export function roundTo2Decimals(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculateTotalUSD(quantity, unitPriceUSD) {
  return roundTo2Decimals(Number(quantity) * Number(unitPriceUSD));
}

export function calculateAmountUSD(amountVES, rateVESPerUSD) {
  if (Number(rateVESPerUSD) <= 0) return 0;
  return roundTo2Decimals(Number(amountVES) / Number(rateVESPerUSD));
}
