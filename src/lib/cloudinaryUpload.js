import { api } from "./api";

const UPLOAD_TIMEOUT_MS = 90_000;

/**
 * Compatibility helper for existing Cloudinary-named call sites. New files go
 * through the authenticated API for a short-lived R2 upload URL.
 */
export async function uploadFileToR2(file, kind, onProgress, signal) {
  if (!file) throw new Error("Choose a file to upload.");
  if (signal?.aborted) {
    throw Object.assign(new Error("Upload cancelled"), { cancelled: true });
  }

  const upload = await api("/storage/uploads/presign", {
    method: "POST",
    body: {
      name: file.name,
      contentType: file.type || "",
      size: file.size,
      kind,
    },
    signal,
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortUpload);
      callback(value);
    };
    const abortUpload = () => {
      xhr.abort();
      finish(reject, Object.assign(new Error("Upload cancelled"), { cancelled: true }));
    };
    const timeout = setTimeout(() => {
      xhr.abort();
      finish(reject, new Error("Upload timed out. Check your connection and try again."));
    }, UPLOAD_TIMEOUT_MS);

    xhr.open("PUT", upload.uploadUrl);
    xhr.setRequestHeader("Content-Type", upload.headers["Content-Type"]);
    xhr.setRequestHeader("Content-Disposition", upload.headers["Content-Disposition"]);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        finish(resolve, {
          secure_url: upload.publicUrl,
          url: upload.publicUrl,
          public_id: upload.key,
          bytes: file.size,
          format: file.name.split(".").pop()?.toLowerCase() || "",
          resource_type: kind === "document" ? "raw" : kind,
        });
      } else {
        finish(reject, new Error("Upload failed. Please try again."));
      }
    };
    xhr.onerror = () => finish(reject, new Error("Network error during upload."));
    xhr.onabort = () => finish(reject, Object.assign(new Error("Upload cancelled"), { cancelled: true }));
    signal?.addEventListener("abort", abortUpload, { once: true });
    if (signal?.aborted) abortUpload();
    else xhr.send(file);
  });
}

export function uploadDocumentToCloudinary(file, onProgress) {
  const image = file?.type?.startsWith("image/") || /\.(gif|jpe?g|png|webp)$/i.test(file?.name || "");
  return uploadFileToR2(file, image ? "image" : "document", onProgress);
}

export function uploadImageToCloudinary(file, onProgress) {
  return uploadFileToR2(file, "image", onProgress);
}

export function uploadVoiceToCloudinary(file, onProgress) {
  return uploadFileToR2(file, "audio", onProgress);
}

// R2 stores downloads with Content-Disposition set at upload time. This helper
// remains for older Cloudinary URLs already stored by the app.
export function withDownloadFlag(url, filename) {
  if (!url) return url;
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const flag = filename ? `fl_attachment:${encodeURIComponent(filename.replace(/\.[^/.]+$/, ""))}` : "fl_attachment";
  return `${url.slice(0, idx + marker.length)}${flag}/${url.slice(idx + marker.length)}`;
}
