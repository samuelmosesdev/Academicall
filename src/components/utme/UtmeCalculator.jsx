import { useCallback, useEffect, useRef, useState } from "react";
import { X, GripHorizontal } from "lucide-react";

/**
 * The simple on-screen calculator a JAMB CBT centre gives you: digits, the four
 * operations, square root, percent, sign change, memory keys, CE and C.
 * Draggable on desktop, a bottom sheet on phones. Keyboard works while it is open.
 */
const fmt = (n) => {
  if (!Number.isFinite(n)) return "Error";
  const s = Number(n.toPrecision(12)).toString();
  return s.length > 14 ? n.toExponential(8) : s;
};

function apply(a, b, op) {
  switch (op) {
    case "+": return a + b;
    case "−": return a - b;
    case "×": return a * b;
    case "÷": return b === 0 ? NaN : a / b;
    default: return b;
  }
}

export default function UtmeCalculator({ onClose }) {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);
  const [mem, setMem] = useState(0);
  const [trail, setTrail] = useState("");
  const [pos, setPos] = useState(null);
  const drag = useRef(null);
  const box = useRef(null);

  const val = () => parseFloat(display) || 0;

  const digit = useCallback((d) => {
    setDisplay((cur) => {
      if (fresh || cur === "0" || cur === "Error") return d === "." ? "0." : d;
      if (d === "." && cur.includes(".")) return cur;
      if (cur.replace(/[-.]/g, "").length >= 14) return cur;
      return cur + d;
    });
    setFresh(false);
  }, [fresh]);

  const operate = useCallback((next) => {
    const v = parseFloat(display) || 0;
    let res = v;
    if (op && !fresh) res = apply(acc, v, op);
    else if (op && fresh) res = acc; // changing the operator
    setAcc(res);
    setOp(next);
    setDisplay(fmt(res));
    setTrail(`${fmt(res)} ${next}`);
    setFresh(true);
  }, [acc, display, fresh, op]);

  const equals = useCallback(() => {
    if (!op) return;
    const res = apply(acc, parseFloat(display) || 0, op);
    setTrail(`${fmt(acc)} ${op} ${display} =`);
    setDisplay(fmt(res));
    setAcc(null); setOp(null); setFresh(true);
  }, [acc, display, op]);

  const clearAll = () => { setDisplay("0"); setAcc(null); setOp(null); setFresh(true); setTrail(""); };
  const clearEntry = () => { setDisplay("0"); setFresh(true); };
  const back = () => setDisplay((cur) => (fresh || cur.length <= 1 || cur === "Error" ? "0" : cur.slice(0, -1)));
  const sqrt = () => { const v = val(); setTrail(`√(${display})`); setDisplay(fmt(v < 0 ? NaN : Math.sqrt(v))); setFresh(true); };
  const percent = () => { const v = val(); setDisplay(fmt(acc != null && op ? (acc * v) / 100 : v / 100)); setFresh(true); };
  const sign = () => setDisplay((cur) => (cur === "0" ? cur : cur.startsWith("-") ? cur.slice(1) : `-${cur}`));

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      const k = e.key;
      let used = true;
      if (/^[0-9]$/.test(k) || k === ".") digit(k);
      else if (k === "+") operate("+");
      else if (k === "-") operate("−");
      else if (k === "*" || k === "x") operate("×");
      else if (k === "/") operate("÷");
      else if (k === "Enter" || k === "=") equals();
      else if (k === "Backspace") back();
      else if (k === "Escape") onClose?.();
      else if (k === "Delete") clearAll();
      else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  function startDrag(e) {
    if (window.matchMedia("(max-width: 639px)").matches) return;
    const r = box.current.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    const move = (ev) => {
      const x = Math.min(Math.max(8, ev.clientX - drag.current.dx), window.innerWidth - r.width - 8);
      const y = Math.min(Math.max(8, ev.clientY - drag.current.dy), window.innerHeight - r.height - 8);
      setPos({ x, y });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const keys = [
    ["MC", () => setMem(0), "mem"], ["MR", () => { setDisplay(fmt(mem)); setFresh(true); }, "mem"], ["M+", () => { setMem((m) => m + val()); setFresh(true); }, "mem"], ["M−", () => { setMem((m) => m - val()); setFresh(true); }, "mem"],
    ["CE", clearEntry, "fn"], ["C", clearAll, "danger"], ["⌫", back, "fn"], ["÷", () => operate("÷"), "op"],
    ["7", () => digit("7")], ["8", () => digit("8")], ["9", () => digit("9")], ["×", () => operate("×"), "op"],
    ["4", () => digit("4")], ["5", () => digit("5")], ["6", () => digit("6")], ["−", () => operate("−"), "op"],
    ["1", () => digit("1")], ["2", () => digit("2")], ["3", () => digit("3")], ["+", () => operate("+"), "op"],
    ["±", sign, "fn"], ["0", () => digit("0")], [".", () => digit(".")], ["=", equals, "eq"],
    ["√", sqrt, "fn"], ["%", percent, "fn"],
  ];

  return (
    <div
      ref={box}
      className="utme-calc"
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
      role="dialog"
      aria-label="Calculator"
    >
      <div className="utme-calc-head" onPointerDown={startDrag}>
        <GripHorizontal size={15} className="opacity-60" />
        <span>Calculator</span>
        <button type="button" onClick={onClose} className="utme-calc-x" aria-label="Close calculator"><X size={16} /></button>
      </div>
      <div className="utme-calc-screen">
        <div className="utme-calc-trail">{mem !== 0 && <b>M</b>}<span>{trail || "\u00a0"}</span></div>
        <div className="utme-calc-value num">{display}</div>
      </div>
      <div className="utme-calc-keys">
        {keys.map(([label, fn, kind]) => (
          <button key={label} type="button" onClick={fn} className={`utme-key ${kind ? `is-${kind}` : ""} ${label === "√" || label === "%" ? "is-wide" : ""}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
