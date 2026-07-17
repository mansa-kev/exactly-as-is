#!/usr/bin/env node
/**
 * Smoke test: POST /api/booking-documents/upload with a tiny PNG payload.
 * Usage: node scripts/test-booking-document-upload.mjs [baseUrl]
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const baseUrl = process.argv[2] || 'http://localhost:8080';

// 1x1 red PNG
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  const carId = `test_car_${Date.now()}`;
  const res = await fetch(`${baseUrl}/api/booking-documents/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      carId,
      docType: 'facePhoto',
      contentType: 'image/png',
      dataBase64: PNG_BASE64,
      uploadId: `smoke_${Date.now()}`,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success || !body.publicUrl) {
    console.error('FAIL', res.status, body);
    process.exit(1);
  }

  console.log('OK booking document upload');
  console.log('  url:', body.publicUrl);
  console.log('  path:', body.filePath);
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
