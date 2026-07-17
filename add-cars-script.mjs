import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://edroffvtzrowpsooszqh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTI2MzUzNSwiZXhwIjoyMDQwODM5NTM1fQ.3Jk8r6n4KuL-aNqBW9xJ0vJ6mJ5j3xJ5j3xJ5j3xJ5j'
);

// Generic placeholder image URL
const placeholderImage = 'https://picsum.photos/seed/luxury-car/800/600.jpg';

// Cars data with compelling marketing descriptions
const carsToAdd = [
  {
    make: 'Toyota',
    model: 'Camry',
    year: 2024,
    color: 'Pearl White',
    license_plate: 'KCB 123A',
    category: 'Sedan',
    description: 'Experience the perfect blend of elegance and efficiency with our 2024 Toyota Camry. This premium sedan offers unparalleled comfort, advanced safety features, and exceptional fuel economy. Whether you\'re navigating Nairobi\'s business districts or embarking on a weekend getaway, the Camry delivers a sophisticated driving experience that exceeds expectations.',
    primary_image_url: placeholderImage,
    photos: [placeholderImage],
    video_url: '',
    transmission: 'Automatic',
    fuel_type: 'Hybrid',
    seats: 5,
    features: ['Leather Seats', 'Sunroof', 'GPS Navigation', 'Bluetooth', 'Cruise Control', 'Lane Assist', 'Adaptive Cruise Control', 'Premium Audio'],
    location_lat: -1.2921,
    location_lon: 36.8219,
    status: 'available',
    maintenance_status: 'ok',
    last_maintenance_date: '2024-01-15',
    next_service_date: '2024-07-15',
    daily_rate: 4500,
    overtime_rate: 500,
    security_deposit: 15000,
    is_approved: true,
    is_outsourced: false
  },
  {
    make: 'Mercedes-Benz',
    model: 'C-Class',
    year: 2024,
    color: 'Metallic Silver',
    license_plate: 'KCD 456B',
    category: 'Luxury',
    description: 'Indulge in pure luxury with our 2024 Mercedes-Benz C-Class. This masterpiece of German engineering combines cutting-edge technology with timeless elegance. From the handcrafted interior to the whisper-quiet engine, every detail speaks of sophistication. Perfect for making a lasting impression at business meetings or special occasions.',
    primary_image_url: placeholderImage,
    photos: [placeholderImage],
    video_url: '',
    transmission: 'Automatic',
    fuel_type: 'Petrol',
    seats: 5,
    features: ['MBUX Infotainment', 'Burmester Audio', 'Ambient Lighting', 'Panoramic Sunroof', 'Heated Seats', 'Wireless Charging', 'Apple CarPlay', 'Android Auto'],
    location_lat: -1.2921,
    location_lon: 36.8219,
    status: 'available',
    maintenance_status: 'ok',
    last_maintenance_date: '2024-01-20',
    next_service_date: '2024-07-20',
    daily_rate: 8500,
    overtime_rate: 1000,
    security_deposit: 25000,
    is_approved: true,
    is_outsourced: false
  },
  {
    make: 'Toyota',
    model: 'Land Cruiser',
    year: 2024,
    color: 'Midnight Black',
    license_plate: 'KCE 789C',
    category: 'SUV',
    description: 'Conquer any terrain with confidence in our 2024 Toyota Land Cruiser. Built for adventure yet refined for comfort, this legendary SUV combines rugged capability with premium amenities. Perfect for safaris, family road trips, or navigating Kenya\'s diverse landscapes with unmatched reliability and prestige.',
    primary_image_url: placeholderImage,
    photos: [placeholderImage],
    video_url: '',
    transmission: 'Automatic',
    fuel_type: 'Diesel',
    seats: 7,
    features: ['4WD System', 'Multi-Terrain Select', 'Crawl Control', 'Third Row Seating', 'Premium Audio', 'Leather Interior', 'Roof Rails', 'Tow Hitch'],
    location_lat: -1.2921,
    location_lon: 36.8219,
    status: 'available',
    maintenance_status: 'ok',
    last_maintenance_date: '2024-01-10',
    next_service_date: '2024-07-10',
    daily_rate: 7500,
    overtime_rate: 900,
    security_deposit: 20000,
    is_approved: true,
    is_outsourced: false
  },
  {
    make: 'BMW',
    model: 'X5',
    year: 2024,
    color: 'Alpine White',
    license_plate: 'KCF 101D',
    category: 'SUV',
    description: 'Elevate your journey with the 2024 BMW X5, where performance meets luxury in perfect harmony. This dynamic SUV delivers sportscar-like agility with SUV versatility, wrapped in unmistakable BMW elegance. Ideal for those who demand excellence in every aspect of their driving experience.',
    primary_image_url: placeholderImage,
    photos: [placeholderImage],
    video_url: '',
    transmission: 'Automatic',
    fuel_type: 'Petrol',
    seats: 7,
    features: ['xDrive AWD', 'Live Cockpit Professional', 'Harman Kardon Audio', 'Panoramic Roof', 'Heated Steering Wheel', 'Gesture Control', 'Wireless Charging', 'Head-Up Display'],
    location_lat: -1.2921,
    location_lon: 36.8219,
    status: 'available',
    maintenance_status: 'ok',
    last_maintenance_date: '2024-01-25',
    next_service_date: '2024-07-25',
    daily_rate: 9000,
    overtime_rate: 1200,
    security_deposit: 30000,
    is_approved: true,
    is_outsourced: false
  },
  {
    make: 'Audi',
    model: 'A4',
    year: 2024,
    color: 'Naval Blue',
    license_plate: 'KCG 234E',
    category: 'Luxury',
    description: 'Discover automotive perfection with our 2024 Audi A4. This compact luxury sedan represents the pinnacle of German engineering, offering refined performance, cutting-edge technology, and understated elegance. Perfect for the discerning driver who appreciates subtlety and sophistication.',
    primary_image_url: placeholderImage,
    photos: [placeholderImage],
    video_url: '',
    transmission: 'Automatic',
    fuel_type: 'Petrol',
    seats: 5,
    features: ['Virtual Cockpit', 'Bang & Olufsen Audio', 'Quattro AWD', 'Matrix LED Headlights', 'Leather Seats', 'Adaptive Cruise', 'Parking Assist', 'Wireless Charging'],
    location_lat: -1.2921,
    location_lon: 36.8219,
    status: 'available',
    maintenance_status: 'ok',
    last_maintenance_date: '2024-01-18',
    next_service_date: '2024-07-18',
    daily_rate: 7000,
    overtime_rate: 850,
    security_deposit: 22000,
    is_approved: true,
    is_outsourced: false
  },
  {
    make: 'Nissan',
    model: 'Patrol',
    year: 2024,
    color: 'Bronze Metallic',
    license_plate: 'KCH 567F',
    category: 'SUV',
    description: 'Command attention with our 2024 Nissan Patrol, the ultimate expression of power and prestige. This full-size luxury SUV combines commanding presence with exceptional off-road capability and premium comfort. Perfect for those who refuse to compromise on adventure or luxury.',
    primary_image_url: placeholderImage,
    photos: [placeholderImage],
    video_url: '',
    transmission: 'Automatic',
    fuel_type: 'Petrol',
    seats: 8,
    features: ['4WD System', 'Intelligent Around View', 'Leather Interior', 'Premium Audio', 'Climate Control', 'Roof Rails', 'Tow Package', 'Remote Start'],
    location_lat: -1.2921,
    location_lon: 36.8219,
    status: 'available',
    maintenance_status: 'ok',
    last_maintenance_date: '2024-01-12',
    next_service_date: '2024-07-12',
    daily_rate: 8000,
    overtime_rate: 1000,
    security_deposit: 25000,
    is_approved: true,
    is_outsourced: false
  },
  {
    make: 'Honda',
    model: 'CR-V',
    year: 2024,
    color: 'Crystal Black',
    license_plate: 'KCM 890G',
    category: 'SUV',
    description: 'Experience versatile excellence with our 2024 Honda CR-V. This compact SUV perfectly balances practicality, efficiency, and style. Ideal for urban adventures and weekend escapes alike, offering Honda\'s legendary reliability with modern comfort and advanced safety features.',
    primary_image_url: placeholderImage,
    photos: [placeholderImage],
    video_url: '',
    transmission: 'Automatic',
    fuel_type: 'Hybrid',
    seats: 5,
    features: ['Honda Sensing', 'Apple CarPlay', 'Android Auto', 'Leather Seats', 'Moonroof', 'Dual Zone Climate', 'Power Tailgate', 'Heated Seats'],
    location_lat: -1.2921,
    location_lon: 36.8219,
    status: 'available',
    maintenance_status: 'ok',
    last_maintenance_date: '2024-01-22',
    next_service_date: '2024-07-22',
    daily_rate: 5500,
    overtime_rate: 650,
    security_deposit: 18000,
    is_approved: true,
    is_outsourced: false
  },
  {
    make: 'Lexus',
    model: 'RX 350',
    year: 2024,
    color: 'Obsidian Black',
    license_plate: 'KCN 345H',
    category: 'Luxury',
    description: 'Immerse yourself in luxury with our 2024 Lexus RX 350. This premium SUV redefines comfort and sophistication, offering whisper-quiet operation, exquisite craftsmanship, and cutting-edge technology. Every journey becomes an experience in pure indulgence.',
    primary_image_url: placeholderImage,
    photos: [placeholderImage],
    video_url: '',
    transmission: 'Automatic',
    fuel_type: 'Petrol',
    seats: 7,
    features: ['Mark Levinson Audio', 'Panoramic Roof', 'Heated & Ventilated Seats', 'Head-Up Display', 'Wireless Charging', 'Apple CarPlay', 'Android Auto', 'Advanced Safety'],
    location_lat: -1.2921,
    location_lon: 36.8219,
    status: 'available',
    maintenance_status: 'ok',
    last_maintenance_date: '2024-01-28',
    next_service_date: '2024-07-28',
    daily_rate: 9500,
    overtime_rate: 1300,
    security_deposit: 35000,
    is_approved: true,
    is_outsourced: false
  }
];

async function addCars() {
  console.log('Starting to add cars to the database...');
  
  for (const car of carsToAdd) {
    try {
      console.log(`Adding ${car.make} ${car.model}...`);
      
      const { data, error } = await supabase
        .from('cars')
        .insert([car])
        .select();
      
      if (error) {
        console.error(`Error adding ${car.make} ${car.model}:`, error);
      } else {
        console.log(`Successfully added ${car.make} ${car.model} with ID: ${data[0].id}`);
      }
    } catch (err) {
      console.error(`Unexpected error adding ${car.make} ${car.model}:`, err);
    }
  }
  
  console.log('Finished adding all cars!');
}

// Run the function
addCars().catch(console.error);
