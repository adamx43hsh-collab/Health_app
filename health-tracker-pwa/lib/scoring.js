/**
 * Scoring module for Health Tracker
 * Implements the WDMS (Weighted Density Model for Scoring) and Dual Moving Average (Változási Index)
 */

/**
 * Calculates the raw score (S) and final normalized score (P) for a given meal.
 * @param {Array} ingredients - Array of ingredient objects: { mass: number (grams per 100g), weightPos: number, weightNeg: number }
 * @returns {number} Final normalized score P (0-100)
 */
export function calculateFoodScore(ingredients) {
  let S = 0;

  // Step 1: Raw Score calculation
  ingredients.forEach(ing => {
    const M = ing.mass; // mass ratio out of 100g (0 to 100)
    // Add positive and negative weights (assuming weightNeg is already a negative number as seen in DB)
    const pos = (M * (ing.weightPos || 0));
    const neg = (M * (ing.weightNeg || 0));
    S += pos + neg;
  });

  // Step 2: Normalization Transformation (Sigmoid)
  const S0 = 0; // Offset
  const k = 0.05; // Growth rate

  const exponent = -k * (S - S0);
  const P = 100 / (1 + Math.exp(exponent));

  // Step 3: Rounding
  return Math.round(P);
}

/**
 * Calculates the Progress Score (Változási Index V) using Dual Moving Average and Volatility.
 * @param {Array<number>} scores - Array of daily scores sorted from oldest to newest (at least 30 days recommended, but handles fewer)
 * @returns {Object} { V: number, Delta: number, Sigma: number, Trend: string }
 */
export function calculateProgressScore(scores) {
  if (!scores || scores.length === 0) return { V: 50, Delta: 0, Sigma: 0, Trend: 'Nincs elég adat' };

  // Helper to calculate Simple Moving Average
  const getSMA = (arr, days) => {
    const slice = arr.slice(-days);
    if (slice.length === 0) return 0;
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / slice.length;
  };

  const SMA30 = getSMA(scores, 30);
  const SMA7 = getSMA(scores, 7);

  // Delta (Change)
  const Delta = SMA7 - SMA30;

  // Volatility (Standard Deviation over 7 days)
  const last7 = scores.slice(-7);
  let Sigma = 0;
  if (last7.length > 1) {
    const mean7 = getSMA(last7, 7);
    const variance = last7.reduce((acc, val) => acc + Math.pow(val - mean7, 2), 0) / last7.length;
    Sigma = Math.sqrt(variance);
  }

  // Final Calculation for V
  const k = 2.5; // Slope multiplier
  const w = 0.5; // Penalty multiplier for standard deviation
  let V = 50 + (k * Delta) - (w * Sigma);

  // Bound to 0-100
  V = Math.max(0, Math.min(100, Math.round(V)));

  // Interpret Trend
  let Trend = 'Stagnálás (A régi szokások szinten tartása)';
  if (V < 40) Trend = 'Súlyos visszaesés';
  else if (V >= 60) Trend = 'Kifejezett javulás és stabilizálódás';

  return { V, Delta: Math.round(Delta * 10) / 10, Sigma: Math.round(Sigma * 10) / 10, Trend };
}
