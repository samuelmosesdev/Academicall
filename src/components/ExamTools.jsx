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
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"><div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-slate-900">Calculator</h3><button type="button" onClick={onClose}><X size={18} className="text-slate-500" /></button></div><div className="mb-2 rounded-xl bg-slate-50 p-3 text-right"><div className="min-h-5 text-xs text-slate-500">{expression || " "}</div><div className="text-xl font-bold text-slate-900">{result || "0"}</div></div><div className="grid grid-cols-4 gap-2"><button type="button" onClick={clear} className="rounded-lg bg-slate-100 py-2.5 text-sm font-semibold">C</button><button type="button" onClick={() => setExpression((current) => current.slice(0, -1))} className="rounded-lg bg-slate-100 py-2.5 text-sm font-semibold">⌫</button><span /><span />{buttons.map((button) => <button type="button" key={button} onClick={() => button === "=" ? evaluate() : append(button)} className="rounded-lg bg-slate-100 py-2.5 text-sm font-semibold">{button}</button>)}{["sin(", "cos(", "tan(", "√(", "log(", "ln(", "π", "e"].map((button) => <button type="button" key={button} onClick={() => append(button)} className="rounded-lg bg-slate-100 py-2.5 text-sm font-semibold">{button.replace("(", "")}</button>)}</div></div></div>;
}

function ConstantsPanel({ onClose }) {
  const [query, setQuery] = useState("");
  const rows = CONSTANTS.filter(([name, value]) => `${name} ${value}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"><div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-4 shadow-xl"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold text-slate-900">Scientific constants</h3><button type="button" onClick={onClose}><X size={18} className="text-slate-500" /></button></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search…" className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /> <ul className="space-y-2">{rows.map(([name, value]) => <li key={name} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-medium text-slate-700">{name}</span><span className="font-mono text-slate-900">{value}</span></li>)}</ul></div></div>;
}

export default function ExamTools() {
  const [calculator, setCalculator] = useState(false);
  const [table, setTable] = useState(false);
  return <><div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2"><button type="button" onClick={() => setCalculator(true)} className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-lg"><Calculator size={16} /> Calculator</button><button type="button" onClick={() => setTable(true)} className="flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg"><Table2 size={16} /> Tables</button></div>{calculator && <CalculatorPanel onClose={() => setCalculator(false)} />}{table && <ConstantsPanel onClose={() => setTable(false)} />}</>;
}
