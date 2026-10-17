/**
 * Renders a deterministic barcode-like pattern from the user's real
 * uniqueId (generated at signup, e.g. "UAR-24-8831"). Purely decorative --
 * not a scannable barcode -- but the bar pattern is derived from the actual
 * ID so it isn't a static placeholder image.
 */
export default function UniqueIdBadge({ uniqueId }) {
  const id = uniqueId || "PENDING";
  const bars = Array.from(id).map((ch, i) => ((ch.charCodeAt(0) * (i + 1)) % 4) + 1);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-light bg-card-light px-3 py-1.5">
      <div className="flex h-6 items-end gap-[2px]">
        {bars.map((w, i) => (
          <span
            key={i}
            className="bg-ink"
            style={{ width: 2, height: `${w * 5 + 4}px` }}
          />
        ))}
      </div>
      <span className="font-mono text-xs font-medium text-ink-muted">{id}</span>
    </div>
  );
}
