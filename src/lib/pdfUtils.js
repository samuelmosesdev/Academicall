export function isPdfFile(item = {}) {
  const name = String(item.fileName || "").toLowerCase();
  const url = String(item.fileUrl || "").toLowerCase();
  const type = String(item.mimeType || item.contentType || item.type || "").toLowerCase();
  if (type === "application/pdf" || type.startsWith("application/pdf;")) return true;
  if (/\.pdf(?:$|[?#])/.test(name) || /\.pdf(?:$|[?#])/.test(url)) return true;
  if (
    /^[a-z0-9.+-]+\/[a-z0-9.+-]+/.test(type) &&
    !["application/octet-stream", "binary/octet-stream"].includes(type.split(";")[0])
  ) {
    return false;
  }

  const nameHasExtension = /\.[a-z0-9]{2,5}$/.test(name);
  const lastPathSegment = url.split(/[?#]/, 1)[0].split("/").pop() || "";
  const urlHasExtension = /\.[a-z0-9]{2,5}$/.test(lastPathSegment);
  if (nameHasExtension || urlHasExtension) return false;

  // Legacy raw uploads may have neither a file extension nor MIME metadata.
  return true;
}
