const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function testPdf() {
  const existingPdfBytes = fs.readFileSync('public/master_contract.pdf').buffer; // wait, do we have a pdf locally? let's check
}
testPdf();
