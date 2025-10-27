const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  googleApiKey: process.env.GOOGLE_API_KEY,
  dataFolder: './landmarks',
  brightonCenter: {
    lat: 50.8225,
    lon: -0.1372
  },
  searchRadius: 3000, 
};

// Ensure landmarks folder exists
if (!fs.existsSync(CONFIG.dataFolder)) {
  fs.mkdirSync(CONFIG.dataFolder, { recursive: true });
}

/**
 * Make a request to Google Places API
 */
function placesRequest(type, pageToken = null) {
  return new Promise((resolve, reject) => {
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?`;
    url += `location=${CONFIG.brightonCenter.lat},${CONFIG.brightonCenter.lon}`;
    url += `&radius=${CONFIG.searchRadius}`;
    url += `&type=${type}`;
    url += `&key=${CONFIG.googleApiKey}`;
    
    if (pageToken) {
      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?`;
      url += `pagetoken=${pageToken}`;
      url += `&key=${CONFIG.googleApiKey}`;
    }

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Get all results with pagination
 */
async function getAllPlaces(type) {
  console.log(`\nFetching ${type}...`);
  let allResults = [];
  let pageToken = null;
  let pageCount = 0;

  do {
    // Add delay for pagination (Google requires ~2 seconds between requests)
    if (pageToken) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const response = await placesRequest(type, pageToken);
    
    if (response.status !== 'OK' && response.status !== 'ZERO_RESULTS') {
      console.log(`  ⚠️  Status: ${response.status}`);
      if (response.error_message) {
        console.log(`  Error: ${response.error_message}`);
      }
      break;
    }

    if (response.results && response.results.length > 0) {
      allResults = allResults.concat(response.results);
      pageCount++;
      console.log(`  Page ${pageCount}: +${response.results.length} results (total: ${allResults.length})`);
    }

    pageToken = response.next_page_token || null;
  } while (pageToken);

  console.log(`  ✓ Total ${type}: ${allResults.length}`);
  return allResults;
}

/**
 * Process and clean landmark data
 */
function processLandmarks(places, type) {
  return places.map(place => ({
    name: place.name,
    type: type,
    lat: place.geometry.location.lat,
    lon: place.geometry.location.lng,
    address: place.vicinity,
    rating: place.rating || null,
    // Determine side of Brighton (rough estimates)
    side: determineSide(place.geometry.location.lat, place.geometry.location.lng)
  }));
}

/**
 * Determine which side/area of Brighton
 */
function determineSide(lat, lon) {
  const isNorth = lat > 50.827;
  const isSouth = lat < 50.821;
  const isWest = lon < -0.145;
  const isEast = lon > -0.135;

  let sides = [];
  
  if (isNorth) sides.push('north');
  else if (isSouth) sides.push('south');
  else sides.push('central');
  
  if (isWest) sides.push('west');
  else if (isEast) sides.push('east');
  else sides.push('central');

  return sides.join('-');
}

/**
 * Save landmarks to file
 */
function saveLandmarks(landmarks, type) {
  const filename = path.join(CONFIG.dataFolder, `${type}.json`);
  fs.writeFileSync(filename, JSON.stringify(landmarks, null, 2));
  console.log(`  💾 Saved to ${filename}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('🗺️  BRIGHTON LANDMARKS SCRAPER');
  console.log('═══════════════════════════════════════');
  console.log(`Center: ${CONFIG.brightonCenter.lat}, ${CONFIG.brightonCenter.lon}`);
  console.log(`Radius: ${CONFIG.searchRadius}m`);
  console.log('');

  // Define what to search for - EXPANDED LIST
  const searches = [
    { type: 'park', name: 'Parks' },
    { type: 'church', name: 'Churches' },
    { type: 'bar', name: 'Pubs/Bars' },
    { type: 'cafe', name: 'Cafes' },
    { type: 'restaurant', name: 'Restaurants' },
    { type: 'museum', name: 'Museums' },
    { type: 'art_gallery', name: 'Art Galleries' },
    { type: 'library', name: 'Libraries' },
    { type: 'tourist_attraction', name: 'Tourist Attractions' },
    { type: 'shopping_mall', name: 'Shopping Centers' },
    { type: 'store', name: 'Shops' },
    { type: 'supermarket', name: 'Supermarkets' },
    { type: 'convenience_store', name: 'Convenience Stores' },
    { type: 'train_station', name: 'Train Stations' },
    { type: 'bus_station', name: 'Bus Stations' },
    { type: 'subway_station', name: 'Subway Stations' },
    { type: 'university', name: 'Universities' },
    { type: 'school', name: 'Schools' },
    { type: 'hospital', name: 'Hospitals' },
    { type: 'pharmacy', name: 'Pharmacies' },
    { type: 'bank', name: 'Banks' },
    { type: 'post_office', name: 'Post Offices' },
    { type: 'town_hall', name: 'Town Halls' },
    { type: 'courthouse', name: 'Courthouses' },
    { type: 'police', name: 'Police Stations' },
    { type: 'fire_station', name: 'Fire Stations' },
    { type: 'parking', name: 'Car Parks' },
    { type: 'gas_station', name: 'Petrol Stations' },
    { type: 'movie_theater', name: 'Cinemas' },
    { type: 'night_club', name: 'Night Clubs' },
    { type: 'gym', name: 'Gyms' },
    { type: 'stadium', name: 'Stadiums' },
    { type: 'cemetery', name: 'Cemeteries' },
    { type: 'dentist', name: 'Dentists' },
    { type: 'veterinary_care', name: 'Vets' },
    { type: 'hair_care', name: 'Hair Salons' },
    { type: 'spa', name: 'Spas' },
    { type: 'laundry', name: 'Laundromats' },
    { type: 'bakery', name: 'Bakeries' },
    { type: 'book_store', name: 'Book Stores' },
    { type: 'clothing_store', name: 'Clothing Stores' },
    { type: 'electronics_store', name: 'Electronics Stores' },
    { type: 'furniture_store', name: 'Furniture Stores' },
    { type: 'jewelry_store', name: 'Jewelry Stores' },
    { type: 'liquor_store', name: 'Off Licenses' },
    { type: 'florist', name: 'Florists' }
  ];

  const allLandmarks = {};

  for (const search of searches) {
    try {
      const places = await getAllPlaces(search.type);
      const processed = processLandmarks(places, search.type);
      allLandmarks[search.type] = processed;
      saveLandmarks(processed, search.type);
      
      // Delay between different searches
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`  ✗ Error fetching ${search.name}:`, error.message);
    }
  }

  // Save combined file
  const combinedFile = path.join(CONFIG.dataFolder, 'all_landmarks.json');
  fs.writeFileSync(combinedFile, JSON.stringify(allLandmarks, null, 2));
  console.log('\n═══════════════════════════════════════');
  console.log(`✨ Complete! All landmarks saved to:`);
  console.log(`   ${combinedFile}`);
  console.log('═══════════════════════════════════════');

  // Print summary
  console.log('\n📊 SUMMARY:');
  Object.keys(allLandmarks).forEach(type => {
    console.log(`   ${type}: ${allLandmarks[type].length} locations`);
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { getAllPlaces, processLandmarks };