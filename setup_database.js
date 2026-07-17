#!/usr/bin/env node

/**
 * Database Setup Script for LinkedUp Cars
 * Run this script to create the car_reservations table
 * 
 * Usage: node setup_database.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  try {
    console.log('Setting up car_reservations table...');
    
    // Read the SQL file
    const sql = readFileSync('./create_car_reservations_table.sql', 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error creating table:', error);
      return;
    }
    
    console.log('â car_reservations table created successfully!');
    console.log('â Indexes created');
    console.log('â RLS policies applied');
    console.log('â Triggers created');
    
  } catch (error) {
    console.error('Setup failed:', error.message);
  }
}

// Alternative method using direct SQL execution
async function setupDatabaseDirect() {
  try {
    console.log('Creating car_reservations table...');
    
    const { data, error } = await supabase
      .from('car_reservations')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.log('Table does not exist. Please run the SQL manually in Supabase Dashboard:');
      console.log('1. Go to your Supabase project');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the contents of create_car_reservations_table.sql');
      console.log('4. Click "Run"');
    } else if (error) {
      console.error('Error checking table:', error);
    } else {
      console.log('â car_reservations table already exists!');
    }
    
  } catch (error) {
    console.error('Setup check failed:', error.message);
  }
}

// Run the setup
setupDatabaseDirect();
