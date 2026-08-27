// Internship Monitor — Übersicht desktop widget (light theme, collapsible via round arrow)
import { run } from "uebersicht";

const FEED_URL = "https://raw.githubusercontent.com/liapaark-code/internship-monitor/main/data/status.json";
const DASHBOARD_PATH = "$HOME/internship-monitor/widget/dashboard.html";
const openDashboard = () => run(`open "${DASHBOARD_PATH}"`);

export const command = `curl -s --max-time 10 "${FEED_URL}"`;
export const refreshFrequency = 5 * 60 * 1000; // 5 minutes

export const initialState = { output: "", collapsed: false };
export const updateState = (event, previousState) => {
  switch (event.type) {
    case "UB/COMMAND_RAN": return { ...previousState, output: event.output };
    case "TOGGLE_COLLAPSE": return { ...previousState, collapsed: !previousState.collapsed };
    default: return previousState;
  }
};

export const className = `
  top: 24px;
  left: 24px;
  width: 340px;
  font-family: -apple-system, "SF Pro Text", Helvetica, sans-serif;
  color: #1d1d1f;
  z-index: 1;
`;

const glass = {
  background: "rgba(244, 247, 255, 0.94)",
  border: "1px solid #c9d5f7",
  WebkitBackdropFilter: "blur(24px) saturate(150%)",
  backdropFilter: "blur(24px) saturate(150%)",
  boxShadow: "0 18px 40px -20px rgba(29,78,216,0.25), inset 0 1px 0 rgba(255,255,255,0.8)",
};

const S = {
  card: { ...glass, position: "relative", borderRadius: 18, padding: "16px 18px", cursor: "pointer" },
  pill: { ...glass, position: "relative", borderRadius: 999, padding: "10px 44px 10px 16px",
    width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
  arrow: (centered) => ({
    position: "absolute",
    right: 12,
    ...(centered ? { top: "50%", transform: "translateY(-50%)" } : { top: 10 }),
    width: 22, height: 22, lineHeight: "20px", textAlign: "center",
    fontSize: 13, fontWeight: 700, color: "#1D4ED8",
    background: "#e8edff", border: "1px solid #d0daff", borderRadius: "50%",
    cursor: "pointer", userSelect: "none",
  }),
  pillName: { fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#1d1d1f" },
  pillStat: { fontSize: 11, fontWeight: 700, color: "#1D4ED8" },
  h1: { fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", margin: 0, color: "#1d1d1f", paddingRight: 26 },
  sub: { fontSize: 10.5, color: "#6e6e73", marginTop: 2 },
  tiles: { display: "flex", gap: 8, marginTop: 12 },
  tile: { flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: 12,
    background: "#e8edff", border: "1px solid #d0daff" },
  num: { fontSize: 22, fontWeight: 800, color: "#1D4ED8", lineHeight: 1.1 },
  numOpen: { fontSize: 22, fontWeight: 800, color: "#1d1d1f", lineHeight: 1.1 },
  k: { fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", color: "#8e8e93", textTransform: "uppercase" },
  row: { marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e5e7" },
  chip: (color, bg, border) => ({ display: "inline-block", fontSize: 8.5, fontWeight: 800,
    letterSpacing: "0.08em", color, background: bg, border: `1px solid ${border}`,
    borderRadius: 999, padding: "2px 8px", marginBottom: 4 }),
  title: { fontSize: 12.5, fontWeight: 650, color: "#1d1d1f", textDecoration: "none", display: "block" },
  meta: { fontSize: 10.5, color: "#6e6e73", marginTop: 1 },
  co: { color: "#1D4ED8", fontWeight: 700 },
  foot: { fontSize: 9.5, color: "#8e8e93", marginTop: 12 },
  err: { fontSize: 11, color: "#8a6d1a", marginTop: 10, lineHeight: 1.45 },
};

const CHIPS = {
  new: ["NEW", "#126b40", "#f0faf4", "#b8d9be"],
  reopened: ["REOPENED", "#1D4ED8", "#dbe4ff", "#d0daff"],
  title_changed: ["TITLE CHANGED", "#8a6d1a", "#fdf7e7", "#e6d59a"],
};

export const render = ({ output, collapsed }, dispatch) => {
  let feed = null;
  try { feed = JSON.parse(output); } catch (e) { /* not ready yet */ }

  const toggle = (ev) => { ev.stopPropagation(); dispatch({ type: "TOGGLE_COLLAPSE" }); };

  if (collapsed) {
    const open = feed && feed.counts ? feed.counts.open : "–";
    const fresh = feed && feed.counts ? feed.counts.new24h : "–";
    return (
      <div style={S.pill} onClick={toggle} title="Expand">
        <span style={S.pillName}>INTERNSHIP MONITOR</span>
        <span style={S.pillStat}>{open} open</span>
        <span style={S.pillStat}>· {fresh} new</span>
        <div style={S.arrow(true)} onClick={toggle} title="Expand">▸</div>
      </div>
    );
  }

  const events = feed && feed.counts ? (feed.recentEvents || []).slice(0, 4) : [];
  const updated = feed && feed.counts
    ? new Date(feed.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div style={S.card} onClick={openDashboard} title="Open dashboard">
      <div style={S.arrow(false)} onClick={toggle} title="Collapse">▾</div>
      <h1 style={S.h1}>INTERNSHIP MONITOR</h1>
      <div style={S.sub}>Product Design · Summer 2027{feed && feed.counts ? ` · ${feed.companiesMonitored} companies` : ""}</div>

      {!feed || !feed.counts ? (
        <div style={S.err}>Waiting for feed… (it appears after the first GitHub Action run).</div>
      ) : (
        <div>
          <div style={S.tiles}>
            <div style={S.tile}><div style={S.numOpen}>{feed.counts.open}</div><div style={S.k}>Open</div></div>
            <div style={S.tile}><div style={S.num}>{feed.counts.new24h}</div><div style={S.k}>New 24h</div></div>
            <div style={S.tile}><div style={S.num}>{feed.counts.summer2027}</div><div style={S.k}>2027</div></div>
          </div>

          {events.length === 0 && (
            <div style={S.row}><div style={S.meta}>No alerts yet — monitoring is active.</div></div>
          )}
          {events.map((e, i) => {
            const [label, color, bg, border] = CHIPS[e.type] || ["UPDATE", "#6e6e73", "#eef2ff", "#d0daff"];
            return (
              <div style={S.row} key={i}>
                <span style={S.chip(color, bg, border)}>{label}</span>
                <a style={S.title} href={e.url} onClick={(ev) => ev.stopPropagation()}>{e.title}</a>
                <div style={S.meta}><span style={S.co}>{e.company}</span> · {e.location || "See posting"}</div>
              </div>
            );
          })}

          <div style={S.foot}>Updated {updated} · click card → dashboard</div>
        </div>
      )}
    </div>
  );
};