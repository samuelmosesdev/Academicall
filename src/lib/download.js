/** Save a file without revealing where it lives. Falls back to opening it if the fetch is blocked. */
export async function downloadFile(url, fileName = "material.pdf") {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = /\.[a-z0-9]{2,5}$/i.test(fileName) ? fileName : `${fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
