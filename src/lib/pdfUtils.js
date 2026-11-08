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

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "heic", "svg"];
const OFFICE_EXT = ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "odt", "odp", "ods", "rtf"];

function extensionOf(item = {}) {
  const pick = (value) => {
    const last = String(value || "").split(/[?#]/, 1)[0].split("/").pop() || "";
    const match = last.match(/\.([a-z0-9]{2,5})$/i);
    return match ? match[1].toLowerCase() : "";
  };
  return pick(item.fileName) || pick(item.fileUrl);
}

/** "pdf" | "image" | "office" | "other" — decides which in-app viewer a file opens in. */
export function getFileKind(item = {}) {
  const type = String(item.mimeType || item.contentType || item.type || "").toLowerCase();
  const ext = extensionOf(item);
  if (type.startsWith("image/") || IMAGE_EXT.includes(ext)) return "image";
  if (isPdfFile(item)) return "pdf";
  if (
    OFFICE_EXT.includes(ext) ||
    /msword|ms-excel|ms-powerpoint|officedocument|opendocument|rtf/.test(type)
  ) {
    return "office";
  }
  return "other";
}

/** Embedded viewer URL for office documents (Google Docs viewer, as before). */
export function officeViewerUrl(fileUrl) {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
}
