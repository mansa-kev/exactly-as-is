import { VehicleModel } from '../types';

const TRIM_SUFFIX_PATTERNS = [
  /\be[\s-]?power\b/g,
  /\bnismo\b/g,
  /\bhybrid\b/g,
  /\bpremium\b/g,
  /\blimited\b/g,
  /\bsport\b/g,
  /\bspecial edition\b/g,
  /\bsignature\b/g,
  /\bexecutive\b/g,
  /\bdeluxe\b/g,
];

function normalizeModelText(value?: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripKnownTrimSuffixes(model?: string): string {
  let normalized = normalizeModelText(model);
  for (const pattern of TRIM_SUFFIX_PATTERNS) {
    normalized = normalized.replace(pattern, ' ').trim().replace(/\s+/g, ' ');
  }
  return normalized;
}

function deriveFamilyModelName(entry: VehicleModel, siblingModels: VehicleModel[]): string {
  const exactModel = normalizeModelText(entry.model);
  const siblingExactModels = new Set(
    siblingModels.map((sibling) => normalizeModelText(sibling.model)).filter(Boolean)
  );

  const stripped = stripKnownTrimSuffixes(entry.model);
  if (stripped && stripped !== exactModel && siblingExactModels.has(stripped)) {
    return stripped;
  }

  const sortedCandidates = [...siblingExactModels].sort((a, b) => a.length - b.length);
  const prefixCandidate = sortedCandidates.find((candidate) => {
    if (!candidate || candidate === exactModel) return false;
    return exactModel.startsWith(`${candidate} `);
  });

  return prefixCandidate || exactModel;
}

export function normalizeMakeModelKey(make?: string, model?: string): string {
  return `${(make || '').trim().toLowerCase()}::${(model || '').trim().toLowerCase()}`;
}

export function buildModelFamilySlug(make: string, model: string): string {
  return `${make}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type SuggestedVehicleModelFamily = {
  family_name: string;
  family_slug: string;
};

/** Suggest a canonical public family for messy legacy make/model rows. */
export function suggestVehicleModelFamily(
  entry: Pick<VehicleModel, 'make' | 'model' | 'display_name'>
): SuggestedVehicleModelFamily {
  const make = normalizeModelText(entry.make);
  const model = normalizeModelText(entry.model);
  const display = normalizeModelText(entry.display_name);
  const combined = `${model} ${display}`.replace(/\s+/g, ' ').trim();

  if (
    make.includes('toyota') &&
    /\bv8\b/.test(combined) &&
    /(land\s*cruiser|prado|\blc\b)/.test(combined)
  ) {
    return {
      family_name: 'Toyota Land Cruiser Prado V8',
      family_slug: 'toyota-land-cruiser-prado-v8',
    };
  }

  if (
    make.includes('toyota') &&
    /(land\s*cruiser\s*prado|\bprado\b|lc\s*prado)/.test(combined) &&
    !/\bv8\b/.test(combined)
  ) {
    return {
      family_name: 'Toyota Land Cruiser Prado',
      family_slug: 'toyota-land-cruiser-prado',
    };
  }

  if (
    make.includes('mercedes') &&
    /(g\s*class|g\s*wagon|\bg\d{2,3}\b)/.test(combined)
  ) {
    return {
      family_name: 'Mercedes-Benz G-Class',
      family_slug: 'mercedes-benz-g-class',
    };
  }

  const baseModel = stripKnownTrimSuffixes(entry.model) || entry.model?.trim() || '';
  const familyName = `${entry.make || ''} ${baseModel}`.trim();
  return {
    family_name: familyName,
    family_slug: buildModelFamilySlug(entry.make || 'vehicle', baseModel || 'model'),
  };
}

export type VehicleModelGroup = {
  groupKey: string;
  make: string;
  model: string;
  displayName: string;
  slug: string;
  representativeId: string;
  representative: VehicleModel;
  variants: VehicleModel[];
  unitCount: number;
  variantYears: number[];
  primary_image_url?: string;
  base_daily_rate?: number;
  category?: string;
  is_public: boolean;
  booking_mode: 'both' | 'reservation_only' | 'disabled';
};

export function resolveGroupBookingMode(variants: VehicleModel[]): 'both' | 'reservation_only' | 'disabled' {
  const modes = variants.map((variant) => variant.booking_mode || 'both');
  if (modes.some((mode) => mode === 'both')) return 'both';
  if (modes.some((mode) => mode === 'reservation_only')) return 'reservation_only';
  return 'disabled';
}

export function resolveModelSpecs(variants: VehicleModel[]): Pick<VehicleModel, 'seats' | 'fuel_type' | 'transmission'> {
  const withSpecs = variants.find(
    (variant) => variant.seats || variant.fuel_type || variant.transmission
  );
  return {
    seats: withSpecs?.seats,
    fuel_type: withSpecs?.fuel_type,
    transmission: withSpecs?.transmission,
  };
}

export function groupVehicleModels(
  models: VehicleModel[],
  unitCountsByModelId: Record<string, number> = {}
): VehicleModelGroup[] {
  const buckets = new Map<string, VehicleModel[]>();
  const modelsByMake = new Map<string, VehicleModel[]>();

  for (const entry of models || []) {
    const makeKey = normalizeModelText(entry.make);
    if (!modelsByMake.has(makeKey)) modelsByMake.set(makeKey, []);
    modelsByMake.get(makeKey)!.push(entry);
  }

  for (const entry of models || []) {
    const persistedFamilySlug = normalizeModelText(entry.family_slug);
    const persistedFamilyName = normalizeModelText(entry.family_name);
    const makeKey = normalizeModelText(entry.make);
    const familyModelName =
      persistedFamilyName ||
      deriveFamilyModelName(entry, modelsByMake.get(makeKey) || []);
    const key = persistedFamilySlug
      ? `${makeKey}::${persistedFamilySlug}`
      : normalizeMakeModelKey(entry.make, familyModelName);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(entry);
  }

  const groups: VehicleModelGroup[] = [];

  for (const [groupKey, variants] of buckets) {
    const sorted = [...variants].sort((a, b) => {
      const unitsA = unitCountsByModelId[a.id] || 0;
      const unitsB = unitCountsByModelId[b.id] || 0;
      if (unitsB !== unitsA) return unitsB - unitsA;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    const representative = sorted[0];
    const publicVariant = sorted.find((v) => v.is_public !== false) || representative;
    const unitCount = sorted.reduce(
      (sum, variant) => sum + (unitCountsByModelId[variant.id] || 0),
      0
    );
    const variantYears = [...new Set(sorted.map((v) => v.year).filter(Boolean) as number[])].sort();
    const rates = sorted
      .map((v) => Number(v.base_daily_rate))
      .filter((rate) => Number.isFinite(rate) && rate > 0);

    groups.push({
      groupKey,
      make: representative.make,
      model: publicVariant.family_name || representative.family_name || representative.model,
      displayName:
        publicVariant.family_name ||
        representative.family_name ||
        publicVariant.display_name ||
        `${representative.make} ${representative.model}`.trim(),
      slug:
        publicVariant.family_slug ||
        representative.family_slug ||
        buildModelFamilySlug(
          representative.make,
          publicVariant.family_name || representative.family_name || representative.model
        ),
      representativeId: representative.id,
      representative: publicVariant,
      variants: sorted,
      unitCount,
      variantYears,
      primary_image_url:
        publicVariant.primary_image_url || representative.primary_image_url,
      base_daily_rate:
        rates.length > 0 ? Math.min(...rates) : representative.base_daily_rate,
      category: publicVariant.category || representative.category,
      is_public: sorted.some((v) => v.is_public !== false),
      booking_mode: resolveGroupBookingMode(sorted),
    });
  }

  return groups.sort(
    (a, b) => (a.representative.sort_order || 0) - (b.representative.sort_order || 0)
  );
}

export function getVehicleModelIdsForGroup(group: VehicleModelGroup): string[] {
  return group.variants.map((variant) => variant.id);
}
