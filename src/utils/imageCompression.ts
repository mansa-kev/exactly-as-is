const MAX_CANVAS_PIXELS = 4_000_000;

function getTargetDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number
) {
  let width = sourceWidth;
  let height = sourceHeight;

  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.max(1, Math.round(width * ratio));
  height = Math.max(1, Math.round(height * ratio));

  const totalPixels = width * height;
  if (totalPixels > MAX_CANVAS_PIXELS) {
    const pixelRatio = Math.sqrt(MAX_CANVAS_PIXELS / totalPixels);
    width = Math.max(1, Math.round(width * pixelRatio));
    height = Math.max(1, Math.round(height * pixelRatio));
  }

  return { width, height };
}

function loadImageFromObjectUrl(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Invalid image file. The file could not be decoded.'));
    };

    img.src = objectUrl;
  });
}

export async function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  if (file.size < 400_000) {
    return file;
  }

  const img = await loadImageFromObjectUrl(file);
  const { width, height } = getTargetDimensions(img.width, img.height, maxWidth, maxHeight);

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      reject(new Error('Failed to prepare image compression canvas'));
      return;
    }

    ctx.drawImage(img, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Image compression failed'));
          return;
        }

        const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
        resolve(new File([blob], newFileName, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        }));
      },
      'image/jpeg',
      quality
    );
  });
}
