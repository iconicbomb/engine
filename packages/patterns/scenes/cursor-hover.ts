// Cursor system fixture: a giant arrow travels to card 1 (hover fill), on to card 2 (card 1 reverts, card 2 fills),
// pauses 150 ms and presses; card 2 dips to 0.96 with the press; each card's rows wipe in left -> right via clip.w.
// Spec timing: move 400–600 ms (500), pause 150 ms before press, press 80 ms, fill 130 ms, rows 300 ms / 40 ms stagger.
import { applyEdits, cursorClick, giantCursor, group, hoverFillCard, jumpCuts, pressTimes, sec, tiltedPlane, type NodeIn, type TrackIn } from "../src/index";

const TOKENS = { bg: "#0B0D12", text: "#FFFFFF", accent: "#FF8A3D", surface: "#1A1D26", font: "Inter" };

function card(n: number, x: number, label: string): NodeIn {
  const id = `b1-cards-${n}`;
  const rows = [0, 1].map((r): NodeIn => ({
    id: `${id}-row-${r + 1}`, type: "rect", w: 300 - r * 80, h: 18, radius: 9, fill: "#FFFFFF59",
    x: r ? -(r * 80) / 2 : 0, y: 30 + r * 40,      // (avoid -0: JSON writes it as 0)
    clip: { x: -(300 - r * 80) / 2, y: -9, w: 0, h: 18 },
    tracks: [{ mode: "tween", prop: "clip.w", at: sec(0.2 + (n - 1) * 0.07 + r * 0.04), ms: 300, from: 0, to: 300 - r * 80, ease: "settle" }],
  }));
  const tracks: TrackIn[] = [{ mode: "onHover", cursor: "b1-cursor", prop: "fill", to: "tokens.accent", ms: 130, ease: "settle" }];
  return { id, type: "rect", w: 420, h: 260, radius: 28, fill: "tokens.surface", x, tracks,
    children: [{ id: `${id}-label`, type: "text", text: label, style: { size: 48, weight: 600 }, y: -50 }, ...rows] };
}

export function buildCursorHover() {
  const cards = [card(1, -250, "Starter"), card(2, 250, "Pro")];
  // the press lands on card 2: it dips with the cursor (explicit tracks, latest started wins)
  (cards[1] as { tracks: TrackIn[] }).tracks.push(
    { mode: "tween", prop: "scale", at: 2.05, ms: 40, from: 1, to: 0.96, ease: "settle" },
    { mode: "tween", prop: "scale", at: 2.09, ms: 120, from: 0.96, to: 1, ease: "settle" },
  );
  const stack = group({ id: "b1-cards", anchor: { x: 0.5, y: 0.45, overrides: { "9:16": { x: 0.5, y: 0.45, scale: 0.6 } } } }, cards);
  const cursor: NodeIn = {
    id: "b1-cursor", type: "cursor", style: "arrow", size: 2,
    anchor: { x: 0.82, y: 0.85, overrides: { "9:16": { x: 0.8, y: 0.85 } } },
    tracks: [
      { mode: "moveTo", target: "b1-cards-1", at: 0.4, ms: 500, ease: "emphasis" },
      { mode: "moveTo", target: "b1-cards-2", at: 1.4, ms: 500, ease: "emphasis" },
      { mode: "press", at: 2.05, ms: 80 },                       // 150 ms after arriving at 1.9
    ],
  };
  return {
    version: 1,
    canvas: { aspect: "16:9", refHeight: 1080, fps: 30 },
    tokens: TOKENS,
    beats: [{ id: "b1", type: "feature", start: 0, duration: 2.6, script: "Pick a plan", nodes: applyEdits([stack, cursor], []), glows: [] }],
  };
}

// S3 demo: an avatar cursor visits a Pros card, then a Cons card; each fills on hover and wipes its rows in
export function buildS3Demo() {
  const pros = hoverFillCard({ id: "b1-pros", cursor: "b1-avatar", enterAt: 0.3, w: 520, h: 360, x: -290,
    title: "Pros", rows: ["Ships in a day", "No-code editor", "Native exports"] });
  const cons = hoverFillCard({ id: "b1-cons", cursor: "b1-avatar", enterAt: 1.3, w: 520, h: 360, x: 290,
    title: "Cons", rows: ["Fewer templates", "Beta API"], hoverFill: "#E5484D" });
  const stack = group({ id: "b1-cards", anchor: { x: 0.5, y: 0.45, overrides: { "9:16": { x: 0.5, y: 0.45, scale: 0.52 } } } },
    [...pros.nodes, ...cons.nodes]);
  const avatar: NodeIn = { id: "b1-avatar", type: "cursor", style: "avatar", size: 1.6,
    anchor: { x: 0.85, y: 0.88, overrides: { "9:16": { x: 0.8, y: 0.85, scale: 0.6 } } } };   // match the cards' portrait scale
  return {
    version: 1,
    canvas: { aspect: "16:9", refHeight: 1080, fps: 30 },
    tokens: TOKENS,
    beats: [{ id: "b1", type: "feature", start: 0, duration: 2.6, script: "Pros and cons", nodes: applyEdits([stack, avatar], [pros, cons]), glows: [] }],
  };
}

// S5 demo: a settings panel; the giant cursor clicks "Connect", then "Apply" — hover background, pause, press dip
export function buildS5Demo() {
  const button = (id: string, label: string, x: number, fill: string): NodeIn => ({
    id, type: "rect", w: 120, h: 72, radius: 18, fill, x, y: 90, sizeToContent: { padX: 36, padY: 16 },
    children: [{ id: `${id}-label`, type: "text", text: label, style: { size: 34, weight: 600 } }],
  });
  const panel: NodeIn = {
    id: "b1-panel", type: "rect", w: 760, h: 380, radius: 32, fill: "tokens.surface",
    anchor: { x: 0.5, y: 0.45, overrides: { "9:16": { x: 0.5, y: 0.45, scale: 0.72 } } },
    children: [
      { id: "b1-panel-title", type: "text", text: "Slack workspace", style: { size: 44, weight: 600 }, y: -90 },
      button("b1-panel-connect", "Connect", -150, "#2A2F3D"),
      button("b1-panel-apply", "Apply", 160, "#2A2F3D"),
    ],
  };
  const cursor = giantCursor({ id: "b1-cursor", anchor: { x: 0.8, y: 0.88, overrides: { "9:16": { x: 0.75, y: 0.8, scale: 0.72 } } } });
  const connect = cursorClick({ cursor: "b1-cursor", target: "b1-panel-connect", at: 0.3, hover: { to: "#3A4152" } });
  const apply = cursorClick({ cursor: "b1-cursor", target: "b1-panel-apply", at: 1.2, hover: { to: "tokens.accent" } });
  return {
    version: 1,
    canvas: { aspect: "16:9", refHeight: 1080, fps: 30 },
    tokens: TOKENS,
    beats: [{ id: "b1", type: "feature", start: 0, duration: 2.6, script: "Connect Slack", nodes: applyEdits([panel, cursor], [connect, apply]), glows: [] }],
  };
}

// S4 demo (camera fixture): wide on the cards -> at the first click, a 300 ms push into a close-up on card 1 ->
// at the second click, a hard cut back to wide. Cuts land on the cursor's press times (cut on action).
export function buildS4Demo() {
  const cards = [card(1, -250, "Starter"), card(2, 250, "Pro")];
  const stack = group({ id: "b1-cards", anchor: { x: 0.5, y: 0.45, overrides: { "9:16": { x: 0.5, y: 0.45, scale: 0.6 } } } }, cards);
  const cursor = giantCursor({ id: "b1-cursor", anchor: { x: 0.82, y: 0.85, overrides: { "9:16": { x: 0.8, y: 0.85, scale: 0.7 } } } });
  const clickStarter = cursorClick({ cursor: "b1-cursor", target: "b1-cards-1", at: 0.3, hover: false });
  const clickPro = cursorClick({ cursor: "b1-cursor", target: "b1-cards-2", at: 1.6, hover: false });
  const [press1, press2] = pressTimes([clickStarter, clickPro], "b1-cursor");
  const cuts = jumpCuts({ shots: [
    { at: 0, target: "b1-cards", size: "wide" },
    { at: press1, target: "b1-cards-1", size: "close", ms: 300 },
    { at: press2, target: "b1-cards", size: "wide" },
  ] });
  return {
    version: 1,
    canvas: { aspect: "16:9", refHeight: 1080, fps: 30 },
    tokens: TOKENS,
    beats: [{ id: "b1", type: "feature", start: 0, duration: 3.0, script: "Starter or Pro", nodes: applyEdits([stack, cursor], [clickStarter, clickPro]),
      glows: [], camera: { tracks: cuts.camera } }],
  };
}

// S10 demo: a rebuilt dashboard on a tilted plane that eases in, dollies and pans; the cursor clicks a stat card on
// the plane (moveTo resolves the tilted geometry from the measure pass)
export function buildS10Demo() {
  const stat = (n: number, label: string, value: string): NodeIn => ({
    id: `b1-ui-stat-${n}`, type: "rect", w: 300, h: 150, radius: 22, fill: "#22273A",
    children: [
      { id: `b1-ui-stat-${n}-label`, type: "text", text: label, style: { size: 28, weight: 500, color: "#8A90A0" }, y: -30 },
      { id: `b1-ui-stat-${n}-value`, type: "text", text: value, style: { size: 54, weight: 700 }, y: 26 },
    ] });
  const ui: NodeIn[] = [
    { id: "b1-ui-panel", type: "rect", w: 1120, h: 640, radius: 36, fill: "#161A26", stroke: { color: "#2C3140", width: 2 } },
    { id: "b1-ui-title", type: "text", text: "Revenue", style: { size: 48, weight: 700, align: "left" }, x: -500, y: -250 },
    { ...group({ id: "b1-ui-stats", layout: { type: "row", gap: 30 } }, [stat(1, "MRR", "$84k"), stat(2, "Churn", "1.8%"), stat(3, "NPS", "62")]), y: -70 } as NodeIn,
    { id: "b1-ui-chart", type: "path", d: "M -500 220 C -380 120 -300 200 -180 150 S 20 40 140 90 S 360 -10 500 30", stroke: "tokens.accent", strokeWidth: 6,
      trim: { start: 0, end: 0 }, tracks: [{ mode: "tween", prop: "trim.end", at: 0.6, ms: 900, from: 0, to: 1, ease: "settle" }] },
  ];
  const plane = tiltedPlane({ id: "b1-ui", children: ui, at: 0.1, until: 3.0, pan: { x: -60 },
    // the pan is in parent px (not scaled with the plane), so portrait leaves room for it
    anchor: { x: 0.5, y: 0.5, overrides: { "9:16": { x: 0.55, y: 0.5, scale: 0.42 } } } });
  const cursor = giantCursor({ id: "b1-cursor", anchor: { x: 0.85, y: 0.9, overrides: { "9:16": { x: 0.8, y: 0.85, scale: 0.6 } } } });
  const click = cursorClick({ cursor: "b1-cursor", target: "b1-ui-stat-2", at: 1.2, hover: { to: "#33395A" } });
  return {
    version: 1,
    canvas: { aspect: "16:9", refHeight: 1080, fps: 30 },
    tokens: TOKENS,
    beats: [{ id: "b1", type: "feature", start: 0, duration: 3.0, script: "Your numbers, live", nodes: applyEdits([...plane.nodes, cursor], [click]), glows: [] }],
  };
}
