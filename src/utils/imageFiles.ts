export interface CompressImageOptions {
  maxSide?: number;
  quality?: number;
  maxBytes?: number;
}

const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("ფოტოს დამუშავება ვერ მოხერხდა."));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });

export const compressImageFile = async (
  file: File,
  { maxSide = 1200, quality = 0.78, maxBytes = 1_800_000 }: CompressImageOptions = {}
) => {
  if (!imageMimeTypes.has(file.type) || file.size <= maxBytes) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("ფოტოს წაკითხვა ვერ მოხერხდა."));
    });

    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("ფოტოს დამუშავება ვერ მოხერხდა.");
    context.drawImage(image, 0, 0, width, height);

    let nextQuality = quality;
    let blob = await canvasToBlob(canvas, "image/jpeg", nextQuality);
    while (blob.size > maxBytes && nextQuality > 0.45) {
      nextQuality -= 0.1;
      blob = await canvasToBlob(canvas, "image/jpeg", nextQuality);
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
