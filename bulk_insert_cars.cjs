const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://edroffvtzrowpsooszqh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcm9mZnZ0enJvd3Bzb29zenFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc0MzY2MiwiZXhwIjoyMDkxMzE5NjYyfQ.jL_YxElgo1_RMcrsslERsioazsCTlwAzw-G0JylGJh8'
);

const economy = ['Air Conditioning','Bluetooth Audio','USB Charging','Power Windows','Fuel-Efficient'];
const suv = ['Air Conditioning','Bluetooth Audio','USB Charging','Rear Camera','Leather Seats','Sunroof','Push Start','Parking Sensors'];
const premium = ['Air Conditioning','Bluetooth Audio','Heated Seats','Panoramic Sunroof','Leather Seats','GPS Navigation','Premium Sound System','Rear Camera','Wireless Charging'];
const chauffeured = [...premium, 'Professional Chauffeur','Privacy Glass','Bottled Water'];

const cars = [
  { make:'Mazda',     model:'Demio',             year:2020, category:'Hatchback', transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:3500,   overtime_rate:400,  security_deposit:7000,   description:'Fuel-efficient and agile city hatchback, perfect for urban commutes and daily errands. Easy to park and economical to run.', features:economy },
  { make:'Nissan',    model:'Note',               year:2020, category:'Hatchback', transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:3000,   overtime_rate:400,  security_deposit:6000,   description:'Practical and comfortable compact car ideal for everyday city driving. Spacious interior with a smooth, reliable ride.', features:economy },
  { make:'Nissan',    model:'Note e-Power',       year:2021, category:'Hatchback', transmission:'Automatic', fuel_type:'Hybrid',  seats:5, daily_rate:3500,   overtime_rate:400,  security_deposit:7000,   description:'Advanced e-Power hybrid technology delivers exceptional fuel efficiency with seamless electric-like acceleration and near-silent performance.', features:[...economy,'Hybrid Drive','Eco Mode'] },
  { make:'Nissan',    model:'Note Nismo',         year:2021, category:'Hatchback', transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:3500,   overtime_rate:400,  security_deposit:7000,   description:'Sport-tuned Nismo variant with enhanced suspension, aggressive body kit, and spirited performance for the driving enthusiast.', features:[...economy,'Sport Mode','Nismo Body Kit'] },
  { make:'Toyota',    model:'Harrier',            year:2022, category:'SUV',       transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:8000,   overtime_rate:800,  security_deposit:16000,  description:'Premium mid-size SUV combining sleek aerodynamic design with a luxurious cabin and refined performance. The perfect blend of style and substance.', features:suv },
  { make:'Toyota',    model:'Prado (Petrol)',     year:2022, category:'SUV',       transmission:'Automatic', fuel_type:'Petrol',  seats:7, daily_rate:12000,  overtime_rate:1200, security_deposit:24000,  description:'The iconic Land Cruiser Prado with a powerful 4.0L petrol V6 engine. Commands any terrain — from Nairobi streets to Maasai Mara game drives.', features:[...suv,'4WD','Terrain Management','7 Seats'] },
  { make:'Toyota',    model:'Prado (Diesel)',     year:2022, category:'SUV',       transmission:'Automatic', fuel_type:'Diesel',  seats:7, daily_rate:13000,  overtime_rate:1300, security_deposit:26000,  description:'Diesel-powered Prado offering superior torque, outstanding fuel efficiency, and legendary reliability for long-distance safaris and tough terrain.', features:[...suv,'4WD','Terrain Management','7 Seats','Diesel Engine'] },
  { make:'Nissan',    model:'X-Trail',            year:2021, category:'SUV',       transmission:'Automatic', fuel_type:'Petrol',  seats:7, daily_rate:6500,   overtime_rate:650,  security_deposit:13000,  description:'Versatile family SUV with all-wheel drive capability, spacious 7-seat cabin, and a host of modern safety and convenience features.', features:[...suv,'7 Seats','AWD'] },
  { make:'Mazda',     model:'CX-5',               year:2022, category:'SUV',       transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:6500,   overtime_rate:650,  security_deposit:13000,  description:'Award-winning compact SUV featuring Mazda\'s SKYACTIV technology for an engaging, efficient drive wrapped in premium KODO soul-in-motion design.', features:suv },
  { make:'Mazda',     model:'Axela',              year:2020, category:'Sedan',     transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:5000,   overtime_rate:500,  security_deposit:10000,  description:'Sophisticated compact sedan with Mazda\'s signature KODO design language and SKYACTIV performance — driving pleasure redefined.', features:economy },
  { make:'Mazda',     model:'CX-3',               year:2021, category:'SUV',       transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:6000,   overtime_rate:600,  security_deposit:12000,  description:'Stylish urban compact crossover with premium Mazda craftsmanship, agile handling, and a feature-packed interior perfect for city adventures.', features:suv },
  { make:'Toyota',    model:'Axio',               year:2019, category:'Sedan',     transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:4000,   overtime_rate:400,  security_deposit:8000,   description:'Kenya\'s most trusted compact sedan — the Toyota Axio. Renowned for exceptional reliability, fuel economy, and comfortable everyday motoring.', features:economy },
  { make:'Toyota',    model:'Fielder',            year:2020, category:'Wagon',     transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:4500,   overtime_rate:450,  security_deposit:9000,   description:'Practical and versatile station wagon with generous cargo space, comfortable seating, and Toyota\'s dependable performance for any journey.', features:[...economy,'Large Boot Space'] },
  { make:'Mazda',     model:'CX-8',               year:2022, category:'SUV',       transmission:'Automatic', fuel_type:'Petrol',  seats:7, daily_rate:8000,   overtime_rate:800,  security_deposit:16000,  description:'Premium 3-row flagship SUV with elegant Japanese craftsmanship, powerful 2.5L engine, and a sophisticated cabin that seats 7 in first-class comfort.', features:[...suv,'7 Seats','Premium Interior'] },
  { make:'Mitsubishi',model:'Outlander',          year:2021, category:'SUV',       transmission:'Automatic', fuel_type:'Petrol',  seats:7, daily_rate:7000,   overtime_rate:700,  security_deposit:14000,  description:'Spacious 7-seater SUV with advanced all-wheel drive, modern safety features, and comfortable long-distance capability for the whole family.', features:[...suv,'7 Seats','AWD','Advanced Safety'] },
  { make:'Toyota',    model:'Noah/Voxy',          year:2021, category:'Minivan',   transmission:'Automatic', fuel_type:'Petrol',  seats:8, daily_rate:6500,   overtime_rate:650,  security_deposit:13000,  description:'Premium family minivan offering exceptional spaciousness, versatile seating, and Toyota\'s reliability. The ideal choice for group transfers and family road trips.', features:[...economy,'8 Seats','Sliding Doors','Large Cabin'] },
  { make:'Nissan',    model:'Serena',             year:2021, category:'Minivan',   transmission:'Automatic', fuel_type:'Petrol',  seats:8, daily_rate:6000,   overtime_rate:600,  security_deposit:12000,  description:'Feature-rich family minivan with ProPilot driver assistance, luxurious captain seats, and an expansive cabin designed for comfortable group travel.', features:[...economy,'8 Seats','Sliding Doors','ProPilot Assist'] },
  { make:'Toyota',    model:'Land Cruiser V8',    year:2022, category:'SUV',       transmission:'Automatic', fuel_type:'Diesel',  seats:8, daily_rate:25000,  overtime_rate:2500, security_deposit:50000,  description:'The undisputed king of the road. The Toyota Land Cruiser V8 commands authority on every surface — prestige, power, and unstoppable off-road capability in one legendary machine.', features:[...suv,'8 Seats','V8 Engine','4WD','Premium Sound','Cooler Box'] },
  { make:'Mercedes-Benz', model:'G-Wagon',       year:2023, category:'SUV',       transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:120000, overtime_rate:12000, security_deposit:240000, description:'The most iconic luxury SUV in the world. Experience the Mercedes-Benz G-Wagon with a dedicated professional chauffeur — unmatched prestige for VIP events and airport transfers.', features:[...chauffeured,'V8 Biturbo','Off-Road Mode'] },
  { make:'Land Rover', model:'Range Rover Sport', year:2023, category:'SUV',       transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:70000,  overtime_rate:7000, security_deposit:140000, description:'Britain\'s finest luxury SUV. The Range Rover Sport delivers breathtaking performance and ultimate refinement. Available exclusively with a professional chauffeur for a truly elevated experience.', features:[...chauffeured,'Air Suspension','Terrain Response','Meridian Sound'] },
  { make:'Toyota',    model:'RAV4',               year:2022, category:'SUV',       transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:9000,   overtime_rate:900,  security_deposit:18000,  description:'The globally acclaimed RAV4 — robust, spacious, and supremely capable. Perfect for weekend getaways, business trips, or navigating Kenya\'s diverse landscapes.', features:suv },
  { make:'Mercedes-Benz', model:'C200',           year:2022, category:'Sedan',     transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:18000,  overtime_rate:1800, security_deposit:36000,  description:'Executive luxury sedan delivering refined turbocharged performance with Mercedes\' signature elegance, cutting-edge technology, and a first-class interior experience.', features:premium },
  { make:'Mercedes-Benz', model:'E250',           year:2022, category:'Sedan',     transmission:'Automatic', fuel_type:'Petrol',  seats:5, daily_rate:22000,  overtime_rate:2200, security_deposit:44000,  description:'Premium business-class sedan offering exceptional comfort, sophisticated driver assistance systems, and the commanding presence that defines the Mercedes E-Class.', features:premium },
];

async function run() {
  console.log(`\n🚗 Inserting ${cars.length} cars into Supabase...\n`);
  let ok = 0, fail = 0;
  for (let i = 0; i < cars.length; i++) {
    const plate = `TEMP-${String(i+1).padStart(3,'0')}`;
    const { error } = await supabase.from('cars').insert({
      ...cars[i],
      license_plate: plate,
      fleet_owner_id: null,
      status: 'available',
      maintenance_status: 'ok',
      is_approved: true,
      primary_image_url: '',
      photos: [],
      video_url: '',
      color: '',
    });
    if (error) {
      console.error(`  ✗ ${cars[i].make} ${cars[i].model}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${cars[i].make} ${cars[i].model} — KES ${cars[i].daily_rate}/day [${plate}]`);
      ok++;
    }
  }
  console.log(`\n✅ Done: ${ok} inserted, ${fail} failed.\n`);
}

run();
