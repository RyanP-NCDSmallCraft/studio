// src/lib/enum-normalization.ts
// ── Enum normalization helpers for imported data ──────────────────────────────
// Maps lowercase / common-variant keys → the canonical enum value.
// Used during CSV import AND when loading Firestore docs for edit.

export const propulsionTypeMap: Record<string, string> = {
  inboard: 'Inboard',
  outboard: 'Outboard',
  both: 'Both',
  sail: 'Sail',
  other: 'Other',
};

export const hullMaterialMap: Record<string, string> = {
  wood: 'Wood',
  fiberglass: 'Fiberglass',
  fibreglass: 'Fiberglass',
  'fiber glass': 'Fiberglass',
  'fibre glass': 'Fiberglass',
  metal: 'Metal',
  aluminium: 'Metal',
  aluminum: 'Metal',
  steel: 'Metal',
  inflatable: 'Inflatable',
  other: 'Other',
};

export const craftUseMap: Record<string, string> = {
  pleasure: 'Pleasure',
  passenger: 'Passenger',
  fishing: 'Fishing',
  cargo: 'Cargo',
  'mixed use': 'Mixed Use',
  mixed: 'Mixed Use',
  mix: 'Mixed Use',
  other: 'Other',
};

export const fuelTypeMap: Record<string, string> = {
  electric: 'Electric',
  petrol: 'Petrol',
  gasoline: 'Petrol',
  gas: 'Petrol',
  diesel: 'Diesel',
  other: 'Other',
};

export const vesselTypeMap: Record<string, string> = {
  openboat: 'OpenBoat',
  'open boat': 'OpenBoat',
  open: 'OpenBoat',
  dinghy: 'OpenBoat',
  cabincruiser: 'CabinCruiser',
  'cabin cruiser': 'CabinCruiser',
  cruiser: 'CabinCruiser',
  sailboat: 'Sailboat',
  'sail boat': 'Sailboat',
  yacht: 'Sailboat',
  pwc: 'PWC',
  'jet ski': 'PWC',
  jetski: 'PWC',
  other: 'Other',
};

/**
 * Attempt to normalize a raw string value against a lookup map.
 * Returns the canonical value if found, otherwise the fallback.
 */
export function normalizeEnum(
  raw: string | undefined | null,
  map: Record<string, string>,
  fallback?: string,
): string | undefined {
  if (!raw) return fallback;
  const key = raw.trim().toLowerCase();
  return map[key] ?? fallback;
}
