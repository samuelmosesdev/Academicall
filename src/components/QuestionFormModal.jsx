import { useEffect, useState } from "react";
import { X, Plus, Trash2, ImagePlus, Loader2 } from "lucide-react";
import { uploadImageToCloudinary } from "../lib/cloudinaryUpload";
import { DIFFICULTIES } from "../lib/questionsExcel";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

function emptyOptions() {
  return [
    { id: "A", text: "" },
    { id: "B", text: "" },
  ];
}

function blankForm() {
  return {
    type: "objective",
    text: "",
    imageUrl: "",
    options: emptyOptions(),
    correctOptionId: "A",
    marks: "",
    batch: "",
    difficulty: "Medium",
    subject: "",
  };
}

export default function QuestionFormModal({ open, onClose, initial, onSave, busy, existingBatches = [] }) {
  const [form, setForm] = useState(blankForm());
  const [error, setError] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        type: initial.type || "objective",
        text: initial.text || "",
        imageUrl: initial.imageUrl || "",
        options: initial.options?.length ? initial.options : emptyOptions(),
        correctOptionId: initial.correctOptionId || "A",
        marks: initial.marks ?? "",
        batch: initial.batch || "",
        difficulty: initial.difficulty || "Medium",
        subject: initial.subject || "",
      });
    } else {
      setForm(blankForm());
    }
    setError("");
  }, [open, initial]);

  if (!open) return null;

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateOption(id, text) {
    setForm((f) => ({ ...f, options: f.options.map((o) => (o.id === id ? { ...o, text } : o)) }));
  }

  function addOption() {
    setForm((f) => {
      const used = new Set(f.options.map((o) => o.id));
      const nextLetter = OPTION_LETTERS.find((l) => !used.has(l));
      if (!nextLetter || f.options.length >= 6) return f;
      return { ...f, options: [...f.options, { id: nextLetter, text: "" }] };
    });
  }

  function removeOption(id) {
    setForm((f) => {
      if (f.options.length <= 2) return f;
      const options = f.options.filter((o) => o.id !== id);
      const correctOptionId = f.correctOptionId === id ? options[0]?.id : f.correctOptionId;
      return { ...f, options, correctOptionId };
    });
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setImageUploading(true);
    setImageProgress(0);
    try {
      const result = await uploadImageToCloudinary(file, setImageProgress);
      update("imageUrl", result.secure_url);
    } catch (err) {
      setError(err.message || "Image upload failed.");
    } finally {
      setImageUploading(false);
      setImageProgress(0);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.text.trim()) return setError("Question text is required.");
    if (!form.batch.trim()) return setError("Batch is required — this is how questions get grouped.");
    if (!form.difficulty) return setError("Choose a difficulty level.");

    let payload = {
      type: form.type,
      text: form.text.trim(),
      imageUrl: form.imageUrl || null,
      marks: form.marks !== "" ? Number(form.marks) : null,
      batch: form.batch.trim(),
      difficulty: form.difficulty,
      subject: form.subject.trim() || null,
    };

    if (form.type === "objective") {
      const options = form.options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text);
      if (options.length < 2) return setError("Add at least two options.");
      if (!options.some((o) => o.id === form.correctOptionId)) return setError("Pick which option is correct.");
      payload = { ...payload, options, correctOptionId: form.correctOptionId };
    } else {
      payload = { ...payload, options: [], correctOptionId: null };
    }

    onSave(payload);
  }

  const fieldClass =
    "w-full rounded-lg border border-border-subtle bg-bg-panel-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-midnight/55 backdrop-blur-[3px] px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-border-subtle bg-bg-panel p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">
            {initial ? "Edit question" : "Add question"}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            {["objective", "essay"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update("type", t)}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  form.type === t
                    ? "bg-accent text-bg-app"
                    : "border border-border-subtle text-text-secondary hover:text-text-primary"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Question text</label>
            <textarea
              value={form.text}
              onChange={(e) => update("text", e.target.value)}
              rows={3}
              placeholder="Type the question here…"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Image (optional)</label>
            {form.imageUrl ? (
              <div className="flex items-center gap-3">
                <img src={form.imageUrl} alt="Question" className="h-20 w-20 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => update("imageUrl", "")}
                  className="text-xs font-medium text-status-danger hover:underline"
                >
                  Remove image
                </button>
              </div>
            ) : (
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent">
                <ImagePlus size={15} />
                {imageUploading ? `Uploading… ${imageProgress}%` : "Add image"}
                <input type="file" accept="image/*" onChange={handleImagePick} disabled={imageUploading} className="hidden" />
              </label>
            )}
          </div>

          {form.type === "objective" && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-medium text-text-secondary">
                  Options — select the correct one
                </label>
                {form.options.length < 6 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    <Plus size={13} /> Add option
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {form.options.map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => update("correctOptionId", o.id)}
                      aria-label={`Mark option ${o.id} correct`}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                        form.correctOptionId === o.id
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border-subtle text-text-muted hover:border-accent"
                      }`}
                    >
                      {o.id}
                    </button>
                    <input
                      value={o.text}
                      onChange={(e) => updateOption(o.id, e.target.value)}
                      placeholder={`Option ${o.id}`}
                      className={fieldClass}
                    />
                    {form.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(o.id)}
                        className="shrink-0 text-text-muted hover:text-status-danger"
                        aria-label="Remove option"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Batch</label>
              <input
                value={form.batch}
                onChange={(e) => update("batch", e.target.value)}
                placeholder="e.g. Batch 2026 - Mock 1"
                list="batch-suggestions"
                className={fieldClass}
              />
              <datalist id="batch-suggestions">
                {existingBatches.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Difficulty</label>
              <select value={form.difficulty} onChange={(e) => update("difficulty", e.target.value)} className={fieldClass}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Marks</label>
              <input
                type="number"
                min="0"
                value={form.marks}
                onChange={(e) => update("marks", e.target.value)}
                placeholder="e.g. 1"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Subject</label>
              <input
                value={form.subject}
                onChange={(e) => update("subject", e.target.value)}
                placeholder="Optional"
                className={fieldClass}
              />
            </div>
          </div>

          {error && <p className="text-sm text-status-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || imageUploading}
              className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-bg-app hover:bg-accent-strong disabled:opacity-60"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {initial ? "Save changes" : "Add question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
