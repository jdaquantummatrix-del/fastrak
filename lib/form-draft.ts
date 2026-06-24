// Browser auto-save for in-progress document forms (DR / PO / Return), per ADR-0006:
// auto-save is automatic and browser-only — no "Save as draft" button, no server-side
// draft record. This module is the PURE core of that feature: it serialises a form's
// field values to a snapshot, restores them, and clears them, against a small storage
// interface. It deliberately knows nothing about React, `window`, or `localStorage`, so
// it can be unit-tested with a fake in-memory store (see form-draft.test.ts). The app
// passes the real `window.localStorage`, which already satisfies `DraftStorage`.
//
// In ADR-0006 terms this is the crash/oops safety net for an unposted in-progress
// document; it does NOT create a Draft document on the server and has no effect on
// stock, A/R, or money. Validation still lives entirely at Post.

// The slice of the Web Storage API we depend on. `window.localStorage` is assignable
// to this, and a fake in-memory object is trivial to write for tests.
export type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

// A captured form: field name -> string value (exactly what a form submits). We only
// store strings because that is all an HTML form yields and all we restore.
export type FormSnapshot = Record<string, string>;

// All draft keys share one prefix so they're easy to spot in devtools and never
// collide with anything else the app might keep in storage.
const PREFIX = "fastrak.draft.";

function storageKey(key: string): string {
  return PREFIX + key;
}

// Drop blank / whitespace-only fields. A form full of empty inputs is not a draft
// worth keeping — this keeps us from "restoring" an untouched form and from leaving
// stale keys behind.
function meaningful(snapshot: FormSnapshot): FormSnapshot {
  const out: FormSnapshot = {};
  for (const [name, value] of Object.entries(snapshot)) {
    if (typeof value === "string" && value.trim() !== "") out[name] = value;
  }
  return out;
}

// Serialise and store the form snapshot for `key` (e.g. "dr:new", "po:123"). If the
// snapshot has no meaningful fields, any existing draft is cleared instead of writing
// an empty one. Never throws: if storage is full or disabled, auto-save is best-effort.
export function saveDraft(
  storage: DraftStorage,
  key: string,
  snapshot: FormSnapshot
): void {
  const trimmed = meaningful(snapshot);
  try {
    if (Object.keys(trimmed).length === 0) {
      storage.removeItem(storageKey(key));
      return;
    }
    storage.setItem(storageKey(key), JSON.stringify(trimmed));
  } catch {
    // Storage unavailable (private mode, quota, blocked) — auto-save is a safety net,
    // so a failure here must never break the form.
  }
}

// Read back the snapshot for `key`, or null if there is no usable draft. Tolerates a
// missing key, corrupt JSON, or a value that isn't a flat string map — all of which
// yield null rather than throwing, so a bad entry can never break form restore.
export function restoreDraft(
  storage: DraftStorage,
  key: string
): FormSnapshot | null {
  let raw: string | null;
  try {
    raw = storage.getItem(storageKey(key));
  } catch {
    return null;
  }
  if (raw == null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return null;
  }

  const snapshot: FormSnapshot = {};
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "string") return null;
    snapshot[name] = value;
  }
  return Object.keys(snapshot).length === 0 ? null : snapshot;
}

// Remove the stored draft for `key`. Called on a successful Save (the draft has become
// a real document) and by the user's "Discard draft" action. Never throws.
export function clearDraft(storage: DraftStorage, key: string): void {
  try {
    storage.removeItem(storageKey(key));
  } catch {
    // ignore — see saveDraft
  }
}
