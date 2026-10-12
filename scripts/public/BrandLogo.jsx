/**
 * Academical — custom "a" mark + Clash Display wordmark.
 * No teal square; the PNG is the full mark.
 */
export default function BrandLogo({
  size = 36,
  showText = true,
  textClass = "text-text-primary",
  className = "",
  stacked = false,
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo-academical.png"
        alt="Academical"
        width={size}
        height={size}
        className="shrink-0 rounded-xl object-contain"
        style={{ width: size, height: size }}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = "/favicon.svg";
        }}
      />
      {showText && (
        <span
          className={`${
            stacked ? "block text-[13px] leading-tight" : "text-[15px] sm:text-base"
          } font-semibold tracking-tight ${textClass}`}
          style={{
            fontFamily: '"Clash Display", "Outfit", system-ui, sans-serif',
          }}
        >
          Academical
        </span>
      )}
    </div>
  );
}
