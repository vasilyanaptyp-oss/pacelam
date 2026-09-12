// Cargo photos are taken on a phone and weigh megabytes; the driver is on a weak connection.
// Compress in the browser before upload: long side 1280 px for the picture, 320 px for the thumbnail.
async function load(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

function draw(source, maxSide, quality) {
  const w = source.width || source.naturalWidth;
  const hgt = source.height || source.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(w, hgt));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(hgt * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality));
}

export async function compressPhoto(file) {
  const source = await load(file);
  const [full, thumb] = await Promise.all([draw(source, 1280, 0.78), draw(source, 320, 0.7)]);
  if (source.close) source.close();
  return { full, thumb, originalBytes: file.size };
}

export const blobToDataUrl = (blob) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.readAsDataURL(blob);
});
