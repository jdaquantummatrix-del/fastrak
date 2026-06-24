import { test, expect } from "vitest";
import {
  saveDraft,
  restoreDraft,
  clearDraft,
  type DraftStorage,
  type FormSnapshot
} from "./form-draft";

// A fake in-memory Web-Storage-shaped store, so the snapshot helper can be unit
// tested with no browser. Mirrors the slice's "fake in-memory storage" criterion.
function fakeStorage(seed: Record<string, string> = {}): DraftStorage & {
  dump(): Record<string, string>;
} {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    dump: () => Object.fromEntries(map)
  };
}

const snap: FormSnapshot = { dr_no: "DR-1", customer_id: "CUST01", lineCount: "2" };

test("saveDraft then restoreDraft round-trips the snapshot", () => {
  const store = fakeStorage();
  saveDraft(store, "dr:new", snap);
  expect(restoreDraft(store, "dr:new")).toEqual(snap);
});

test("restoreDraft returns null when nothing is stored", () => {
  const store = fakeStorage();
  expect(restoreDraft(store, "dr:new")).toBeNull();
});

test("drafts are namespaced per key — one key does not leak into another", () => {
  const store = fakeStorage();
  saveDraft(store, "dr:new", { a: "1" });
  saveDraft(store, "po:new", { b: "2" });
  expect(restoreDraft(store, "dr:new")).toEqual({ a: "1" });
  expect(restoreDraft(store, "po:new")).toEqual({ b: "2" });
});

test("saveDraft overwrites a previous snapshot for the same key", () => {
  const store = fakeStorage();
  saveDraft(store, "dr:new", { dr_no: "DR-1" });
  saveDraft(store, "dr:new", { dr_no: "DR-2", customer_id: "C2" });
  expect(restoreDraft(store, "dr:new")).toEqual({ dr_no: "DR-2", customer_id: "C2" });
});

test("clearDraft removes the stored snapshot (clears on successful save)", () => {
  const store = fakeStorage();
  saveDraft(store, "dr:new", snap);
  clearDraft(store, "dr:new");
  expect(restoreDraft(store, "dr:new")).toBeNull();
});

test("clearDraft only removes the targeted key", () => {
  const store = fakeStorage();
  saveDraft(store, "dr:new", { a: "1" });
  saveDraft(store, "po:new", { b: "2" });
  clearDraft(store, "dr:new");
  expect(restoreDraft(store, "dr:new")).toBeNull();
  expect(restoreDraft(store, "po:new")).toEqual({ b: "2" });
});

test("the stored value lives under a namespaced storage key, not the bare key", () => {
  const store = fakeStorage();
  saveDraft(store, "dr:new", snap);
  const keys = Object.keys(store.dump());
  expect(keys).toHaveLength(1);
  expect(keys[0]).not.toBe("dr:new");
  expect(keys[0]).toContain("dr:new");
});

test("restoreDraft tolerates a corrupt / non-JSON stored value by returning null", () => {
  const store = fakeStorage();
  // Write garbage directly under the namespaced key the helper would use.
  store.setItem("fastrak.draft.dr:new", "{not valid json");
  expect(restoreDraft(store, "dr:new")).toBeNull();
});

test("restoreDraft returns null for a JSON value that is not an object of strings", () => {
  const store = fakeStorage();
  store.setItem("fastrak.draft.dr:new", JSON.stringify(["a", "b"]));
  expect(restoreDraft(store, "dr:new")).toBeNull();
  store.setItem("fastrak.draft.po:new", JSON.stringify({ a: 1, b: true }));
  expect(restoreDraft(store, "po:new")).toBeNull();
});

test("an empty snapshot is treated as no draft (nothing worth restoring)", () => {
  const store = fakeStorage();
  saveDraft(store, "dr:new", {});
  expect(restoreDraft(store, "dr:new")).toBeNull();
  // and it should not leave a stale key behind
  expect(Object.keys(store.dump())).toHaveLength(0);
});

test("saveDraft drops blank fields so a snapshot of only-empty values is no draft", () => {
  const store = fakeStorage();
  saveDraft(store, "dr:new", { dr_no: "  ", customer_id: "", remarks: "" });
  expect(restoreDraft(store, "dr:new")).toBeNull();
});

test("saveDraft keeps non-blank fields and trims surrounding the meaningful ones", () => {
  const store = fakeStorage();
  saveDraft(store, "dr:new", { dr_no: "DR-9", remarks: "  ", customer_id: "C1" });
  expect(restoreDraft(store, "dr:new")).toEqual({ dr_no: "DR-9", customer_id: "C1" });
});

test("a throwing storage (e.g. quota / disabled) does not crash save or restore", () => {
  const boom: DraftStorage = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("quota");
    },
    removeItem: () => {
      throw new Error("denied");
    }
  };
  expect(() => saveDraft(boom, "dr:new", snap)).not.toThrow();
  expect(restoreDraft(boom, "dr:new")).toBeNull();
  expect(() => clearDraft(boom, "dr:new")).not.toThrow();
});
