"use client";

// First-run product tour. The first time a browser visits a page/section it gets a
// short spotlight walkthrough of what that page is for. After that it never auto-shows
// again (tracked in localStorage). A floating "?" button replays the current page's
// guide anytime, and a toggle stops auto-showing on new pages.
//
// NOTE: "seen" + "enabled" live in localStorage, so this is per-BROWSER. There are no
// per-user accounts yet (shared-password auth, ADR-0004); when real users land, move
// this state onto the user record so it follows them across devices.

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Step = { title: string; body: string; selector?: string };

// Each "section" (first path segment) has a short guide. Steps may point at a generic
// selector that already exists on the page (no per-page markup needed); a step with no
// resolvable target just shows centered.
const GUIDES: Record<string, Step[]> = {
  "/": [
    {
      title: "Welcome to fastrak 👋",
      body: "This is your dashboard — a quick read on what's outstanding and what's moving. Here's a 20-second tour."
    },
    {
      title: "Everything's in the sidebar",
      body: "Sales, inventory, contacts, reports and setup all live on the left. Click any section to jump in.",
      selector: ".sidebar"
    },
    {
      title: "Your key numbers",
      body: "These cards show outstanding receivables, posted delivery receipts, and your catalog at a glance. Click a card to open it.",
      selector: ".card"
    },
    {
      title: "Need this again?",
      body: "Click the ? button any time to replay a page's guide — or switch off the auto tips below.",
      selector: ".tour-fab"
    }
  ],
  "/dr": [
    {
      title: "Delivery Receipts",
      body: "A Delivery Receipt (DR) is how you record a sale to a customer. This list shows all of them.",
      selector: "h1"
    },
    {
      title: "Create a DR",
      body: "Start a new one here — pick a customer, add item lines with quantity and price, and save.",
      selector: "a[href$='/new']"
    },
    {
      title: "Post to make it count",
      body: "Open a DR and Post it: that releases stock and creates the customer's receivable (A/R). Cancel reverses both.",
      selector: "table"
    }
  ],
  "/ar": [
    {
      title: "Accounts Receivable",
      body: "What your customers owe you. A receivable appears automatically when you Post a Delivery Receipt — you don't add these by hand.",
      selector: "h1"
    },
    {
      title: "Balances & aging",
      body: "See each customer's outstanding balance and how overdue it is. Record payments over on the Collections page.",
      selector: "table"
    }
  ],
  "/collections": [
    {
      title: "Collections",
      body: "Record a customer's payment here: pick the customer, then apply the amount across their outstanding receivables.",
      selector: "h1"
    },
    {
      title: "It updates A/R for you",
      body: "Each collection reduces that customer's balance automatically — it can't overpay a receivable or touch another customer's.",
      selector: "a[href$='/new']"
    }
  ],
  "/returns": [
    {
      title: "Returns",
      body: "Record goods a customer sends back. Resalable items go back into stock, and the customer's A/R is credited for the value.",
      selector: "h1"
    }
  ],
  "/items": [
    {
      title: "Items",
      body: "Your product catalog — codes, units and prices (cost, selling, retail). Everything you sell or stock is here.",
      selector: "h1"
    },
    {
      title: "Add a product",
      body: "Create an item here and set its category, brand, supplier and prices.",
      selector: "a[href$='/new']"
    }
  ],
  "/inventory": [
    {
      title: "Stock",
      body: "Current stock per item plus the movement history. Stock rises when you receive a Purchase Order and falls when you post a DR.",
      selector: "h1"
    }
  ],
  "/po": [
    {
      title: "Purchase Orders",
      body: "Order stock from suppliers here. When the goods arrive, Receive the PO to add them into inventory.",
      selector: "h1"
    },
    {
      title: "Raise an order",
      body: "Create a PO here — pick a supplier and add the items you're ordering with quantities and costs.",
      selector: "a[href$='/new']"
    }
  ],
  "/customers": [
    {
      title: "Customers",
      body: "Everyone you sell to. Add a customer here, then you can raise Delivery Receipts and track what they owe.",
      selector: "h1"
    },
    {
      title: "Add a customer",
      body: "Capture name, payment terms, address and TIN — the same fields fastrak uses.",
      selector: "a[href$='/new']"
    }
  ],
  "/suppliers": [
    {
      title: "Suppliers",
      body: "Everyone you buy from. Add suppliers here so you can raise Purchase Orders against them.",
      selector: "h1"
    }
  ],
  "/reports": [
    {
      title: "Reports",
      body: "Printable statements and documents — A/R statements and stock reports. Use your browser's Print to save a PDF.",
      selector: "h1"
    }
  ],
  "/settings": [
    {
      title: "Settings",
      body: "Your company details and app defaults — these print on documents like Delivery Receipts.",
      selector: "h1"
    }
  ]
};

const DEFAULT: Step[] = [
  {
    title: "Setup list",
    body: "A reference list (units, categories, brands). Add values here so they're ready to choose when you create items.",
    selector: "h1"
  }
];

const ENABLED_KEY = "kenny_tour_enabled";
const SEEN_KEY = "kenny_tour_seen";

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
  const steps = GUIDES[key] ?? DEFAULT;

  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => setMounted(true), []);

  // Decide whether to auto-start when the section changes.
  useEffect(() => {
    if (pathname === "/login") return;
    const en = localStorage.getItem(ENABLED_KEY);
    const on = en === null ? true : en === "1";
    setEnabled(on);
    setStep(0);
    setActive(on && !readSeen().includes(key));
  }, [key, pathname]);

  // Position the spotlight on the current step's target.
  const reposition = useCallback(() => {
    const sel = steps[step]?.selector;
    const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [steps, step]);

  useEffect(() => {
    if (!active) return;
    const sel = steps[step]?.selector;
    const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null;
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(reposition, 80);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [active, step, reposition, steps]);

  const finish = useCallback(() => {
    const seen = readSeen();
    if (!seen.includes(key)) {
      seen.push(key);
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    }
    setActive(false);
    setRect(null);
  }, [key]);

  const setEnabledPersist = (v: boolean) => {
    setEnabled(v);
    localStorage.setItem(ENABLED_KEY, v ? "1" : "0");
    if (!v) finish();
  };

  if (!mounted || pathname === "/login") return null;

  const cur = steps[step];
  const last = step + 1 >= steps.length;

  // Tooltip placement: under the target if there's room, else above; centered if no target.
  let popStyle: React.CSSProperties = {};
  let centered = false;
  if (active && rect) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const left = Math.min(Math.max(rect.left, 16), W - 336);
    if (H - rect.bottom > 200) popStyle = { top: rect.bottom + 14, left };
    else if (rect.top > 220) popStyle = { top: rect.top - 14, left, transform: "translateY(-100%)" };
    else { centered = true; }
  } else if (active) {
    centered = true;
  }

  return (
    <>
      <button
        className="tour-fab"
        title="Show the guide for this page"
        aria-label="Show page guide"
        onClick={() => {
          setStep(0);
          setActive(true);
        }}
      >
        ?
      </button>

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
            <h4>{cur.title}</h4>
            <p>{cur.body}</p>
            <div className="tour-foot">
              <button className="tour-skip" onClick={finish}>
                {last ? "" : "Skip"}
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
            <label className="tour-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabledPersist(e.target.checked)}
                style={{ width: "auto" }}
              />
              Show tips automatically on new pages
            </label>
          </div>
        </>
      ) : null}
    </>
  );
}
