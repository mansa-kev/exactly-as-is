import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase details
const SUPABASE_URL = 'https://edroffvtzrowpsooszqh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const imageDir = '/home/billionaire_kevin/Downloads/Linkedupcarsimages/';

// Mapping images based on my review
const imgFiles = [
  'WhatsApp Image 2026-05-03 at 10.28.16.jpeg', // 1
  'WhatsApp Image 2026-05-03 at 10.28.17 (1).jpeg', // 2
  'WhatsApp Image 2026-05-03 at 10.28.17 (2).jpeg', // 3
  'WhatsApp Image 2026-05-03 at 10.28.17.jpeg', // 4
  'WhatsApp Image 2026-05-03 at 10.28.18 (1).jpeg', // 5
  'WhatsApp Image 2026-05-03 at 10.28.18.jpeg', // 6
  'WhatsApp Image 2026-05-03 at 10.28.19 (1).jpeg', // 7
  'WhatsApp Image 2026-05-03 at 10.28.19.jpeg', // 8
  'WhatsApp Image 2026-05-03 at 10.28.20 (1).jpeg', // 9
  'WhatsApp Image 2026-05-03 at 10.28.20.jpeg', // 10
  'WhatsApp Image 2026-05-03 at 10.28.21 (1).jpeg', // 11
  'WhatsApp Image 2026-05-03 at 10.28.21.jpeg', // 12
  'WhatsApp Image 2026-05-03 at 10.28.22.jpeg', // 13
  'WhatsApp Image 2026-05-03 at 10.28.23.jpeg', // 14
  'WhatsApp Image 2026-05-03 at 10.28.25 (1).jpeg', // 15
  'WhatsApp Image 2026-05-03 at 10.28.25 (2).jpeg', // 16
  'WhatsApp Image 2026-05-03 at 10.28.25.jpeg', // 17
  'WhatsApp Image 2026-05-03 at 10.28.26 (1).jpeg', // 18
  'WhatsApp Image 2026-05-03 at 10.28.26.jpeg', // 19
  'WhatsApp Image 2026-05-03 at 10.32.27 (1).jpeg', // 20
  'WhatsApp Image 2026-05-03 at 10.32.27 (2).jpeg', // 21
  'WhatsApp Image 2026-05-03 at 10.32.27.jpeg', // 22
  'WhatsApp Image 2026-05-03 at 10.32.28.jpeg', // 23
  'WhatsApp Image 2026-05-03 at 10.32.30 (1).jpeg', // 24
  'WhatsApp Image 2026-05-03 at 10.32.30 (2).jpeg', // 25
  'WhatsApp Image 2026-05-03 at 10.32.30.jpeg', // 26
  'WhatsApp Image 2026-05-03 at 10.32.31.jpeg', // 27
  'WhatsApp Image 2026-05-03 at 10.32.34.jpeg', // 28
  'WhatsApp Image 2026-05-03 at 10.32.35 (1).jpeg', // 29
  'WhatsApp Image 2026-05-03 at 10.32.35.jpeg', // 30
  'WhatsApp Image 2026-05-03 at 10.32.36 (1).jpeg', // 31
  'WhatsApp Image 2026-05-03 at 10.32.36 (2).jpeg', // 32
  'WhatsApp Image 2026-05-03 at 10.32.36 (3).jpeg', // 33
  'WhatsApp Image 2026-05-03 at 10.32.36.jpeg', // 34
  'WhatsApp Image 2026-05-03 at 10.32.37 (1).jpeg', // 35
  'WhatsApp Image 2026-05-03 at 10.32.37 (2).jpeg', // 36
  'WhatsApp Image 2026-05-03 at 10.32.37 (3).jpeg', // 37
  'WhatsApp Image 2026-05-03 at 10.32.37.jpeg', // 38
  'WhatsApp Image 2026-05-03 at 10.32.38.jpeg' // 39
];

// Re-read dir to get exact names since indices might have shifted
const actualFiles = fs.readdirSync(imageDir).filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg'));
// Map based on prefixes or exact names discovered during manual review

const carsToAdd = [
  { make: 'Mazda', model: 'Demio', daily_rate: 3500, color: 'Black', license_plate: 'KDJ 100K', category: 'Hatchback', imgFilter: (f) => f.includes('10.28.21') || f.includes('10.28.22') || f.includes('10.28.23') },
  { make: 'Nissan', model: 'Note', daily_rate: 3000, color: 'Silver', license_plate: 'KDN 528H', category: 'Hatchback', imgFilter: (f) => f === 'WhatsApp Image 2026-05-03 at 10.28.17 (1).jpeg' },
  { make: 'Nissan', model: 'Note', daily_rate: 3000, color: 'White', license_plate: 'KCW 733X', category: 'Hatchback', imgFilter: (f) => ['WhatsApp Image 2026-05-03 at 10.28.18.jpeg', 'WhatsApp Image 2026-05-03 at 10.28.19 (1).jpeg', 'WhatsApp Image 2026-05-03 at 10.28.19.jpeg', 'WhatsApp Image 2026-05-03 at 10.28.20 (1).jpeg', 'WhatsApp Image 2026-05-03 at 10.28.20.jpeg'].includes(f) },
  { make: 'Nissan', model: 'Note e-Power', daily_rate: 3500, color: 'Black', license_plate: '', category: 'Hatchback', imgFilter: (f) => f === 'WhatsApp Image 2026-05-03 at 10.32.37 (1).jpeg' },
  { make: 'Nissan', model: 'Note Nismo', daily_rate: 3500, color: 'Black', license_plate: 'KDS 979V', category: 'Hatchback', imgFilter: (f) => ['WhatsApp Image 2026-05-03 at 10.32.30.jpeg', 'WhatsApp Image 2026-05-03 at 10.32.30 (1).jpeg', 'WhatsApp Image 2026-05-03 at 10.32.30 (2).jpeg'].includes(f) }, // Approximate match for Nismo
  { make: 'Toyota', model: 'Harrier', daily_rate: 8000, color: 'Black', license_plate: 'KDP 476Z', category: 'SUV', imgFilter: (f) => f.includes('10.32.34') || f.includes('10.32.35') },
  { make: 'Toyota', model: 'Harrier', daily_rate: 8000, color: 'White', license_plate: '', category: 'SUV', imgFilter: (f) => f === 'WhatsApp Image 2026-05-03 at 10.32.36 (3).jpeg' },
  { make: 'Toyota', model: 'Prado', daily_rate: 12000, color: '', license_plate: '', category: 'SUV', description: 'Petrol engine', imgFilter: () => false },
  { make: 'Toyota', model: 'Prado', daily_rate: 13000, color: '', license_plate: '', category: 'SUV', description: 'Diesel engine', imgFilter: () => false },
  { make: 'Nissan', model: 'X-Trail', daily_rate: 6500, color: '', license_plate: '', category: 'SUV', imgFilter: () => false },
  { make: 'Mazda', model: 'CX-5', daily_rate: 6500, color: 'Red', license_plate: 'KDK 629Q', category: 'SUV', imgFilter: (f) => f === 'WhatsApp Image 2026-05-03 at 10.28.16.jpeg' },
  { make: 'Mazda', model: 'CX-5', daily_rate: 6500, color: 'Grey', license_plate: 'KDP 606S', category: 'SUV', imgFilter: (f) => f.includes('10.32.30') && !f.includes('10.32.30.jpeg') }, // Assuming Nismo matched first
  { make: 'Mazda', model: 'CX-5', daily_rate: 6500, color: 'Black', license_plate: 'KDU', category: 'SUV', imgFilter: (f) => f === 'WhatsApp Image 2026-05-03 at 10.32.36 (1).jpeg' },
  { make: 'Mazda', model: 'CX-5', daily_rate: 6500, color: 'Silver', license_plate: 'KDS', category: 'SUV', imgFilter: (f) => f === 'WhatsApp Image 2026-05-03 at 10.32.36.jpeg' },
  { make: 'Mazda', model: 'CX-5', daily_rate: 6500, color: 'Silver', license_plate: 'KDP', category: 'SUV', description: 'Diesel', imgFilter: (f) => f === 'WhatsApp Image 2026-05-03 at 10.32.31.jpeg' },
  { make: 'Mazda', model: 'Axela', daily_rate: 5000, color: 'White', license_plate: 'KDG 951Z', category: 'Sedan', imgFilter: (f) => f.includes('10.32.27') || f.includes('10.32.28') },
  { make: 'Mazda', model: 'CX-3', daily_rate: 6000, color: 'Black', license_plate: 'KDK 412J', category: 'SUV', imgFilter: (f) => f.includes('10.28.25') || f.includes('10.28.26') },
  { make: 'Mazda', model: 'CX-3', daily_rate: 6000, color: 'Dark Blue', license_plate: 'KDU', category: 'SUV', imgFilter: (f) => f === 'WhatsApp Image 2026-05-03 at 10.32.37 (2).jpeg' },
  { make: 'Toyota', model: 'Axio', daily_rate: 4000, color: 'Silver', license_plate: 'KDU', category: 'Sedan', imgFilter: (f) => f === 'WhatsApp Image 2026-05-03 at 10.32.37.jpeg' },
  { make: 'Toyota', model: 'Fielder', daily_rate: 4500, color: 'Black', license_plate: 'KDG 839T', category: 'Wagon', imgFilter: (f) => ['WhatsApp Image 2026-05-03 at 10.28.17 (2).jpeg', 'WhatsApp Image 2026-05-03 at 10.28.17.jpeg', 'WhatsApp Image 2026-05-03 at 10.28.18 (1).jpeg'].includes(f) },
  { make: 'Mazda', model: 'CX-8', daily_rate: 8000, color: 'Dark Grey', license_plate: 'KDT', category: 'SUV', imgFilter: (f) => f === 'WhatsApp Image 2026-05-03 at 10.32.38.jpeg' },
  { make: 'Mitsubishi', model: 'Outlander', daily_rate: 7000, color: '', license_plate: '', category: 'SUV', imgFilter: () => false },
  { make: 'Toyota', model: 'Noah/Voxy', daily_rate: 6500, color: '', license_plate: '', category: 'Minivan', imgFilter: () => false },
  { make: 'Nissan', model: 'Serena', daily_rate: 6000, color: '', license_plate: '', category: 'Minivan', imgFilter: () => false },
  { make: 'Toyota', model: 'Land Cruiser V8', daily_rate: 25000, color: '', license_plate: '', category: 'SUV', imgFilter: () => false },
  { make: 'Mercedes-Benz', model: 'G-Wagon', daily_rate: 120000, color: '', license_plate: '', category: 'SUV', description: 'Chauffeured', imgFilter: () => false },
  { make: 'Land Rover', model: 'Range Rover Sport', daily_rate: 70000, color: '', license_plate: '', category: 'SUV', description: 'Chauffeured', imgFilter: () => false },
  { make: 'Toyota', model: 'RAV4', daily_rate: 9000, color: '', license_plate: '', category: 'SUV', imgFilter: () => false },
  { make: 'Mercedes-Benz', model: 'C200', daily_rate: 18000, color: '', license_plate: '', category: 'Sedan', imgFilter: () => false },
  { make: 'Mercedes-Benz', model: 'E250', daily_rate: 22000, color: '', license_plate: '', category: 'Sedan', imgFilter: () => false },
];

async function uploadImage(fileName) {
  const filePath = path.join(imageDir, fileName);
  if (!fs.existsSync(filePath)) return null;
  const ext = path.extname(fileName);
  const newName = `car_images/${Math.random().toString(36).substring(2, 15)}_${Date.now()}${ext}`;
  
  const fileBody = fs.readFileSync(filePath);
  const { data, error } = await supabase.storage.from('public_assets').upload(newName, fileBody, { contentType: 'image/jpeg' });
  if (error) {
    console.error('Upload error for', fileName, error);
    return null;
  }
  const { data: pubData } = supabase.storage.from('public_assets').getPublicUrl(newName);
  return pubData.publicUrl;
}

async function run() {
  let matchedFiles = new Set();
  
  for (const car of carsToAdd) {
    const carImages = actualFiles.filter(f => car.imgFilter(f) && !matchedFiles.has(f));
    carImages.forEach(f => matchedFiles.add(f));
    
    let uploadedUrls = [];
    for (const f of carImages) {
      console.log(`Uploading ${f} for ${car.make} ${car.model}...`);
      const url = await uploadImage(f);
      if (url) uploadedUrls.push(url);
    }
    
    const dbCar = {
      make: car.make,
      model: car.model,
      year: 2020,
      daily_rate: car.daily_rate,
      overtime_rate: Math.round(car.daily_rate / 10),
      security_deposit: car.daily_rate * 2,
      category: car.category,
      color: car.color,
      license_plate: car.license_plate || `TEMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      transmission: 'Automatic',
      fuel_type: 'Petrol',
      seats: car.category === 'SUV' || car.category === 'Minivan' ? 7 : 5,
      description: car.description || 'Premium vehicle available for rent.',
      primary_image_url: uploadedUrls.length > 0 ? uploadedUrls[0] : '',
      photos: uploadedUrls.slice(1),
      fleet_owner_id: null, // default to platform owned
      status: 'available',
      maintenance_status: 'ok',
      is_approved: true,
      features: ['Air Conditioning', 'Bluetooth Audio']
    };
    
    console.log(`Inserting ${car.make} ${car.model}...`);
    const { error } = await supabase.from('cars').insert(dbCar);
    if (error) {
      console.error(`Failed to insert ${car.make} ${car.model}:`, error.message);
    } else {
      console.log(`Successfully inserted ${car.make} ${car.model}`);
    }
  }
  
  const unusedFiles = actualFiles.filter(f => !matchedFiles.has(f));
  console.log(`\nUnused files:`, unusedFiles);
}

run();
