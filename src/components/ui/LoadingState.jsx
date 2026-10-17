import { SkeletonPage } from "./Skeleton";

/** Page-level loading: a skeleton the size of the content, so nothing jumps. */
export default function LoadingState({ message = "Loading…", className = "", compact = false }) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-4 sm:px-8 ${className}`}>
      <SkeletonPage label={message} compact={compact} />
    </div>
  );
}
