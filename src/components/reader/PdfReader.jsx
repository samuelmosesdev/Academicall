import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Loader2,
  Maximize,
  Minimize,
  Minus,
  MoveHorizontal,
  Plus,
  RotateCw,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const MAX_PAGE_WIDTH = 920;

function ToolButton({ label, onClick, disabled = false, active = false, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-30 ${
        active ? "bg-lemon text-midnight" : "text-white/85 hover:bg-white/10 hover:text-white"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export default function PdfReader({ src, title }) {
  const file = useMemo(() => (src ? { url: src } : null), [src]);
  const shellRef = useRef(null);
  const scrollRef = useRef(null);
  const pageRefs = useRef([]);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const [pageRatio, setPageRatio] = useState(1.414);
  const [visiblePages, setVisiblePages] = useState(() => new Set([1, 2]));
  const [fullscreen, setFullscreen] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [fetching, setFetching] = useState(Boolean(src));
  const [progress, setProgress] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setNumPages(0);
    setPage(1);
    setPageInput("1");
    setVisiblePages(new Set([1, 2]));
    setLoadError(null);
    setFetching(Boolean(src));
    setProgress(null);
    setRotation(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [src]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pageWidth = Math.max(
    240,
    Math.round(Math.min(containerWidth - (containerWidth < 640 ? 16 : 48), MAX_PAGE_WIDTH) * (fitWidth ? 1 : zoom))
  );
  const pageHeight = Math.round(pageWidth * (rotation % 180 ? 1 / pageRatio : pageRatio));

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !numPages) return undefined;

    const nearbyObserver = new IntersectionObserver(
      (entries) => {
        setVisiblePages((previous) => {
          const next = new Set(previous);
          let changed = false;
          entries.forEach((entry) => {
            const number = Number(entry.target.dataset.page);
            if (entry.isIntersecting && !next.has(number)) {
              next.add(number);
              changed = true;
            }
          });
          return changed ? next : previous;
        });
      },
      { root, rootMargin: "150% 0px" }
    );
    const currentObserver = new IntersectionObserver(
      (entries) => {
        const current = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (current) {
          const number = Number(current.target.dataset.page);
          setPage(number);
          setPageInput(String(number));
        }
      },
      { root, threshold: [0.35, 0.6] }
    );

    pageRefs.current.slice(0, numPages).forEach((element) => {
      if (element) {
        nearbyObserver.observe(element);
        currentObserver.observe(element);
      }
    });
    return () => {
      nearbyObserver.disconnect();
      currentObserver.disconnect();
    };
  }, [numPages, pageWidth]);

  const goToPage = useCallback(
    (requestedPage) => {
      if (!numPages) return;
      const targetPage = Math.min(Math.max(1, requestedPage), numPages);
      setVisiblePages((previous) => new Set(previous).add(targetPage));
      const element = pageRefs.current[targetPage - 1];
      if (element && scrollRef.current) {
        scrollRef.current.scrollTo({ top: element.offsetTop - 12, behavior: "smooth" });
      }
      setPage(targetPage);
      setPageInput(String(targetPage));
    },
    [numPages]
  );

  const zoomBy = useCallback(
    (direction) => {
      const currentZoom = fitWidth ? 1 : zoom;
      const index = ZOOMS.findIndex((value) => value >= currentZoom - 0.001);
      const nextIndex = Math.min(
        Math.max(0, (index === -1 ? ZOOMS.length - 1 : index) + direction),
        ZOOMS.length - 1
      );
      setFitWidth(false);
      setZoom(ZOOMS[nextIndex]);
    },
    [fitWidth, zoom]
  );

  const toggleFullscreen = useCallback(async () => {
    const element = shellRef.current;
    if (!fullscreen) {
      try {
        if (element?.requestFullscreen) await element.requestFullscreen();
      } catch {
        // Keep the CSS fullscreen mode as a fallback on browsers that block the API.
      }
      setFullscreen(true);
    } else {
      if (document.fullscreenElement) await document.exitFullscreen();
      setFullscreen(false);
    }
  }, [fullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      const target = event.target;
      if (!fullscreen && !shellRef.current?.contains(document.activeElement)) return;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && ["=", "+"].includes(event.key)) {
        event.preventDefault();
        zoomBy(1);
      } else if ((event.ctrlKey || event.metaKey) && event.key === "-") {
        event.preventDefault();
        zoomBy(-1);
      } else if (event.key === "ArrowRight" || event.key === "PageDown") {
        goToPage(page + 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        goToPage(page - 1);
      } else if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
      } else if (event.key === "Escape" && fullscreen && !document.fullscreenElement) {
        setFullscreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreen, goToPage, page, toggleFullscreen, zoomBy]);

  const handleLoadProgress = useCallback(({ loaded, total }) => {
    setFetching(true);
    setProgress(total ? Math.min(100, Math.round((loaded / total) * 100)) : null);
  }, []);

  const handleLoadSuccess = useCallback((pdf) => {
    setFetching(false);
    setProgress(null);
    setNumPages(pdf.numPages);
    pdf
      .getPage(1)
      .then((firstPage) => {
        const viewport = firstPage.getViewport({ scale: 1 });
        setPageRatio(viewport.height / viewport.width);
      })
      .catch((error) => console.error("Could not read PDF page dimensions:", error));
  }, []);

  const handleLoadError = useCallback((error) => {
    setFetching(false);
    setLoadError(error);
  }, []);

  function retry() {
    setLoadError(null);
    setFetching(true);
    setProgress(null);
    setAttempt((current) => current + 1);
  }

  const failed = Boolean(loadError);
  const zoomLabel = fitWidth ? "Fit" : `${Math.round(zoom * 100)}%`;

  return (
    <div
      ref={shellRef}
      className={`flex min-h-0 flex-col bg-[#ece8df] dark:bg-[#0b0220] ${
        fullscreen ? "fixed inset-0 z-[80]" : "h-full w-full"
      }`}
    >
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto bg-midnight px-2 py-1.5 text-white sm:gap-2 sm:px-3">
        {fullscreen && title && (
          <p className="mr-2 hidden max-w-[28ch] truncate font-display text-sm text-white/90 md:block">
            {title}
          </p>
        )}
        <div className="flex items-center gap-0.5">
          <ToolButton label="Previous page" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
            <ChevronLeft size={17} />
          </ToolButton>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              goToPage(Number(pageInput) || 1);
            }}
            className="flex items-center gap-1.5 text-xs tabular-nums text-white/70"
          >
            <input
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value.replace(/[^0-9]/g, ""))}
              onBlur={() => setPageInput(String(page))}
              inputMode="numeric"
              aria-label="Page number"
              className="h-8 w-11 rounded-full bg-white/10 text-center text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-lemon"
            />
            <span className="whitespace-nowrap">/ {numPages || "–"}</span>
          </form>
          <ToolButton
            label="Next page"
            onClick={() => goToPage(page + 1)}
            disabled={!numPages || page >= numPages}
          >
            <ChevronRight size={17} />
          </ToolButton>
        </div>

        <span className="mx-1 h-5 w-px shrink-0 bg-white/15" />
        <div className="flex items-center gap-0.5">
          <ToolButton label="Zoom out" onClick={() => zoomBy(-1)} disabled={!fitWidth && zoom <= ZOOMS[0]}>
            <Minus size={16} />
          </ToolButton>
          <button
            type="button"
            onClick={() => setFitWidth((value) => !value)}
            title="Toggle fit to width"
            className="h-8 min-w-[52px] rounded-full bg-white/10 px-2 text-xs font-semibold tabular-nums text-white hover:bg-white/15"
          >
            {zoomLabel}
          </button>
          <ToolButton label="Zoom in" onClick={() => zoomBy(1)} disabled={!fitWidth && zoom >= ZOOMS[ZOOMS.length - 1]}>
            <Plus size={16} />
          </ToolButton>
          <ToolButton label="Fit to width" onClick={() => setFitWidth(true)} active={fitWidth} className="hidden sm:flex">
            <MoveHorizontal size={16} />
          </ToolButton>
          <ToolButton label="Rotate" onClick={() => setRotation((value) => (value + 90) % 360)} className="hidden sm:flex">
            <RotateCw size={15} />
          </ToolButton>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ToolButton
            label={fullscreen ? "Exit full screen" : "Full screen"}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </ToolButton>
        </div>
      </div>

      <div
        ref={scrollRef}
        role="region"
        aria-label="PDF pages"
        tabIndex={0}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain outline-none"
      >
        {(fetching || (!failed && !numPages)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-muted">
            <Loader2 size={22} className="animate-spin text-teal" />
            <p className="eyebrow">Opening document</p>
          </div>
        )}
        {failed && (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <Expand size={22} className="text-ink-muted" />
            <p className="font-display text-lg text-ink">This document couldn&apos;t open</p>
            <p className="max-w-md text-sm text-ink-muted">
              The PDF could not be loaded for in-app reading. Check your connection or open the file directly.
            </p>
            {src && (
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white"
              >
                Open PDF in browser
              </a>
            )}
            <button type="button" onClick={retry} className="text-sm font-semibold text-teal">
              Try again
            </button>
          </div>
        )}
        {file && !failed && (
          <Document
            key={attempt}
            file={file}
            loading={null}
            error={null}
            onLoadProgress={handleLoadProgress}
            onLoadSuccess={handleLoadSuccess}
            onSourceError={handleLoadError}
            onLoadError={handleLoadError}
            className="flex w-max min-w-full flex-col gap-3 px-2 py-4 sm:gap-5 sm:px-6 sm:py-6"
          >
            {Array.from({ length: numPages }, (_, index) => {
              const number = index + 1;
              return (
                <div
                  key={number}
                  data-page={number}
                  ref={(element) => {
                    pageRefs.current[index] = element;
                  }}
                  className="relative mx-auto"
                  style={{ width: pageWidth, minHeight: pageHeight }}
                >
                  {visiblePages.has(number) ? (
                    <Page
                      pageNumber={number}
                      width={pageWidth}
                      rotate={rotation}
                      loading={<div className="bg-white" style={{ width: pageWidth, height: pageHeight }} />}
                      className="overflow-hidden rounded-md bg-white shadow-[0_10px_30px_-18px_rgba(15,3,38,0.45)] ring-1 ring-black/5"
                      renderAnnotationLayer
                      renderTextLayer
                    />
                  ) : (
                    <div
                      className="rounded-md bg-white/70 ring-1 ring-black/5"
                      style={{ width: pageWidth, height: pageHeight }}
                    />
                  )}
                  {fetching && progress !== null && (
                    <div className="absolute inset-x-4 bottom-4 mx-auto max-w-xs rounded-full bg-midnight/90 px-4 py-2 text-center text-xs text-white">
                      Loading PDF… {progress}%
                    </div>
                  )}
                </div>
              );
            })}
          </Document>
        )}
      </div>
    </div>
  );
}
