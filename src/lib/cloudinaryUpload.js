const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const UPLOAD_TIMEOUT_MS = 90_000;

function attachTimeout(xhr, reject) {
  const t = setTimeout(() => {
    try { xhr.abort(); } catch { /* ignore */ }
    reject(new Error("Upload timed out. Check your connection and try again."));
  }, UPLOAD_TIMEOUT_MS);
  const clear = () => clearTimeout(t);
  xhr.addEventListener("loadend", clear);
  xhr.addEventListener("error", clear);
  xhr.addEventListener("abort", clear);
}

export async function uploadDocumentToCloudinary(file, onProgress) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary isn't configured yet — check your .env.local.");
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error("Upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    attachTimeout(xhr, reject);
    xhr.send(formData);
  });
}

// Same as uploadDocumentToCloudinary but for images (question illustrations,
// diagrams, etc). Uses Cloudinary's image endpoint so it gets thumbnails /
// transformations if we need them later.
export async function uploadImageToCloudinary(file, onProgress) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary isn't configured yet — check your .env.local.");
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error("Image upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    attachTimeout(xhr, reject);
    xhr.send(formData);
  });
}

// Turns a normal Cloudinary delivery URL into one that forces a browser
// download (Content-Disposition: attachment) instead of navigating to it.
// Works for both /raw/upload/ and /image/upload/ style URLs.
export function withDownloadFlag(url, filename) {
  if (!url) return url;
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const flag = filename ? `fl_attachment:${encodeURIComponent(filename.replace(/\.[^/.]+$/, ""))}` : "fl_attachment";
  return `${url.slice(0, idx + marker.length)}${flag}/${url.slice(idx + marker.length)}`;
}
export async function uploadVoiceToCloudinary(file, onProgress) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary isn't configured yet — check your .env.local.");
  }
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error("Voice note upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Network error during voice upload."));
    attachTimeout(xhr, reject);
    xhr.send(formData);
  });
}
