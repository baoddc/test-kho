const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, text) {
  // Create raw RGBA image data
  const buffer = Buffer.alloc(width * height * 4);
  
  // Fill background with #1e293b (R: 30, G: 41, B: 59, A: 255)
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    // Outer border vs inner gradient fill
    const x = i % width;
    const y = Math.floor(i / width);
    const margin = Math.floor(width * 0.1);
    
    if (x >= margin && x < width - margin && y >= margin && y < height - margin) {
      // DDC Blue accent #2563eb
      buffer[idx] = 37;
      buffer[idx + 1] = 99;
      buffer[idx + 2] = 235;
      buffer[idx + 3] = 255;
    } else {
      // Dark slate background #0f172a
      buffer[idx] = 15;
      buffer[idx + 1] = 23;
      buffer[idx + 2] = 42;
      buffer[idx + 3] = 255;
    }
  }

  // Draw simple "DDC" block in center
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const size = Math.floor(width * 0.25);
  for (let y = cy - size; y < cy + size; y++) {
    for (let x = cx - size; x < cx + size; x++) {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = (y * width + x) * 4;
        buffer[idx] = 255;
        buffer[idx + 1] = 255;
        buffer[idx + 2] = 255;
        buffer[idx + 3] = 255;
      }
    }
  }

  // Filter byte (0 = None) at start of each scanline
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    scanlines[y * (width * 4 + 1)] = 0; // Filter type 0
    buffer.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(scanlines);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression method
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Interlace method

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const bufToCrc = Buffer.concat([typeBuf, data]);
  
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(bufToCrc), 0);

  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// CRC32 implementation for PNG chunks
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const imagesDir = path.join(__dirname, '..', 'assets', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

fs.writeFileSync(path.join(imagesDir, 'icon-192.png'), createPNG(192, 192, 'DDC'));
fs.writeFileSync(path.join(imagesDir, 'icon-512.png'), createPNG(512, 512, 'DDC'));
fs.writeFileSync(path.join(imagesDir, 'apple-touch-icon.png'), createPNG(180, 180, 'DDC'));

console.log('Successfully generated PWA icon assets PNGs!');
