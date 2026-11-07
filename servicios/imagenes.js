const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const matches = dataUrl.match(/^data:image\/(?:png|jpeg|jpg|webp|gif|bmp|avif);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!matches) return null;

  const buffer = Buffer.from(matches[1], 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES || buffer.toString('base64') !== matches[1]) return null;

  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return { buffer, mime: 'image/png' };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { buffer, mime: 'image/jpeg' };
  }
  if (buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { buffer, mime: 'image/webp' };
  }
  if (buffer.toString('ascii', 0, 6) === 'GIF87a' ||
      buffer.toString('ascii', 0, 6) === 'GIF89a') {
    return { buffer, mime: 'image/gif' };
  }
  if (buffer.length >= 2 && buffer.toString('ascii', 0, 2) === 'BM') {
    return { buffer, mime: 'image/bmp' };
  }
  if (buffer.length >= 16 &&
      buffer.toString('ascii', 4, 8) === 'ftyp' &&
      buffer.readUInt32BE(0) >= 16 &&
      buffer.readUInt32BE(0) <= buffer.length) {
    const boxEnd = buffer.readUInt32BE(0);
    for (let offset = 8; offset + 4 <= boxEnd; offset += offset === 8 ? 8 : 4) {
      const brand = buffer.toString('ascii', offset, offset + 4);
      if (brand === 'avif' || brand === 'avis') {
        return { buffer, mime: 'image/avif' };
      }
    }
  }

  return null;
}

module.exports = { parseImageDataUrl };
