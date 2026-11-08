import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Newspaper } from "lucide-react";
import { REACTIONS, timeAgo } from "../../lib/newsApi";
import { parseBlocks, safeUrl } from "./newsMarkdown";

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
        : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet text-[0.7rem] font-semibold text-white">{(a.name || "A").slice(0, 1)}</span>}
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

/** Story content is parsed into React nodes; no story HTML is injected into the page. */
export function Prose({ body }) {
  const blocks = useMemo(() => parseBlocks(body), [body]);
  return (
    <div className="news-prose">
      {blocks.map((block, i) => <StoryBlock key={i} block={block} />)}
    </div>
  );
}

function Inline({ nodes }) {
  return nodes.map((node, i) => {
    if (node.t === "text") return node.v;
    if (node.t === "br") return <br key={i} />;
    if (node.t === "strong") return <strong key={i}><Inline nodes={node.c} /></strong>;
    if (node.t === "em") return <em key={i}><Inline nodes={node.c} /></em>;
    if (node.t === "code") return <code key={i}>{node.v}</code>;
    const href = safeUrl(node.href);
    if (!href) return <Inline key={i} nodes={node.c} />;
    const external = !href.startsWith("/");
    return <a key={i} href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}><Inline nodes={node.c} /></a>;
  });
}

function StoryBlock({ block }) {
  if (block.type === "h2") return <><h2><Inline nodes={block.c} /></h2>{block.rest && <Prose body={block.rest} />}</>;
  if (block.type === "h3") return <><h3><Inline nodes={block.c} /></h3>{block.rest && <Prose body={block.rest} />}</>;
  if (block.type === "quote") return <blockquote><Inline nodes={block.c} /></blockquote>;
  if (block.type === "hr") return <hr />;
  if (block.type === "ul") return <ul>{block.items.map((item, i) => <li key={i}><Inline nodes={item} /></li>)}</ul>;
  if (block.type === "ol") return <ol>{block.items.map((item, i) => <li key={i}><Inline nodes={item} /></li>)}</ol>;
  if (block.type === "image") {
    const src = safeUrl(block.src, { image: true });
    if (!src) return null;
    return <figure><img src={src} alt={block.alt || block.caption || ""} loading="lazy" decoding="async" />{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
  }
  if (block.type === "button") {
    const href = safeUrl(block.href);
    if (!href) return null;
    const external = !href.startsWith("/");
    return <p className="news-cta-row"><a className="news-cta" href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}>{block.label}</a></p>;
  }
  return <p><Inline nodes={block.c} /></p>;
}
