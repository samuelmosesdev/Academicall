import { useState } from "react";
import { Calculator, Table2, X } from "lucide-react";

const CONSTANTS = [
  ["Speed of light (c)", "2.998 × 10⁸ m/s"],
  ["Planck (h)", "6.626 × 10⁻³⁴ J·s"],
  ["Avogadro (Nₐ)", "6.022 × 10²³ mol⁻¹"],
  ["Gas constant (R)", "8.314 J/(mol·K)"],
  ["Gravity (g)", "9.81 m/s²"],
  ["Electron charge (e)", "1.602 × 10⁻¹⁹ C"],
  ["π", "3.1415926535"],
  ["e (Euler)", "2.7182818284"],
];

function CalculatorPanel({ onClose }) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const append = (value) => setExpression((current) => current + value);
  const clear = () => { setExpression(""); setResult(""); };
  const evaluate = () => {
    try {
      const normalized = expression
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/π/g, String(Math.PI))
        .replace(/\be\b/g, String(Math.E))
        .replace(/√\(/g, "Math.sqrt(")
        .replace(/sin\(/g, "Math.sin(")
        .replace(/cos\(/g, "Math.cos(")
        .replace(/tan\(/g, "Math.tan(")
        .replace(/log\(/g, "Math.log10(")
        .replace(/ln\(/g, "Math.log(");
      if (!/^[0-9+\-*/()., MathsqrtincosatlgehPI]+$/.test(normalized)) throw new Error("Invalid expression");
      // The allow-list above limits the calculator input to math syntax and Math functions.
      // eslint-disable-next-line no-new-func
      setResult(String(Function(`"use strict"; return (${normalized})`)()));
    } catch { setResult("Error"); }
  };
  const buttons = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "(", ")", "+", "=" ];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg-panel p-4 text-text-primary shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Calculator</h3>
          <button type="button" onClick={onClose} aria-label="Close calculator">
            <X size={18} className="text-text-muted" />
          </button>
        </div>
        <div className="mb-2 rounded-xl bg-bg-panel-alt p-3 text-right">
          <div className="min-h-5 text-xs text-text-muted">{expression || " "}</div>
          <div className="text-xl font-bold">{result || "0"}</div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button type="button" onClick={clear} className="rounded-lg bg-bg-elevated py-2.5 text-sm font-semibold hover:bg-accent-soft">C</button>
          <button type="button" onClick={() => setExpression((current) => current.slice(0, -1))} className="rounded-lg bg-bg-elevated py-2.5 text-sm font-semibold hover:bg-accent-soft" aria-label="Delete last character">⌫</button>
          <span />
          <span />
          {buttons.map((button) => (
            <button type="button" key={button} onClick={() => button === "=" ? evaluate() : append(button)} className="rounded-lg bg-bg-elevated py-2.5 text-sm font-semibold hover:bg-accent-soft">
              {button}
            </button>
          ))}
          {["sin(", "cos(", "tan(", "√(", "log(", "ln(", "π", "e"].map((button) => (
            <button type="button" key={button} onClick={() => append(button)} className="rounded-lg bg-bg-elevated py-2.5 text-sm font-semibold hover:bg-accent-soft">
              {button.replace("(", "")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConstantsPanel({ onClose }) {
  const [query, setQuery] = useState("");
  const rows = CONSTANTS.filter(([name, value]) => `${name} ${value}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl border border-border-subtle bg-bg-panel p-4 text-text-primary shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">Scientific constants</h3>
          <button type="button" onClick={onClose} aria-label="Close constants">
            <X size={18} className="text-text-muted" />
          </button>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search…" className="mb-3 w-full rounded-xl border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
        <ul className="space-y-2">
          {rows.map(([name, value]) => (
            <li key={name} className="flex justify-between gap-3 rounded-lg bg-bg-panel-alt px-3 py-2 text-sm">
              <span className="font-medium">{name}</span>
              <span className="font-mono text-text-secondary">{value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ExamTools() {
  const [calculator, setCalculator] = useState(false);
  const [table, setTable] = useState(false);
  return (
    <>
      <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2">
        <button type="button" onClick={() => setCalculator(true)} className="flex items-center gap-2 rounded-full bg-[#14355e] px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-[#101c30]">
          <Calculator size={16} /> Calculator
        </button>
        <button type="button" onClick={() => setTable(true)} className="flex items-center gap-2 rounded-full bg-[#3d6fe0] px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-[#14355e]">
          <Table2 size={16} /> Tables
        </button>
      </div>
      {calculator && <CalculatorPanel onClose={() => setCalculator(false)} />}
      {table && <ConstantsPanel onClose={() => setTable(false)} />}
    </>
  );
}
