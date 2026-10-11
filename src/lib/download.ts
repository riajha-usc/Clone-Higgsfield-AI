/** Saves a generation's output. Falls back to opening it when the host blocks cross-origin fetches. */
export async function downloadOutput(url: string, baseName: string): Promise<void> {
  const extension = url.split("?")[0].match(/\.(\w{2,4})$/)?.[1] ?? "png";
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${baseName}.${extension}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
