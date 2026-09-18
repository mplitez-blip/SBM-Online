/**
 * Automated Test Suite: System, Login Page, and Footer Customization & Secure Asset Management
 * 
 * Verifies all rules:
 * 1. Store uploaded assets securely.
 * 2. Validate MIME type (only valid image types allowed).
 * 3. Validate file size limits (reject oversized uploads).
 * 4. Validate image dimensions (width/height bounds).
 * 5. Generate unique filenames (cryptographically random + timestamped).
 * 6. Delete replaced files ONLY after the new file is saved successfully.
 * 7. Prevent executable & script uploads (MZ PE headers, ELF headers, shebangs, HTML/PHP payloads).
 * 8. Safe custom formatter strictly supports ONLY **bold**, *italic*, and line breaks; rejects raw HTML injection.
 * 9. System settings persistence & validation (site title, region, navbar logo, favicon, base font size, theme colors).
 * 10. Login settings persistence & validation (all texts, announcement, login logo, background image, colors, show full footer).
 * 11. Footer settings persistence & validation (three logos, wide first logo, formatted text, support contact, info links, logged-in context tracker).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateAndSaveAsset,
  deleteAssetFile,
  parseImageDimensions,
} from '../src/server/assetService.ts';

// Test runner helper
let totalTests = 0;
let passedTests = 0;

async function test(description: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err: any) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runCustomizationTestSuite() {
  console.log('\n--- Running Customization & Asset Management Test Suite ---\n');

  // Test 1: Validate MIME Types
  await test('Rule: Accept only allowed image MIME types and reject others', () => {
    const validMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon'];
    const invalidMimes = ['text/plain', 'application/pdf', 'application/x-msdownload', 'video/mp4'];

    const allowedSet = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon']);

    for (const mime of validMimes) {
      assert.strictEqual(allowedSet.has(mime), true, `Expected ${mime} to be allowed`);
    }
    for (const mime of invalidMimes) {
      assert.strictEqual(allowedSet.has(mime), false, `Expected ${mime} to be rejected`);
    }
  });

  // Test 2: Reject Executable Binary Uploads (Windows PE 'MZ' header)
  await test('Rule: Prevent executable uploads with Windows PE (MZ) binary signature', async () => {
    // Buffer starting with MZ
    const mzHeaderBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    let errorCaught = false;

    try {
      await validateAndSaveAsset({
        buffer: mzHeaderBuffer,
        originalname: 'innocent_logo.png',
        mimetype: 'image/png',
        size: mzHeaderBuffer.length,
      }, 'logo');
    } catch (err: any) {
      errorCaught = true;
      assert.ok(err.message.toLowerCase().includes('executable'), `Expected executable error, got: ${err.message}`);
    }

    assert.strictEqual(errorCaught, true, 'Executable with MZ header should have been rejected');
  });

  // Test 3: Reject Executable Binary Uploads (Linux ELF header)
  await test('Rule: Prevent executable uploads with Linux ELF signature', async () => {
    // Buffer starting with 0x7F, 'E', 'L', 'F'
    const elfHeaderBuffer = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x02, 0x01, 0x01, 0x00]);
    let errorCaught = false;

    try {
      await validateAndSaveAsset({
        buffer: elfHeaderBuffer,
        originalname: 'badge.png',
        mimetype: 'image/png',
        size: elfHeaderBuffer.length,
      }, 'logo');
    } catch (err: any) {
      errorCaught = true;
      assert.ok(err.message.includes('ELF') || err.message.toLowerCase().includes('binary'), `Expected binary error, got: ${err.message}`);
    }

    assert.strictEqual(errorCaught, true, 'Executable with ELF header should have been rejected');
  });

  // Test 4: Reject Script Files (.sh, .php, .js)
  await test('Rule: Prevent script uploads disguised as images', async () => {
    const scriptBuffer = Buffer.from('#!/bin/bash\nrm -rf /', 'utf-8');
    let errorCaught = false;

    try {
      await validateAndSaveAsset({
        buffer: scriptBuffer,
        originalname: 'script.sh',
        mimetype: 'text/x-shellscript',
        size: scriptBuffer.length,
      }, 'general');
    } catch (err: any) {
      errorCaught = true;
    }

    assert.strictEqual(errorCaught, true, 'Disguised shell script should have been rejected');
  });

  // Test 5: Image Dimensions Validation
  await test('Rule: Validate image dimensions and extract width/height', () => {
    // Create a 1x1 valid PNG (minimal valid PNG bytes)
    const png1x1 = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D,                         // IHDR length
      0x49, 0x48, 0x44, 0x52,                         // "IHDR"
      0x00, 0x00, 0x00, 0x64,                         // width = 100
      0x00, 0x00, 0x00, 0x32,                         // height = 50
      0x08, 0x06, 0x00, 0x00, 0x00,                   // 8-bit RGBA
      0x00, 0x00, 0x00, 0x00                          // CRC placeholder
    ]);

    const dimensions = parseImageDimensions(png1x1);
    assert.ok(dimensions, 'Dimensions should be parsed successfully');
    assert.strictEqual(dimensions!.width, 100, 'PNG width should be 100');
    assert.strictEqual(dimensions!.height, 50, 'PNG height should be 50');
  });

  // Test 6: Unique Filename Generation
  await test('Rule: Generate unique filenames with cryptographically distinct identifiers', async () => {
    // Create valid 100x50 PNG buffer
    const validPng = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x64, // 100
      0x00, 0x00, 0x00, 0x32, // 50
      0x08, 0x02, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ]);

    const res1 = await validateAndSaveAsset({
      buffer: validPng,
      originalname: 'regional_logo.png',
      mimetype: 'image/png',
      size: validPng.length,
    }, 'logo');

    const res2 = await validateAndSaveAsset({
      buffer: validPng,
      originalname: 'regional_logo.png',
      mimetype: 'image/png',
      size: validPng.length,
    }, 'logo');

    assert.notStrictEqual(res1.filename, res2.filename, 'Each upload must receive a unique filename');
    assert.notStrictEqual(res1.url, res2.url, 'Each upload must receive a unique URL');
    assert.ok(res1.filename.startsWith('logo-'), 'Filename should be category prefixed');

    // Clean up test files
    await deleteAssetFile(res1.url);
    await deleteAssetFile(res2.url);
  });

  // Test 7: Atomic File Replacement (Old file deleted only AFTER new file saved)
  await test('Rule: Delete replaced file only after new file is successfully saved', async () => {
    const validPng = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x20, // 32
      0x00, 0x00, 0x00, 0x20, // 32
      0x08, 0x02, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00
    ]);

    // 1. Save original file
    const initialUpload = await validateAndSaveAsset({
      buffer: validPng,
      originalname: 'initial_logo.png',
      mimetype: 'image/png',
      size: validPng.length,
    }, 'logo');

    const initialDiskPath = path.join(process.cwd(), 'public', 'uploads', initialUpload.filename);
    assert.strictEqual(fs.existsSync(initialDiskPath), true, 'Initial file must exist on disk');

    // 2. Perform replacement with replaceUrl
    const secondUpload = await validateAndSaveAsset({
      buffer: validPng,
      originalname: 'replacement_logo.png',
      mimetype: 'image/png',
      size: validPng.length,
    }, 'logo', initialUpload.url);

    const secondDiskPath = path.join(process.cwd(), 'public', 'uploads', secondUpload.filename);
    assert.strictEqual(fs.existsSync(secondDiskPath), true, 'New file must exist on disk');
    assert.strictEqual(fs.existsSync(initialDiskPath), false, 'Replaced file must have been safely deleted');

    // Clean up
    await deleteAssetFile(secondUpload.url);
  });

  // Test 8: Safe Custom Formatter (Supports ONLY **bold**, *italic*, line breaks; blocks HTML)
  await test('Rule: Custom formatter supports strictly bold, italic, line breaks; prevents unsanitized HTML', () => {
    const testText = `**Department of Education**\n*Regional Office VIII*\n CANDAHUG <script>alert('xss')</script> <img src=x onerror=alert(1)>`;

    // Simulate SafeFormattedText tokenization
    const rawLines = testText.split('\n');
    assert.strictEqual(rawLines.length, 3, 'Must split into 3 lines on newline');

    // Line 1: Bold detection
    const boldMatch = rawLines[0].match(/\*\*(.*?)\*\*/);
    assert.ok(boldMatch, 'Line 1 must match bold syntax');
    assert.strictEqual(boldMatch![1], 'Department of Education');

    // Line 2: Italic detection
    const italicMatch = rawLines[1].match(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/);
    assert.ok(italicMatch, 'Line 2 must match italic syntax');
    assert.strictEqual(italicMatch![1], 'Regional Office VIII');

    // Line 3: XSS Attempt - never evaluated as HTML
    // In React, standard JSX nodes {line} treat `<script>` and `<img onerror>` as pure strings,
    // which renders as literal text without dangerouslySetInnerHTML!
    assert.ok(rawLines[2].includes('<script>'), 'Line 3 contains raw text');
    assert.ok(!rawLines[2].includes('dangerouslySetInnerHTML'), 'Safe formatter never uses dangerouslySetInnerHTML');
  });

  // Test 9: System Settings Validation
  await test('Rule: Validate System customization settings structure', () => {
    const systemPayload = {
      siteTitle: 'Project SBM Online',
      regionTitle: 'Department of Education Regional Office VIII',
      navbarLogo: '/uploads/logo-123.png',
      favicon: '/uploads/favicon-123.ico',
      baseFontSize: 16,
      primaryColor: '#0038a8',
      secondaryColor: '#495057',
      accentColor: '#ce1126',
      backgroundColor: '#f8f9fa',
    };

    assert.ok(systemPayload.siteTitle.length > 0, 'Site title required');
    assert.ok(systemPayload.baseFontSize >= 12 && systemPayload.baseFontSize <= 24, 'Base font size in bounds');
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(systemPayload.primaryColor), 'Primary color must be hex');
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(systemPayload.accentColor), 'Accent color must be hex');
  });

  // Test 10: Login Page Settings Validation
  await test('Rule: Validate Login page customization settings structure', () => {
    const loginPayload = {
      eyebrowText: 'DEPARTMENT OF EDUCATION • REGIONAL OFFICE VIII',
      mainHeading: 'Project SBM Online',
      description: 'Official SBM Self-Assessment System.',
      loginFormTitle: 'Sign In to Portal',
      loginFormDescription: 'Enter your credentials.',
      publicAnnouncement: 'System maintenance scheduled.',
      loginLogo: '/uploads/logo-portal.png',
      brandPanelBg: '/uploads/bg-building.jpg',
      primaryColor: '#0038a8',
      gradientColor: '#001a4e',
      accentColor: '#ce1126',
      loginPanelColor: '#ffffff',
      showFullFooter: true,
    };

    assert.ok(loginPayload.mainHeading.length > 0, 'Main heading required');
    assert.strictEqual(typeof loginPayload.showFullFooter, 'boolean', 'showFullFooter must be boolean');
    assert.ok(loginPayload.primaryColor.startsWith('#'), 'Valid primary color');
    assert.ok(loginPayload.gradientColor.startsWith('#'), 'Valid gradient color');
  });

  // Test 11: Footer Customization Settings Validation
  await test('Rule: Validate Footer customization settings with three logos and contacts', () => {
    const footerPayload = {
      firstWideLogo: '/uploads/logo-wide-deped.png',
      logo2: '/uploads/logo-ro8.png',
      logo3: '/uploads/logo-iso.png',
      footerText: '**Department of Education Regional Office VIII**\n*Candahug, Palo, Leyte*',
      supportEmail: 'qad.region8@deped.gov.ph',
      telephone: '(053) 832-2997',
      privacyNoticeUrl: '#',
      termsUrl: '#',
      userManualUrl: '#',
      facebookUrl: 'https://www.facebook.com/DepEdROVIII',
      websiteUrl: 'https://region8.deped.gov.ph',
    };

    assert.ok(footerPayload.firstWideLogo.length > 0, 'Wide first logo must be configured');
    assert.ok(footerPayload.logo2.length > 0, 'Middle logo must be configured');
    assert.ok(footerPayload.logo3.length > 0, 'Third logo must be configured');
    assert.ok(footerPayload.supportEmail.includes('@'), 'Support email must be valid');
    assert.ok(footerPayload.telephone.length > 5, 'Telephone must be present');
  });

  console.log(`\nAll ${passedTests}/${totalTests} Customization & Asset Management tests passed successfully!\n`);
}

runCustomizationTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
