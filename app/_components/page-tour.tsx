"use client";

// Product tour & on-demand help.
//
//  • PAGE GUIDE  — a short, animated spotlight walkthrough of what a page is for and
//    where it sits in the workflow. Auto-shows once per browser on first visit; the
//    "?" button replays it; a toggle stops auto-showing.
//  • FORM HELP   — field-by-field guidance, shown ONLY when asked (the "?" menu →
//    "How to fill this form"). Built live from the form's own labels, so it works on
//    every form without per-page markup.
//
// "seen" + "enabled" live in localStorage → per-browser. No per-user accounts yet
// (shared-password auth, ADR-0004); when real accounts land, move this to the user
// record so it follows them across devices.

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { getFieldHint } from "@/lib/field-hints";
import { introStepFor } from "@/lib/page-intros";

type Step = { title: string; body: string; selector?: string };
type RStep = Step & { el?: HTMLElement | null };

// ── Page guides (the extra spotlight steps that come AFTER the per-module intro).
// The opening "what this page is for / where it fits in the flow" step is NOT
// hardcoded here — it's built from the shared page-intro registry (lib/page-intros.ts,
// issue #24 / S7) by introStep() below, so onboarding tells one consistent story
// across modules. These entries are the page-specific spotlights layered on top.
const GUIDES: Record<string, Step[]> = {
  "/": [
    {
      title: "Everything's in the sidebar",
      body: "Grouped by Sales, Inventory, Contacts, Reports and Setup. Click any section to open it.",
      selector: ".sidebar"
    },
    {
      title: "Your headline numbers",
      body: "Outstanding receivables, posted sales, and catalog size at a glance. Click a card to drill in.",
      selector: ".card"
    },
    {
      title: "Help is always here",
      body: "Tap the ? button any time to replay a page's guide or get field-by-field help on a form — and switch off auto-tips whenever you like.",
      selector: ".tour-fab"
    }
  ],
  "/dr": [
    {
      title: "Create one",
      body: "Choose the customer, then add item lines — each with quantity, unit and price.",
      selector: "a[href$='/new']"
    },
    {
      title: "Your DRs live here",
      body: "Each one stays a draft until you open it and Post it.",
      selector: "table"
    },
    {
      title: "Posting does the bookkeeping",
      body: "Posting automatically lowers stock and creates the customer's receivable (A/R). Cancelling reverses both — unless a payment was already recorded against it."
    }
  ],
  "/ar": [
    {
      title: "Balances & aging",
      body: "What each customer owes, and how overdue it is (current vs 30 / 60 / 90+ days late).",
      selector: "table"
    },
    {
      title: "Getting paid",
      body: "When a customer pays, record it in Collections — the balance here drops automatically."
    }
  ],
  "/collections": [
    {
      title: "Record a payment",
      body: "Pick the customer, see their open receivables, and apply the payment across them.",
      selector: "a[href$='/new']"
    },
    {
      title: "The maths is handled",
      body: "A collection can't overpay a receivable or touch another customer's — the app keeps the money straight for you."
    }
  ],
  "/returns": [
    {
      title: "Resalable vs not",
      body: "Tick the lines that are still resalable — those go back into stock — and the customer's A/R is credited for the return's value."
    }
  ],
  "/items": [
    {
      title: "Add a product",
      body: "Create an item here and tag its category, brand and supplier.",
      selector: "a[href$='/new']"
    },
    {
      title: "Tip: set up first",
      body: "Add your Units, Categories and Brands under Setup first, so they're ready to pick on the item form."
    }
  ],
  "/inventory": [
    {
      title: "It stays honest",
      body: "Stock rises when you Receive a Purchase Order and falls when you Post a Delivery Receipt — so it always matches reality."
    }
  ],
  "/po": [
    {
      title: "Raise an order",
      body: "Pick a supplier and add the items and quantities you're ordering, with costs.",
      selector: "a[href$='/new']"
    },
    {
      title: "Receiving adds stock",
      body: "When the goods arrive, open the PO and Receive it — the quantities go straight into your inventory.",
      selector: "table"
    }
  ],
  "/customers": [
    {
      title: "Add a customer",
      body: "Capture name, payment terms, address and TIN — the same fields fastrak uses.",
      selector: "a[href$='/new']"
    },
    {
      title: "Then you can sell to them",
      body: "Once a customer exists you can raise Delivery Receipts for them and track what they owe."
    }
  ],
  "/suppliers": [
    {
      title: "Why add them",
      body: "Suppliers let you raise Purchase Orders and receive stock against them."
    }
  ],
  "/reports": [
    {
      title: "Save as PDF",
      body: "Open one and use your browser's Print (Ctrl/Cmd-P). The sidebar is hidden automatically for a clean page."
    }
  ],
  "/settings": [
    {
      title: "These print on documents",
      body: "Company name, address and the like appear on Delivery Receipts and reports — keep them accurate."
    }
  ]
};

const DEFAULT: Step[] = [
  {
    title: "Setup list",
    body: "A reference list — like Units, Categories or Brands.",
    selector: "h1"
  },
  {
    title: "Add once, reuse everywhere",
    body: "Add the values here; they then appear as options when you create Items and other records."
  }
];

// The full page-guide for a section: the registry-built intro first (from
// lib/page-intros.ts, so onboarding copy lives in ONE place), then the
// page-specific spotlight steps from GUIDES. Reference lists with no registered
// intro fall back to DEFAULT's own opener.
function buildGuideSteps(key: string): Step[] {
  const intro = introStepFor(key);
  const rest = GUIDES[key] ?? DEFAULT;
  return intro ? [intro, ...rest] : rest;
}

// ── On-demand form help ──────────────────────────────────────────────────────
// Field guidance comes FIRST from the shared S6 hint registry (lib/field-hints.ts),
// looked up by the input's `name` — so the walk-me-through-this-form tour and the
// inline hints under each field tell the exact same thing (issue #24 / S7). The
// label-regex table below is only a fallback for inputs not in the registry, so
// the tour still says something sensible on any form, registered or not.
const FIELD_HINTS: [RegExp, string][] = [
  [/\bname\b/i, "The name as it should appear on documents."],
  [/term/i, "Payment terms in days — e.g. 30 means due 30 days after the receipt."],
  [/address/i, "Street address; this prints on documents."],
  [/contact/i, "Who to reach at this company."],
  [/mobile|tel|phone|fax/i, "A contact number."],
  [/\btin\b/i, "Tax Identification Number, for official receipts."],
  [/code|sku/i, "Your internal code for this item."],
  [/desc/i, "A clear description — this shows on documents."],
  [/unit|pack/i, "The unit it's counted in (e.g. BOX, PCS) and how many per pack."],
  [/retail|selling|price|base|cost|amount/i, "A peso amount — numbers only, decimals allowed."],
  [/qty|quantity/i, "How many — whole numbers."],
  [/date/i, "Pick a date."],
  [/categ|brand|supplier|customer|salesman|warehouse|item/i, "Choose from the list. Missing one? Add it under Setup first."],
  [/disc/i, "A percentage, e.g. 5 for 5%."],
  [/remark|note/i, "Optional free text."],
  [/type/i, "A short label you use to group these records."]
];
function hintFor(label: string): string {
  for (const [re, h] of FIELD_HINTS) if (re.test(label)) return h;
  return "Fill this in.";
}

// The body text for one field's tour step. Prefer the S6 registry entry (by the
// input's `name`), including its worked example; fall back to the label-regex.
// ADR-0006: hints describe what a field MEANS — at Save everything is lenient, so
// even a `required` input only gets a gentle "needed before you can Post" nudge.
function fieldBody(name: string, label: string, required: boolean): string {
  const reg = name ? getFieldHint(name, formContextForPath()) : null;
  let body = reg?.hint ?? hintFor(label);
  if (reg?.example) body += ` For example: ${reg.example}.`;
  body += required ? " You'll need this before you can Post." : " (Optional.)";
  return body;
}

// Map the current section to the form-context used by the S6 registry so a
// document-specific override (e.g. a DR vs PO date) wins where one is registered.
function formContextForPath(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const seg = window.location.pathname.split("/")[1];
  return seg || undefined;
}

function buildFormSteps(): RStep[] {
  if (typeof document === "undefined") return [];
  const labels = Array.from(
    document.querySelectorAll("main form label")
  ) as HTMLElement[];
  const out: RStep[] = [];
  for (const lab of labels) {
    let input = lab.querySelector("input, select, textarea") as HTMLElement | null;
    const forId = lab.getAttribute("for");
    if (!input && forId) input = document.getElementById(forId);
    if (!input) continue;
    if ((input as HTMLInputElement).type === "hidden") continue;
    const labelEl = lab.querySelector(".field-label, span") ?? lab;
    const text = (labelEl.textContent || "").replace(/\s+/g, " ").replace(/\*+$/, "").trim();
    if (!text) continue;
    const name = input.getAttribute("name") || "";
    const required = input.hasAttribute("required");
    out.push({
      title: text,
      body: fieldBody(name, text, required),
      el: input
    });
  }
  const submit = document.querySelector(
    "main form button[type='submit'], main form .btn-primary"
  ) as HTMLElement | null;
  if (submit)
    out.push({
      title: "Save it",
      body: "When everything looks right, click here — you'll go back to the list with your new entry.",
      el: submit
    });
  return out;
}

const MICONS: Record<string, string> = {
  play: '<polygon points="6 4 19 12 6 20 6 4"/>',
  form: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>'
};
function Ico({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: MICONS[name] ?? "" }}
    />
  );
}

const ENABLED_KEY = "fastrak_tour_enabled";
const SEEN_KEY = "fastrak_tour_seen";
function sectionKey(path: string): string {
  if (path === "/") return "/";
  return "/" + (path.split("/")[1] || "");
}
function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function PageTour() {
  const pathname = usePathname() || "/";
  const key = sectionKey(pathname);

  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<"page" | "form">("page");
  const [steps, setSteps] = useState<RStep[]>([]);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [menu, setMenu] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => setMounted(true), []);

  const startPage = useCallback(() => {
    setMode("page");
    setSteps(buildGuideSteps(key).map((s) => ({ ...s })));
    setStep(0);
    setMenu(false);
    setActive(true);
  }, [key]);

  const startForm = useCallback(() => {
    const built = buildFormSteps();
    setMenu(false);
    if (!built.length) return;
    setMode("form");
    setSteps(built);
    setStep(0);
    setActive(true);
  }, []);

  // Auto-start the PAGE guide on a new section — after a beat, so the page has
  // settled in (its own fade-in finishes), which makes the tour feel like it leads in.
  useEffect(() => {
    if (pathname === "/login") return;
    const en = localStorage.getItem(ENABLED_KEY);
    const on = en === null ? true : en === "1";
    setEnabled(on);
    setActive(false);
    setMenu(false);
    if (on && !readSeen().includes(key)) {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => startPage(), 380);
      return () => window.clearTimeout(timer.current);
    }
  }, [key, pathname, startPage]);

  const reposition = useCallback(() => {
    const cur = steps[step];
    if (!cur) return setRect(null);
    const el =
      cur.el ??
      (cur.selector ? (document.querySelector(cur.selector) as HTMLElement | null) : null);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [steps, step]);

  useEffect(() => {
    if (!active) return;
    const cur = steps[step];
    const el =
      cur?.el ??
      (cur?.selector ? (document.querySelector(cur.selector) as HTMLElement | null) : null);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(reposition, 90);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [active, step, reposition, steps]);

  const finish = useCallback(() => {
    if (mode === "page") {
      const seen = readSeen();
      if (!seen.includes(key)) {
        seen.push(key);
        localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
      }
    }
    setActive(false);
    setRect(null);
  }, [mode, key]);

  const setEnabledPersist = (v: boolean) => {
    setEnabled(v);
    localStorage.setItem(ENABLED_KEY, v ? "1" : "0");
  };

  if (!mounted || pathname === "/login") return null;

  const cur = steps[step];
  const last = step + 1 >= steps.length;
  const hasForm =
    typeof document !== "undefined" && !!document.querySelector("main form");

  // Place the card below the target if there's room; otherwise centre it.
  let popStyle: CSSProperties = {};
  let centered = false;
  if (active && rect && typeof window !== "undefined") {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const left = Math.min(Math.max(rect.left, 16), W - 336);
    if (H - rect.bottom > 210) popStyle = { top: rect.bottom + 14, left };
    else centered = true;
  } else if (active) {
    centered = true;
  }

  return (
    <>
      <button
        className="tour-fab"
        aria-label="Help and guides"
        title="Help & guides"
        onClick={() => setMenu((m) => !m)}
      >
        ?
      </button>

      {menu && !active ? (
        <div className="tour-menu" role="menu">
          <button onClick={startPage}>
            <Ico name="play" /> Tour this page
          </button>
          {hasForm ? (
            <button onClick={startForm}>
              <Ico name="form" /> How to fill this form
            </button>
          ) : null}
          <div className="sep" />
          <label className="tour-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabledPersist(e.target.checked)}
              style={{ width: "auto" }}
            />
            Auto-show tips on new pages
          </label>
        </div>
      ) : null}

      {active && cur ? (
        <>
          <div className={"tour-layer" + (rect ? "" : " dim")} />
          {rect ? (
            <div
              className="tour-spot"
              style={{
                top: rect.top - 6,
                left: rect.left - 6,
                width: rect.width + 12,
                height: rect.height + 12
              }}
            />
          ) : null}
          <div className={"tour-pop" + (centered ? " center" : "")} style={popStyle}>
            <div className="kicker" style={{ marginBottom: 4 }}>
              {mode === "form" ? "Filling this form" : "Quick guide"}
            </div>
            <h4>{cur.title}</h4>
            <p>{cur.body}</p>
            <div className="tour-foot">
              <button className="tour-skip" onClick={finish}>
                {last ? "Close" : "Skip"}
              </button>
              <span className="tour-dots">
                {step + 1} / {steps.length}
              </span>
              <div className="tour-actions">
                {step > 0 ? (
                  <button className="btn btn-sm" onClick={() => setStep((s) => s - 1)}>
                    Back
                  </button>
                ) : null}
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => (last ? finish() : setStep((s) => s + 1))}
                >
                  {last ? "Got it" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
