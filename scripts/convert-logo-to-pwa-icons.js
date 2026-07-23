const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Parse PNG IDAT chunks to raw RGBA
function parsePNG(buffer) {
  let offset = 8; // skip signature
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IHDR') {
      width = buffer.readUInt32BE(offset + 8);
      height = buffer.readUInt32BE(offset + 12);
      bitDepth = buffer[offset + 16];
      colorType = buffer[offset + 17];
    } else if (type === 'IDAT') {
      idatChunks.push(buffer.slice(offset + 8, offset + 8 + length));
    }
    offset += 12 + length;
  }

  const compressed = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(compressed);
  
  // Reconstruct un-filtered scanlines
  const rawRGBA = Buffer.alloc(width * height * 4);
  const bytesPerPixel = colorType === 6 ? 4 : (colorType === 2 ? 3 : 4);
  const stride = width * bytesPerPixel + 1;

  let prevLine = Buffer.alloc(width * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const lineStart = y * stride;
    const filterType = decompressed[lineStart];
    const currentLine = Buffer.alloc(width * bytesPerPixel);

    for (let x = 0; x < width * bytesPerPixel; x++) {
      const rawByte = decompressed[lineStart + 1 + x];
      let a = x >= bytesPerPixel ? currentLine[x - bytesPerPixel] : 0;
      let b = prevLine[x];
      let c = x >= bytesPerPixel ? prevLine[x - bytesPerPixel] : 0;

      let val = 0;
      if (filterType === 0) val = rawByte;
      else if (filterType === 1) val = (rawByte + a) & 0xFF;
      else if (filterType === 2) val = (rawByte + b) & 0xFF;
      else if (filterType === 3) val = (rawByte + Math.floor((a + b) / 2)) & 0xFF;
      else if (filterType === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        let pr = c;
        if (pa <= pb && pa <= pc) pr = a;
        else if (pb <= pc) pr = b;
        val = (rawByte + pr) & 0xFF;
      }
      currentLine[x] = val;
    }

    // Convert to RGBA
    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 4;
      const inIdx = x * bytesPerPixel;
      if (bytesPerPixel === 4) {
        rawRGBA[outIdx] = currentLine[inIdx];
        rawRGBA[outIdx + 1] = currentLine[inIdx + 1];
        rawRGBA[outIdx + 2] = currentLine[inIdx + 2];
        rawRGBA[outIdx + 3] = currentLine[inIdx + 3];
      } else if (bytesPerPixel === 3) {
        rawRGBA[outIdx] = currentLine[inIdx];
        rawRGBA[outIdx + 1] = currentLine[inIdx + 1];
        rawRGBA[outIdx + 2] = currentLine[inIdx + 2];
        rawRGBA[outIdx + 3] = 255;
      }
    }
    prevLine = currentLine;
  }

  return { width, height, data: rawRGBA };
}

// Create canvas and composite source image centered with crisp transparent background
function renderIcon(srcImg, targetSize) {
  const targetBuf = Buffer.alloc(targetSize * targetSize * 4); // default transparent 0

  // Scale srcImg to fit cleanly inside targetSize with minimal padding (90% size)
  const maxDim = Math.floor(targetSize * 0.9);
  const scale = Math.min(maxDim / srcImg.width, maxDim / srcImg.height);
  const scaledW = Math.floor(srcImg.width * scale);
  const scaledH = Math.floor(srcImg.height * scale);

  const startX = Math.floor((targetSize - scaledW) / 2);
  const startY = Math.floor((targetSize - scaledH) / 2);

  for (let y = 0; y < scaledH; y++) {
    const srcY = Math.floor(y / scale);
    for (let x = 0; x < scaledW; x++) {
      const srcX = Math.floor(x / scale);
      
      const srcIdx = (srcY * srcImg.width + srcX) * 4;
      const tgtIdx = ((startY + y) * targetSize + (startX + x)) * 4;

      const sa = srcImg.data[srcIdx + 3];
      if (sa > 0) {
        targetBuf[tgtIdx] = srcImg.data[srcIdx];
        targetBuf[tgtIdx + 1] = srcImg.data[srcIdx + 1];
        targetBuf[tgtIdx + 2] = srcImg.data[srcIdx + 2];
        targetBuf[tgtIdx + 3] = sa;
      }
    }
  }

  // Encode PNG
  const scanlines = Buffer.alloc(targetSize * (targetSize * 4 + 1));
  for (let y = 0; y < targetSize; y++) {
    scanlines[y * (targetSize * 4 + 1)] = 0;
    targetBuf.copy(scanlines, y * (targetSize * 4 + 1) + 1, y * targetSize * 4, (y + 1) * targetSize * 4);
  }

  const compressed = zlib.deflateSync(scanlines);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(targetSize, 0);
  ihdr.writeUInt32BE(targetSize, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

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

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >>> 1) ^ 0xEDB88320;
      else crc = crc >>> 1;
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const logoPath = path.join(__dirname, '..', 'assets', 'img', 'Logo-DDC.png');
const logoBuf = fs.readFileSync(logoPath);
const srcImg = parsePNG(logoBuf);
console.log(`Parsed Logo-DDC.png: ${srcImg.width}x${srcImg.height}`);

const imagesDir = path.join(__dirname, '..', 'assets', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

fs.writeFileSync(path.join(imagesDir, 'icon-192.png'), renderIcon(srcImg, 192));
fs.writeFileSync(path.join(imagesDir, 'icon-512.png'), renderIcon(srcImg, 512));
fs.writeFileSync(path.join(imagesDir, 'apple-touch-icon.png'), renderIcon(srcImg, 180));

console.log('Successfully generated transparent PWA icons from Logo-DDC.png!');
