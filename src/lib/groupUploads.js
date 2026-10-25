/**
 * Uploads for study-group messages: client-side checks (mirrored on the server),
 * photo compression, video length check, and R2 upload with progress + cancel.
 */
import { uploadFileToR2 } from "./cloudinaryUpload";

export const GROUP_LIMITS = {
  image: 10 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  document: 20 * 1024 * 1024,
  videoSeconds: 180,
};

export const ACCEPT = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  video: "video/mp4,video/webm,video/quicktime,video/3gpp",
  document: ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.rtf,.odt,.odp",
};

const DOC_EXT = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv", "rtf", "odt", "odp"];
const IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VID_EXT = ["mp4", "webm", "mov", "m4v", "3gp"];

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function ext(name = "") {
  const m = name.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return m ? m[1] : "";
}

export function kindFor(file) {
  if (IMG_TYPES.includes(file.type)) return "image";
  if (file.type.startsWith("video/") || VID_EXT.includes(ext(file.name))) return "video";
  if (DOC_EXT.includes(ext(file.name))) return "document";
  return null;
}

function videoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = v.duration;
      const w = v.videoWidth;
      const h = v.videoHeight;
      URL.revokeObjectURL(url);
      resolve({ duration: Number.isFinite(d) ? d : null, width: w || null, height: h || null });
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: null, width: null, height: null });
    };
    v.src = url;
  });
}

/** Re-encode large photos to ≤2000px JPEG so chats stay fast on mobile data. */
async function compressImage(file) {
  if (file.type === "image/gif" || file.size < 1.2 * 1024 * 1024) {
    const dims = await new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: null, height: null }); };
      img.src = url;
    });
    return { file, ...dims };
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { file, width: null, height: null };
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.84));
  if (!blob || blob.size >= file.size) return { file, width: bitmap.width, height: bitmap.height };
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return { file: new File([blob], name, { type: "image/jpeg" }), width, height };
}

/** Validate and prepare a picked file. Throws an Error with a friendly message. */
export async function prepareFile(file, forcedKind) {
  const kind = forcedKind || kindFor(file);
  if (!kind) throw new Error("That file type can't be shared. Use a photo, a short video, or a PDF/Office document.");
  if (forcedKind === "image" && !IMG_TYPES.includes(file.type)) throw new Error("Choose a JPG, PNG, WebP or GIF photo.");
  if (forcedKind === "document" && !DOC_EXT.includes(ext(file.name))) throw new Error("Choose a PDF, Word, PowerPoint, Excel or text file.");
  let meta = { width: null, height: null, duration: null };
  let prepared = file;
  if (kind === "image") {
    const out = await compressImage(file);
    prepared = out.file;
    meta = { ...meta, width: out.width, height: out.height };
  }
  if (kind === "video") {
    meta = await videoDuration(file);
    if (meta.duration && meta.duration > GROUP_LIMITS.videoSeconds) {
      throw new Error(`Videos can be up to ${GROUP_LIMITS.videoSeconds / 60} minutes. This one is ${Math.ceil(meta.duration / 60)} minutes.`);
    }
  }
  if (prepared.size > GROUP_LIMITS[kind]) {
    throw new Error(`That ${kind} is ${formatBytes(prepared.size)}. The limit is ${formatBytes(GROUP_LIMITS[kind])}.`);
  }
  if (!prepared.size) throw new Error("That file is empty.");
  return { file: prepared, kind, ...meta };
}

/** Upload to R2 with progress and cancel; the API returns a short-lived PUT URL. */
export function uploadToCloudinary(file, kind, { onProgress, signal } = {}) {
  return uploadFileToR2(file, kind, onProgress, signal);
}

/** Cloudinary poster frame for a video URL. */
export function videoPoster(url) {
  if (!url || !url.includes("/video/upload/")) return null;
  return url.replace("/video/upload/", "/video/upload/so_1,w_640,c_limit/").replace(/\.[a-z0-9]+(\?.*)?$/i, ".jpg");
}

/** Smaller delivery size for chat thumbnails. */
export function imageThumb(url, width = 720) {
  if (!url || !url.includes("/image/upload/")) return url;
  return url.replace("/image/upload/", `/image/upload/c_limit,w_${width},q_auto,f_auto/`);
}
