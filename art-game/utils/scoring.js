// utils/scoring.js

/**
 * Compute distance (in meters) between two lat/lon points using Haversine formula
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = x => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in meters
}

/**
 * Compute points based on distance and number of clues used
 * - 1 clue: full points if within 50m, otherwise scaled
 * - 2-3 clues: half points
 */
export function computeScore(distance, cluesUsed) {
  let baseScore = 10;
  if (distance > 50) {
    baseScore *= Math.max(0, 1 - distance / 1000); // reduce score for further away
  }
  if (cluesUsed >= 2) {
    baseScore /= 2; // half points if used multiple clues
  }
  return baseScore;
}
