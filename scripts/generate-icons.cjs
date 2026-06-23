const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourcePath = 'C:\\Users\\AMOL\\Downloads\\goodlife fitness salon icon.png';
const outputDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// All requested sizes
const pwaIcons = [
  { name: 'icon-72x72.png', size: 72 },
  { name: 'icon-96x96.png', size: 96 },
  { name: 'icon-128x128.png', size: 128 },
  { name: 'icon-144x144.png', size: 144 },
  { name: 'icon-152x152.png', size: 152 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-384x384.png', size: 384 },
  { name: 'icon-512x512.png', size: 512 },
];

const iosIcons = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'apple-touch-icon-120x120.png', size: 120 },
  { name: 'apple-touch-icon-152x152.png', size: 152 },
  { name: 'apple-touch-icon-167x167.png', size: 167 },
  { name: 'apple-touch-icon-180x180.png', size: 180 },
];

const faviconIcons = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
];

// Helper to convert multiple PNG buffers to an ICO buffer
function createIco(images) {
  // images is array of { buffer: Buffer, width: number, height: number }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(images.length, 4); // Number of images

  const entryBuffers = [];
  let offset = 6 + images.length * 16;

  for (const img of images) {
    const entry = Buffer.alloc(16);
    const w = img.width >= 256 ? 0 : img.width;
    const h = img.height >= 256 ? 0 : img.height;

    entry.writeUInt8(w, 0); // Width
    entry.writeUInt8(h, 1); // Height
    entry.writeUInt8(0, 2); // Color palette (0 for no palette)
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel (32-bit color depth)
    entry.writeUInt32LE(img.buffer.length, 8); // Size of the PNG image data
    entry.writeUInt32LE(offset, 12); // Offset from the beginning of the file to PNG data

    entryBuffers.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entryBuffers, ...images.map((img) => img.buffer)]);
}

async function main() {
  try {
    console.log(`Checking source logo at: ${sourcePath}`);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source image not found at ${sourcePath}`);
    }

    // Verify source metadata
    const sourceMetadata = await sharp(sourcePath).metadata();
    console.log(`Source dimensions: ${sourceMetadata.width}x${sourceMetadata.height}, format: ${sourceMetadata.format}`);

    const allOutputs = [...pwaIcons, ...iosIcons, ...faviconIcons];
    
    // Generate all standard PNGs
    for (const spec of allOutputs) {
      const destPath = path.join(outputDir, spec.name);
      console.log(`Generating ${spec.name}...`);
      await sharp(sourcePath)
        .resize(spec.size, spec.size, {
          kernel: 'lanczos3',
          fit: 'contain',
          background: { r: 10, g: 10, b: 10, alpha: 1 } // ensure black bg if not fully opaque
        })
        .png()
        .toFile(destPath);
    }

    // Generate multi-size favicon.ico
    console.log('Generating favicon.ico...');
    const icoSizes = [16, 32, 48];
    const icoImageBuffers = [];
    
    for (const size of icoSizes) {
      const buf = await sharp(sourcePath)
        .resize(size, size, {
          kernel: 'lanczos3',
          fit: 'contain',
          background: { r: 10, g: 10, b: 10, alpha: 1 }
        })
        .png()
        .toBuffer();
      
      icoImageBuffers.push({ buffer: buf, width: size, height: size });
    }
    
    const icoBuffer = createIco(icoImageBuffers);
    fs.writeFileSync(path.join(outputDir, 'favicon.ico'), icoBuffer);
    console.log('favicon.ico generated successfully.');

    // PROGRAMMATIC VERIFICATION
    console.log('\n--- VERIFYING GENERATED FILES ---');
    let verificationFailed = false;

    // Check PNGs
    for (const spec of allOutputs) {
      const destPath = path.join(outputDir, spec.name);
      if (!fs.existsSync(destPath)) {
        console.error(`❌ Verification failed: ${spec.name} does not exist!`);
        verificationFailed = true;
        continue;
      }
      const meta = await sharp(destPath).metadata();
      if (meta.width !== spec.size || meta.height !== spec.size) {
        console.error(`❌ Verification failed: ${spec.name} is ${meta.width}x${meta.height}, expected ${spec.size}x${spec.size}`);
        verificationFailed = true;
      } else {
        console.log(`✅ ${spec.name} verified successfully (${meta.width}x${meta.height})`);
      }
    }

    // Check favicon.ico existence and size
    const icoPath = path.join(outputDir, 'favicon.ico');
    if (!fs.existsSync(icoPath)) {
      console.error('❌ Verification failed: favicon.ico does not exist!');
      verificationFailed = true;
    } else {
      const stats = fs.statSync(icoPath);
      console.log(`✅ favicon.ico verified successfully (${stats.size} bytes)`);
    }

    if (verificationFailed) {
      process.exit(1);
    } else {
      console.log('\n🎉 All icons generated and verified successfully!');
    }
  } catch (error) {
    console.error('Error during icon generation:', error);
    process.exit(1);
  }
}

main();
