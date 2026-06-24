import { test, expect } from "vitest";
import {
  fieldHints,
  getFieldHint,
  fieldHintsNeedingKennard
} from "./field-hints";

test("every registry entry has a non-empty one-line hint", () => {
  const entries = Object.entries(fieldHints);
  expect(entries.length).toBeGreaterThan(0);
  for (const [name, hint] of entries) {
    expect(hint.hint, `hint for ${name}`).toBeTruthy();
    // One line: no embedded newlines.
    expect(hint.hint.includes("\n"), `hint for ${name} is single-line`).toBe(false);
  }
});

test("getFieldHint returns the base hint for a known field", () => {
  const got = getFieldHint("tin");
  expect(got).not.toBeNull();
  expect(got?.hint).toBeTruthy();
});

test("getFieldHint returns null for an unknown field", () => {
  expect(getFieldHint("definitely_not_a_field")).toBeNull();
});

test("phone and TIN fields carry an example format", () => {
  for (const name of ["tin", "mobile", "tel_no", "fax_no"]) {
    const got = getFieldHint(name);
    expect(got, `hint for ${name}`).not.toBeNull();
    expect(got?.example, `example for ${name}`).toBeTruthy();
  }
});

test("a form-context override wins over the base hint", () => {
  // `date` means different things on a DR vs a PO; context selects the wording.
  const base = getFieldHint("date");
  const onDr = getFieldHint("dr_date", "dr");
  expect(onDr).not.toBeNull();
  // The DR date hint should not be the generic fallback.
  expect(onDr?.hint).not.toBe(base?.hint ?? "");
});

test("hints needing Kennard confirmation are flagged and discoverable", () => {
  const flagged = fieldHintsNeedingKennard();
  expect(flagged.length).toBeGreaterThan(0);
  for (const name of flagged) {
    expect(fieldHints[name]?.needsKennard).toBe(true);
  }
});
