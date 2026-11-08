import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "./reader.css";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Ellipsis,
  Expand,
  File as FileIcon,
  Loader2,
  Maximize,
  Minimize,
  Minus,
  Moon,
  MoveHorizontal,
  MoveVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCw,
  Rows3,
  Search,
  Sun,
  Type,
  X,
} from "lucide-react";
import { downloadFile } from "../../lib/download";
import { loadDocState, loadReaderPrefs, readerDocKey, saveDocState, saveReaderPrefs } from "./readerStorage";
import {
  ReaderButton,
  ReaderDivider,
  ReaderMenuRow,
  ReaderPopover,
  ReaderSegment,
  ReaderSheet,
} from "./ReaderUi";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/** CSS pixels per PDF point: "100%" means the page at its printed size on a 96dpi screen. */
const PX_PER_PT = 96 / 72;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const SIDEBAR_WIDTH = 184;
const THUMB_WIDTH = 124;
const DEFAULT_DIM = { w: 595, h: 842, rot: 0 }; // A4 until the real size is known
const MAX_CANVAS_AREA = 16_000_000; // iOS Safari refuses larger canvases

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function canvasRatio(width, height) {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return Math.max(0.5, Math.min(dpr, 3, Math.sqrt(MAX_CANVAS_AREA / Math.max(1, width * height))));
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Fetches the file ourselves so we can show real download progress on slow connections. */
function usePdfBytes(src, attempt) {
  const [state, setState] = useState({ data: null, error: null, loading: true, progress: null });

  useEffect(() => {
    if (!src) {
      setState({ data: null, error: new Error("No file URL was provided."), loading: false, progress: null });
      return undefined;
    }

    const controller = new AbortController();
    setState({ data: null, error: null, loading: true, progress: null });

    (async () => {
      const response = await fetch(src, { signal: controller.signal });
      if (!response.ok) throw new Error(`The PDF request failed (${response.status}).`);
      const total = Number(response.headers.get("content-length")) || 0;
      if (!response.body || !total) {
        return new Uint8Array(await response.arrayBuffer());
      }
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      let lastReported = -1;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        const pct = Math.min(99, Math.round((received / total) * 100));
        if (pct !== lastReported && !controller.signal.aborted) {
          lastReported = pct;
          setState((previous) => ({ ...previous, progress: pct }));
        }
      }
      const bytes = new Uint8Array(received);
      let offset = 0;
      chunks.forEach((chunk) => {
        bytes.set(chunk, offset);
        offset += chunk.length;
      });
      return bytes;
    })()
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false, progress: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ data: null, error, loading: false, progress: null });
      });

    return () => controller.abort();
  }, [src, attempt]);

  return state;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

const PageSlot = memo(function PageSlot({
  number,
  width,
  height,
  rendered,
  rotate,
  textRenderer,
  registerEl,
  protect,
}) {
  const placeholder = <div className="reader-ph" style={{ width, height }} />;
  return (
    <div
      ref={(element) => registerEl(number, element)}
      data-page={number}
      className="reader-page relative shrink-0 overflow-hidden bg-white"
      style={{ width, height }}
      onContextMenu={protect ? (event) => event.preventDefault() : undefined}
    >
      {rendered ? (
        <Page
          pageNumber={number}
          width={width}
          rotate={rotate}
          devicePixelRatio={canvasRatio(width, height)}
          loading={placeholder}
          error={placeholder}
          customTextRenderer={textRenderer}
          renderAnnotationLayer
          renderTextLayer
        />
      ) : (
        placeholder
      )}
    </div>
  );
});

function Thumb({ number, dim, rotation, active, onSelect, root }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const swap = rotation % 180 !== 0;
  const ratio = swap ? dim.w / dim.h : dim.h / dim.w;
  const height = Math.round(THUMB_WIDTH * ratio);

  useEffect(() => {
    const element = ref.current;
    if (!element || !root) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root, rootMargin: "400px 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    if (active && ref.current) ref.current.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(number)}
      className="group flex w-full flex-col items-center gap-1.5 py-1.5"
      aria-label={`Page ${number}`}
      aria-current={active ? "page" : undefined}
    >
      <span
        data-active={active ? "true" : undefined}
        className="reader-thumb block overflow-hidden rounded-sm bg-white shadow-sm"
        style={{ width: THUMB_WIDTH, height }}
      >
        {visible && (
          <Page
            pageNumber={number}
            width={THUMB_WIDTH}
            rotate={rotation ? (dim.rot + rotation) % 360 : undefined}
            devicePixelRatio={Math.min(2, window.devicePixelRatio || 1)}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            loading={null}
            error={null}
          />
        )}
      </span>
      <span className={`text-[0.7rem] tabular-nums ${active ? "font-semibold" : "reader-muted"}`}>{number}</span>
    </button>
  );
}

function PdfReaderInner({
  src,
  title,
  subtitle,
  docKey,
  onBack,
  actions,
  menuItems = [],
  allowDownload = false,
  onDownload,
  fileName,
  protect = false,
  onPageChange,
  showTitle = false,
}) {
  const storageKey = readerDocKey(docKey, src);
  const saved = useMemo(() => loadDocState(storageKey), [storageKey]);

  const [attempt, setAttempt] = useState(0);
  const { data, error: fetchError, loading: fetching, progress: fetchProgress } = usePdfBytes(src, attempt);
  const file = useMemo(() => (data ? { data } : null), [data]);

  const isPhone = useMediaQuery("(max-width: 639px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const shellRef = useRef(null);
  const innerRef = useRef(null);
  const pageEls = useRef([]);
  const [sidebarEl, setSidebarEl] = useState(null);
  const [scrollEl, setScrollEl] = useState(null);

  const [prefs, setPrefs] = useState(loadReaderPrefs);
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [dims, setDims] = useState([]);
  const [baseDim, setBaseDim] = useState(null);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [fit, setFit] = useState(() => (["width", "page", "custom"].includes(saved?.fit) ? saved.fit : "width"));
  const [zoom, setZoom] = useState(() => clamp(Number(saved?.zoom) || 1, MIN_ZOOM, MAX_ZOOM));
  const [rotation, setRotation] = useState(0);
  const [avail, setAvail] = useState(null);
  const [rendered, setRendered] = useState(() => new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [parseProgress, setParseProgress] = useState(null);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [menu, setMenu] = useState(null); // "zoom" | "display" | "sheet"
  const [zoomToast, setZoomToast] = useState(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState([]);
  const [resultIndex, setResultIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const textCache = useRef(new Map());
  const searchToken = useRef(0);
  const searchInputRef = useRef(null);

  const pendingAnchor = useRef(null);
  const restoredRef = useRef(false);
  const pageRef = useRef(1);
  pageRef.current = page;

  const single = prefs.mode === "single";
  const layoutReady = Boolean(pdf && baseDim && avail);
  useEffect(() => {
    if (!isPhone) setChromeHidden(false);
  }, [isPhone]);
  const theme = prefs.theme;
  // Thumbnails only when the reader itself is roomy (it may sit beside other panels).
  const [shellWide, setShellWide] = useState(false);
  useEffect(() => {
    const element = shellRef.current;
    if (!element || !isDesktop) {
      setShellWide(false);
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => setShellWide(entry.contentRect.width >= 900));
    observer.observe(element);
    return () => observer.disconnect();
  }, [isDesktop]);
  const canSidebar = isDesktop && shellWide && numPages > 1;
  const sidebarOpen = canSidebar && prefs.sidebar;
  const padX = isPhone ? 0 : 24;
  const padY = isPhone ? 0 : 20;
  const gap = isPhone ? 6 : 14;

  const updatePrefs = useCallback((patch) => {
    setPrefs((previous) => {
      const next = { ...previous, ...patch };
      saveReaderPrefs(next);
      return next;
    });
  }, []);

  // ---------- geometry ----------
  const dimFor = useCallback(
    (number) => {
      const dim = dims[number - 1] || baseDim || DEFAULT_DIM;
      return rotation % 180 ? { w: dim.h, h: dim.w, rot: dim.rot } : dim;
    },
    [dims, baseDim, rotation]
  );

  const maxWidthPt = useMemo(() => {
    const base = baseDim || DEFAULT_DIM;
    let widest = rotation % 180 ? base.h : base.w;
    dims.forEach((dim) => {
      if (!dim) return;
      widest = Math.max(widest, rotation % 180 ? dim.h : dim.w);
    });
    return widest;
  }, [dims, baseDim, rotation]);

  const scale = useMemo(() => {
    if (!avail) return PX_PER_PT;
    const usableW = Math.max(120, avail.w - padX * 2);
    const usableH = Math.max(120, avail.h - padY * 2);
    if (fit === "width") return usableW / maxWidthPt;
    if (fit === "page") {
      const dim = dimFor(single ? page : 1);
      return Math.min(usableW / dim.w, usableH / dim.h);
    }
    return zoom * PX_PER_PT;
  }, [avail, padX, padY, fit, maxWidthPt, dimFor, page, single, zoom]);

  const percent = Math.round((scale / PX_PER_PT) * 100);

  const sizeFor = useCallback(
    (number) => {
      const dim = dimFor(number);
      return { width: Math.max(1, Math.round(dim.w * scale)), height: Math.max(1, Math.round(dim.h * scale)) };
    },
    [dimFor, scale]
  );

  // ---------- scroll anchoring (keeps your place across zoom / resize / rotation) ----------
  const captureAnchor = useCallback(
    (px, py) => {
      const root = scrollEl;
      if (!root || !numPages) return;
      const x = px ?? root.clientWidth / 2;
      const y = py ?? 0;
      const contentX = root.scrollLeft + x;
      const contentY = root.scrollTop + y;
      let target = null;
      for (let index = 0; index < pageEls.current.length; index += 1) {
        const element = pageEls.current[index];
        if (!element) continue;
        target = element;
        if (element.offsetTop + element.offsetHeight + gap >= contentY) break;
      }
      if (!target) return;
      pendingAnchor.current = {
        page: Number(target.dataset.page),
        fracX: (contentX - target.offsetLeft) / Math.max(1, target.offsetWidth),
        fracY: (contentY - target.offsetTop) / Math.max(1, target.offsetHeight),
        x,
        y,
      };
    },
    [scrollEl, numPages, gap]
  );

  useLayoutEffect(() => {
    const anchor = pendingAnchor.current;
    const root = scrollEl;
    if (!anchor || !root) return;
    pendingAnchor.current = null;
    const element = pageEls.current[anchor.page - 1];
    if (!element) return;
    root.scrollTop = element.offsetTop + anchor.fracY * element.offsetHeight - anchor.y;
    root.scrollLeft = element.offsetLeft + anchor.fracX * element.offsetWidth - anchor.x;
  }, [scale, rotation, scrollEl, dims, avail, fit, zoom, single]);

  // Re-measure on resize / orientation change / sidebar toggle.
  useEffect(() => {
    if (!scrollEl) return undefined;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = { w: scrollEl.clientWidth, h: scrollEl.clientHeight };
        setAvail((previous) => {
          if (previous && Math.abs(previous.w - next.w) < 1 && Math.abs(previous.h - next.h) < 1) return previous;
          if (previous && restoredRef.current) captureAnchor();
          return next;
        });
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(scrollEl);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [scrollEl, captureAnchor]);

  // ---------- document loading ----------
  const handleLoadProgress = useCallback(({ loaded, total }) => {
    setParseProgress(total ? Math.min(100, Math.round((loaded / total) * 100)) : null);
  }, []);

  const handleLoadSuccess = useCallback((doc) => {
    setParseProgress(null);
    setPdf(doc);
    setNumPages(doc.numPages);
    setDims(new Array(doc.numPages).fill(null));
  }, []);

  const handleLoadError = useCallback((error) => {
    setParseProgress(null);
    setLoadError(error || new Error("Could not read PDF"));
  }, []);

  // Read every page's real size in the background so placeholders don't jump.
  useEffect(() => {
    if (!pdf) return undefined;
    let alive = true;
    (async () => {
      try {
        const first = await pdf.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        if (!alive) return;
        const firstDim = { w: viewport.width, h: viewport.height, rot: first.rotate || 0 };
        setBaseDim(firstDim);
        const collected = new Array(pdf.numPages).fill(null);
        collected[0] = firstDim;
        const BATCH = 40;
        for (let start = 2; start <= pdf.numPages; start += BATCH) {
          const end = Math.min(pdf.numPages, start + BATCH - 1);
          const batch = [];
          for (let number = start; number <= end; number += 1) batch.push(pdf.getPage(number));
          const pages = await Promise.all(batch);
          if (!alive) return;
          pages.forEach((p, offset) => {
            const vp = p.getViewport({ scale: 1 });
            collected[start - 1 + offset] = { w: vp.width, h: vp.height, rot: p.rotate || 0 };
          });
          const changed = pages.some((p) => {
            const vp = p.getViewport({ scale: 1 });
            return Math.abs(vp.width - firstDim.w) > 1 || Math.abs(vp.height - firstDim.h) > 1 || (p.rotate || 0) !== firstDim.rot;
          });
          if (changed || end === pdf.numPages) {
            if (restoredRef.current) captureAnchor();
            setDims(collected.slice());
          }
        }
        if (pdf.numPages === 1) setDims([firstDim]);
      } catch {
        // Sizes are an optimisation; the pages still render at the default ratio.
      }
    })();
    return () => {
      alive = false;
    };
    // captureAnchor intentionally omitted: sizes are read once per document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  // ---------- navigation ----------
  const registerEl = useCallback((number, element) => {
    pageEls.current[number - 1] = element;
  }, []);

  const goToPage = useCallback(
    (requested, { smooth = false } = {}) => {
      if (!numPages) return;
      const target = clamp(Math.round(requested) || 1, 1, numPages);
      setPage(target);
      setPageInput(String(target));
      setRendered((previous) => (previous.has(target) ? previous : new Set(previous).add(target)));
      const root = scrollEl;
      if (!root) return;
      if (single) {
        root.scrollTo({ top: 0, left: root.scrollLeft });
        return;
      }
      const element = pageEls.current[target - 1];
      if (element) {
        root.scrollTo({ top: Math.max(0, element.offsetTop - (isPhone ? 0 : 12)), behavior: smooth ? "smooth" : "auto" });
      }
    },
    [numPages, scrollEl, single, isPhone]
  );

  // Restore last position once the layout exists.
  useEffect(() => {
    if (restoredRef.current || !numPages || !avail || !baseDim || !scrollEl) return;
    restoredRef.current = true;
    const target = clamp(Number(saved?.page) || 1, 1, numPages);
    if (target > 1) {
      requestAnimationFrame(() => goToPage(target));
    }
  }, [numPages, avail, baseDim, scrollEl, saved, goToPage]);

  // Track the current page from scroll position (continuous mode).
  useEffect(() => {
    if (!scrollEl || !numPages || single) return undefined;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const probe = scrollEl.scrollTop + scrollEl.clientHeight * 0.35;
        let low = 0;
        let high = numPages - 1;
        let found = 0;
        while (low <= high) {
          const mid = (low + high) >> 1;
          const element = pageEls.current[mid];
          if (!element) break;
          if (element.offsetTop <= probe) {
            found = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }
        const number = found + 1;
        if (number !== pageRef.current) {
          setPage(number);
          if (document.activeElement?.dataset?.readerPageInput !== "true") setPageInput(String(number));
        }
      });
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scrollEl.removeEventListener("scroll", onScroll);
    };
  }, [scrollEl, numPages, single]);

  // Lazy-render: only pages within about a screen of the viewport hold a canvas.
  useEffect(() => {
    if (!scrollEl || !numPages || single || !layoutReady) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        setRendered((previous) => {
          let next = previous;
          entries.forEach((entry) => {
            const number = Number(entry.target.dataset.page);
            if (entry.isIntersecting && !next.has(number)) {
              if (next === previous) next = new Set(previous);
              next.add(number);
            } else if (!entry.isIntersecting && next.has(number)) {
              if (next === previous) next = new Set(previous);
              next.delete(number);
            }
          });
          return next;
        });
      },
      { root: scrollEl, rootMargin: "120% 0px" }
    );
    pageEls.current.slice(0, numPages).forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, [scrollEl, numPages, single, layoutReady]);

  // Persist position + report progress.
  useEffect(() => {
    if (!numPages || !restoredRef.current) return undefined;
    onPageChange?.(page, numPages);
    const timer = setTimeout(() => saveDocState(storageKey, { page, fit, zoom, pages: numPages }), 400);
    return () => clearTimeout(timer);
  }, [page, fit, zoom, numPages, storageKey, onPageChange, layoutReady]);

  // ---------- zoom ----------
  const flashZoom = useCallback((value) => {
    setZoomToast(value);
  }, []);

  useEffect(() => {
    if (zoomToast === null) return undefined;
    const timer = setTimeout(() => setZoomToast(null), 900);
    return () => clearTimeout(timer);
  }, [zoomToast]);

  const applyZoom = useCallback(
    (value, point) => {
      const next = clamp(value, MIN_ZOOM, MAX_ZOOM);
      captureAnchor(point?.x, point?.y);
      setFit("custom");
      setZoom(next);
      flashZoom(Math.round(next * 100));
    },
    [captureAnchor, flashZoom]
  );

  const zoomBy = useCallback(
    (direction) => {
      const current = scale / PX_PER_PT;
      const next =
        direction > 0
          ? ZOOM_STEPS.find((step) => step > current + 0.01) ?? MAX_ZOOM
          : [...ZOOM_STEPS].reverse().find((step) => step < current - 0.01) ?? MIN_ZOOM;
      applyZoom(next);
    },
    [scale, applyZoom]
  );

  const setFitMode = useCallback(
    (mode) => {
      captureAnchor();
      setFit(mode);
      setMenu(null);
    },
    [captureAnchor]
  );

  // Pinch (touch) and ctrl/trackpad-wheel zoom: preview with a CSS transform, commit once the gesture settles.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const applyZoomRef = useRef(applyZoom);
  applyZoomRef.current = applyZoom;
  const gestureRef = useRef({});

  useEffect(() => {
    const root = scrollEl;
    if (!root) return undefined;
    const gesture = gestureRef.current;

    const setPreview = (ratio, x, y) => {
      const inner = innerRef.current;
      if (!inner) return;
      inner.style.transformOrigin = `${root.scrollLeft + x}px ${root.scrollTop + y}px`;
      inner.style.transform = ratio === 1 ? "" : `scale(${ratio})`;
    };

    const commit = () => {
      const { ratio = 1, x = 0, y = 0, startZoom = 1 } = gesture;
      setPreview(1, x, y);
      gesture.active = false;
      if (Math.abs(ratio - 1) > 0.02) applyZoomRef.current(startZoom * ratio, { x, y });
    };

    const distance = (touches) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    const onTouchStart = (event) => {
      if (event.touches.length === 2) {
        const rect = root.getBoundingClientRect();
        gesture.active = true;
        gesture.kind = "pinch";
        gesture.startDist = distance(event.touches);
        gesture.startZoom = scaleRef.current / PX_PER_PT;
        gesture.ratio = 1;
        gesture.x = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
        gesture.y = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
        gesture.tap = null;
      } else if (event.touches.length === 1 && !gesture.active) {
        const touch = event.touches[0];
        gesture.tap = { x: touch.clientX, y: touch.clientY, t: Date.now(), moved: false };
      }
    };

    const onTouchMove = (event) => {
      if (gesture.active && gesture.kind === "pinch" && event.touches.length === 2) {
        event.preventDefault();
        const raw = distance(event.touches) / Math.max(1, gesture.startDist);
        gesture.ratio = clamp(raw, MIN_ZOOM / gesture.startZoom, MAX_ZOOM / gesture.startZoom);
        setPreview(gesture.ratio, gesture.x, gesture.y);
      } else if (gesture.tap && event.touches.length === 1) {
        const touch = event.touches[0];
        if (Math.abs(touch.clientX - gesture.tap.x) > 10 || Math.abs(touch.clientY - gesture.tap.y) > 10) {
          gesture.tap.moved = true;
        }
      }
    };

    const onTouchEnd = (event) => {
      if (gesture.active && gesture.kind === "pinch") {
        if (event.touches.length < 2) commit();
        return;
      }
      const tap = gesture.tap;
      gesture.tap = null;
      if (!tap || event.touches.length) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - tap.x;
      const dy = touch.clientY - tap.y;
      const elapsed = Date.now() - tap.t;
      const fitsWidth = root.scrollWidth <= root.clientWidth + 2;
      if (gesture.single && fitsWidth && Math.abs(dx) > 60 && Math.abs(dy) < 50 && elapsed < 600) {
        gesture.navigate?.(dx < 0 ? 1 : -1);
        return;
      }
      if (!tap.moved && elapsed < 300 && !event.target.closest?.("a,button,input")) {
        gesture.toggleChrome?.();
      }
    };

    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = root.getBoundingClientRect();
      if (!gesture.active || gesture.kind !== "wheel") {
        gesture.active = true;
        gesture.kind = "wheel";
        gesture.startZoom = scaleRef.current / PX_PER_PT;
        gesture.ratio = 1;
        gesture.x = event.clientX - rect.left;
        gesture.y = event.clientY - rect.top;
      }
      const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0025));
      gesture.ratio = clamp(gesture.ratio * factor, MIN_ZOOM / gesture.startZoom, MAX_ZOOM / gesture.startZoom);
      setPreview(gesture.ratio, gesture.x, gesture.y);
      clearTimeout(gesture.timer);
      gesture.timer = setTimeout(commit, 160);
    };

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    root.addEventListener("touchcancel", onTouchEnd, { passive: true });
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      clearTimeout(gesture.timer);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
      root.removeEventListener("wheel", onWheel);
    };
  }, [scrollEl]);

  // Latest callbacks for the gesture handlers without re-binding listeners.
  gestureRef.current.single = single;
  gestureRef.current.navigate = (direction) => goToPage(pageRef.current + direction);
  gestureRef.current.toggleChrome = isPhone ? () => setChromeHidden((value) => !value) : null;

  // ---------- fullscreen ----------
  const toggleFullscreen = useCallback(async () => {
    setMenu(null);
    if (!fullscreen) {
      try {
        if (shellRef.current?.requestFullscreen) await shellRef.current.requestFullscreen();
      } catch {
        // CSS fullscreen below still works where the API is blocked (iOS Safari).
      }
      setFullscreen(true);
    } else {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
      } catch {
        // ignore
      }
      setFullscreen(false);
    }
  }, [fullscreen]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ---------- search ----------
  const runSearch = useCallback(
    async (raw) => {
      const needle = raw.trim().toLowerCase();
      const token = ++searchToken.current;
      setActiveQuery(raw.trim());
      setResults([]);
      setResultIndex(-1);
      if (!pdf || !needle) {
        setSearching(false);
        return;
      }
      setSearching(true);
      const found = [];
      let jumped = false;
      for (let number = 1; number <= pdf.numPages; number += 1) {
        let text = textCache.current.get(number);
        if (text === undefined) {
          try {
            const p = await pdf.getPage(number);
            const content = await p.getTextContent();
            text = content.items.map((item) => (item.str || "") + (item.hasEOL ? "\n" : "")).join("").toLowerCase();
          } catch {
            text = "";
          }
          textCache.current.set(number, text);
        }
        if (token !== searchToken.current) return;
        const count = countMatches(text, needle);
        if (count) {
          found.push({ page: number, count });
          if (!jumped && number >= pageRef.current) {
            jumped = true;
            setResultIndex(found.length - 1);
            goToPage(number);
          }
        }
        if (number % 15 === 0 || number === pdf.numPages) setResults(found.slice());
      }
      if (token !== searchToken.current) return;
      if (!jumped && found.length) {
        setResultIndex(0);
        goToPage(found[0].page);
      }
      setSearching(false);
    },
    [pdf, goToPage]
  );

  const stepResult = useCallback(
    (direction) => {
      if (!results.length) return;
      const next = (resultIndex + direction + results.length) % results.length;
      setResultIndex(next);
      goToPage(results[next].page);
    },
    [results, resultIndex, goToPage]
  );

  const closeSearch = useCallback(() => {
    searchToken.current += 1;
    setSearchOpen(false);
    setSearching(false);
    setActiveQuery("");
    setResults([]);
    setResultIndex(-1);
  }, []);

  const openSearch = useCallback(() => {
    setMenu(null);
    setChromeHidden(false);
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const textRenderer = useMemo(() => {
    if (!activeQuery) return undefined;
    const pattern = new RegExp(`(${escapeRegExp(activeQuery)})`, "gi");
    return ({ str }) =>
      str
        .split(pattern)
        .map((part, index) => (index % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
        .join("");
  }, [activeQuery]);

  // ---------- keyboard ----------
  useEffect(() => {
    function onKeyDown(event) {
      const inside = fullscreen || shellRef.current?.contains(document.activeElement);
      if (!inside) return;
      const target = event.target;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "f") {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.key === "Escape") {
        if (menu) setMenu(null);
        else if (searchOpen) closeSearch();
        else if (fullscreen && !document.fullscreenElement) setFullscreen(false);
        return;
      }
      if (typing) return;
      const pannable = scrollEl ? scrollEl.scrollWidth > scrollEl.clientWidth + 2 : false;
      const atBottom = scrollEl ? scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2 : true;
      const atTop = scrollEl ? scrollEl.scrollTop <= 1 : true;
      if (mod && ["=", "+"].includes(event.key)) {
        event.preventDefault();
        zoomBy(1);
      } else if (mod && event.key === "-") {
        event.preventDefault();
        zoomBy(-1);
      } else if (mod && event.key === "0") {
        event.preventDefault();
        setFitMode("width");
      } else if (
        ((event.key === "ArrowRight" || event.key === "ArrowLeft") && !pannable) ||
        event.key === "PageDown" ||
        event.key === "PageUp" ||
        (single && event.key === "ArrowDown" && atBottom) ||
        (single && event.key === "ArrowUp" && atTop)
      ) {
        event.preventDefault();
        const forward = ["ArrowRight", "PageDown", "ArrowDown"].includes(event.key);
        goToPage(page + (forward ? 1 : -1));
      } else if (event.key === "Home") {
        event.preventDefault();
        goToPage(1);
      } else if (event.key === "End") {
        event.preventDefault();
        goToPage(numPages);
      } else if (event.key.toLowerCase() === "f" && !mod) {
        toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, menu, searchOpen, closeSearch, openSearch, zoomBy, setFitMode, single, scrollEl, goToPage, page, numPages, toggleFullscreen]);

  // ---------- actions ----------
  const handleDownload = useCallback(() => {
    setMenu(null);
    if (onDownload) onDownload();
    else downloadFile(src, fileName || title || "document.pdf");
  }, [onDownload, src, fileName, title]);

  const rotate = useCallback(() => {
    captureAnchor();
    setRotation((value) => (value + 90) % 360);
  }, [captureAnchor]);

  const setMode = useCallback(
    (mode) => {
      updatePrefs({ mode });
      setMenu(null);
      if (mode === "continuous") {
        // Jump back to the page we were on once the full stack renders.
        const current = pageRef.current;
        requestAnimationFrame(() => requestAnimationFrame(() => goToPage(current)));
      } else {
        scrollEl?.scrollTo({ top: 0 });
      }
    },
    [updatePrefs, goToPage, scrollEl]
  );

  function retry() {
    setLoadError(null);
    setPdf(null);
    setNumPages(0);
    setAttempt((value) => value + 1);
  }

  const failed = Boolean(fetchError || loadError);
  const showDownload = allowDownload && !protect;
  const ready = Boolean(pdf && baseDim);
  const busy = !failed && !ready;
  const titleVisible = Boolean(onBack || showTitle || fullscreen) && title;
  const fitLabel = fit === "width" ? "Fit width" : fit === "page" ? "Fit page" : null;

  const pageForm = (compact) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        goToPage(Number(pageInput) || 1, { smooth: false });
        event.currentTarget.querySelector("input")?.blur();
      }}
      className={`flex items-center gap-1.5 text-xs tabular-nums ${compact ? "" : "reader-muted"}`}
    >
      <input
        value={pageInput}
        onChange={(event) => setPageInput(event.target.value.replace(/[^0-9]/g, ""))}
        onFocus={(event) => event.target.select()}
        onBlur={() => setPageInput(String(page))}
        inputMode="numeric"
        enterKeyHint="go"
        aria-label="Page number"
        data-reader-page-input="true"
        className={`h-7 rounded-md text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-violet ${
          compact ? "w-10 bg-white/15 text-white" : "reader-chip w-12"
        }`}
        style={compact ? undefined : { color: "inherit" }}
      />
      <span className="whitespace-nowrap">/ {numPages || "–"}</span>
    </form>
  );

  const displayOptions = (
    <div className="space-y-3">
      <ReaderMenuRow label="Layout">
        <ReaderSegment
          label="Page layout"
          value={prefs.mode}
          onChange={setMode}
          options={[
            { value: "continuous", label: "Scroll", icon: Rows3 },
            { value: "single", label: "Single page", icon: FileIcon },
          ]}
        />
      </ReaderMenuRow>
      <ReaderMenuRow label="Page colour">
        <ReaderSegment
          label="Page colour"
          value={theme}
          onChange={(value) => updatePrefs({ theme: value })}
          options={[
            { value: "light", label: "Light", icon: Sun },
            { value: "sepia", label: "Sepia", icon: Type },
            { value: "dark", label: "Dark", icon: Moon },
          ]}
        />
      </ReaderMenuRow>
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <button type="button" onClick={rotate} className="reader-btn reader-chip inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium">
          <RotateCw size={14} /> Rotate
        </button>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key || item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setMenu(null);
                item.onClick?.();
              }}
              data-active={item.active ? "true" : undefined}
              className="reader-btn reader-chip inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {Icon && <Icon size={14} className={item.spinning ? "animate-spin" : ""} />} {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const pageNumbers = single ? [page] : Array.from({ length: numPages }, (_, index) => index + 1);

  return (
    <div
      ref={shellRef}
      data-theme={theme}
      className={`reader flex min-h-0 flex-col ${protect ? "reader-protected" : ""} ${
        fullscreen ? "fixed inset-0 z-[80]" : "h-full w-full"
      }`}
    >
      {/* Toolbar */}
      <div
        className={`reader-bar relative z-20 shrink-0 border-b ${chromeHidden ? "hidden" : ""}`}
      >
        <div className="flex h-12 items-center gap-1 px-1.5 sm:px-2.5">
          {onBack && (
            <ReaderButton label="Back" onClick={onBack}>
              <ArrowLeft size={18} />
            </ReaderButton>
          )}
          {canSidebar && (
            <ReaderButton
              label={prefs.sidebar ? "Hide pages" : "Show pages"}
              onClick={() => updatePrefs({ sidebar: !prefs.sidebar })}
            >
              {prefs.sidebar ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
            </ReaderButton>
          )}

          <div className="min-w-0 flex-1 px-1">
            {titleVisible && (
              <>
                <p className="truncate font-display text-sm font-semibold leading-tight">{title}</p>
                {subtitle && <p className="reader-muted hidden truncate text-[0.7rem] leading-tight sm:block">{subtitle}</p>}
              </>
            )}
          </div>

          {/* Desktop controls */}
          <div className="hidden items-center md:flex">
            <ReaderButton label="Previous page" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
              <ChevronLeft size={17} />
            </ReaderButton>
            {pageForm(false)}
            <ReaderButton label="Next page" onClick={() => goToPage(page + 1)} disabled={!numPages || page >= numPages}>
              <ChevronRight size={17} />
            </ReaderButton>
            <ReaderDivider />
            <ReaderButton label="Zoom out" onClick={() => zoomBy(-1)} disabled={percent <= MIN_ZOOM * 100}>
              <Minus size={16} />
            </ReaderButton>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu(menu === "zoom" ? null : "zoom")}
                className="reader-btn reader-chip inline-flex h-8 min-w-[64px] items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold tabular-nums"
                aria-haspopup="menu"
                aria-expanded={menu === "zoom"}
                title={fitLabel || "Zoom"}
              >
                {percent}%<ChevronDown size={12} className="opacity-60" />
              </button>
              <ReaderPopover open={menu === "zoom"} onClose={() => setMenu(null)} align="left" className="w-44 p-1.5">
                {[
                  { key: "width", label: "Fit width", icon: MoveHorizontal },
                  { key: "page", label: "Fit page", icon: MoveVertical },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFitMode(option.key)}
                    data-active={fit === option.key ? "true" : undefined}
                    className="reader-btn flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium"
                  >
                    <option.icon size={14} /> {option.label}
                  </button>
                ))}
                <div className="reader-line my-1 h-px" />
                {ZOOM_PRESETS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      applyZoom(value);
                      setMenu(null);
                    }}
                    data-active={fit === "custom" && Math.abs(zoom - value) < 0.005 ? "true" : undefined}
                    className="reader-btn flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs tabular-nums"
                  >
                    {Math.round(value * 100)}%
                  </button>
                ))}
              </ReaderPopover>
            </div>
            <ReaderButton label="Zoom in" onClick={() => zoomBy(1)} disabled={percent >= MAX_ZOOM * 100}>
              <Plus size={16} />
            </ReaderButton>
            <ReaderButton label="Fit width" onClick={() => setFitMode("width")} active={fit === "width"} className="hidden lg:flex">
              <MoveHorizontal size={16} />
            </ReaderButton>
            <ReaderButton label="Fit page" onClick={() => setFitMode("page")} active={fit === "page"} className="hidden lg:flex">
              <MoveVertical size={16} />
            </ReaderButton>
            <ReaderDivider />
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <ReaderButton label="Search in document" onClick={searchOpen ? closeSearch : openSearch} active={searchOpen} disabled={!ready}>
              <Search size={16} />
            </ReaderButton>
            <div className="relative hidden md:block">
              <ReaderButton
                label="Display options"
                onClick={() => setMenu(menu === "display" ? null : "display")}
                active={menu === "display"}
              >
                {theme === "dark" ? <Moon size={16} /> : theme === "sepia" ? <Type size={16} /> : <Sun size={16} />}
              </ReaderButton>
              <ReaderPopover open={menu === "display"} onClose={() => setMenu(null)} className="w-72">
                {displayOptions}
              </ReaderPopover>
            </div>
            {showDownload && (
              <ReaderButton label="Download" onClick={handleDownload} className="hidden md:flex">
                <Download size={16} />
              </ReaderButton>
            )}
            <ReaderButton
              label={fullscreen ? "Exit full screen" : "Full screen"}
              onClick={toggleFullscreen}
              className="hidden md:flex"
            >
              {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </ReaderButton>
            <ReaderButton label="Reader options" onClick={() => setMenu("sheet")} className="md:hidden">
              <Ellipsis size={18} />
            </ReaderButton>
            {actions && <div className="ml-1 flex items-center gap-1.5">{actions}</div>}
          </div>
        </div>

        {searchOpen && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (query.trim() && query.trim() === activeQuery && results.length) stepResult(1);
              else runSearch(query);
            }}
            className="flex h-11 items-center gap-1 border-t px-2 sm:px-3"
            style={{ borderColor: "var(--reader-bar-line)" }}
          >
            <Search size={15} className="reader-muted ml-1 shrink-0" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find in document"
              enterKeyHint="search"
              className="h-8 min-w-0 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:opacity-60"
              style={{ color: "inherit" }}
            />
            <span className="reader-muted shrink-0 text-xs tabular-nums">
              {searching && <Loader2 size={13} className="mr-1 inline animate-spin" />}
              {activeQuery
                ? results.length
                  ? `${resultIndex + 1} / ${results.length} page${results.length === 1 ? "" : "s"}`
                  : searching
                    ? "Searching"
                    : "No matches"
                : ""}
            </span>
            <ReaderButton label="Previous match" onClick={() => stepResult(-1)} disabled={!results.length}>
              <ChevronUp size={16} />
            </ReaderButton>
            <ReaderButton label="Next match" onClick={() => stepResult(1)} disabled={!results.length}>
              <ChevronDown size={16} />
            </ReaderButton>
            <ReaderButton label="Close search" onClick={closeSearch}>
              <X size={16} />
            </ReaderButton>
          </form>
        )}
      </div>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1">
        {busy && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
            <Loader2 size={22} className="animate-spin text-violet" />
            <p className="reader-muted text-xs font-medium">
              {fetching
                ? fetchProgress !== null
                  ? `Downloading… ${fetchProgress}%`
                  : "Opening document"
                : parseProgress !== null && parseProgress < 100
                  ? `Preparing… ${parseProgress}%`
                  : "Opening document"}
            </p>
            {fetching && fetchProgress !== null && (
              <div className="reader-chip h-1 w-40 overflow-hidden rounded-full">
                <div className="h-full bg-violet transition-[width]" style={{ width: `${fetchProgress}%` }} />
              </div>
            )}
          </div>
        )}

        {failed && (
          <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Expand size={22} className="reader-muted" />
            <p className="font-display text-lg">This document couldn&apos;t open</p>
            <p className="reader-muted max-w-md text-sm">
              {fetchError
                ? "The PDF could not be fetched for in-app reading. Check your connection or open the file directly."
                : "The file was downloaded but could not be rendered as a PDF."}
            </p>
            {src && !protect && (
              <a href={src} target="_blank" rel="noopener noreferrer" className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">
                Open PDF in browser
              </a>
            )}
            <button type="button" onClick={retry} className="text-sm font-semibold text-violet">
              Try again
            </button>
          </div>
        )}

        {file && !failed && (
          <Document
            key={attempt}
            file={file}
            suspense={false}
            loading={null}
            error={null}
            onLoadProgress={handleLoadProgress}
            onLoadSuccess={handleLoadSuccess}
            onSourceError={handleLoadError}
            onLoadError={handleLoadError}
            onItemClick={({ pageNumber }) => goToPage(pageNumber)}
            externalLinkTarget="_blank"
            className="flex min-h-0 min-w-0 flex-1"
          >
            {sidebarOpen && (
              <aside
                ref={setSidebarEl}
                aria-label="Page thumbnails"
                className="reader-bar shrink-0 overflow-y-auto border-r px-2 py-3"
                style={{ width: SIDEBAR_WIDTH }}
              >
                {sidebarEl &&
                  Array.from({ length: numPages }, (_, index) => (
                    <Thumb
                      key={index + 1}
                      number={index + 1}
                      dim={dims[index] || baseDim || DEFAULT_DIM}
                      rotation={rotation}
                      active={page === index + 1}
                      onSelect={goToPage}
                      root={sidebarEl}
                    />
                  ))}
              </aside>
            )}

            <div
              ref={setScrollEl}
              role="region"
              aria-label="Document pages"
              tabIndex={0}
              className="reader-scroll relative min-h-0 min-w-0 flex-1 overflow-auto outline-none"
            >
              {ready && avail && (
                <div
                  ref={innerRef}
                  className="flex flex-col items-center"
                  style={{
                    width: "max-content",
                    minWidth: "100%",
                    minHeight: single ? "100%" : undefined,
                    justifyContent: single ? "center" : undefined,
                    padding: `${padY}px ${padX}px ${single ? padY : padY + (isPhone ? 64 : 0)}px`,
                    gap,
                  }}
                >
                  {pageNumbers.map((number) => {
                    const { width, height } = sizeFor(number);
                    const dim = dims[number - 1] || baseDim;
                    return (
                      <PageSlot
                        key={single ? `single-${number}` : number}
                        number={number}
                        width={width}
                        height={height}
                        rendered={single || rendered.has(number)}
                        rotate={rotation ? ((dim?.rot || 0) + rotation) % 360 : undefined}
                        textRenderer={textRenderer}
                        registerEl={registerEl}
                        protect={protect}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </Document>
        )}

        {/* Phone page pill + single-page arrows */}
        {ready && !chromeHidden && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-2 md:hidden" style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            {single && (
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
                className="reader-pill pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
              >
                <ChevronLeft size={17} />
              </button>
            )}
            <div className="reader-pill pointer-events-auto flex h-9 items-center rounded-full px-3">{pageForm(true)}</div>
            {single && (
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= numPages}
                aria-label="Next page"
                className="reader-pill pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
              >
                <ChevronRight size={17} />
              </button>
            )}
          </div>
        )}

        {zoomToast !== null && (
          <div className="reader-pill pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums">
            {zoomToast}%
          </div>
        )}
      </div>

      {/* Phone options sheet */}
      <ReaderSheet open={menu === "sheet"} onClose={() => setMenu(null)} title="Reader options">
        <div className="space-y-4 pb-2">
          <ReaderMenuRow label="Zoom">
            <div className="flex items-center gap-2">
              <ReaderButton label="Zoom out" onClick={() => zoomBy(-1)} className="reader-chip">
                <Minus size={16} />
              </ReaderButton>
              <span className="w-14 text-center text-sm font-semibold tabular-nums">{percent}%</span>
              <ReaderButton label="Zoom in" onClick={() => zoomBy(1)} className="reader-chip">
                <Plus size={16} />
              </ReaderButton>
              <div className="flex-1">
                <ReaderSegment
                  label="Fit"
                  value={fit}
                  onChange={setFitMode}
                  options={[
                    { value: "width", label: "Width", icon: MoveHorizontal },
                    { value: "page", label: "Page", icon: MoveVertical },
                  ]}
                />
              </div>
            </div>
          </ReaderMenuRow>
          {displayOptions}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={toggleFullscreen} className="reader-btn reader-chip inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium">
              {fullscreen ? <Minimize size={14} /> : <Maximize size={14} />} {fullscreen ? "Exit full screen" : "Full screen"}
            </button>
            {showDownload && (
              <button type="button" onClick={handleDownload} className="reader-btn reader-chip inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium">
                <Download size={14} /> Download
              </button>
            )}
          </div>
          <p className="reader-muted text-[0.7rem]">Pinch to zoom · tap the page to hide controls{single ? " · swipe to turn pages" : ""}</p>
        </div>
      </ReaderSheet>
    </div>
  );
}

/**
 * In-app PDF reader.
 *
 * Props (all optional except src):
 *  - title, subtitle         shown in the toolbar when `onBack`/`showTitle` is set, or in full screen
 *  - docKey                  stable id used to remember last page + zoom (defaults to the URL without query)
 *  - onBack                  renders a back button and makes the toolbar the page header
 *  - actions                 extra toolbar nodes (e.g. "Practice with AI")
 *  - menuItems               [{ key, label, icon, onClick, active, disabled, spinning }] for the display menu
 *  - allowDownload/onDownload/fileName   download button (hidden when `protect`)
 *  - protect                 no download, no context menu, no text selection
 *  - onPageChange(page, total)  progress hook
 */
export default function PdfReader(props) {
  // Remount per file so position, zoom and caches never leak between documents.
  return <PdfReaderInner key={`${props.docKey || ""}|${props.src || ""}`} {...props} />;
}
