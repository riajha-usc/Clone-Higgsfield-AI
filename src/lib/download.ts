/** Saves a generation's output. Falls back to opening it when the host blocks cross-origin fetches. */
export async function downloadOutput(url: string, baseName: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    // Proxied and data URLs carry no extension; the content type does.
    const extension =
      url.split("?")[0].match(/\.(\w{2,4})$/)?.[1] ??
      ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4" } as Record<string, string>)[blob.type] ??
      "png";
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${baseName}.${extension}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
