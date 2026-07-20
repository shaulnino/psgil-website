import type { Area } from "react-easy-crop";

/** Load an HTMLImageElement from a (blob/object) URL. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

/**
 * Render the selected crop area to a square canvas and return a JPEG blob.
 * `output` is the edge length of the square export (default 512px), which also
 * keeps large source images comfortably under the upload size limit.
 */
export async function getCroppedBlob(
  src: string,
  crop: Area,
  output = 512,
): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = output;
  canvas.height = output;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");

  // Fill with white so any transparent source areas don't turn black in JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, output, output);
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    output,
    output,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not crop image"))),
      "image/jpeg",
      0.92,
    );
  });
}
