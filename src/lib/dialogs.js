/**
 * App-wide replacements for window.alert / confirm / prompt.
 *
 *   import { appConfirm, appPrompt, notify } from "../lib/dialogs";
 *   if (!(await appConfirm("Delete this message?", { tone: "danger" }))) return;
 *   const reason = await appPrompt("Why?", { required: true });
 *   notify.success("Saved");
 *
 * <DialogProvider> (mounted once in main.jsx) registers the real implementation.
 */
let impl = null;
const pending = [];

export function registerDialogs(next) {
  impl = next;
  while (impl && pending.length) {
    const job = pending.shift();
    job();
  }
}

function whenReady(fn) {
  return new Promise((resolve) => {
    const run = () => resolve(fn());
    if (impl) run();
    else pending.push(run);
  });
}

const ERROR_RE = /(could not|couldn't|cannot|can't|failed|error|unable|invalid|not allowed|denied|too large|limit|wrong|missing|expired|no longer)/i;
const SUCCESS_RE = /(saved|success|done|copied|sent|updated|created|added|approved|removed|deleted|published|uploaded|welcome|joined)/i;

function guessTone(message) {
  const text = String(message || "");
  if (ERROR_RE.test(text)) return "error";
  if (SUCCESS_RE.test(text)) return "success";
  return "info";
}

/** Drop-in for alert(): a non-blocking toast (long messages open a dialog). */
export function appAlert(message, opts = {}) {
  const text = String(message ?? "");
  return whenReady(() =>
    text.length > 160 || opts.dialog
      ? impl.alert(text, opts)
      : impl.toast({ message: text, tone: opts.tone || guessTone(text), title: opts.title })
  );
}

/** Drop-in for confirm(): resolves true / false. */
export function appConfirm(message, opts = {}) {
  return whenReady(() => impl.confirm(String(message ?? ""), opts));
}

/** Drop-in for prompt(): resolves the text, or null when cancelled. */
export function appPrompt(message, opts = {}) {
  return whenReady(() => impl.prompt(String(message ?? ""), opts));
}

export const notify = {
  success: (message, opts = {}) => whenReady(() => impl.toast({ ...opts, message, tone: "success" })),
  error: (message, opts = {}) => whenReady(() => impl.toast({ ...opts, message, tone: "error" })),
  info: (message, opts = {}) => whenReady(() => impl.toast({ ...opts, message, tone: "info" })),
};
