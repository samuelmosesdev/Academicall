import { Fragment } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { imgUrl } from "../../lib/utmeBank";

const LETTERS = "ABCDE";

/** **bold** → <strong>, keep line breaks. */
export function RichText({ text, className = "" }) {
  if (!text) return null;
  const lines = String(text).split("\n");
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : <Fragment key={j}>{part}</Fragment>,
          )}
          {i < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </span>
  );
}

/** A cropped picture from the bank: printed maths, tables and diagrams. */
export function BankImage({ slug, img, alt, className = "", maxScale = 1 }) {
  if (!img) return null;
  const [file, w, h] = img;
  // crops are rendered at 2.4x the printed size; show them close to print size
  const cssW = Math.round((w / 2.4) * 1.38 * maxScale);
  return (
    <span className={`utme-paper ${className}`}>
      <img src={imgUrl(slug, file)} width={w} height={h} alt={alt} loading="lazy" draggable={false} style={{ width: `min(100%, ${cssW}px)` }} />
    </span>
  );
}

/** Passage / shared instructions for comprehension and literature sets. */
export function Passage({ passage }) {
  if (!passage) return null;
  return (
    <div className="utme-passage">
      {passage.h && <p className="utme-passage-head"><RichText text={passage.h} /></p>}
      {passage.b.map((para, i) => (
        <p key={i}><RichText text={para} /></p>
      ))}
    </div>
  );
}

/**
 * One question. In review (or practice after answering) it shows the right
 * answer, the candidate's pick and the explanation.
 */
export default function UtmeQuestion({ q, number, selected, onSelect, reveal = false, passage, rtl = false }) {
  if (!q) return null;
  const showStemText = !q.si && q.s;
  return (
    <div className="utme-q">
      {passage && <Passage passage={passage} />}
      <div className="utme-q-stem" dir={rtl ? "auto" : undefined}>
        <span className="utme-q-num num">{number}.</span>
        <div className="min-w-0 flex-1">
          {showStemText && <p className="utme-q-text"><RichText text={q.s} /></p>}
          {q.si && <BankImage slug={q.slug} img={q.si} alt={q.s ? q.s.replace(/\*\*/g, "").slice(0, 140) : `Question ${number}`} />}
        </div>
      </div>

      <div className={`utme-opts ${q.block ? "is-letters" : ""}`} role="radiogroup" aria-label={`Options for question ${number}`}>
        {q.o.map((text, i) => {
          const picked = selected === i;
          const isRight = reveal && i === q.a;
          const isWrong = reveal && picked && i !== q.a;
          const optImg = q.oi?.[i];
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={picked}
              disabled={reveal && !onSelect}
              onClick={() => onSelect?.(i)}
              className={`utme-opt ${picked ? "is-picked" : ""} ${isRight ? "is-right" : ""} ${isWrong ? "is-wrong" : ""}`}
            >
              <span className="utme-opt-letter">{LETTERS[i]}</span>
              {!q.block && (
                <span className="utme-opt-body">
                  {optImg ? <BankImage slug={q.slug} img={optImg} alt={text || `Option ${LETTERS[i]}`} className="is-inline" maxScale={1.35} /> : <RichText text={text} />}
                </span>
              )}
              {isRight && <CheckCircle2 size={18} className="utme-opt-mark text-[var(--utme-good)]" aria-label="Correct answer" />}
              {isWrong && <XCircle size={18} className="utme-opt-mark text-[var(--utme-bad)]" aria-label="Your answer" />}
            </button>
          );
        })}
      </div>

      {reveal && (
        <div className="utme-expl">
          <p className="utme-expl-head">
            {selected == null ? "Not answered. " : selected === q.a ? "Correct. " : `You picked ${LETTERS[selected]}. `}
            The answer is <b>{LETTERS[q.a]}</b>.
          </p>
          {q.e && <p className="mt-1"><RichText text={q.e} /></p>}
          {q.k != null && q.k !== q.a && (
            <p className="utme-keynote">The published JAMB key says {LETTERS[q.k]}. Our review found {LETTERS[q.a]} is correct; worth confirming with your teacher.</p>
          )}
        </div>
      )}
    </div>
  );
}
