const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const matches = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!matches) return null;

  const buffer = Buffer.from(matches[2], 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES || buffer.toString('base64') !== matches[2]) return null;

  const mime = matches[1].toLowerCase();
  if (mime === 'image/png' && !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return null;
  if ((mime === 'image/jpeg' || mime === 'image/jpg') &&
      !(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) return null;

  return { buffer, mime: mime === 'image/jpg' ? 'image/jpeg' : mime };
}

module.exports = { parseImageDataUrl };
