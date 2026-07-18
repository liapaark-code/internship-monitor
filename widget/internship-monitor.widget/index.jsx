// Internship Monitor — Übersicht desktop widget (glass / dark blue / high contrast)
// ─────────────────────────────────────────────────────────────────────────────
// SETUP (2 steps):
//   1. Install Übersicht (free): https://tracesof.net/uebersicht/
//   2. Copy this folder (internship-monitor.widget) into your Übersicht
//      widgets folder, then edit FEED_URL below to point at your feed:
//      - local run:  file path is fine → set USE_LOCAL_FILE and LOCAL_PATH
//      - GitHub Actions: https://raw.githubusercontent.com/<you>/<repo>/main/data/status.json

const FEED_URL = "https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/data/status.json";
const USE_LOCAL_FILE = false; // true if the monitor runs on this Mac
const LOCAL_PATH = "$HOME/internship-monitor/data/status.json";

export const command = USE_LOCAL_FILE
  ? `cat "${LOCAL_PATH}" 2>/dev/null`
  : `curl -s --max-time 10 "${FEED_URL}"`;

export const refreshFrequency = 5 * 60 * 1000; // 5 minutes

export const className = `
  top: 24px;
  right: 24px;
  width: 340px;
  font-family: -apple-system, "SF Pro Text", Helvetica, sans-serif;
  color: #f2f7ff;
  z-index: 1;
`;

const S = {
  card: {
    background: "rgba(8, 22, 51, 0.62)",
    border: "1px solid rgba(122,170,255,0.28)",
    borderRadius: 18,
    padding: "16px 18px",
    WebkitBackdropFilter: "blur(24px) saturate(150%)",
    backdropFilter: "blur(24px) saturate(150%)",
    boxShadow: "0 12px 40px rgba(2,8,25,0.55), inset 0 1px 0 rgba(180,215,255,0.14)",
  },
  h1: { fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", margin: 0, color: "#f2f7ff" },
  sub: { fontSize: 10.5, color: "#b9cdf2", marginTop: 2 },
  tiles: { display: "flex", gap: 8, marginTop: 12 },
  tile: {
    flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 12,
    background: "rgba(18,40,86,0.5)", border: "1px solid rgba(122,170,255,0.2)",
  },
  num: { fontSize: 22, fontWeight: 800, color: "#7ff0ff", lineHeight: 1.1 },
  numOpen: { fontSize: 22, fontWeight: 800, color: "#f2f7ff", lineHeight: 1.1 },
  k: { fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", color: "#7d95c4", textTransform: "uppercase" },
  row: { marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(122,170,255,0.15)" },
  chip: (color, bg, border) => ({
    display: "inline-block", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em",
    color, background: bg, border: `1px solid ${border}`,
    borderRadius: 999, padding: "2px 8px", marginBottom: 4,
  }),
  title: { fontSize: 12.5, fontWeight: 650, color: "#f2f7ff", textDecoration: "none", display: "block" },
  meta: { fontSize: 10.5, color: "#b9cdf2", marginTop: 1 },
  co: { color: "#66b3ff", fontWeight: 700 },
  foot: { fontSize: 9.5, color: "#7d95c4", marginTop: 12 },
  err: { fontSize: 11, color: "#ffd166", marginTop: 10, lineHeight: 1.45 },
};

const CHIPS = {
  new: ["NEW", "#35e08d", "rgba(53,224,141,0.12)", "rgba(53,224,141,0.4)"],
  reopened: ["REOPENED", "#5ab8ff", "rgba(90,184,255,0.12)", "rgba(90,184,255,0.4)"],
  title_changed: ["TITLE CHANGED", "#ffd166", "rgba(255,209,102,0.12)", "rgba(255,209,102,0.4)"],
};

export const render = ({ output }) => {
  let feed = null;
  try { feed = JSON.parse(output); } catch (e) { /* not ready yet */ }

  if (!feed || !feed.counts) {
    return (
      <div style={S.card}>
        <h1 style={S.h1}>INTERNSHIP MONITOR</h1>
        <div style={S.sub}>Product Design · Summer 2027</div>
        <div style={S.err}>
          Waiting for feed… Edit FEED_URL inside
          internship-monitor.widget/index.jsx (point it at your status.json).
        </div>
      </div>
    );
  }

  const events = (feed.recentEvents || []).slice(0, 4);
  const updated = new Date(feed.generatedAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <div style={S.card}>
      <h1 style={S.h1}>INTERNSHIP MONITOR</h1>
      <div style={S.sub}>Product Design · Summer 2027 · {feed.companiesMonitored} companies</div>

      <div style={S.tiles}>
        <div style={S.tile}><div style={S.numOpen}>{feed.counts.open}</div><div style={S.k}>Open</div></div>
        <div style={S.tile}><div style={S.num}>{feed.counts.new24h}</div><div style={S.k}>New 24h</div></div>
        <div style={S.tile}><div style={S.num}>{feed.counts.summer2027}</div><div style={S.k}>2027</div></div>
      </div>

      {events.length === 0 && (
        <div style={S.row}>
          <div style={S.meta}>No alerts yet — monitoring is active.</div>
        </div>
      )}
      {events.map((e, i) => {
        const [label, color, bg, border] = CHIPS[e.type] || ["UPDATE", "#b9cdf2", "rgba(122,170,255,0.12)", "rgba(122,170,255,0.4)"];
        return (
          <div style={S.row} key={i}>
            <span style={S.chip(color, bg, border)}>{label}</span>
            <a style={S.title} href={e.url}>{e.title}</a>
            <div style={S.meta}><span style={S.co}>{e.company}</span> · {e.location || "See posting"}</div>
          </div>
        );
      })}

      <div style={S.foot}>Updated {updated} · refreshes every 5 min</div>
    </div>
  );
};
