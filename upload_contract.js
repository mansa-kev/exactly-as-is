import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const htmlPath = '/home/billionaire_kevin/.gemini/antigravity/brain/a9a5a43e-e67f-431e-b752-53ef081d6edc/linkedhub_contract_template.html';
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  html = html.replace('Two Thousand Twenty ____________', 'Two Thousand Twenty Six');
  html = html.replace('currently of mileage ____________', 'currently of mileage ____________ (as confirmed at the pickup)');
  html = html.replace('https://nzwqexzuvnlyqzzxigcd.supabase.co/storage/v1/object/public/public_assets/logo.png', '{{logoUrl}}');
  html = html.replace('of post office box number ____________ Nairobi', 'of post office box number {{companyPoBox}} Nairobi');
  html = html.replace('<!-- The company signature logic can be embedded here if needed -->', '<img src="{{companySignatureUrl}}" alt="Company Signature" style="max-height: 50px; margin-top: 10px;" />');

  const buffer = Buffer.from(html, 'utf8');
  const fileName = `contract-v2.1.1-auto.html`;
  const filePath = `contracts/${fileName}`;
  
  console.log('Uploading HTML to storage...');
  const { error: uploadError } = await supabase.storage.from('public_assets').upload(filePath, buffer, { contentType: 'text/html', upsert: true });
  if (uploadError) throw uploadError;
  
  const { data: { publicUrl } } = supabase.storage.from('public_assets').getPublicUrl(filePath);
  console.log('Public URL:', publicUrl);
  
  console.log('Deactivating old contracts...');
  await supabase.from('contracts_master').update({ is_active: false }).eq('is_active', true);
  
  console.log('Creating new contract version...');
  const { error: insertError } = await supabase.from('contracts_master').insert({
    version: '2.1.1',
    pdf_url: publicUrl,
    is_active: true
  });
  if (insertError) throw insertError;
  
  console.log('Done.');
}
run().catch(console.error);
