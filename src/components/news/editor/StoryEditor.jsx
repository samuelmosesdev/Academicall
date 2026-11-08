import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, BubbleMenu, FloatingMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import {
  Bold, Italic, Link2, Unlink, Heading2, Heading3, Quote, List, ListOrdered, Minus, ImagePlus,
  MousePointerClick, Undo2, Redo2, Plus, Loader2, Check, X,
} from "lucide-react";
import { uploadImageToCloudinary } from "../../../lib/cloudinaryUpload";
import { notify } from "../../../lib/dialogs";
import { normalizeLink, safeUrl, wordCount } from "../newsMarkdown";
import { CtaButton, Figure, tidyMarkdown, toEditorMarkdown } from "./storyExtensions";

const MAX_IMAGE_MB = 12;

function Tool({ label, active, onClick, children, disabled }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={!!active} disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm transition disabled:opacity-40 ${active ? "bg-midnight text-white dark:bg-lemon dark:text-midnight" : "text-ink hover:bg-bg-hover"}`}>
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-border-light" aria-hidden="true" />;

/**
 * Substack-style story editor: format as you write, drop a photo or a link button anywhere in the story,
 * add links with the toolbar or Ctrl/Cmd+K. The story is saved as Markdown (see newsMarkdown.js).
 */
export default function StoryEditor({ value, onChange }) {
  const [uploading, setUploading] = useState(null); // percent while a photo uploads
  const [link, setLink] = useState(null); // { url, text } while the link box is open
  const fileRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const editorRef = useRef(null);
  const uploadRef = useRef(null);
  const openLinkRef = useRef(null);
  const initial = useRef(toEditorMarkdown(value));
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true, protocols: ["mailto", "tel"], validate: (href) => !!safeUrl(href) }),
      Placeholder.configure({ placeholder: ({ node }) => (node.type.name === "heading" ? "Subheading" : "Tell the story… press + for a photo, link button or divider") }),
      Figure,
      CtaButton,
      Markdown.configure({ html: true, breaks: true, tightLists: true, bulletListMarker: "-", linkify: false, transformPastedText: true }),
    ],
    content: initial.current,
    editorProps: {
      attributes: { "aria-label": "Story body", spellcheck: "true" },
      handlePaste: (_view, event) => {
        const file = [...(event.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        uploadRef.current?.(file);
        return true;
      },
      handleDrop: (view, event) => {
        const file = [...(event.dataTransfer?.files || [])].find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        uploadRef.current?.(file, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        return true;
      },
      handleKeyDown: (_view, event) => {
        if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          openLinkRef.current?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => onChangeRef.current?.(tidyMarkdown(ed.storage.markdown.getMarkdown())),
  });

  useEffect(() => { editorRef.current = editor; }, [editor]);

  /** Always leave a paragraph after a block so the writer can keep typing below it. */
  const ensureTrailingParagraph = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const last = ed.state.doc.lastChild;
    if (last && last.type.name !== "paragraph") ed.commands.insertContentAt(ed.state.doc.content.size, { type: "paragraph" });
  }, []);

  /**
   * Put a block (photo, button, divider) after the paragraph the writer is in. It replaces that paragraph only
   * when it is empty, and never overwrites selected text. `pos` is a drop position from a dragged-in photo.
   */
  const insertBlock = useCallback((node, pos) => {
    const ed = editorRef.current;
    if (!ed) return;
    const { doc, selection } = ed.state;
    const $at = pos != null ? doc.resolve(Math.min(pos, doc.content.size)) : selection.$to;
    let target;
    if ($at.depth === 0) target = $at.pos;
    else if (pos == null && selection.empty && $at.parent.type.name === "paragraph" && $at.parent.content.size === 0 && $at.depth === 1) {
      target = { from: $at.before(1), to: $at.after(1) };
    } else target = $at.after(1);
    ed.chain().focus().insertContentAt(target, node).run();
    ensureTrailingParagraph();
  }, [ensureTrailingParagraph]);

  const uploadImage = useCallback(async (file, pos) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { notify.error("That file isn't an image."); return; }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { notify.error(`Photos can be up to ${MAX_IMAGE_MB} MB.`); return; }
    setUploading(0);
    try {
      const result = await uploadImageToCloudinary(file, setUploading);
      insertBlock({ type: "figure", attrs: { src: result.secure_url, alt: "", caption: "" } }, pos);
    } catch (err) {
      notify.error(err?.message || "The photo didn't upload. Try again.");
    } finally {
      setUploading(null);
    }
  }, [insertBlock]);
  useEffect(() => { uploadRef.current = uploadImage; }, [uploadImage]);

  const openLink = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    setLink({ url: ed.getAttributes("link").href || "", text: "" });
  }, []);
  useEffect(() => { openLinkRef.current = openLink; }, [openLink]);

  function applyLink(e) {
    e?.preventDefault();
    const ed = editorRef.current;
    const href = normalizeLink(link.url);
    if (!ed) return;
    if (!href || !safeUrl(href)) { notify.error("Enter a web address, like https://example.com"); return; }
    // Decided now, from the live selection: with nothing selected we insert the link text as well.
    if (ed.state.selection.empty && !ed.isActive("link")) {
      ed.chain().focus().insertContent({ type: "text", text: link.text.trim() || href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      ed.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLink(null);
  }
  function removeLink() {
    editorRef.current?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLink(null);
  }

  if (!editor) return <div className="min-h-[22rem]" aria-busy="true" />;

  const linkNeedsText = !!link && editor.state.selection.empty && !editor.isActive("link");
  const words = wordCount(tidyMarkdown(editor.storage.markdown.getMarkdown()));
  const run = (fn) => () => fn(editor.chain().focus()).run();

  return (
    <div className="news-editor">
      <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-border-light bg-card-light/95 px-2 py-1.5 backdrop-blur" role="toolbar" aria-label="Formatting">
        <div className="flex flex-wrap items-center gap-0.5">
          <Tool label="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={run((c) => c.toggleBold())}><Bold size={16} /></Tool>
          <Tool label="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={run((c) => c.toggleItalic())}><Italic size={16} /></Tool>
          <Tool label="Add link (Ctrl+K)" active={editor.isActive("link")} onClick={openLink}><Link2 size={16} /></Tool>
          <Divider />
          <Tool label="Subheading" active={editor.isActive("heading", { level: 2 })} onClick={run((c) => c.toggleHeading({ level: 2 }))}><Heading2 size={17} /></Tool>
          <Tool label="Small subheading" active={editor.isActive("heading", { level: 3 })} onClick={run((c) => c.toggleHeading({ level: 3 }))}><Heading3 size={17} /></Tool>
          <Tool label="Pull quote" active={editor.isActive("blockquote")} onClick={run((c) => c.toggleBlockquote())}><Quote size={16} /></Tool>
          <Tool label="Bulleted list" active={editor.isActive("bulletList")} onClick={run((c) => c.toggleBulletList())}><List size={17} /></Tool>
          <Tool label="Numbered list" active={editor.isActive("orderedList")} onClick={run((c) => c.toggleOrderedList())}><ListOrdered size={17} /></Tool>
          <Divider />
          <Tool label="Add a photo" onClick={() => fileRef.current?.click()} disabled={uploading !== null}>{uploading !== null ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={17} />}</Tool>
          <Tool label="Add a link button" onClick={() => insertBlock({ type: "ctaButton", attrs: { label: "Read more", url: "" } })}><MousePointerClick size={16} /></Tool>
          <Tool label="Add a divider" onClick={() => insertBlock({ type: "horizontalRule" })}><Minus size={17} /></Tool>
          <span className="ml-auto flex items-center gap-0.5">
            <Tool label="Undo" onClick={run((c) => c.undo())} disabled={!editor.can().undo()}><Undo2 size={16} /></Tool>
            <Tool label="Redo" onClick={run((c) => c.redo())} disabled={!editor.can().redo()}><Redo2 size={16} /></Tool>
          </span>
        </div>
        {link && (
          <form onSubmit={applyLink} className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-border-light px-1 pb-1 pt-2">
            {linkNeedsText && (
              <input value={link.text} onChange={(e) => setLink((l) => ({ ...l, text: e.target.value }))} placeholder="Link text" aria-label="Link text"
                className="min-w-[8rem] flex-1 rounded-xl border border-border-light bg-paper px-3 py-1.5 text-sm text-ink focus:border-violet focus:outline-none" />
            )}
            <input autoFocus value={link.url} onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))} placeholder="Paste or type a link" aria-label="Link address" inputMode="url"
              className="min-w-[12rem] flex-[2] rounded-xl border border-border-light bg-paper px-3 py-1.5 text-sm text-ink focus:border-violet focus:outline-none" />
            <button type="submit" className="inline-flex items-center gap-1 rounded-full bg-midnight px-4 py-1.5 text-sm font-semibold text-white dark:bg-lemon dark:text-midnight"><Check size={14} /> Apply</button>
            {editor.isActive("link") && <button type="button" onClick={removeLink} className="inline-flex items-center gap-1 rounded-full border border-border-strong px-3 py-1.5 text-sm text-ink"><Unlink size={14} /> Remove</button>}
            <button type="button" onClick={() => setLink(null)} aria-label="Close link box" className="rounded-full p-1.5 text-ink-muted hover:bg-bg-hover"><X size={15} /></button>
          </form>
        )}
      </div>

      <BubbleMenu editor={editor} tippyOptions={{ duration: 120, maxWidth: 360 }}
        shouldShow={({ editor: ed, state }) => !state.selection.empty && ed.isEditable && !ed.isActive("figure") && !ed.isActive("ctaButton")}>
        <div className="flex items-center gap-0.5 rounded-xl bg-midnight p-1 shadow-lg">
          {[
            ["Bold", "bold", <Bold key="b" size={15} />, () => editor.chain().focus().toggleBold().run()],
            ["Italic", "italic", <Italic key="i" size={15} />, () => editor.chain().focus().toggleItalic().run()],
            ["Link", "link", <Link2 key="l" size={15} />, openLink],
          ].map(([label, name, icon, action]) => (
            <button key={label} type="button" aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={action}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${editor.isActive(name) ? "bg-white/25" : "hover:bg-white/15"}`}>{icon}</button>
          ))}
          <button type="button" aria-label="Subheading" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${editor.isActive("heading", { level: 2 }) ? "bg-white/25" : "hover:bg-white/15"}`}><Heading2 size={16} /></button>
          <button type="button" aria-label="Pull quote" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${editor.isActive("blockquote") ? "bg-white/25" : "hover:bg-white/15"}`}><Quote size={15} /></button>
        </div>
      </BubbleMenu>

      <FloatingMenu editor={editor} tippyOptions={{ duration: 120, placement: "left-start", offset: [0, 10] }}
        shouldShow={({ state }) => {
          const { $from, empty } = state.selection;
          return empty && $from.parent.type.name === "paragraph" && $from.parent.content.size === 0 && $from.depth === 1;
        }}>
        <div className="flex items-center gap-1 rounded-full border border-border-light bg-card-light p-1 shadow-md">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-midnight text-white dark:bg-lemon dark:text-midnight"><Plus size={15} /></span>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg-hover"><ImagePlus size={14} /> Photo</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertBlock({ type: "ctaButton", attrs: { label: "Read more", url: "" } })} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg-hover"><MousePointerClick size={14} /> Button</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertBlock({ type: "horizontalRule" })} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg-hover"><Minus size={14} /> Divider</button>
        </div>
      </FloatingMenu>

      <div className="relative pt-6">
        <EditorContent editor={editor} />
        {uploading !== null && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-midnight px-4 py-2 text-sm text-white shadow-lg" role="status">
            <Loader2 size={15} className="animate-spin" /> Uploading photo{uploading ? ` ${uploading}%` : "…"}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-muted">{words.toLocaleString()} words · about {Math.max(1, Math.round(words / 220))} min read · drop or paste a photo anywhere in the story</p>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { uploadImage(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
