/* DevTools mockup — UI components + canned data. Exports to window for the app script. */
const { useState, useRef, useEffect } = React;

/* ----------------------------- icons ----------------------------- */
const I = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.sw || 1.7}
  strokeLinecap="round" strokeLinejoin="round" width={p.s || 18} height={p.s || 18} className={p.className}>{p.children}</svg>;

const IconProtobuf = (p) => <I {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><rect x="9" y="9" width="6" height="6" rx="1" /></I>;
const IconBytes = (p) => <I {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M8 5v14" /></I>;
const IconClock = (p) => <I {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></I>;
const IconJwt = (p) => <I {...p}><path d="M9 4H7a3 3 0 0 0-3 3v1a2 2 0 0 1-1 1.7 2 2 0 0 1 1 1.7V12a3 3 0 0 0 3 3h2M15 4h2a3 3 0 0 0 3 3v1a2 2 0 0 0 1 1.7 2 2 0 0 0-1 1.7V12a3 3 0 0 0-3 3h-2" /></I>;
const IconHash = (p) => <I {...p}><path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" /></I>;
const IconId = (p) => <I {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h2v4H7zM12 10v4M16 10h1v4h-1" /></I>;
const IconSearch = (p) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></I>;
const IconCopy = (p) => <I {...p} s={p.s || 14}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></I>;
const IconCheck = (p) => <I {...p} s={p.s || 14}><path d="m20 6-11 11-5-5" /></I>;
const IconChevron = (p) => <I {...p} s={p.s || 14} sw={2}><path d="m6 9 6 6 6-6" /></I>;
const IconLock = (p) => <I {...p} s={p.s || 13}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></I>;
const IconBookmark = (p) => <I {...p}><path d="M6 4h12v16l-6-4-6 4z" /></I>;
const IconReturn = (p) => <I {...p} s={p.s || 13} sw={2}><path d="M9 10 5 14l4 4M5 14h10a4 4 0 0 0 4-4V6" /></I>;

/* ----------------------------- tools ----------------------------- */
const TOOLS = [
  { id: "protobuf", name: "Protobuf Decoder", desc: "Decode wire format without a schema", Icon: IconProtobuf, hero: true },
  { id: "bytes", name: "Base64 / Hex / Bytes", desc: "text ⇄ base64 ⇄ hex", Icon: IconBytes },
  { id: "unix", name: "Unix Time Converter", desc: "Convert UNIX dates to human-readable", Icon: IconClock },
  { id: "jwt", name: "JWT Debugger", desc: "Decode & inspect JWT tokens", Icon: IconJwt },
  { id: "hash", name: "Hash Generator", desc: "MD5 / SHA-1 / SHA-256 …", Icon: IconHash },
  { id: "uuid", name: "UUID / ULID", desc: "Generate & validate identifiers", Icon: IconId },
];

/* ----------------------------- sample payload ----------------------------- */
// real, decodable: {1:150, 2:"testing", 3:{1:150}, 4:1.0f, 5:1.0d}
const HEX = "08 96 01 12 07 74 65 73 74 69 6e 67 1a 03 08 96 01 25 00 00 80 3f 29 00 00 00 00 00 00 f0 3f";

const FIELDS = [
  {
    id: "f1", field: 1, wire: "varint", bytes: "08 96 01", len: 2,
    interps: [
      { k: "uint", v: "150" }, { k: "int", v: "150" }, { k: "sint", v: "75" }, { k: "bool", v: "true" },
    ], sel: "uint",
  },
  {
    id: "f2", field: 2, wire: "len", bytes: "12 07 · 74 65 73 74 69 6e 67", len: 7,
    interps: [
      { k: "string", v: "\"testing\"" }, { k: "bytes", v: "74 65 73 74 69 6e 67" }, { k: "message", v: "✕ not a clean parse" },
    ], sel: "string",
  },
  {
    id: "f3", field: 3, wire: "len", bytes: "1a 03 · 08 96 01", len: 3,
    interps: [
      { k: "message", v: "{ 1 field }" }, { k: "string", v: "✕ invalid UTF-8" }, { k: "bytes", v: "08 96 01" },
    ], sel: "message",
    children: [
      { id: "f3c1", field: 1, wire: "varint", bytes: "08 96 01", len: 2,
        interps: [{ k: "uint", v: "150" }, { k: "int", v: "150" }, { k: "sint", v: "75" }, { k: "bool", v: "true" }], sel: "uint" },
    ],
  },
  {
    id: "f4", field: 4, wire: "i32", bytes: "25 · 00 00 80 3f", len: 4,
    interps: [{ k: "float", v: "1.0" }, { k: "u32", v: "1065353216" }, { k: "i32", v: "1065353216" }], sel: "float",
  },
  {
    id: "f5", field: 5, wire: "i64", bytes: "29 · 00 00 00 00 00 00 f0 3f", len: 8,
    interps: [{ k: "double", v: "1.0" }, { k: "u64", v: "4607182418800017408" }, { k: "i64", v: "4607182418800017408" }], sel: "double",
  },
];

/* ----------------------------- copy button ----------------------------- */
function CopyBtn({ text, mode }) {
  const [done, setDone] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    try { navigator.clipboard.writeText(text); } catch (_) {}
    setDone(true); setTimeout(() => setDone(false), 1100);
  };
  if (mode === "inline")
    return <button className="copy-inline" onClick={copy}>{done ? "copied" : "copy"}</button>;
  return (
    <button className={"copy-btn " + (mode === "always" ? "is-always" : "is-hover")} onClick={copy} title="Copy">
      {done ? <IconCheck /> : <IconCopy />}
    </button>
  );
}

/* ----------------------------- type chips ----------------------------- */
function TypeChips({ f, sel, onSel }) {
  return (
    <div className="chips">
      {f.interps.map((it) => (
        <button key={it.k} className={"chip" + (sel === it.k ? " on" : "")}
          onClick={() => onSel(f.id, it.k)} disabled={it.v.startsWith("✕")}>{it.k}</button>
      ))}
    </div>
  );
}

/* ----------------------------- field node (cards / rows) ----------------------------- */
function FieldNode({ f, selMap, onSel, copyMode, depth = 0 }) {
  const sel = selMap[f.id] || f.sel;
  const chosen = f.interps.find((i) => i.k === sel) || f.interps[0];
  const isMsg = f.wire === "len" && sel === "message" && f.children;
  return (
    <div className={"field d" + depth}>
      <div className="field-head">
        <span className="fnum">#{f.field}</span>
        <span className="wire">{f.wire}</span>
        <span className="meta">{f.len} byte{f.len === 1 ? "" : "s"}</span>
        <span className="field-bytes">{f.bytes}</span>
        <CopyBtn text={chosen.v.replace(/^"|"$/g, "")} mode={copyMode} />
      </div>
      <TypeChips f={f} sel={sel} onSel={onSel} />
      {isMsg ? (
        <div className="submsg">
          {f.children.map((c) => (
            <FieldNode key={c.id} f={c} selMap={selMap} onSel={onSel} copyMode={copyMode} depth={depth + 1} />
          ))}
        </div>
      ) : (
        <div className={"val" + (chosen.v.startsWith("✕") ? " bad" : "")}>{chosen.v}</div>
      )}
    </div>
  );
}

/* ----------------------------- json view ----------------------------- */
function jsonLines(fields, selMap, indent = 1) {
  let out = [];
  fields.forEach((f, idx) => {
    const sel = selMap[f.id] || f.sel;
    const chosen = f.interps.find((i) => i.k === sel) || f.interps[0];
    const comma = idx < fields.length - 1 ? "," : "";
    const pad = "  ".repeat(indent);
    if (f.wire === "len" && sel === "message" && f.children) {
      out.push({ pad, key: f.field, val: "{", type: f.wire, open: true });
      out = out.concat(jsonLines(f.children, selMap, indent + 1));
      out.push({ pad, val: "}" + comma, close: true });
    } else {
      out.push({ pad, key: f.field, val: chosen.v + comma, type: f.wire + " · " + sel });
    }
  });
  return out;
}
function JsonView({ selMap }) {
  const lines = jsonLines(FIELDS, selMap);
  return (
    <div className="json">
      <div className="jline"><span className="jbrace">{"{"}</span></div>
      {lines.map((l, i) => (
        <div className="jline" key={i}>
          <span>{l.pad}</span>
          {l.key != null && <span className="jkey">{l.key}</span>}
          {l.key != null && <span className="jcolon">: </span>}
          <span className={l.open || l.close ? "jbrace" : "jval"}>{l.val}</span>
          {l.type && <span className="jtype">  // {l.type}</span>}
        </div>
      ))}
      <div className="jline"><span className="jbrace">{"}"}</span></div>
    </div>
  );
}

/* ----------------------------- decoded panel ----------------------------- */
function Decoded({ tree, selMap, onSel, copyMode }) {
  return (
    <section className="pane decoded-pane">
      <div className="pane-top">
        <span className="pane-label">Decoded fields</span>
        <CopyBtn text={"decoded protobuf"} mode={copyMode === "inline" ? "always" : copyMode} />
      </div>
      <div className={"decoded scroll tree-" + tree}>
        {tree === "json"
          ? <JsonView selMap={selMap} />
          : FIELDS.map((f) => <FieldNode key={f.id} f={f} selMap={selMap} onSel={onSel} copyMode={copyMode} />)}
      </div>
    </section>
  );
}

/* ----------------------------- input panel ----------------------------- */
function InputPanel({ copyMode }) {
  return (
    <section className="pane input-pane">
      <div className="pane-top">
        <span className="pane-label">Input</span>
        <div className="examples">
          <button className="ex on">nested message</button>
          <button className="ex">jwt payload</button>
          <button className="ex">packed repeated</button>
        </div>
      </div>
      <div className="hexbox scroll">
        <div className="hexgrid">
          {HEX.split(" ").map((b, i) => <span className="byte" key={i}>{b}</span>)}
          <span className="caret" />
        </div>
      </div>
      <div className="input-foot">
        <span>{HEX.split(" ").length} bytes</span>
        <CopyBtn text={HEX} mode={copyMode === "inline" ? "always" : copyMode} />
      </div>
    </section>
  );
}

/* ----------------------------- sidebar ----------------------------- */
function Sidebar({ active, onPick, mode, premium }) {
  return (
    <aside className={"sidebar mode-" + (mode || "full")}>
      <div className="search">
        <IconSearch s={16} className="search-i" />
        <input placeholder="Search tools…" readOnly />
        <kbd>⌘/</kbd>
      </div>
      <nav className="navlist">
        {TOOLS.map((t) => (
          <button key={t.id} className={"navitem" + (active === t.id ? " on" : "")}
            onClick={() => onPick(t.id)} title={mode === "icons" ? t.name : ""}>
            <span className="navbar-accent" />
            <t.Icon s={mode === "icons" ? 19 : 18} className="navicon" />
            <span className="navtext">
              <span className="navname">{t.name}</span>
              <span className="navdesc">{t.desc}</span>
            </span>
          </button>
        ))}
      </nav>
      {premium && (
        <div className="pro-block">
          <div className="pro-head"><span>Workspaces</span><span className="pro-pill"><IconLock /> Pro</span></div>
          <button className="navitem pro" disabled>
            <IconBookmark s={18} className="navicon" />
            <span className="navtext"><span className="navname">Saved sessions</span><span className="navdesc">Pin payloads & history</span></span>
          </button>
        </div>
      )}
    </aside>
  );
}

/* ----------------------------- command palette ----------------------------- */
const PALETTE_ITEMS = [
  { g: "Tools", items: TOOLS.map((t) => ({ id: t.id, name: t.name, Icon: t.Icon, hint: "" })) },
  { g: "Actions", items: [
    { id: "copy", name: "Copy decoded result", Icon: IconCopy, hint: "⌘C" },
    { id: "fmt", name: "Switch input format → base64", Icon: IconBytes, hint: "" },
    { id: "theme", name: "Toggle compact density", Icon: IconBytes, hint: "" },
  ] },
];
function Palette({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="palette-scrim" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-search">
          <IconSearch s={18} className="search-i" />
          <input autoFocus placeholder="Type a command or search…" />
          <kbd className="esc">esc</kbd>
        </div>
        <div className="palette-list scroll">
          {PALETTE_ITEMS.map((grp) => (
            <div className="pgroup" key={grp.g}>
              <div className="pglabel">{grp.g}</div>
              {grp.items.map((it, i) => (
                <button key={it.id} className={"pitem" + (grp.g === "Tools" && i === 0 ? " on" : "")}>
                  <it.Icon s={17} className="navicon" />
                  <span className="pname">{it.name}</span>
                  {it.hint && <kbd>{it.hint}</kbd>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="palette-foot">
          <span><IconReturn /> open</span><span>↑↓ navigate</span><span>esc dismiss</span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- status bar ----------------------------- */
function StatusBar({ premium }) {
  return (
    <footer className="statusbar">
      <div className="st-left">
        <span className="st-ok"><span className="dot" /> decoded</span>
        <span className="st-sep" />
        <span>5 fields</span>
        <span className="st-sep" />
        <span>31 bytes</span>
        <span className="st-sep" />
        <span>hex</span>
        <span className="st-sep" />
        <span className="st-time">0.4 ms</span>
      </div>
      <div className="st-right">
        {premium && <span className="st-pro"><IconLock /> Pro</span>}
        <span className="st-kbd"><kbd>⌘K</kbd> commands</span>
      </div>
    </footer>
  );
}

/* ----------------------------- tool header ----------------------------- */
function ToolHeader({ premium, onPalette }) {
  return (
    <header className="toolhead">
      <div className="th-left">
        <h1>Protobuf Decoder</h1>
        <p>Schema-less wire walker · all interpretations kept</p>
      </div>
      <div className="th-right">
        {premium && <button className="proto-btn"><IconLock /> Load .proto<span className="tag">Pro</span></button>}
        <button className="palette-trigger" onClick={onPalette}><kbd>⌘K</kbd></button>
        <button className="fmt">hex <IconChevron /></button>
      </div>
    </header>
  );
}

Object.assign(window, {
  TOOLS, FIELDS, HEX,
  Sidebar, InputPanel, Decoded, Palette, StatusBar, ToolHeader,
  IconProtobuf, IconSearch,
});
