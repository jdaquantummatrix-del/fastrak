// Instant navigation feedback. Next shows this the moment you click a link, while
// the destination (a dynamic, DB-backed page) renders — so moving around never
// feels frozen. The sidebar stays put; only the content area shows this skeleton.
export default function Loading() {
  return (
    <main>
      <div className="route-bar" />
      <div className="page-header">
        <div>
          <div className="skeleton" style={{ width: 84, height: 11, marginBottom: 9 }} />
          <div className="skeleton" style={{ width: 190, height: 24 }} />
        </div>
        <div className="skeleton" style={{ width: 150, height: 36, borderRadius: 8 }} />
      </div>
      <div className="card">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 18,
              padding: "12px 16px",
              borderBottom: i < 7 ? "1px solid var(--line)" : "none"
            }}
          >
            <div className="skeleton" style={{ height: 11, flex: 2 }} />
            <div className="skeleton" style={{ height: 11, flex: 3 }} />
            <div className="skeleton" style={{ height: 11, flex: 1 }} />
            <div className="skeleton" style={{ height: 11, flex: 1 }} />
          </div>
        ))}
      </div>
    </main>
  );
}
