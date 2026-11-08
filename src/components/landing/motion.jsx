import { useEffect, useRef, useState } from "react";

export function RotatingWord({ words, interval = 2600, className = "" }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || words.length < 2) return undefined;

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % words.length);
    }, interval);
    return () => clearInterval(timer);
  }, [words.length, interval]);

  return (
    <span className={`rot-word ${className}`} aria-live="polite">
      {words.map((word, itemIndex) => (
        <span
          key={word}
          data-state={
            itemIndex === index
              ? "in"
              : itemIndex === (index - 1 + words.length) % words.length
                ? "up"
                : "down"
          }
          aria-hidden={itemIndex !== index}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

export function CountUp({ to, duration = 1400, suffix = "" }) {
  const elementRef = useRef(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return undefined;
    }

    let animationFrame;
    const start = () => {
      const startedAt = performance.now();
      const step = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        setValue(Math.round(to * (1 - (1 - progress) ** 3)));
        if (progress < 1) animationFrame = requestAnimationFrame(step);
      };
      animationFrame = requestAnimationFrame(step);
    };

    if (!("IntersectionObserver" in window)) {
      start();
    } else {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            start();
            observer.disconnect();
          }
        },
        { threshold: 0.4 },
      );
      observer.observe(element);
      return () => {
        observer.disconnect();
        cancelAnimationFrame(animationFrame);
      };
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [to, duration]);

  return <span ref={elementRef}>{value}{suffix}</span>;
}

export function Marquee({ items }) {
  const row = (suffix) => items.map((item, index) => (
    <span
      key={`${suffix}-${index}`}
      className="whitespace-nowrap rounded-full border border-midnight/10 bg-white px-4 py-2 text-[0.85rem] text-midnight/70"
    >
      {item}
    </span>
  ));

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">{row("first")}{row("second")}</div>
    </div>
  );
}
