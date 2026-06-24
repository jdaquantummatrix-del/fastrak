"use client";

// Browser auto-save wrapper for the document forms (DR / PO / Return), per ADR-0006.
// Drop this around an existing <form> and it will, in the browser only:
//   * restore the user's in-progress entries when they return in the same browser,
//   * auto-save (debounced) as they type — no "Save as draft" button,
//   * clear the stored draft when the form is successfully submitted,
//   * offer a "Discard draft" action to start fresh.
// It is a thin React shell over the pure helper in lib/form-draft.ts (which holds all
// the serialise/restore/clear logic and the unit tests). This component owns only the
// browser plumbing: the storage handle, the debounce, the DOM read/write, and the
// little "draft restored" banner.
//
// ADR-0006: this is the crash/oops safety net for an UNPOSTED in-progress document. It
// creates no server-side Draft record and has no effect on stock, A/R, or money;
// validation still happens only at Post.
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import {
  saveDraft,
  restoreDraft,
  clearDraft,
  type DraftStorage,
  type FormSnapshot
} from "@/lib/form-draft";

// `window.localStorage` already satisfies DraftStorage; this just guards SSR / blocked
// storage so the component never throws on render.
function browserStorage(): DraftStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

// Read every named control in the form into a flat snapshot. Mirrors what the form
// would submit (FormData), minus the file/binary entries.
function snapshotForm(form: HTMLFormElement): FormSnapshot {
  const snap: FormSnapshot = {};
  const data = new FormData(form);
  for (const [name, value] of data.entries()) {
    if (typeof value === "string") snap[name] = value;
  }
  return snap;
}

// Write a restored value back into a control and let React-controlled inputs notice,
// by setting the value through the native setter and dispatching the matching event.
function applyValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Push a snapshot's values into the form's controls (best-effort, by name).
function fillForm(form: HTMLFormElement, snapshot: FormSnapshot) {
  for (const [name, value] of Object.entries(snapshot)) {
    const el = form.elements.namedItem(name);
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
    ) {
      applyValue(el, value);
    }
  }
}

export function DraftForm({
  draftKey,
  action,
  children
}: {
  // Stable per-form key, e.g. "dr:new" or "po:abc123". One draft per key.
  draftKey: string;
  // The same server action the form would otherwise use.
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [restored, setRestored] = useState(false);

  // On mount: if a draft exists for this key, fill the form and surface the banner.
  useEffect(() => {
    const storage = browserStorage();
    const form = formRef.current;
    if (!storage || !form) return;
    const snap = restoreDraft(storage, draftKey);
    if (snap) {
      fillForm(form, snap);
      setRestored(true);
    }
    // We intentionally restore once, on mount, for this key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Debounced auto-save as the user types or changes any field.
  function scheduleSave() {
    const storage = browserStorage();
    const form = formRef.current;
    if (!storage || !form) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const f = formRef.current;
      if (f) saveDraft(storage, draftKey, snapshotForm(f));
    }, 500);
  }

  // Clear the stored draft once the form is submitted — the draft has become a real
  // (to-be-posted) document. We don't preventDefault: the server action still runs.
  function onSubmit(_e: FormEvent<HTMLFormElement>) {
    const storage = browserStorage();
    if (timer.current) clearTimeout(timer.current);
    if (storage) clearDraft(storage, draftKey);
  }

  // The user's explicit "start fresh": drop the draft and reset the form fields.
  function discard() {
    const storage = browserStorage();
    if (timer.current) clearTimeout(timer.current);
    if (storage) clearDraft(storage, draftKey);
    formRef.current?.reset();
    setRestored(false);
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      onInput={scheduleSave}
      onChange={scheduleSave}
    >
      {restored && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--panel2)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "9px 12px",
            marginBottom: 16,
            fontSize: 13
          }}
        >
          <span style={{ color: "var(--muted)" }}>
            Restored your unsaved draft from this browser.
          </span>
          <button
            type="button"
            onClick={discard}
            style={{
              background: "transparent",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              font: "inherit",
              fontSize: 13,
              padding: "5px 11px",
              cursor: "pointer"
            }}
          >
            Discard draft
          </button>
        </div>
      )}
      {children}
    </form>
  );
}
