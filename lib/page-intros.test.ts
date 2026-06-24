import { test, expect } from "vitest";
import {
  pageIntros,
  getPageIntro,
  introStepFor,
  FLOW_STEPS
} from "./page-intros";

// The everyday flow, from CONTEXT.md, in order. The intros explain where each
// module sits along it, so onboarding tells the same story everywhere.
test("the flow is PO -> Inventory -> DR -> A/R -> Collection", () => {
  expect(FLOW_STEPS).toEqual([
    "/po",
    "/inventory",
    "/dr",
    "/ar",
    "/collections"
  ]);
});

test("every intro has a title, a what-it-is-for line and a where-in-the-flow line", () => {
  const entries = Object.entries(pageIntros);
  expect(entries.length).toBeGreaterThan(0);
  for (const [key, intro] of entries) {
    expect(intro.title, `title for ${key}`).toBeTruthy();
    expect(intro.whatFor, `whatFor for ${key}`).toBeTruthy();
    expect(intro.whereInFlow, `whereInFlow for ${key}`).toBeTruthy();
    // One line each — no embedded newlines.
    expect(intro.whatFor.includes("\n"), `whatFor for ${key} single-line`).toBe(false);
    expect(intro.whereInFlow.includes("\n"), `whereInFlow for ${key} single-line`).toBe(false);
  }
});

test("every module on the PO->DR->A/R->Collection flow has an intro", () => {
  for (const key of FLOW_STEPS) {
    const intro = getPageIntro(key);
    expect(intro, `intro for ${key}`).not.toBeNull();
  }
});

test("getPageIntro resolves a full path down to its section", () => {
  // A deep route (e.g. the DR create form) still finds the DR module intro.
  const deep = getPageIntro("/dr/new");
  const root = getPageIntro("/dr");
  expect(deep).not.toBeNull();
  expect(deep).toBe(root);
});

test("getPageIntro returns null for an unknown module", () => {
  expect(getPageIntro("/definitely-not-a-module")).toBeNull();
});

test("the dashboard carries a welcome intro", () => {
  const home = getPageIntro("/");
  expect(home).not.toBeNull();
  expect(home?.title).toBeTruthy();
});

test("introStepFor builds an opening tour step that spotlights the heading", () => {
  const step = introStepFor("/dr");
  expect(step).not.toBeNull();
  expect(step?.title).toBe(pageIntros["/dr"].title);
  // Body combines what-it-is-for and where-in-the-flow.
  expect(step?.body).toContain(pageIntros["/dr"].whatFor);
  expect(step?.body).toContain(pageIntros["/dr"].whereInFlow);
  // Module pages spotlight their <h1>.
  expect(step?.selector).toBe("h1");
});

test("introStepFor on the dashboard has no h1 spotlight", () => {
  const step = introStepFor("/");
  expect(step).not.toBeNull();
  expect(step?.selector).toBeUndefined();
});

test("introStepFor returns null for a section with no intro", () => {
  // Reference lists (e.g. /units) carry no module intro; the tour falls back.
  expect(introStepFor("/units")).toBeNull();
});

test("each flow intro mentions the flow vocabulary so the story stays consistent", () => {
  // Onboarding consistency: every document-flow intro situates itself in the
  // PO -> DR -> A/R -> Collection chain, not in isolation.
  const flowWords = /\b(purchase order|po|delivery receipt|dr|receivable|a\/r|collection|stock|inventory)\b/i;
  for (const key of FLOW_STEPS) {
    const intro = getPageIntro(key)!;
    expect(
      flowWords.test(intro.whereInFlow),
      `whereInFlow for ${key} references the flow`
    ).toBe(true);
  }
});
