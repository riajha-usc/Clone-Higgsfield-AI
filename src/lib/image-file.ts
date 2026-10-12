const MAX_SIDE = 1536;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

/**
 * Reads an image file into a JPEG data URL, scaled down so its long side is at most
 * 1536px. Keeps stored elements small enough for IndexedDB and for sending as a
 * start frame.
 */
export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image. Choose a PNG, JPEG or WebP.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("That image is over 20 MB. Choose a smaller one.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't read that image. Try another file.");
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.9);
}
