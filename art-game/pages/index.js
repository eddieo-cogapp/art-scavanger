import { useState } from 'react'
import { useRouter } from 'next/router'
import artworksData from '../data/artworks.json'

export default function Home() {
  const router = useRouter()
  const [count, setCount] = useState(1)
  const [location, setLocation] = useState('Brighton')
  const [distance, setDistance] = useState(5000)
  const [mode, setMode] = useState('map') // 'map' or 'location'
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState(null)

  /**
   * Calculate distance between two coordinates (in meters)
   */
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
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
   * Find artworks near a location, sorted by distance
   */
  const findNearbyArtworks = (userLat, userLon, artworks, maxDistance = 1000) => {
    const artworksWithDistance = artworks.map(artwork => ({
      ...artwork,
      distanceFromUser: calculateDistance(
        userLat, 
        userLon, 
        artwork.coordinates.lat, 
        artwork.coordinates.lon
      )
    }))

    // Filter by max distance and sort by distance
    return artworksWithDistance
      .filter(a => a.distanceFromUser <= maxDistance)
      .sort((a, b) => a.distanceFromUser - b.distanceFromUser)
  }

  /**
   * Select a random starting artwork from nearby options
   */
  const selectRandomStartingArtwork = (nearbyArtworks, maxStartDistance = 100) => {
    // Get artworks within starting distance
    const startingCandidates = nearbyArtworks.filter(a => a.distanceFromUser <= maxStartDistance)
    
    if (startingCandidates.length === 0) {
      // If no artworks within 100m, take the 5 closest and pick randomly
      const closest = nearbyArtworks.slice(0, Math.min(5, nearbyArtworks.length))
      return closest[Math.floor(Math.random() * closest.length)]
    }
    
    // Randomly select from candidates
    return startingCandidates[Math.floor(Math.random() * startingCandidates.length)]
  }

  /**
   * Build a route of artworks approximately 100m apart
   */
  const buildArtworkRoute = (startingArtwork, allArtworks, routeCount, targetSpacing = 100) => {
    const route = [startingArtwork]
    const used = new Set([startingArtwork.artwork_id])
    let currentArtwork = startingArtwork

    while (route.length < routeCount && route.length < allArtworks.length) {
      // Find artworks near the current one
      const candidates = allArtworks
        .filter(a => !used.has(a.artwork_id))
        .map(artwork => ({
          ...artwork,
          distanceFromCurrent: calculateDistance(
            currentArtwork.coordinates.lat,
            currentArtwork.coordinates.lon,
            artwork.coordinates.lat,
            artwork.coordinates.lon
          )
        }))
        .filter(a => a.distanceFromCurrent >= targetSpacing * 0.5 && a.distanceFromCurrent <= targetSpacing * 2)
        .sort((a, b) => Math.abs(a.distanceFromCurrent - targetSpacing) - Math.abs(b.distanceFromCurrent - targetSpacing))

      if (candidates.length === 0) {
        // If no good candidates, just take the closest unused artwork
        const fallback = allArtworks
          .filter(a => !used.has(a.artwork_id))
          .map(artwork => ({
            ...artwork,
            distanceFromCurrent: calculateDistance(
              currentArtwork.coordinates.lat,
              currentArtwork.coordinates.lon,
              artwork.coordinates.lat,
              artwork.coordinates.lon
            )
          }))
          .sort((a, b) => a.distanceFromCurrent - b.distanceFromCurrent)[0]
        
        if (!fallback) break
        
        route.push(fallback)
        used.add(fallback.artwork_id)
        currentArtwork = fallback
      } else {
        // Pick from top 3 candidates randomly for variety
        const topCandidates = candidates.slice(0, Math.min(3, candidates.length))
        const nextArtwork = topCandidates[Math.floor(Math.random() * topCandidates.length)]
        route.push(nextArtwork)
        used.add(nextArtwork.artwork_id)
        currentArtwork = nextArtwork
      }
    }

    return route
  }

  /**
   * Randomly select N artworks from the pool
   */
  const selectRandomArtworks = (artworks, count) => {
    const shuffled = [...artworks].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  const startGame = async (e) => {
    e.preventDefault()
    setLocationError(null)

    if (mode === 'location') {
      // Location mode - use GPS
      if (!navigator.geolocation) {
        setLocationError('Geolocation is not supported by your browser')
        return
      }

      setIsGettingLocation(true)

      try {
        // Get user's current position
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          })
        })

        const userLat = position.coords.latitude
        const userLon = position.coords.longitude

        // Use imported artworks data
        if (!Array.isArray(artworksData) || artworksData.length === 0) {
          setLocationError('No artworks data available')
          setIsGettingLocation(false)
          return
        }

        // Find nearby artworks
        const nearbyArtworks = findNearbyArtworks(userLat, userLon, artworksData, distance)

        if (nearbyArtworks.length === 0) {
          setLocationError(`No artworks found within ${distance}m of your location`)
          setIsGettingLocation(false)
          return
        }

        // Select random starting artwork within 100m (or closest if none that close)
        const startingArtwork = selectRandomStartingArtwork(nearbyArtworks, 100)

        // Build route of artworks ~100m apart
        const route = buildArtworkRoute(startingArtwork, nearbyArtworks, count, 100)

        // Store options and route
        const opts = { 
          count: route.length, 
          location, 
          distance, 
          mode,
          userLocation: { lat: userLat, lon: userLon },
          selectedArtworks: route.map(a => a.artwork_id)
        }
        localStorage.setItem('artgame_opts', JSON.stringify(opts))
        
        setIsGettingLocation(false)
        router.push('/game')

      } catch (error) {
        setIsGettingLocation(false)
        if (error.code === 1) {
          setLocationError('Location permission denied. Please enable location access.')
        } else if (error.code === 2) {
          setLocationError('Location unavailable. Please try again.')
        } else if (error.code === 3) {
          setLocationError('Location request timed out. Please try again.')
        } else {
          setLocationError('Error getting location: ' + error.message)
        }
      }
    } else {
      // Map mode - randomly select artworks
      if (!Array.isArray(artworksData) || artworksData.length === 0) {
        setLocationError('No artworks data available')
        return
      }

      console.log('Map mode: Selecting random artworks...')
      console.log('Artworks available:', artworksData.length)
      console.log('Count requested:', count)

      // Randomly select artworks
      const randomArtworks = selectRandomArtworks(artworksData, count)
      
      console.log('Random artworks selected:', randomArtworks.length)
      console.log('Selected artwork IDs:', randomArtworks.map(a => a.artwork_id))
      console.log('Selected artwork titles:', randomArtworks.map(a => a.title))
      
      const opts = { 
        count: randomArtworks.length, 
        location, 
        distance, 
        mode,
        selectedArtworks: randomArtworks.map(a => a.artwork_id)
      }
      
      console.log('Saving options to localStorage:', opts)
      localStorage.setItem('artgame_opts', JSON.stringify(opts))
      
      console.log('Navigating to /game...')
      router.push('/game')
    }
  }

  return (
    <div className="container">
      <h1>Art Hunt</h1>
      <form onSubmit={startGame} className="form">
        <label>
          How many artworks?
          <input 
            type="number" 
            min="1" 
            max="20" 
            value={count} 
            onChange={e => setCount(Number(e.target.value))} 
          />
        </label>

        <label>
          General location
          <input 
            type="text" 
            value={location} 
            onChange={e => setLocation(e.target.value)} 
          />
        </label>

        <label>
          Max distance to travel (meters)
          <input 
            type="number" 
            min="100" 
            step="100" 
            value={distance} 
            onChange={e => setDistance(Number(e.target.value))} 
          />
        </label>

        <fieldset>
          <legend>Mode</legend>
          <label>
            <input 
              type="radio" 
              name="mode" 
              value="map" 
              checked={mode === 'map'} 
              onChange={() => setMode('map')} 
            /> Map mode
          </label>
          <label>
            <input 
              type="radio" 
              name="mode" 
              value="location" 
              checked={mode === 'location'} 
              onChange={() => setMode('location')} 
            /> Location mode (uses device GPS)
          </label>
        </fieldset>

        {locationError && (
          <div className="error-message" style={{ color: 'red', marginTop: '10px' }}>
            {locationError}
          </div>
        )}

        <button 
          type="submit" 
          className="start-btn"
          disabled={isGettingLocation}
        >
          {isGettingLocation ? 'Getting location...' : 'Start Game'}
        </button>
      </form>
    </div>
  )
}