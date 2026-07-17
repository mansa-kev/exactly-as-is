export function generateVehicleSlug(model: any): string {
  if (!model) return '';
  
  // Use friendly_id if available, fallback to the UUID id
  const idPart = model.friendly_id ? model.friendly_id.toString() : model.id;
  
  // We use family_slug or construct it from make/model (without year, as requested)
  let namePart = model.family_slug || '';
  
  if (!namePart) {
    const make = (model.make || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const modelName = (model.model || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    namePart = [make, modelName].filter(Boolean).join('-');
  }
  
  // Remove any leading/trailing hyphens
  namePart = namePart.replace(/^-+|-+$/g, '');
  
  return namePart ? `${idPart}-${namePart}` : idPart;
}

export function parseVehicleFriendlyId(slug: string | undefined): { friendlyId: number | null, uuid: string | null } {
  if (!slug) return { friendlyId: null, uuid: null };
  
  // The ID is the first part of the slug before the first hyphen
  const firstPart = slug.split('-')[0];
  
  // Check if it's a UUID (fallback for old links)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug) || 
                 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstPart);
                 
  if (isUuid) {
    // Return the whole slug if it's just a UUID, or the extracted UUID
    return { 
      friendlyId: null, 
      uuid: slug.length === 36 ? slug : firstPart 
    };
  }
  
  // Otherwise parse as friendly integer ID
  const parsedInt = parseInt(firstPart, 10);
  return {
    friendlyId: isNaN(parsedInt) ? null : parsedInt,
    uuid: null
  };
}
