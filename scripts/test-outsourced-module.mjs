#!/usr/bin/env node
/**
 * Smoke test: outsourced module schema + supplier car insert lifecycle.
 * Usage: node scripts/test-outsourced-module.mjs
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey =
  process.env.SB_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('FAIL Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkTable(name) {
  const { error } = await supabase.from(name).select('id').limit(1);
  if (error) {
    console.log(`SKIP table "${name}" — ${error.message}`);
    return false;
  }
  console.log(`OK table "${name}" exists`);
  return true;
}

async function assertCarOutsourceColumns() {
  const testPlate = `TST-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { data, error } = await supabase
    .from('cars')
    .insert({
      make: 'Test',
      model: 'Outsource',
      year: 2024,
      license_plate: testPlate,
      daily_rate: 100,
      is_outsourced: true,
      outsource_owner_name: 'Test Owner',
      outsource_commission_rate: 15,
      fleet_owner_id: null,
      status: 'available',
    })
    .select('id, is_outsourced, outsource_owner_name, outsource_commission_rate')
    .single();

  if (error) {
    console.error('FAIL Outsourced car insert:', error.message);
    process.exit(1);
  }

  if (!data?.is_outsourced || data.outsource_owner_name !== 'Test Owner') {
    console.error('FAIL Outsourced car columns not persisted correctly', data);
    await supabase.from('cars').delete().eq('id', data?.id);
    process.exit(1);
  }

  const { error: delError } = await supabase.from('cars').delete().eq('id', data.id);
  if (delError) {
    console.error('WARN cleanup failed for test car:', delError.message);
  }

  console.log('OK outsourced car insert + cleanup');
}

async function assertBrokerInsert() {
  const name = `Test Broker ${randomUUID().slice(0, 6)}`;
  const { data, error } = await supabase
    .from('brokers')
    .insert({ name, default_commission_rate: 10 })
    .select('id, name')
    .single();

  if (error) {
    console.error('FAIL Broker insert:', error.message);
    process.exit(1);
  }

  await supabase.from('brokers').delete().eq('id', data.id);
  console.log('OK broker insert + cleanup');
}

async function main() {
  console.log('Testing outsourced module against', supabaseUrl);

  // Phase 3 UI depends on cars outsource columns (usually already migrated)
  await assertCarOutsourceColumns();

  const hasBrokers = await checkTable('brokers');
  const hasSettlements = await checkTable('payout_settlements');

  if (hasBrokers) {
    await assertBrokerInsert();
  } else {
    console.log('WARN Broker registry + settlements need scripts/apply_outsourced_module_extension.sql');
  }

  if (!hasBrokers || !hasSettlements) {
    console.log('\nPartial pass: supplier car flow ready; run SQL migration for brokers/settlements.');
    process.exit(0);
  }

  console.log('\nAll outsourced module checks passed.');
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
