// Central per-module page-intro registry for the fastrak onboarding (issue #24 /
// S7). Every module page carries a short two-line intro: what the page is FOR,
// and WHERE it sits in the everyday flow.
//
// Why this exists: new-hire onboarding (the on-demand "Tour this page" guide in
// app/_components/page-tour.tsx) should tell ONE consistent story across all the
// document modules, sourced from a single place — not from copy scattered and
// drifting inside the tour component. The page-tour reads the opening step of
// each guide from here, so the "what it is / where it fits" message stays in
// lock-step everywhere.
//
// The everyday flow (CONTEXT.md):
//   Purchase Order -> Inventory -> Delivery Receipt -> Accounts Receivable -> Collection
// with Returns, discounts and reference data around the edges. FLOW_STEPS pins
// that order so a test can assert every flow module is covered and on-message.
//
// Keys are SECTION paths ("/dr", "/po", ...) — the first path segment. Deep
// routes (e.g. "/dr/new") resolve to their section via getPageIntro(), so the
// create/edit forms inherit the same intro as the list page.

export type PageIntro = {
  // Heading for the intro step (kept short, friendly).
  title: string;
  // One line: what this page is for.
  whatFor: string;
  // One line: where this module sits in the PO -> DR -> A/R -> Collection flow.
  whereInFlow: string;
};

// The everyday document flow, in order. Each of these modules must carry an
// intro that situates it in the chain (see the tests).
export const FLOW_STEPS = ["/po", "/inventory", "/dr", "/ar", "/collections"] as const;

export const pageIntros: Record<string, PageIntro> = {
  "/": {
    title: "Welcome to fastrak 👋",
    whatFor: "Your distribution business, online — sales, stock, customers and money in one place.",
    whereInFlow:
      "The everyday flow: raise a Purchase Order, receive it into stock, deliver to a customer on a DR, that becomes an A/R, and a Collection settles it."
  },

  // --- The document flow, in order ---
  "/po": {
    title: "Purchase Orders",
    whatFor: "How you order stock from your suppliers, with the items, quantities and costs.",
    whereInFlow:
      "The start of the flow: receive a Purchase Order and the goods land in your Inventory, ready to sell on a Delivery Receipt."
  },
  "/inventory": {
    title: "Stock",
    whatFor: "Live stock on hand per item, plus every movement in and out.",
    whereInFlow:
      "The middle of the flow: stock rises when you receive a Purchase Order and falls when you Post a Delivery Receipt."
  },
  "/dr": {
    title: "Delivery Receipts",
    whatFor: "The sale itself — the goods handed to a customer. Every sale starts here.",
    whereInFlow:
      "The heart of the flow: Posting a Delivery Receipt lowers stock and creates the customer's A/R, which a Collection later settles."
  },
  "/ar": {
    title: "Accounts Receivable",
    whatFor: "Everything customers owe you, with balances and aging. You never key these by hand.",
    whereInFlow:
      "Downstream of the flow: an A/R appears when you Post a Delivery Receipt and drops when you record a Collection."
  },
  "/collections": {
    title: "Collections",
    whatFor: "Where you record customer payments against what they owe.",
    whereInFlow:
      "The end of the flow: a Collection applies a payment to a customer's A/R from a Posted Delivery Receipt."
  },

  // --- Around the edges of the flow ---
  "/returns": {
    title: "Returns",
    whatFor: "Record goods a customer sends back, and whether they're resalable.",
    whereInFlow:
      "A reversal in the flow: resalable lines go back into stock and the customer's A/R is credited for the return."
  },
  "/items": {
    title: "Items",
    whatFor: "Your product catalog — codes, units and prices (cost, selling, retail).",
    whereInFlow:
      "Reference data the flow leans on: items are what you order on a PO, hold in stock, and sell on a Delivery Receipt."
  },
  "/customers": {
    title: "Customers",
    whatFor: "Everyone you sell to — name, terms, address and TIN.",
    whereInFlow:
      "Set up before the flow: a customer must exist before you can raise a Delivery Receipt or track their A/R."
  },
  "/suppliers": {
    title: "Suppliers",
    whatFor: "Everyone you buy from.",
    whereInFlow:
      "Set up before the flow: a supplier must exist before you can raise a Purchase Order against them."
  },
  "/reports": {
    title: "Reports",
    whatFor: "Printable statements and documents — A/R statements and stock reports.",
    whereInFlow:
      "A read-only view across the flow: it summarises your A/R and stock, it doesn't change them."
  },
  "/settings": {
    title: "Settings",
    whatFor: "Your company details and app defaults — these print on your documents.",
    whereInFlow:
      "Outside the flow: company name and address appear on Delivery Receipts and reports."
  }
};

// Resolve the intro for a path. A full route ("/dr/new") falls back to its
// section ("/dr"), so create/edit forms inherit the module intro. Returns null
// when no intro is registered for the section.
export function getPageIntro(pathname: string): PageIntro | null {
  if (pageIntros[pathname]) return pageIntros[pathname];
  if (pathname === "/") return pageIntros["/"] ?? null;
  const section = "/" + (pathname.split("/")[1] || "");
  return pageIntros[section] ?? null;
}

// One opening tour step (title + combined body + spotlight selector) for the
// page guide, built from the registry. The on-demand "Tour this page" walkthrough
// in app/_components/page-tour.tsx leads with this, so the what-it-is-for /
// where-in-the-flow message is generated in ONE place. Returns null for sections
// with no registered intro (those fall back to the tour's generic opener).
export type IntroStep = { title: string; body: string; selector?: string };
export function introStepFor(pathname: string): IntroStep | null {
  const intro = getPageIntro(pathname);
  if (!intro) return null;
  return {
    title: intro.title,
    body: `${intro.whatFor} ${intro.whereInFlow}`,
    // The dashboard has no module <h1> worth spotlighting; everywhere else the
    // page heading is the natural anchor for the intro.
    selector: pathname === "/" ? undefined : "h1"
  };
}
