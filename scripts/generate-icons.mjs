// สร้าง PNG icon ของ PWA จากสี token โดยไม่พึ่ง lib ภาพ (PNG encoder ขนาดเล็กด้วย zlib ของ Node)
// รัน: node scripts/generate-icons.mjs  → public/icons/*.png
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const BRAND = [0x7a, 0x5f, 0xe0]; // --color-brand-500
const ACCENT = [0xf5, 0x64, 0x8c]; // --color-accent-500
const WHITE = [0xff, 0xff, 0xff];

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
};

function render(size, { rounded }) {
  const px = Buffer.alloc(size * size * 4);
  const r = rounded ? size * 0.22 : 0;
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size * 0.27;
  const ringW = size * 0.055;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // rounded-rect mask
      const dx = Math.max(r - x - 0.5, x + 0.5 - (size - r), 0);
      const dy = Math.max(r - y - 0.5, y + 0.5 - (size - r), 0);
      const inside = rounded ? dx * dx + dy * dy <= r * r : true;
      if (!inside) continue;
      let color = BRAND;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (Math.abs(d - ringR) <= ringW / 2) color = WHITE;
      // needle: เข็มทิศ — สามเหลี่ยมชี้ขึ้น (สีพีช) และชี้ลง (ขาว)
      const nx = x + 0.5 - cx;
      const ny = y + 0.5 - cy;
      const halfW = size * 0.07 * (1 - Math.abs(ny) / (ringR * 0.85));
      if (Math.abs(ny) <= ringR * 0.85 && Math.abs(nx) <= Math.max(halfW, 0))
        color = ny < 0 ? ACCENT : WHITE;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = 255;
    }
  }
  const rows = [];
  for (let y = 0; y < size; y++)
    rows.push(Buffer.concat([Buffer.from([0]), px.subarray(y * size * 4, (y + 1) * size * 4)]));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", render(192, { rounded: true }));
writeFileSync("public/icons/icon-512.png", render(512, { rounded: true }));
writeFileSync("public/icons/icon-maskable-512.png", render(512, { rounded: false }));
writeFileSync("public/icons/apple-touch-icon.png", render(180, { rounded: false }));
console.log(
  "icons written: public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png",
);
