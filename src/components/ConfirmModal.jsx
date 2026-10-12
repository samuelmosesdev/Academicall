import Modal from "./Modal";

export default function ConfirmModal({ open, title, message, onCancel, onConfirm, confirmLabel = "Yes", cancelLabel = "Cancel" }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="space-y-8">
        <p className="text-[0.95rem] leading-relaxed text-text-secondary">{message}</p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="rounded-full border border-border-strong px-5 py-3 text-sm font-medium text-text-primary transition hover:bg-bg-panel-alt">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="btn-primary px-6 py-3 text-sm">
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
