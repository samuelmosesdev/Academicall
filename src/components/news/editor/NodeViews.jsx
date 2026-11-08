import { NodeViewWrapper } from "@tiptap/react";
import { X } from "lucide-react";

/** A photo in the middle of a story, with an editable caption. */
export function FigureView({ node, updateAttributes, deleteNode, selected }) {
  const { src, caption } = node.attrs;
  return (
    <NodeViewWrapper as="figure" className="group relative my-7" data-drag-handle>
      <img src={src} alt={caption || ""} draggable={false} className={`block w-full rounded-2xl bg-bg-panel-alt ${selected ? "ring-2 ring-[#454ade] ring-offset-2" : ""}`} />
      <button type="button" onClick={deleteNode} aria-label="Remove photo" contentEditable={false}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-midnight/75 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100">
        <X size={15} />
      </button>
      <input value={caption || ""} onChange={(e) => updateAttributes({ caption: e.target.value, alt: e.target.value })}
        placeholder="Add a caption (optional)" aria-label="Photo caption" maxLength={200} contentEditable={false}
        className="mt-2.5 w-full bg-transparent text-center text-sm text-ink-muted placeholder:text-ink-muted/60 focus:outline-none" />
    </NodeViewWrapper>
  );
}

/** A call-to-action link button, edited in place. */
export function CtaView({ node, updateAttributes, deleteNode, selected }) {
  const { label, url } = node.attrs;
  return (
    <NodeViewWrapper className="my-6" data-drag-handle>
      <div contentEditable={false} className={`rounded-2xl border border-dashed p-4 ${selected ? "border-[#454ade] bg-[#454ade]/5" : "border-border-strong"}`}>
        <div className="mb-3 flex justify-center">
          <span className="inline-block rounded-full bg-midnight px-7 py-3 text-sm font-semibold text-white dark:bg-lemon dark:text-midnight">{label || "Button text"}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
          <input value={label || ""} onChange={(e) => updateAttributes({ label: e.target.value })} placeholder="Button text" aria-label="Button text" maxLength={60}
            className="rounded-xl border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-violet focus:outline-none" />
          <input value={url || ""} onChange={(e) => updateAttributes({ url: e.target.value })} placeholder="https://where-it-goes.com" aria-label="Button link" inputMode="url"
            className="rounded-xl border border-border-light bg-card-light px-3 py-2 text-sm text-ink focus:border-violet focus:outline-none" />
          <button type="button" onClick={deleteNode} className="rounded-xl border border-border-light px-3 py-2 text-sm text-ink-muted hover:text-status-danger">Remove</button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
