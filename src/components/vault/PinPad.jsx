import { useEffect, useRef } from "react";
import { Delete } from "lucide-react";

/**
 * Six-dot PIN entry with an on-screen keypad and physical-keyboard support.
 * Calls onComplete(pin) as soon as the sixth digit lands.
 */
export default function PinPad({ value, onChange, onComplete, disabled, error, length = 6 }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus({ preventScroll: true });
  }, [disabled]);

  function push(d) {
    if (disabled || value.length >= length) return;
    const next = value + d;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  }
  function pop() {
    if (!disabled) onChange(value.slice(0, -1));
  }

  return (
    <div className="flex flex-col items-center">
      <input
        ref={inputRef}
        value={value}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Vault PIN"
        className="sr-only"
        maxLength={length}
        disabled={disabled}
        onChange={(e) => {
          const clean = e.target.value.replace(/\D/g, "").slice(0, length);
          onChange(clean);
          if (clean.length === length) onComplete?.(clean);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className={`vault-dots ${error ? "vault-shake" : ""}`}
        aria-label={`${value.length} of ${length} digits entered`}
      >
        {Array.from({ length }).map((_, i) => (
          <span key={i} className={i < value.length ? "on" : ""} />
        ))}
      </button>

      <div className="mt-8 grid w-full max-w-[17rem] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className="vault-key" disabled={disabled} onClick={() => push(d)}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" className="vault-key" disabled={disabled} onClick={() => push("0")}>0</button>
        <button type="button" className="vault-key vault-key-ghost" disabled={disabled} onClick={pop} aria-label="Delete last digit">
          <Delete size={20} />
        </button>
      </div>
    </div>
  );
}
