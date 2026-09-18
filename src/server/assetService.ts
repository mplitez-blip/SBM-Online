import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ImageMetadata {
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
  extension: string;
}

export interface UploadValidationOptions {
  allowedMimeTypes?: string[];
  maxSizeBytes?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  category?: 'logo' | 'favicon' | 'background' | 'general';
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const CATEGORY_LIMITS: Record<string, { minW: number; maxW: number; minH: number; maxH: number; maxSize: number }> = {
  logo: { minW: 16, maxW: 3000, minH: 16, maxH: 3000, maxSize: 5 * 1024 * 1024 },
  favicon: { minW: 16, maxW: 512, minH: 16, maxH: 512, maxSize: 1024 * 1024 },
  background: { minW: 100, maxW: 4000, minH: 100, maxH: 4000, maxSize: 8 * 1024 * 1024 },
  general: { minW: 16, maxW: 4000, minH: 16, maxH: 4000, maxSize: 5 * 1024 * 1024 },
};

/**
 * Checks binary buffer for known executable, script, or compressed archive signatures.
 * Returns true if an executable/malicious signature is found.
 */
export function isExecutableOrProhibited(buffer: Buffer, originalFilename?: string): { prohibited: boolean; reason?: string } {
  if (!buffer || buffer.length < 4) {
    return { prohibited: true, reason: 'File buffer is empty or corrupted.' };
  }

  // 1. Prohibited extension check
  if (originalFilename) {
    const ext = path.extname(originalFilename).toLowerCase();
    const disallowedExts = [
      '.exe', '.bat', '.cmd', '.sh', '.bash', '.bin', '.elf', '.dll', '.so', '.dylib',
      '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.php', '.phtml', '.php3', '.php4',
      '.php5', '.phps', '.py', '.pyc', '.pl', '.cgi', '.jar', '.war', '.jsp', '.asp',
      '.aspx', '.vbs', '.vbe', '.ps1', '.psm1', '.scr', '.com', '.hta', '.msi', '.apk',
      '.zip', '.tar', '.gz', '.7z', '.rar'
    ];
    if (disallowedExts.includes(ext)) {
      return { prohibited: true, reason: `Executable or script extension "${ext}" is strictly forbidden.` };
    }
  }

  // 2. Windows PE Executable (MZ header)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { prohibited: true, reason: 'Windows PE executable (MZ) binary signature detected.' };
  }

  // 3. Linux ELF Binary
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { prohibited: true, reason: 'Linux ELF binary signature detected.' };
  }

  // 4. Mach-O Binaries (macOS)
  if (
    (buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa && (buffer[3] === 0xce || buffer[3] === 0xcf)) ||
    (buffer[0] === 0xce && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) ||
    (buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) ||
    (buffer[0] === 0xca && buffer[1] === 0xfe && buffer[2] === 0xba && buffer[3] === 0xbe)
  ) {
    return { prohibited: true, reason: 'Mach-O binary signature detected.' };
  }

  // 5. ZIP / JAR / APK (PK..)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return { prohibited: true, reason: 'Compressed archive / JAR package signature detected.' };
  }

  // 6. Shell script shebang (#!/)
  if (buffer[0] === 0x23 && buffer[1] === 0x21 && buffer[2] === 0x2f) {
    return { prohibited: true, reason: 'Shell script shebang signature detected.' };
  }

  // 7. Embedded script patterns (PHP, Script, HTML injection in image)
  const headerPreview = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1');
  if (/<\?php|<\?=|<script\b|eval\s*\(|base64_decode\s*\(|system\s*\(|shell_exec\s*\(/i.test(headerPreview)) {
    return { prohibited: true, reason: 'Script execution payload detected in file header.' };
  }

  return { prohibited: false };
}

/**
 * Extracts dimensions and verifies MIME type from image buffer without external native libraries.
 */
export function parseImageDimensions(buffer: Buffer): { width: number; height: number; mimeType: string } | null {
  if (!buffer || buffer.length < 8) return null;

  // 1. PNG check: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height, mimeType: 'image/png' };
    }
  }

  // 2. JPEG check: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      // SOF markers: 0xC0 (baseline), 0xC1, 0xC2 (progressive), 0xC3
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height, mimeType: 'image/jpeg' };
      }
      const blockLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + blockLength;
    }
    // Fallback default if SOF is deep or fragmented
    return { width: 800, height: 600, mimeType: 'image/jpeg' };
  }

  // 3. WebP check: 'RIFF' .... 'WEBP'
  if (
    buffer.length >= 30 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunkType = buffer.toString('ascii', 12, 16);
    if (chunkType === 'VP8 ') {
      // Lossy VP8
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height, mimeType: 'image/webp' };
    } else if (chunkType === 'VP8L') {
      // Lossless VP8L
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height, mimeType: 'image/webp' };
    } else if (chunkType === 'VP8X') {
      // Extended VP8X
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      return { width, height, mimeType: 'image/webp' };
    }
    return { width: 800, height: 600, mimeType: 'image/webp' };
  }

  // 4. ICO check: 00 00 01 00 (icon) or 00 00 02 00 (cursor)
  if (
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    (buffer[2] === 0x01 || buffer[2] === 0x02) &&
    buffer[3] === 0x00
  ) {
    if (buffer.length >= 8) {
      let width = buffer[6];
      let height = buffer[7];
      if (width === 0) width = 256;
      if (height === 0) height = 256;
      return { width, height, mimeType: 'image/x-icon' };
    }
  }

  // 5. SVG check
  const textHead = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('utf8').trim();
  if (textHead.includes('<svg') || textHead.startsWith('<?xml') && textHead.includes('<svg')) {
    // Check for dangerous scripts in SVG
    if (/<script|javascript:|xlink:href="javascript:|<foreignObject/i.test(buffer.toString('utf8'))) {
      return null; // Prohibited SVG
    }

    let width = 300;
    let height = 150;

    const widthMatch = textHead.match(/width=["']?([0-9.]+)(px)?["']?/i);
    const heightMatch = textHead.match(/height=["']?([0-9.]+)(px)?["']?/i);
    const viewBoxMatch = textHead.match(/viewBox=["']?[0-9.\s,-]+\s+([0-9.]+)\s+([0-9.]+)["']?/i);

    if (widthMatch && heightMatch) {
      width = Math.round(parseFloat(widthMatch[1])) || 300;
      height = Math.round(parseFloat(heightMatch[1])) || 150;
    } else if (viewBoxMatch) {
      width = Math.round(parseFloat(viewBoxMatch[1])) || 300;
      height = Math.round(parseFloat(viewBoxMatch[2])) || 150;
    }

    return { width, height, mimeType: 'image/svg+xml' };
  }

  return null;
}

/**
 * Validates file buffer against MIME, dimensions, size, and security constraints.
 */
export function validateUploadedAsset(
  buffer: Buffer,
  originalFilename: string,
  options: UploadValidationOptions = {}
): ImageMetadata {
  const category = options.category || 'general';
  const limits = CATEGORY_LIMITS[category] || CATEGORY_LIMITS.general;

  const maxSizeBytes = options.maxSizeBytes || limits.maxSize || DEFAULT_MAX_SIZE;
  const minWidth = options.minWidth || limits.minW;
  const maxWidth = options.maxWidth || limits.maxW;
  const minHeight = options.minHeight || limits.minH;
  const maxHeight = options.maxHeight || limits.maxH;

  // 1. Executable / script detection
  const execCheck = isExecutableOrProhibited(buffer, originalFilename);
  if (execCheck.prohibited) {
    throw new Error(`Security validation error: ${execCheck.reason || 'Prohibited file type.'}`);
  }

  // 2. File size check
  if (buffer.length === 0) {
    throw new Error('Uploaded file is empty.');
  }
  if (buffer.length > maxSizeBytes) {
    const mbLimit = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    const currentMb = (buffer.length / (1024 * 1024)).toFixed(2);
    throw new Error(`File size (${currentMb} MB) exceeds maximum permitted limit of ${mbLimit} MB.`);
  }

  // 3. Dimension & binary MIME parsing
  const parsed = parseImageDimensions(buffer);
  if (!parsed) {
    throw new Error('Invalid or unsupported image format. Only PNG, JPEG, WebP, SVG, and ICO are permitted.');
  }

  // 4. Allowed MIME types check
  const defaultAllowed = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
  ];
  const allowedMimes = options.allowedMimeTypes || defaultAllowed;
  if (!allowedMimes.includes(parsed.mimeType)) {
    throw new Error(`MIME type "${parsed.mimeType}" is not allowed for this asset.`);
  }

  // 5. Dimension bounds check
  if (parsed.width < minWidth || parsed.width > maxWidth) {
    throw new Error(
      `Image width (${parsed.width}px) is outside allowed range (${minWidth}px - ${maxWidth}px).`
    );
  }
  if (parsed.height < minHeight || parsed.height > maxHeight) {
    throw new Error(
      `Image height (${parsed.height}px) is outside allowed range (${minHeight}px - ${maxHeight}px).`
    );
  }

  // Map extension
  let extension = '.png';
  if (parsed.mimeType === 'image/jpeg') extension = '.jpg';
  else if (parsed.mimeType === 'image/webp') extension = '.webp';
  else if (parsed.mimeType === 'image/svg+xml') extension = '.svg';
  else if (parsed.mimeType.includes('icon')) extension = '.ico';

  return {
    width: parsed.width,
    height: parsed.height,
    mimeType: parsed.mimeType,
    sizeBytes: buffer.length,
    extension,
  };
}

/**
 * Generates a unique, non-colliding filename.
 */
export function generateUniqueAssetFilename(prefix: string, extension: string): string {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'asset';
  const cleanExt = extension.startsWith('.') ? extension : `.${extension}`;
  return `${cleanPrefix}-${timestamp}-${randomSuffix}${cleanExt}`;
}

/**
 * Saves a new asset file to disk and ensures the directory exists.
 * Returns the public URL path (e.g. /uploads/filename.png).
 */
export async function saveAssetToDisk(buffer: Buffer, filename: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
  }

  const filePath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(filePath, buffer, { mode: 0o644 });

  return `/uploads/${filename}`;
}

/**
 * Deletes replaced files ONLY AFTER the new file is saved and confirmed.
 * Ensures that only files inside the managed uploads directory are deleted.
 */
export async function deleteReplacedAsset(oldAssetUrl?: string | null): Promise<boolean> {
  if (!oldAssetUrl || typeof oldAssetUrl !== 'string') return false;

  // Only remove files that are hosted under our /uploads/ directory
  if (!oldAssetUrl.startsWith('/uploads/')) return false;

  const fileName = path.basename(oldAssetUrl);
  // Prevent directory traversal
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return false;
  }

  const fullPath = path.join(process.cwd(), 'public', 'uploads', fileName);

  try {
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      return true;
    }
  } catch (err) {
    console.error(`Warning: Failed to delete replaced asset "${fullPath}":`, err);
  }

  return false;
}

/**
 * Convenient all-in-one validator, saver, and atomic replacer.
 */
export async function validateAndSaveAsset(
  file: { buffer: Buffer; originalname: string; mimetype?: string; size: number },
  category: 'logo' | 'favicon' | 'background' | 'general' = 'general',
  replaceUrl?: string
): Promise<{ url: string; filename: string; metadata: ImageMetadata }> {
  const metadata = validateUploadedAsset(file.buffer, file.originalname, { category });
  const filename = generateUniqueAssetFilename(category, metadata.extension);
  const url = await saveAssetToDisk(file.buffer, filename);

  // Delete replaced file ONLY after new file is successfully saved
  if (replaceUrl) {
    await deleteReplacedAsset(replaceUrl);
  }

  return { url, filename, metadata };
}

export const deleteAssetFile = deleteReplacedAsset;

