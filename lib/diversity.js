/**
 * Diversity module for Health Tracker
 * Implements the Food Frequency rules and Weekly 30 rule
 */

/**
 * Analyzes the dietary diversity for a given 7-day period.
 * @param {Array} weeklyLogs - Array of food log entries for the last 7 days.
 * Expected log entry format: { foodName: string, category: string, isPlant: boolean, amount: number (servings) }
 * @returns {Object} Diversity analysis results
 */
export function analyzeDiversity(weeklyLogs) {
  const analysis = {
    mddwScore: 0,
    plantCount: 0,
    warnings: [],
    healthyRotation: true,
  };

  if (!weeklyLogs || weeklyLogs.length === 0) return analysis;

  // 1. MDD-W (Minimum Dietary Diversity) - unique categories
  const uniqueGroups = new Set();
  
  // 2. Weekly 30 Rule (Plant-based diversity)
  const uniquePlants = new Set();

  // 4. Restricted Foods Accumulators
  let redMeatServings = 0;
  let butterServings = 0; // assuming amount translates to roughly tbsp if category is butter
  let fattyCheeseServings = 0;
  let friedFoodServings = 0;
  let sweetsServings = 0;

  // Rotation tracker
  const plantFrequencies = {};

  weeklyLogs.forEach(log => {
    uniqueGroups.add(log.category);

    if (log.isPlant) {
      const normalizedName = log.foodName.toLowerCase().trim();
      uniquePlants.add(normalizedName);
      
      // Track frequencies to check for rotation
      plantFrequencies[normalizedName] = (plantFrequencies[normalizedName] || 0) + 1;
    }

    // Checking limits based on categories (categories must match DB eventually)
    const cat = (log.category || '').toLowerCase();
    const name = (log.foodName || '').toLowerCase();

    // These checks can be refined when mapping to the exact Excel categories
    if (cat.includes('hús') && (name.includes('sertés') || name.includes('marha') || name.includes('szalonna') || name.includes('kolbász') || name.includes('virsli'))) {
      redMeatServings += log.amount || 1;
    }
    if (name.includes('vaj') || name.includes('margarin')) {
      butterServings += log.amount || 1; // Assuming 1 unit = 1 tbsp for simplicity
    }
    if (cat.includes('sajt') && (name.includes('trappista') || name.includes('camembert') || name.includes('brie'))) {
      fattyCheeseServings += log.amount || 1;
    }
    if (name.includes('sült krumpli') || cat.includes('gyorséttermi')) {
      friedFoodServings += log.amount || 1;
    }
    if (cat.includes('édesség') || cat.includes('nass') || name.includes('cukor')) {
      sweetsServings += log.amount || 1;
    }
  });

  analysis.mddwScore = uniqueGroups.size;
  analysis.plantCount = uniquePlants.size;

  // Evaluate Limits
  if (redMeatServings >= 4) {
    analysis.warnings.push('Vörös hús / feldolgozott hús túllépve (Limit: heti <4 adag).');
  }
  // Butter is per day (<1), so over 7 days it's <7
  if (butterServings >= 7) {
    analysis.warnings.push('Vaj / margarin túllépve (Limit: heti <7 adag / napi <1 adag).');
  }
  if (fattyCheeseServings >= 1) {
    analysis.warnings.push('Zsíros sajtok túllépve (Limit: heti <1 adag).');
  }
  if (friedFoodServings > 1) {
    analysis.warnings.push('Bő zsírban sült étel túllépve (Limit: heti legfeljebb 1 adag).');
  }
  if (sweetsServings >= 5) {
    analysis.warnings.push('Édességek / hozzáadott cukor túllépve (Limit: heti <5 adag).');
  }

  // Check rotation
  // If the user eats a plant more than 4 times a week but total plant count is low, they might not be rotating well.
  if (analysis.plantCount < 10 && Object.values(plantFrequencies).some(count => count > 3)) {
    analysis.healthyRotation = false;
    analysis.warnings.push('Nincs meg a megfelelő zöldség/gyümölcs rotáció, túl monoton az étrend.');
  }

  return analysis;
}
