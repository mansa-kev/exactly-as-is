import fs from 'fs';

const files = [
  'src/components/public/CarShowroom.tsx',
  'src/components/admin/AdminVehicleModels.tsx',
  'src/components/admin/AdminBookingCommandCenter.tsx',
  'src/components/client/MyBookings.tsx',
  'src/components/public/BookingFlow/ReservationFlow.tsx',
  'src/components/public/CarDetails.tsx',
  'src/server/reservationContinuationHandler.ts',
  'src/utils/bookingSource.ts'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add import for generateVehicleSlug if not already there, except for files that don't need it or need a different path
    if (file !== 'src/components/public/VehicleModelDetails.tsx' && !content.includes('generateVehicleSlug')) {
       // Figure out relative path to urlUtils
       let depth = file.split('/').length - 2;
       let relPath = '../'.repeat(depth) + 'utils/urlUtils';
       // Special case for root files
       if (depth < 1) relPath = './utils/urlUtils';
       
       const importStatement = `import { generateVehicleSlug } from '${relPath}';\n`;
       
       // Find last import
       const lastImportIndex = content.lastIndexOf('import ');
       if (lastImportIndex !== -1) {
          const endOfImport = content.indexOf('\n', lastImportIndex);
          content = content.slice(0, endOfImport + 1) + importStatement + content.slice(endOfImport + 1);
       } else {
          content = importStatement + content;
       }
    }
    
    // Patch /models/${...id...} -> /vehicles/${generateVehicleSlug(...)}
    // Be very careful here, these files use different variable names (group.representativeId, booking.vehicle_model_id, etc)
    
    // CarShowroom.tsx
    if (file.includes('CarShowroom.tsx')) {
       content = content.replace(/to=\{`\/models\/\$\{group\.representativeId\}`\}/g, "to={`/vehicles/${generateVehicleSlug(group.representative)}`}");
       content = content.replace(/window\.location\.href = `\/models\/\$\{group\.representativeId\}\?booking=true`;/g, "window.location.href = `/vehicles/${generateVehicleSlug(group.representative)}?booking=true`;");
       content = content.replace(/window\.location\.href = `\/models\/\$\{group\.representativeId\}\?reservation=true`;/g, "window.location.href = `/vehicles/${generateVehicleSlug(group.representative)}?reservation=true`;");
    }
    
    // AdminVehicleModels.tsx
    if (file.includes('AdminVehicleModels.tsx')) {
       content = content.replace(/href=\{`\/models\/\$\{selectedGroup\.representativeId\}`\}/g, "href={`/vehicles/${generateVehicleSlug(selectedGroup.representative)}`}");
    }
    
    // AdminBookingCommandCenter.tsx
    if (file.includes('AdminBookingCommandCenter.tsx')) {
       content = content.replace(/href=\{`\/models\/\$\{booking\.vehicle_model_id\}`\}/g, "href={`/vehicles/${generateVehicleSlug({id: booking.vehicle_model_id, friendly_id: booking.vehicle_model?.friendly_id, family_slug: booking.vehicle_model?.family_slug, make: booking.cars?.make, model: booking.cars?.model})}`}");
    }
    
    // MyBookings.tsx
    if (file.includes('MyBookings.tsx')) {
       content = content.replace(/const url = `\/models\/\$\{booking\.vehicle_model_id\}\?booking=true/g, "const url = `/vehicles/${generateVehicleSlug({id: booking.vehicle_model_id, friendly_id: booking.vehicle_model?.friendly_id, family_slug: booking.vehicle_model?.family_slug, make: booking.cars?.make, model: booking.cars?.model})}?booking=true");
    }
    
    // ReservationFlow.tsx
    if (file.includes('ReservationFlow.tsx')) {
       // continuationPath = vehicleModelId ? `/models/${vehicleModelId}` : ...
       // Wait, ReservationFlow doesn't have the full model object. It only has ID. That's fine, generateVehicleSlug handles fallback to ID.
       content = content.replace(/`\/models\/\$\{vehicleModelId\}`/g, "`/vehicles/${generateVehicleSlug({id: vehicleModelId})}`");
    }
    
    // CarDetails.tsx
    if (file.includes('CarDetails.tsx')) {
       content = content.replace(/navigate\(`\/models\/\$\{carData\.vehicle_model_id\}/g, "navigate(`/vehicles/${generateVehicleSlug({id: carData.vehicle_model_id})}");
    }
    
    // reservationContinuationHandler.ts
    if (file.includes('reservationContinuationHandler.ts')) {
       content = content.replace(/`\/models\/\$\{reservation\.vehicle_model_id\}`/g, "`/vehicles/${generateVehicleSlug({id: reservation.vehicle_model_id, friendly_id: reservation.vehicle_model?.friendly_id, family_slug: reservation.vehicle_model?.family_slug})}`");
    }
    
    // bookingSource.ts
    if (file.includes('bookingSource.ts')) {
       content = content.replace(/`\/models\/\$\{modelId\}`/g, "`/vehicles/${generateVehicleSlug({id: modelId})}`");
    }

    fs.writeFileSync(file, content);
  }
}
