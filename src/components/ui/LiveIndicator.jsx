import { useRealtimeStatus } from "../../lib/realtime";

/** Small "Live / Reconnecting / Offline" pill for real-time screens. */
export default function LiveIndicator({ className = "" }) {
  const status = useRealtimeStatus();
  const map = {
    live: { label: "Live", dot: "bg-aqua-deep live-dot", text: "text-aqua-deep", bg: "bg-aqua-soft" },
    connecting: { label: "Reconnecting…", dot: "bg-status-warning live-dot", text: "text-midnight", bg: "bg-lemon-soft" },
    offline: { label: "Offline", dot: "bg-text-muted", text: "text-text-muted", bg: "bg-bg-panel-alt" },
  };
  const s = map[status] || map.offline;
  return (
    <span
      role="status"
      aria-live="polite"
      title={status === "live" ? "Updates appear automatically" : status === "connecting" ? "Trying to reconnect. New messages will appear once connected." : "You're offline. We'll catch up when you're back."}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.bg} ${s.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
