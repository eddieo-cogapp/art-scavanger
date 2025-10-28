const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config();

// Configuration
const CONFIG = {
  elasticsearchUrl: process.env.ES_URL,
  elasticsearchUsername: process.env.ES_USERNAME,
  elasticsearchPassword: process.env.ES_PASSWORD,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  googleApiKey: process.env.GOOGLE_API_KEY,
  indexName: process.env.ES_INDEX,
  dataFolder: '../data',
  landmarksFolder: './landmarks',
  brightonBounds: {
    top_left: { lat: 50.85, lon: -0.20 },
    bottom_right: { lat: 50.80, lon: -0.10 }
  },
  useAI: true,
  maxArtworks: parseInt(process.env.MAX_ARTWORKS) || 1,  // Maximum number of artworks to process
  landmarkTiers: {
    tier1: ['church', 'pub', 'museum', 'park', 'town_hall', 'courthouse', 'train_station', 'library', 'tourist_attraction', 'statue'],
    tier1Weight: 100,
    tier2Weight: 50
  },
  maxLandmarkDistance: 1000  // Maximum distance for landmarks in meters
};


// Ensure data folder exists
if (!fs.existsSync(CONFIG.dataFolder)) {
  fs.mkdirSync(CONFIG.dataFolder, { recursive: true });
}

let LANDMARKS = {};

// IMPROVED LANDMARK LOADING WITH BETTER DIAGNOSTICS
function loadLandmarks() {
  try {
    // Try multiple possible paths
    const possiblePaths = [
      path.join(CONFIG.landmarksFolder, 'all_landmarks.json'),
      path.join(__dirname, CONFIG.landmarksFolder, 'all_landmarks.json'),
      path.join(process.cwd(), CONFIG.landmarksFolder, 'all_landmarks.json'),
      './landmarks/all_landmarks.json',
      path.join(__dirname, 'landmarks', 'all_landmarks.json')
    ];

    console.log('🗺️ Searching for landmarks file in multiple locations:');
    
    let foundPath = null;
    for (const testPath of possiblePaths) {
      const absolutePath = path.resolve(testPath);
      console.log(`  Checking: ${absolutePath}`);
      
      if (fs.existsSync(testPath)) {
        foundPath = testPath;
        console.log(`  ✓ Found landmarks file at: ${absolutePath}`);
        break;
      }
    }

    if (!foundPath) {
      console.log('\n⚠️  Landmarks file not found in any location!');
      console.log('Current working directory:', process.cwd());
      console.log('Script directory:', __dirname);
      console.log('\nPlease ensure landmarks/all_landmarks.json exists relative to where you run this script.');
      console.log('Run scrape-landmarks.js first if you haven\'t already.\n');
      return false;
    }

    // Load the file
    const rawData = fs.readFileSync(foundPath, 'utf8');
    const parsed = JSON.parse(rawData);
    
    // Validate structure
    if (!parsed || typeof parsed !== 'object') {
      console.log('⚠️  Landmarks file has invalid structure (not an object)');
      return false;
    }

    // Check if it has the expected format with arrays
    const categories = Object.keys(parsed);
    if (categories.length === 0) {
      console.log('⚠️  Landmarks file is empty');
      return false;
    }

    // Validate each category has an array
    let totalLandmarks = 0;
    const categoryCounts = {};
    
    for (const category of categories) {
      if (!Array.isArray(parsed[category])) {
        console.log(`⚠️  Category "${category}" is not an array`);
        continue;
      }
      categoryCounts[category] = parsed[category].length;
      totalLandmarks += parsed[category].length;
    }

    LANDMARKS = parsed;
    
    console.log(`\n✓ Successfully loaded landmarks data:`);
    console.log(`  Total categories: ${categories.length}`);
    console.log(`  Total landmarks: ${totalLandmarks}`);
    console.log(`  Breakdown by category:`);
    
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      console.log(`    - ${cat}: ${count} landmarks`);
    });
    
    return true;

  } catch (error) {
    console.error('⚠️  Error loading landmarks data:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Load landmarks on startup
const landmarksLoaded = loadLandmarks();


/**
 * Calculate distance between two coordinates (in meters)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Get landmark tier (1 or 2)
 */
function getLandmarkTier(landmarkType) {
  const normalizedType = landmarkType.toLowerCase().replace(/\s+/g, '_');
  return CONFIG.landmarkTiers.tier1.includes(normalizedType) ? 1 : 2;
}

/**
 * Calculate bearing/direction from point A to point B (in degrees, 0 = North)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const bearing = (θ * 180 / Math.PI + 360) % 360;

  return bearing;
}

/**
 * Convert bearing to compass direction (N, NE, E, SE, S, SW, W, NW)
 */
function bearingToCompass(bearing) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * Get directional sector for landmark selection (N, S, E, W)
 */
function getDirectionalSector(bearing) {
  // North: 315-45 degrees
  if (bearing >= 315 || bearing < 45) return 'N';
  // East: 45-135 degrees
  if (bearing >= 45 && bearing < 135) return 'E';
  // South: 135-225 degrees
  if (bearing >= 135 && bearing < 225) return 'S';
  // West: 225-315 degrees
  if (bearing >= 225 && bearing < 315) return 'W';
  return 'N'; // fallback
}

/**
 * Calculate landmark score based on tier and proximity
 */
function calculateLandmarkScore(distance, tier) {
  const tierWeight = tier === 1 ? CONFIG.landmarkTiers.tier1Weight : CONFIG.landmarkTiers.tier2Weight;
  // Score formula: tierWeight / (distance + 1)
  // Adding 1 to distance to avoid division by zero and to give very close landmarks a finite score
  return tierWeight / (distance + 1);
}

/**
 * Call Anthropic API to enhance clue with more poetic language
 */
async function enhanceClueWithAI(baseClue, level, artwork, nearby) {
  if (!CONFIG.useAI) return baseClue;
  
  // Build nearby list from new structure
  const nearbyList = [];
  const allLandmarks = nearby.all_landmarks || [];
  allLandmarks.slice(0, 5).forEach(landmark => {
    nearbyList.push(`${landmark.name} (${Math.round(landmark.distance)}m away, ${landmark.compass_direction})`);
  });
  
  const prompt = level === 1 
    ? `Make this treasure hunt clue MORE poetic and evocative, mentioning the landmark. Keep it mysterious but beautiful:
"${baseClue}"

Artwork: ${artwork.artwork_title}
Type: ${artwork.type}
Medium: ${artwork.medium}
Nearby: ${nearbyList.slice(0, 1).join(', ')}

Return ONLY the enhanced clue, nothing else.`
    : level === 2
    ? `Enhance this clue to be moderately cryptic but helpful. Mention 2+ landmarks but NO specific distances in meters. Use words like "between", "near", or "close to" instead of exact measurements:
"${baseClue}"

Artwork: ${artwork.artwork_title}
Type: ${artwork.type}
Nearby landmarks: ${nearbyList.slice(0, 3).join(', ')}

Return ONLY the enhanced clue, nothing else.`
    : `Make this clue simple and direct. Include specific distances in meters, compass directions (N, NE, E, etc), and the street name. This should be easy to follow:
"${baseClue}"

Artwork: ${artwork.artwork_title}
Type: ${artwork.type}
Nearby: ${nearbyList.slice(0, 3).join(', ')}

Return ONLY the enhanced clue, nothing else.`;

  try {
    console.log(`    🤖 Enhancing Level ${level} with AI...`);
    const response = await callAnthropicAPI(prompt);
    if (response) {
      console.log(`    ✓ AI enhanced`);
      return response;
    } else {
      console.log(`    ⚠️  AI returned empty, using base clue`);
      return baseClue;
    }
  } catch (error) {
    console.log(`    ⚠️  AI enhancement failed: ${error.message}`);
    return baseClue;
  }
}

/**
 * Call Anthropic API
 */
function callAnthropicAPI(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          
          // Check for API errors
          if (result.error) {
            reject(new Error(result.error.message || 'API Error'));
            return;
          }
          
          const text = result.content?.[0]?.text;
          resolve(text);
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Request error: ${e.message}`)));
    req.write(data);
    req.end();
  });
}

/**
 * Get street name from coordinates using reverse geocoding
 */
function getStreetName(lat, lon) {
  return new Promise((resolve, reject) => {
    const apiKey = CONFIG.googleApiKey;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 'OK' && result.results[0]) {
            // Try to extract route (street name)
            const addressComponents = result.results[0].address_components;
            const route = addressComponents.find(c => c.types.includes('route'));
            resolve(route ? route.long_name : null);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Find and score nearest landmarks with enhanced metadata
 */
function findNearestLandmarks(lat, lon, maxResults = 10) {
  if (!landmarksLoaded || Object.keys(LANDMARKS).length === 0) {
    console.log('    ⚠️  No landmarks data available for this artwork');
    return {
      all_landmarks: [],
      tier1_landmarks: [],
      directional_landmarks: {},
      closest_overall: null,
      closest_tier1: null
    };
  }

  const allLandmarksWithMetadata = [];
  
  // Process all landmarks and calculate metadata
  Object.keys(LANDMARKS).forEach(type => {
    const landmarks = LANDMARKS[type] || [];
    
    if (!Array.isArray(landmarks)) {
      console.log(`    ⚠️  Invalid landmark type: ${type} (not an array)`);
      return;
    }
    
    landmarks.forEach(landmark => {
      const distance = calculateDistance(lat, lon, landmark.lat, landmark.lon);
      
      // Only include landmarks within max distance
      if (distance <= CONFIG.maxLandmarkDistance) {
        const bearing = calculateBearing(lat, lon, landmark.lat, landmark.lon);
        const tier = getLandmarkTier(type);
        const score = calculateLandmarkScore(distance, tier);
        const sector = getDirectionalSector(bearing);
        
        allLandmarksWithMetadata.push({
          name: landmark.name,
          type: type,
          lat: landmark.lat,
          lon: landmark.lon,
          distance: distance,
          bearing: bearing,
          compass_direction: bearingToCompass(bearing),
          sector: sector,
          tier: tier,
          score: score
        });
      }
    });
  });

  // Sort by score (highest first)
  allLandmarksWithMetadata.sort((a, b) => b.score - a.score);
  
  // Get tier 1 landmarks only
  const tier1Landmarks = allLandmarksWithMetadata.filter(l => l.tier === 1);
  
  // Get directional distribution (one from each sector: N, S, E, W)
  const directionalLandmarks = {
    N: null,
    S: null,
    E: null,
    W: null,
    best: null
  };
  
  // Find best landmark in each sector
  ['N', 'S', 'E', 'W'].forEach(sector => {
    const inSector = allLandmarksWithMetadata.filter(l => l.sector === sector);
    if (inSector.length > 0) {
      directionalLandmarks[sector] = inSector[0]; // Already sorted by score
    }
  });
  
  // Add the overall best landmark
  if (allLandmarksWithMetadata.length > 0) {
    directionalLandmarks.best = allLandmarksWithMetadata[0];
  }
  
  const result = {
    all_landmarks: allLandmarksWithMetadata.slice(0, maxResults),
    tier1_landmarks: tier1Landmarks.slice(0, maxResults),
    directional_landmarks: directionalLandmarks,
    closest_overall: allLandmarksWithMetadata.length > 0 ? allLandmarksWithMetadata[0] : null,
    closest_tier1: tier1Landmarks.length > 0 ? tier1Landmarks[0] : null
  };
  
  console.log(`    📍 Found ${allLandmarksWithMetadata.length} landmarks (${tier1Landmarks.length} tier 1) within ${CONFIG.maxLandmarkDistance}m`);
  
  return result;
}

// [Rest of the functions remain the same - I'll include the key ones]

/**
 * Get compass direction from one point to another
 */
function getDirection(fromLat, fromLon, toLat, toLon) {
  const angle = Math.atan2(toLon - fromLon, toLat - fromLat) * 180 / Math.PI;
  const directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const index = Math.round((angle + 360) % 360 / 45) % 8;
  return directions[index];
}

/**
 * Get building description based on nearby landmarks
 */
function getBuildingDescription(lat, lon, nearby) {
  // Check if we have the new landmark structure
  if (nearby.all_landmarks) {
    const closeBuildings = nearby.all_landmarks.filter(l => l.distance < 50);
    if (closeBuildings.length > 0) {
      return closeBuildings[0].name;
    }
  }
  
  // Fallback descriptions
  const area = lat > 50.825 ? 'a building in north Brighton' : 
               lat < 50.821 ? 'a seafront building' : 
               'a building in central Brighton';
  return area;
}

/**
 * Generate cryptic/poetic clue (Level 1) - BASE VERSION
 */
function generateCrypticClueBase(artwork, nearby) {
  const title = artwork.artwork_title || artwork.title || 'Artwork';
  const type = artwork.type || 'artwork';
  
  // Use closest overall landmark
  if (nearby.closest_overall) {
    const closest = nearby.closest_overall;
    const distance = Math.round(closest.distance);
    return `Near ${closest.name}, approximately ${distance}m away, seek "${title}" - a ${type} that tells a story.`;
  }
  
  return `In Brighton's streets, find "${title}" - a ${type} waiting to be discovered.`;
}

/**
 * Generate cryptic/poetic clue (Level 1) - with AI enhancement
 */
async function generateCrypticClue(artwork, nearby) {
  const baseClue = generateCrypticClueBase(artwork, nearby);
  return await enhanceClueWithAI(baseClue, 1, artwork, nearby);
}

/**
 * Generate medium difficulty clue (Level 2) - BASE VERSION
 */
function generateMediumClueBase(artwork, nearby) {
  const title = artwork.artwork_title || artwork.title || 'Artwork';
  const type = artwork.type || 'artwork';
  const lat = artwork.address_lat || artwork.geolocation?.[0]?.lat;
  const building = getBuildingDescription(lat, null, nearby);
  
  // Use top landmarks from all_landmarks
  const allLandmarks = nearby.all_landmarks || [];
  
  if (allLandmarks.length >= 2) {
    const landmark1 = allLandmarks[0];
    const landmark2 = allLandmarks[1];
    
    return `"${title}" is a ${type} located on ${building}, between ${landmark1.name} and ${landmark2.name}.`;
  } else if (allLandmarks.length >= 1) {
    const landmark = allLandmarks[0];
    return `"${title}" is a ${type} on ${building}, near ${landmark.name}.`;
  }
  
  return `"${title}" is a ${type} displayed on ${building}.`;
}

/**
 * Generate medium difficulty clue (Level 2) - with AI enhancement
 */
async function generateMediumClue(artwork, nearby) {
  const baseClue = generateMediumClueBase(artwork, nearby);
  return await enhanceClueWithAI(baseClue, 2, artwork, nearby);
}

/**
 * Get full artwork description with tags - SAFE VERSION
 */
function getFullArtworkDescription(artwork) {
  const type = artwork.type || 'artwork';
  const medium = artwork.medium || '';
  const date = artwork.execution_date || '';
  const tags = artwork.tags; // Don't default to [] yet
  
  let desc = type;
  
  if (medium) {
    desc += ` in ${medium}`;
  }
  
  // SAFE TAG PARSING - handles all data types
  const tagList = [];
  
  if (tags) {
    // If tags is a string, split it
    if (typeof tags === 'string') {
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      tagArray.forEach(tag => {
        if (tag.includes(':')) {
          const value = tag.split(':')[1].trim();
          if (value && !value.toLowerCase().includes('undefined')) {
            tagList.push(value);
          }
        } else if (tag) {
          tagList.push(tag);
        }
      });
    }
    // If tags is an array, process normally
    else if (Array.isArray(tags)) {
      tags.forEach(tag => {
        if (typeof tag === 'string' && tag.includes(':')) {
          const value = tag.split(':')[1].trim();
          if (value && !value.toLowerCase().includes('undefined')) {
            tagList.push(value);
          }
        } else if (typeof tag === 'string' && tag) {
          tagList.push(tag);
        }
      });
    }
    // If tags is an object, try to extract values
    else if (typeof tags === 'object') {
      Object.values(tags).forEach(value => {
        if (typeof value === 'string' && value && !value.toLowerCase().includes('undefined')) {
          tagList.push(value);
        }
      });
    }
  }
  
  if (tagList.length > 0) {
    // Limit to first 3 tags to avoid overly long descriptions
    const limitedTags = tagList.slice(0, 3);
    const tagDesc = limitedTags.join(' and ').toLowerCase();
    desc += ` featuring ${tagDesc}`;
  }
  
  // Add date
  if (date) {
    desc += `, created in ${date}`;
  }
  
  return desc;
}

/**
 * Get relative direction (left/right) from a landmark to artwork
 */
function getRelativeDirection(fromLat, fromLon, toLat, toLon, facingDirection) {
  const angle = Math.atan2(toLon - fromLon, toLat - fromLat) * 180 / Math.PI;
  
  // Normalize to 0-360
  const normalizedAngle = (angle + 360) % 360;
  
  // Simple left/right based on facing direction
  if (facingDirection === 'north') {
    return normalizedAngle > 180 ? 'on your left' : 'on your right';
  } else if (facingDirection === 'south') {
    return normalizedAngle > 180 ? 'on your right' : 'on your left';
  } else if (facingDirection === 'east') {
    return normalizedAngle < 90 || normalizedAngle > 270 ? 'on your right' : 'on your left';
  } else { // west
    return normalizedAngle < 90 || normalizedAngle > 270 ? 'on your left' : 'on your right';
  }
}

/**
 * Generate precise directional clue with distances and directions (Level 3) - BASE VERSION
 */
async function generateDirectionalClueBase(artwork, nearby) {
  const title = artwork.artwork_title || artwork.title || 'Artwork';
  const lat = artwork.address_lat || artwork.geolocation?.[0]?.lat;
  const lon = artwork.address_long || artwork.geolocation?.[0]?.lon;
  const type = artwork.type || 'artwork';
  const building = getBuildingDescription(lat, lon, nearby);
  
  // Get the street name
  const streetName = await getStreetName(lat, lon);
  
  // Get close landmarks within 250m from all_landmarks
  const allLandmarks = nearby.all_landmarks || [];
  const veryClose = allLandmarks.filter(l => l.distance < 250);
  
  // DETAILED MULTI-LANDMARK DIRECTIONS (need 2+)
  if (veryClose.length >= 2) {
    const landmark1 = veryClose[0];
    const landmark2 = veryClose[1];
    
    const meters1 = Math.round(landmark1.distance);
    const meters2 = Math.round(landmark2.distance);
    const dir1 = landmark1.compass_direction;
    
    let clue = `"${title}" is ${meters1}m ${dir1} of ${landmark1.name}`;
    if (streetName) {
      clue += ` on ${streetName}`;
    }
    clue += `. ${landmark2.name} is ${meters2}m away. It's a ${type} on ${building}.`;
    
    return clue;
  } else if (veryClose.length >= 1) {
    const landmark = veryClose[0];
    const meters = Math.round(landmark.distance);
    const dir = landmark.compass_direction;
    
    let clue = `"${title}" is ${meters}m ${dir} of ${landmark.name}`;
    if (streetName) {
      clue += ` on ${streetName}`;
    }
    clue += `. It's a ${type} on ${building}.`;
    
    return clue;
  } else if (streetName) {
    return `"${title}" is a ${type} on ${building} on ${streetName}.`;
  }
  
  // ULTIMATE FALLBACK
  const area = lat > 50.825 ? 'north Brighton' : lat < 50.821 ? 'near the seafront' : 'central Brighton';
  return `"${title}" is a ${type} on ${building} in ${area}.`;
}

/**
 * Generate directional clue - with optional AI enhancement
 */
async function generateDirectionalClue(artwork, nearby) {
  const baseClue = await generateDirectionalClueBase(artwork, nearby);
  return await enhanceClueWithAI(baseClue, 3, artwork, nearby);
}

/**
 * Generate all three levels of clues for an artwork
 */
async function generateClues(artwork) {
  const lat = artwork.address_lat || artwork.geolocation?.[0]?.lat;
  const lon = artwork.address_long || artwork.geolocation?.[0]?.lon;
  
  // Find nearby landmarks with enhanced scoring
  const nearby = findNearestLandmarks(lat, lon, 10);
  
  // Fetch street name
  const streetName = await getStreetName(lat, lon);
  console.log(`    🛣️  Street: ${streetName || 'Unknown'}`);
  
  // Generate BASE clues first (always works)
  const baseClue1 = generateCrypticClueBase(artwork, nearby);
  const baseClue2 = generateMediumClueBase(artwork, nearby);
  const baseClue3 = await generateDirectionalClueBase(artwork, nearby);
  
  // Try to generate AI-enhanced versions
  let enhancedClue1 = baseClue1;
  let enhancedClue2 = baseClue2;
  let enhancedClue3 = baseClue3;
  
  if (CONFIG.useAI) {
    // Add delays between AI calls to respect rate limit (5 requests per minute = 12 seconds between calls)
    enhancedClue1 = await generateCrypticClue(artwork, nearby);
    console.log(`    ⏳ Waiting 13 seconds before next AI call...`);
    await new Promise(resolve => setTimeout(resolve, 13000));
    
    enhancedClue2 = await generateMediumClue(artwork, nearby);
    console.log(`    ⏳ Waiting 13 seconds before next AI call...`);
    await new Promise(resolve => setTimeout(resolve, 13000));
    
    enhancedClue3 = await generateDirectionalClue(artwork, nearby);
  }
  
  return {
    artwork_id: artwork.artwork_id || artwork.id,
    title: artwork.artwork_title || artwork.title,
    type: artwork.type,
    medium: artwork.medium,
    execution_date: artwork.execution_date,
    tags: artwork.tags,
    image: artwork.image,
    coordinates: {
      lat: lat,
      lon: lon
    },
    street_name: streetName,
    clues: [
      {
        level: 1,
        type: 'cryptic',
        clue: enhancedClue1,
        base_clue: baseClue1
      },
      {
        level: 2,
        type: 'medium',
        clue: enhancedClue2,
        base_clue: baseClue2
      },
      {
        level: 3,
        type: 'directional',
        clue: enhancedClue3,
        base_clue: baseClue3
      }
    ]
  };
}

/**
 * Query Elasticsearch for Brighton artworks
 */
async function queryArtworks() {
  const query = {
    size: CONFIG.maxArtworks,
    query: {
      "geo_bounding_box": {
      "geolocation": {
        "top_left": {
          "lat": 50.85,
          "lon": -0.20
        },
        "bottom_right": {
          "lat": 50.80,
          "lon": -0.10
        }
      }
    }
    }
  };

  const url = new URL(`${CONFIG.elasticsearchUrl}/${CONFIG.indexName}/_search`);
  const auth = Buffer.from(`${CONFIG.elasticsearchUsername}:${CONFIG.elasticsearchPassword}`).toString('base64');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(query));
    req.end();
  });
}

/**
 * Save master index of all clues
 */
function saveMasterIndex(allClues) {
  const filename = path.join(CONFIG.dataFolder, 'all_clues.json');
  fs.writeFileSync(filename, JSON.stringify(allClues, null, 2));
  console.log(`✓ Saved master index with ${allClues.length} artworks`);
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🎨 Brighton Art Clue Generator');
    console.log('================================\n');
    
    // Check if landmarks were loaded successfully
    if (!landmarksLoaded) {
      console.log('⚠️  WARNING: Proceeding without landmarks data. Clues will be less detailed.');
      console.log('Consider running scrape-landmarks.js first.\n');
    }
    
    console.log('Querying Elasticsearch for Brighton artworks...');
    const response = await queryArtworks();
    
    const artworks = response.hits?.hits?.map(hit => ({
      artwork_id: hit._id,
      ...hit._source
    })) || [];
    
    console.log(`Found ${artworks.length} artworks\n`);
    
    if (artworks.length === 0) {
      console.log('No artworks found. Check your Elasticsearch connection and query.');
      return;
    }
    
    // Limit based on configuration
    const limitedArtworks = artworks.slice(0, CONFIG.maxArtworks);
    console.log(`Processing first ${limitedArtworks.length} artworks (max: ${CONFIG.maxArtworks})...\n`);
    
    const allClues = [];
    
    for (let i = 0; i < limitedArtworks.length; i++) {
      const artwork = limitedArtworks[i];
      console.log(`\n[${i + 1}/${limitedArtworks.length}] Processing: ${artwork.artwork_title || 'Untitled'}`);
      
      const clueData = await generateClues(artwork);
      allClues.push(clueData);
      
      // Safely display clues
      const clue1 = String(clueData.clues[0].clue || '');
      const clue2 = String(clueData.clues[1].clue || '');
      const clue3 = String(clueData.clues[2].clue || '');
      
      console.log(`  ✓ Level 1: ${clue1.substring(0, 100)}${clue1.length > 100 ? '...' : ''}`);
      console.log(`  ✓ Level 2: ${clue2.substring(0, 100)}${clue2.length > 100 ? '...' : ''}`);
      console.log(`  ✓ Level 3: ${clue3.substring(0, 100)}${clue3.length > 100 ? '...' : ''}`);
      
      // RATE LIMITING: Wait 1 second between artworks (AI calls already have built-in delays)
      if (i < limitedArtworks.length - 1) {
        console.log(`  ⏳ Waiting 1 second before next artwork...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    saveMasterIndex(allClues);
    
    console.log('\n================================');
    console.log('✨ Clue generation complete!');
    console.log(`📁 File saved to: ${CONFIG.dataFolder}/all_clues.json`);
    console.log(`📊 Processed ${allClues.length} artworks`);
    
  } catch (error) {
    console.error('Error generating clues:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateClues, queryArtworks };