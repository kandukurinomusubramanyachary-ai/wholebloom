export function isStrengthEnabled() {
  const value = String(process.env.EXPO_PUBLIC_BLOOM_STRENGTH || '').toLowerCase();
  return value === '1' || value === 'true';
}
