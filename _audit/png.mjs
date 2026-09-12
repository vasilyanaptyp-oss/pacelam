// Minimal PNG decoder (8-bit, non-interlaced) + pixel diff, so the diacritics check compares
// rendered pixels and never trusts glyph-width measurements.
import zlib from 'node:zlib';

export const PNG = {
  decode(buf) {
    let pos = 8, width = 0, height = 0, colorType = 0, bitDepth = 0;
    const idat = [];
    while (pos < buf.length) {
      const len = buf.readUInt32BE(pos);
      const type = buf.toString('ascii', pos + 4, pos + 8);
      const data = buf.subarray(pos + 8, pos + 8 + len);
      if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; if (data[12] !== 0) throw new Error('interlaced'); }
      else if (type === 'IDAT') idat.push(data);
      else if (type === 'IEND') break;
      pos += 12 + len;
    }
    if (bitDepth !== 8) throw new Error('bit depth ' + bitDepth);
    const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const out = Buffer.alloc(width * height * 4);
    let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride), p = 0;
    for (let y = 0; y < height; y++) {
      const filter = raw[p++];
      raw.copy(cur, 0, p, p + stride); p += stride;
      for (let i = 0; i < stride; i++) {
        const a = i >= channels ? cur[i - channels] : 0, b = prev[i], c = i >= channels ? prev[i - channels] : 0;
        let v = cur[i];
        if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1;
        else if (filter === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
        cur[i] = v & 255;
      }
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4, s = x * channels;
        if (channels === 4) { out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = cur[s + 3]; }
        else if (channels === 3) { out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2]; out[o + 3] = 255; }
        else if (channels === 2) { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = cur[s + 1]; }
        else { out[o] = out[o + 1] = out[o + 2] = cur[s]; out[o + 3] = 255; }
      }
      const t = prev; prev = cur; cur = t;
    }
    return { width, height, data: out };
  },
  diff(a, b) {
    if (a.width !== b.width || a.height !== b.height) return { differing: -1, total: a.width * a.height, sizeMismatch: true };
    let differing = 0;
    const total = a.width * a.height;
    for (let i = 0; i < total; i++) {
      const o = i * 4;
      if (Math.abs(a.data[o] - b.data[o]) > 8 || Math.abs(a.data[o + 1] - b.data[o + 1]) > 8 || Math.abs(a.data[o + 2] - b.data[o + 2]) > 8) differing++;
    }
    return { differing, total, sizeMismatch: false };
  },
};
