// Asset prices and package totals use hundredths of one board point.
// Use integer hundredths when applying price thresholds and comparing ties.
export function priceHundredths(value) {
  const price = Number(value);
  if (!Number.isFinite(price)) return 0;
  const magnitude = Math.abs(price);
  const units = Math.round((magnitude + Number.EPSILON * magnitude) * 100);
  return units ? Math.sign(price) * units : 0;
}

export function roundPrice(value) {
  return priceHundredths(value) / 100;
}
