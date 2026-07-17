import fs from 'fs';

let content = fs.readFileSync('src/services/fleetService.ts', 'utf8');

const getVehicleModelByFriendlyIdCode = `
  getVehicleModelByFriendlyId: async (friendlyId: number) => {
    const { data, error } = await supabase
      .from('vehicle_models')
      .select('*')
      .eq('friendly_id', friendlyId)
      .maybeSingle();
    if (error) return handleSupabaseError(error, 'getVehicleModelByFriendlyId');
    return data as VehicleModel | null;
  },

  getVehicleModelById: async (id: string) => {`;

content = content.replace(
  "  getVehicleModelById: async (id: string) => {",
  getVehicleModelByFriendlyIdCode
);

const getVehicleModelFamilyByFriendlyIdCode = `
  getVehicleModelFamilyByFriendlyId: async (friendlyId: number): Promise<VehicleModelGroup | null> => {
    const groupedPublic = await fleetService.getGroupedPublicVehicleModels();
    const cachedGroup = groupedPublic.find((group) =>
      group.variants.some((variant) => variant.friendly_id === friendlyId)
    );
    if (cachedGroup) return cachedGroup;

    const model = await fleetService.getVehicleModelByFriendlyId(friendlyId);
    if (!model) return null;

    let query = supabase.from('vehicle_models').select('*');
    if (model.family_slug) {
      query = query.eq('family_slug', model.family_slug);
    } else {
      query = query.eq('make', model.make).eq('model', model.model);
    }

    const { data, error } = await query.order('year', { ascending: false, nullsFirst: false });

    if (error) return handleSupabaseError(error, 'getVehicleModelFamilyByFriendlyId');
    const unitCounts = await fleetService.getModelUnitCounts();
    const groups = groupVehicleModels((data || []) as VehicleModel[], unitCounts);
    return groups.find((group) => group.variants.some((variant) => variant.friendly_id === friendlyId)) || groups[0] || null;
  },

  getVehicleModelFamilyById: async (id: string): Promise<VehicleModelGroup | null> => {`;

content = content.replace(
  "  getVehicleModelFamilyById: async (id: string): Promise<VehicleModelGroup | null> => {",
  getVehicleModelFamilyByFriendlyIdCode
);

fs.writeFileSync('src/services/fleetService.ts', content);
