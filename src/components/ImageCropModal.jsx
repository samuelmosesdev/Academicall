import { useEffect, useRef, useState } from "react";
import { X, Check } from "lucide-react";

/**
 * Simple resize/zoom before upload. Outputs a square JPEG data URL.
 */
export default function ImageCropModal({ file, open, onClose, onDone }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open || !file) return;
    setReady(false);
    setZoom(1);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
      draw(img, 1);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  useEffect(() => {
    if (ready && imgRef.current) draw(imgRef.current, zoom);
  }, [zoom, ready]);

  function draw(img, z) {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const size = 320;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, size, size);
    const scale = Math.max(size / img.width, size / img.height) * z;
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (size - w) / 2;
    const y = (size - h) / 2;
    ctx.drawImage(img, x, y, w, h);
  }

  function confirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    onDone?.(dataUrl);
    onClose?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-midnight/55 backdrop-blur-[3px] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border-light bg-card-light p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Adjust photo</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-bg-panel-alt">
            <X size={18} />
          </button>
        </div>
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="rounded-2xl border border-border-light bg-black"
            style={{ width: 280, height: 280 }}
          />
        </div>
        <label className="mt-4 block text-xs font-medium text-ink-muted">
          Zoom
          <input
            type="range"
            min="1"
            max="2.5"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-light px-3 py-2 text-sm text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-2 text-sm font-semibold text-white"
          >
            <Check size={16} /> Use photo
          </button>
        </div>
      </div>
    </div>
  );
}
