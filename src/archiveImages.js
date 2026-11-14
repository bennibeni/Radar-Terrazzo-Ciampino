export function fittedImageSize(width, height, maxSide = 1280) {
  if (![width, height, maxSide].every(Number.isFinite) || width <= 0 || height <= 0 || maxSide <= 0) throw new Error('Dimensioni immagine non valide.');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function optimizeImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 80000000) throw new Error('Immagine troppo grande: massimo 80 megapixel.');
    const size = fittedImageSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Ottimizzazione immagini non disponibile.');
    context.drawImage(image, 0, 0, size.width, size.height);
    const data = canvas.toDataURL('image/webp', 0.82);
    const original = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Immagine non leggibile.'));
      reader.readAsDataURL(file);
    });
    // Keep an already small original if re-encoding would make it larger.
    const keepOriginal = size.width === image.naturalWidth && size.height === image.naturalHeight && original.length <= data.length;
    return keepOriginal ? original : data;
  } finally { URL.revokeObjectURL(url); }
}

export function archiveContentBytes(rows) {
  return new Blob([JSON.stringify(rows)]).size;
}

export function formatStorageBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'Non disponibile';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
