import { useCallback, useEffect, useRef, useState } from "react";
import { ImageOff, Loader2, Minus, MoveHorizontal, MoveVertical, Plus } from "lucide-react";
import "./reader.css";
import { ReaderButton } from "./ReaderUi";

const STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/**
 * Image viewer that behaves like the PDF reader: fills the width by default,
 * edge to edge on phones, with zoom / fit controls floating in the corner.
 * Pinch on phones and ctrl/trackpad-wheel on desktop zoom around the pointer.
 */
export default function ImageReader({ src, alt = "", protect = false }) {
  const scrollRef = useRef(null);
  const [natural, setNatural] = useState(null);
  const [failed, setFailed] = useState(false);
  const [fit, setFit] = useState("width");
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setBox({ w: element.clientWidth, h: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitWidthScale = natural && box.w ? box.w / natural.w : 1;
  const fitPageScale = natural && box.w ? Math.min(box.w / natural.w, box.h / natural.h) : 1;
  const scale = fit === "width" ? fitWidthScale : fit === "page" ? fitPageScale : zoom;
  const width = natural ? Math.round(natural.w * scale) : undefined;

  const applyZoom = useCallback(
    (next, point) => {
      const element = scrollRef.current;
      const clamped = Math.min(Math.max(next, 0.1), 6);
      if (element && point) {
        const ratio = clamped / scale;
        const x = element.scrollLeft + point.x;
        const y = element.scrollTop + point.y;
        requestAnimationFrame(() => {
          element.scrollLeft = x * ratio - point.x;
          element.scrollTop = y * ratio - point.y;
        });
      }
      setFit("custom");
      setZoom(clamped);
    },
    [scale]
  );

  const step = (direction) => {
    const next =
      direction > 0
        ? STEPS.find((value) => value > scale + 0.01) ?? 6
        : [...STEPS].reverse().find((value) => value < scale - 0.01) ?? 0.1;
    applyZoom(next);
  };

  // Pinch + ctrl-wheel
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const applyRef = useRef(applyZoom);
  applyRef.current = applyZoom;
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    let pinch = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (event) => {
      if (event.touches.length !== 2) return;
      const rect = element.getBoundingClientRect();
      pinch = {
        d: dist(event.touches),
        s: scaleRef.current,
        x: (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left,
        y: (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top,
      };
    };
    const onMove = (event) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      applyRef.current(pinch.s * (dist(event.touches) / pinch.d), { x: pinch.x, y: pinch.y });
    };
    const onEnd = (event) => {
      if (event.touches.length < 2) pinch = null;
    };
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      applyRef.current(scaleRef.current * Math.exp(-event.deltaY * 0.0025), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: false });
    element.addEventListener("touchend", onEnd, { passive: true });
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div className="reader relative flex h-full min-h-0 w-full flex-col" data-theme="light">
      <div ref={scrollRef} className="reader-scroll relative min-h-0 flex-1 overflow-auto">
        {!natural && !failed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-violet" />
          </div>
        )}
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <ImageOff size={22} className="reader-muted" />
            <p className="reader-muted text-sm">This image couldn&apos;t be loaded.</p>
          </div>
        ) : (
          <div
            className="flex min-h-full items-center justify-center"
            style={{ width: "max-content", minWidth: "100%" }}
          >
            <img
              src={src}
              alt={alt}
              draggable={false}
              onLoad={(event) => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
              onError={() => setFailed(true)}
              onContextMenu={protect ? (event) => event.preventDefault() : undefined}
              onDoubleClick={() => (fit === "custom" || fit === "page" ? setFit("width") : applyZoom(fitWidthScale * 2))}
              className="reader-image block max-w-none select-none bg-white"
              style={{ width, visibility: natural ? "visible" : "hidden" }}
            />
          </div>
        )}
      </div>
      {natural && (
        <div className="reader-bar absolute bottom-3 right-3 flex items-center gap-0.5 rounded-xl border p-1 shadow-sm" style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <ReaderButton label="Zoom out" onClick={() => step(-1)}>
            <Minus size={16} />
          </ReaderButton>
          <span className="w-11 text-center text-xs font-semibold tabular-nums">{Math.round(scale * 100)}%</span>
          <ReaderButton label="Zoom in" onClick={() => step(1)}>
            <Plus size={16} />
          </ReaderButton>
          <ReaderButton label="Fit width" active={fit === "width"} onClick={() => setFit("width")}>
            <MoveHorizontal size={16} />
          </ReaderButton>
          <ReaderButton label="Fit screen" active={fit === "page"} onClick={() => setFit("page")}>
            <MoveVertical size={16} />
          </ReaderButton>
        </div>
      )}
    </div>
  );
}
