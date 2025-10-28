import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ClueBox from '../components/ClueBox'
import MapGuess from '../components/MapGuess'
import ScoreScreen from '../components/ScoreScreen'
import artworksData from '../data/artworks.json'
import { computeScore, haversineDistance } from '../utils/scoring'
import dynamic from 'next/dynamic';

// const MapGuess = dynamic(() => import('../components/MapGuess'), { ssr: false });


export default function GamePage() {
  const router = useRouter()
  const [opts, setOpts] = useState(null)
  const [pool, setPool] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [usedClues, setUsedClues] = useState(0)
  const [showMap, setShowMap] = useState(false)
  const [guessResult, setGuessResult] = useState(null)
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [pointsPerArtwork, setPointsPerArtwork] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    const raw = localStorage.getItem('artgame_opts')
    console.log('Loading game options:', raw)
    
    if (!raw) {
      console.log('No game options found, redirecting to home')
      router.push('/')
      return
    }
    
    const o = JSON.parse(raw)
    console.log('Parsed options:', o)
    setOpts(o)
    
    // If we have pre-selected artworks (from either mode), use those
    if (o?.selectedArtworks && Array.isArray(o.selectedArtworks)) {
      console.log('Using pre-selected artworks:', o.selectedArtworks.length)
      console.log('Selected IDs from localStorage:', o.selectedArtworks)
      const selectedPool = o.selectedArtworks
        .map(id => {
          const artwork = artworksData.find(a => a.artwork_id === id)
          if (!artwork) {
            console.warn('Artwork not found for ID:', id)
          }
          return artwork
        })
        .filter(Boolean) // Remove any nulls if artwork not found
      console.log('Loaded artworks pool:', selectedPool.length)
      console.log('Pool titles:', selectedPool.map(a => a.title))
      setPool(selectedPool)
    } else {
      // Fallback - use first N artworks (shouldn't happen with new logic)
      console.log('Fallback: using first N artworks')
      const filtered = artworksData.slice(0, o?.count || 1)
      setPool(filtered)
    }
    
    setLoading(false)
  }, [router])

  if (loading || !opts) {
    return <div className="container"><p>Loading game...</p></div>
  }
  
  if (pool.length === 0) {
    return (
      <div className="container">
        <p>No artworks found for &quot;{opts.location}&quot;.</p>
        <p>Back to <a href="/">start</a>.</p>
      </div>
    )
  }

  const current = pool[currentIndex]
  const totalClueLevels = current.clues.length

  const nextClue = () => setUsedClues(c => Math.min(c + 1, totalClueLevels))
  const onGuess = () => setShowMap(true)

  const handleMapGuess = ({ lat, lon }) => {
    const dist = haversineDistance(lat, lon, current.coordinates.lat, current.coordinates.lon)
    
    // Use different scoring based on mode
    const points = opts.mode === 'location' 
      ? computeScoreGPS(dist, usedClues)
      : computeScore(dist, usedClues)
    
    setScore(s => s + points)
    setPointsPerArtwork(prev => {
      const arr = [...prev]
      arr[currentIndex] = points
      return arr
    })
    setGuessResult({ dist, points })
  }

  const nextArtwork = () => {
    setUsedClues(0)
    setGuessResult(null)
    setShowMap(false)
    if (currentIndex + 1 < pool.length) {
      setCurrentIndex(i => i + 1)
    } else {
      setGameOver(true) // Game finished
    }
  }

  const restartGame = () => {
    setScore(0)
    setCurrentIndex(0)
    setUsedClues(0)
    setGuessResult(null)
    setShowMap(false)
    setGameOver(false)
    setPointsPerArtwork([])
    router.push('/')
  }

  if (gameOver) {
    return (
      <ScoreScreen
        score={score}
        pool={pool}
        pointsPerArtwork={pointsPerArtwork}
        onRestart={restartGame}
      />
    )
  }

  return (
    <div className="game-container">
      <h2>Find: {current.title}</h2>
      <ClueBox clues={current.clues} usedClues={usedClues} nextClue={nextClue} onGuess={onGuess} />

      {showMap && <MapGuess mode={opts.mode} target={current} onGuess={handleMapGuess} />}

      {guessResult && (
        <div className="result">
          <p className="distance">Distance: {Math.round(guessResult.dist)} m</p>
          <p className="points">Points for this artwork: {guessResult.points.toFixed(2)}</p>
          <p className="total">Total score: {score.toFixed(2)}</p>
          <button className="next-btn" onClick={nextArtwork}>Next artwork</button>
        </div>
      )}

      <div className="footer">
        Artworks found: {pool.length} · Current: {currentIndex + 1}/{pool.length} · Used clues: {usedClues}
        {opts.mode === 'location' && <span> · Mode: GPS</span>}
      </div>

      <style jsx>{`
        .footer {
          text-align: center;
          margin: 2rem 0;
          font-size: 1rem;
          color: #555;
          font-weight: 500;
        }

        .result {
          max-width: 400px;
          margin: 2rem auto;
          padding: 20px 30px;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          text-align: center;
          font-family: 'Arial', sans-serif;
          color: #333;
        }

        .result p {
          margin: 0.5rem 0;
          font-size: 1.1rem;
        }

        .distance {
          font-weight: 500;
          color: #555;
        }

        .points {
          font-weight: 600;
          color: #2a9d8f;
        }

        .total {
          font-weight: 700;
          color: #e76f51;
          font-size: 1.2rem;
        }

        .next-btn {
          margin-top: 1rem;
          padding: 10px 20px;
          font-size: 1rem;
          font-weight: 600;
          color: #fff;
          background-color: #264653;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.3s ease, transform 0.2s ease;
        }

        .next-btn:hover {
          background-color: #1b2f3a;
          transform: translateY(-2px);
        }

        .next-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  )
}

/**
 * GPS Mode Scoring - requires much closer proximity
 * Max points only if within 10m, decreases rapidly with distance
 */
function computeScoreGPS(distanceMeters, cluesUsed) {
  // Base points by number of clues used
  const basePoints = {
    0: 100,  // No clues used
    1: 75,   // 1 clue used
    2: 50,   // 2 clues used
    3: 25    // 3 clues used
  }
  
  const base = basePoints[cluesUsed] || 10
  
  // GPS mode requires being VERY close
  // Perfect score within 10m, zero points beyond 50m
  if (distanceMeters <= 10) {
    return base // Full points
  } else if (distanceMeters <= 20) {
    return base * 0.7 // 70% of points
  } else if (distanceMeters <= 30) {
    return base * 0.4 // 40% of points
  } else if (distanceMeters <= 50) {
    return base * 0.2 // 20% of points
  } else {
    return 0 // No points if more than 50m away
  }
}