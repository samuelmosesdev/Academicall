import { Link } from "react-router-dom";
import { MessageCircle, Newspaper } from "lucide-react";
import { REACTIONS, timeAgo } from "../../lib/newsApi";

export function Cover({ post, className = "", eager }) {
  return (
    <div className={`news-card-img ${className}`}>
      {post.coverUrl ? (
        <img src={post.coverUrl} alt="" loading={eager ? "eager" : "lazy"} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-violet/40"><Newspaper size={36} /></div>
      )}
    </div>
  );
}

export function Byline({ post, light }) {
  const a = post.author || {};
  return (
    <div className={`flex items-center gap-2 text-xs ${light ? "text-white/70" : "text-ink-muted"}`}>
      {a.photoUrl ? <img src={a.photoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet text-[10px] font-semibold text-white">{(a.name || "A").slice(0, 1)}</span>}
      <span className={`font-medium ${light ? "text-white" : "text-ink"}`}>{a.name}</span>
      <span>·</span>
      <span>{timeAgo(post.publishedAt || post.updatedAt)}</span>
      <span>·</span>
      <span>{post.readMinutes} min read</span>
    </div>
  );
}

export function Engagement({ post }) {
  const top = REACTIONS.filter((r) => post.reactions?.[r.type]).sort((a, b) => post.reactions[b.type] - post.reactions[a.type]).slice(0, 3);
  return (
    <div className="flex items-center gap-3 text-xs text-ink-muted">
      {post.reactionTotal > 0 && (
        <span className="inline-flex items-center gap-1">
          <span className="tracking-[-0.15em]">{top.map((r) => r.emoji).join("")}</span>
          <span className="num ml-1">{post.reactionTotal}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> <span className="num">{post.commentCount}</span></span>
    </div>
  );
}

export function StoryCard({ post }) {
  return (
    <Link to={`/news/${post.slug}`} className="group flex flex-col">
      <Cover post={post} className="aspect-[16/10]" />
      <div className="mt-3.5 flex items-center gap-2">
        <span className="news-tag">{post.category}</span>
      </div>
      <h3 className="mt-2 font-display text-[1.28rem] leading-snug text-ink transition-colors group-hover:text-violet">{post.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{post.excerpt}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Byline post={post} />
      </div>
      <div className="mt-2"><Engagement post={post} /></div>
    </Link>
  );
}

/** Body text: blank-line paragraphs, "## " subheads, "> " pull quotes, **bold**. */
export function Prose({ body }) {
  const blocks = String(body || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const inline = (t) => t.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (/^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part));
  return (
    <div className="news-prose">
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i}>{inline(b.slice(3))}</h2>;
        if (b.startsWith("> ")) return <blockquote key={i}>{inline(b.replace(/^>\s?/gm, ""))}</blockquote>;
        return <p key={i}>{b.split("\n").map((line, j, arr) => <span key={j}>{inline(line)}{j < arr.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}
