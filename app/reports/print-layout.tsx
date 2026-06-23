// S11 — shared print layout for fastrak's documents/reports (ADR-0003).
// Slice-owned. A light wrapper that gives every printable document a consistent
// company header (pulled from lib/company), a title block, and a print-friendly
// stylesheet: white page, black ink, a button to print, and an @media print rule
// that hides the on-screen chrome so the browser's Print / Save-as-PDF output is
// clean. The app's dark globals.css still loads, so these styles deliberately
// reset to a paper look and are scoped under `.print-doc`.
import type { Company } from "@/lib/company";

// The print CSS, scoped to .print-doc so it overrides the dark globals only on
// these report pages. Kept inline (a styled-jsx-free string in a <style> tag)
// so the layout is a self-contained server component with no client JS.
const PRINT_CSS = `
.print-doc {
  --paper: #ffffff;
  --paper-ink: #111111;
  --paper-muted: #555555;
  --paper-line: #cccccc;
  background: var(--paper);
  color: var(--paper-ink);
  font-family: var(--sans);
  max-width: 820px;
  margin: 24px auto;
  padding: 36px 40px;
  border: 1px solid var(--paper-line);
  border-radius: 8px;
  line-height: 1.4;
}
.print-doc a { color: inherit; }
.print-doc .doc-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}
.print-doc .doc-actions a,
.print-doc .doc-actions button {
  font: inherit;
  font-size: 13px;
  padding: 6px 14px;
  border: 1px solid var(--paper-line);
  border-radius: 6px;
  background: #f3f4f6;
  color: var(--paper-ink);
  cursor: pointer;
  text-decoration: none;
}
.print-doc .doc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid var(--paper-ink);
  padding-bottom: 12px;
  margin-bottom: 18px;
}
.print-doc .doc-company-name { font-size: 20px; font-weight: 700; margin: 0; }
.print-doc .doc-company-meta { font-size: 12px; color: var(--paper-muted); margin: 2px 0 0; }
.print-doc .doc-title-block { text-align: right; }
.print-doc .doc-title { font-size: 16px; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 0.04em; }
.print-doc .doc-subtitle { font-size: 12px; color: var(--paper-muted); margin: 2px 0 0; }
.print-doc table { width: 100%; border-collapse: collapse; font-size: 13px; color: var(--paper-ink); }
.print-doc th, .print-doc td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--paper-line);
  vertical-align: top;
}
.print-doc thead th {
  border-bottom: 1.5px solid var(--paper-ink);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--paper-muted);
  font-weight: 700;
}
.print-doc tbody tr:hover { background: transparent; }
.print-doc .num { text-align: right; font-variant-numeric: tabular-nums; }
.print-doc .doc-meta { display: flex; flex-wrap: wrap; gap: 6px 28px; font-size: 13px; margin-bottom: 16px; }
.print-doc .doc-meta div { min-width: 140px; }
.print-doc .doc-meta .label { color: var(--paper-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
.print-doc .totals { margin-top: 14px; margin-left: auto; width: 320px; }
.print-doc .totals td { border-bottom: none; padding: 4px 10px; }
.print-doc .totals .grand td { border-top: 1.5px solid var(--paper-ink); font-weight: 700; padding-top: 8px; }
.print-doc tfoot td { border-top: 1.5px solid var(--paper-ink); font-weight: 700; }
.print-doc .low { font-weight: 700; }
.print-doc .empty { color: var(--paper-muted); font-style: italic; }

@media print {
  body { background: #ffffff; }
  .print-doc {
    margin: 0;
    max-width: none;
    border: none;
    border-radius: 0;
    padding: 0;
  }
  .print-doc .doc-actions { display: none; }
}
`;

// A self-contained Print button. The click is wired to window.print() by a tiny
// inline script at the end of PrintLayout, so this stays a server component (no
// "use client"). The button is hidden in @media print.
function PrintActions({ backHref }: { backHref?: string }) {
  return (
    <div className="doc-actions">
      <button type="button" data-print="1">
        Print / Save as PDF
      </button>
      {backHref ? <a href={backHref}>← Back</a> : null}
    </div>
  );
}

export type PrintLayoutProps = {
  company: Company | null;
  title: string;
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
};

// Wrap a document body in the shared print frame: inject the print stylesheet,
// render the company header (left) + the document title/subtitle (right), then
// the page content. `company` may be null (no company row yet) — we fall back to
// a neutral placeholder so the document still prints.
export function PrintLayout({
  company,
  title,
  subtitle,
  backHref,
  children
}: PrintLayoutProps) {
  return (
    <div className="print-doc">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <PrintActions backHref={backHref} />
      <header className="doc-head">
        <div>
          <p className="doc-company-name">{company?.name ?? "Company"}</p>
          {company?.address ? (
            <p className="doc-company-meta">{company.address}</p>
          ) : null}
          <p className="doc-company-meta">
            {[
              company?.proprietor ? `Prop: ${company.proprietor}` : null,
              company?.tin ? `TIN: ${company.tin}` : null,
              company?.tel_no ? `Tel: ${company.tel_no}` : null
            ]
              .filter(Boolean)
              .join("  •  ")}
          </p>
        </div>
        <div className="doc-title-block">
          <p className="doc-title">{title}</p>
          {subtitle ? <p className="doc-subtitle">{subtitle}</p> : null}
        </div>
      </header>
      {children}
      {/* Wire the Print button without a client component: a tiny inline script
          binds every [data-print] button on the page to window.print(). Runs
          after hydration; harmless if JS is off (the browser's own Print menu
          still works). */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.querySelectorAll('[data-print]').forEach(function(b){" +
            "b.addEventListener('click',function(){window.print();});});"
        }}
      />
    </div>
  );
}
