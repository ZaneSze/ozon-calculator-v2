export function formatWeightParts(weightG: number | undefined | null): { grams: string; kg: string } | null {
  const value = Number(weightG);
  if (!Number.isFinite(value)) return null;
  const roundedGrams = Math.round(value);
  return {
    grams: `${roundedGrams.toLocaleString()}g`,
    kg: `${(roundedGrams / 1000).toFixed(2)} kg`,
  };
}

export function formatWeightWithKg(weightG: number | undefined | null): string {
  const parts = formatWeightParts(weightG);
  if (!parts) return "";
  return `${parts.grams} (${parts.kg})`;
}
