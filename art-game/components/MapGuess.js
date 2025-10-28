import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import Modal from 'react-modal'

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false })

export default function MapGuess({ mode, target, onGuess }) {
  const [showModal, setShowModal] = useState(false)
  const [userGuess, setUserGuess] = useState(null)
  const [gpsError, setGpsError] = useState(null)
  const [gettingLocation, setGettingLocation] = useState(false)

  if (typeof window !== 'undefined') {
    Modal.setAppElement('#__next')
  }

  // Auto-get GPS location when component mounts in GPS mode
  useEffect(() => {
    if (mode === 'location' && !userGuess) {
      getGPSLocation()
    }
  }, [mode])

  const getGPSLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser')
      return
    }

    setGettingLocation(true)
    setGpsError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const guess = {
          lat: position.coords.latitude,
          lon: position.coords.longitude
        }
        setUserGuess(guess)
        setGettingLocation(false)
        onGuess(guess) // Send GPS coordinates to parent to calculate distance
      },
      (error) => {
        setGettingLocation(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Location permission denied. Please enable location access in your browser.')
            break
          case error.POSITION_UNAVAILABLE:
            setGpsError('Location information is unavailable.')
            break
          case error.TIMEOUT:
            setGpsError('Location request timed out.')
            break
          default:
            setGpsError('An unknown error occurred getting your location.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  const handleGuess = (guess) => {
    // Check if this is a marker click (modal open request)
    if (guess.openModal) {
      setShowModal(true)
    } else {
      // Regular guess with coordinates
      setUserGuess(guess)
      onGuess(guess)
    }
  }

  const modalStyles = {
    content: {
      top: '50%',
      left: '50%',
      right: 'auto',
      bottom: 'auto',
      marginRight: '-50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: '700px',
      maxHeight: '85vh',
      overflow: 'auto',
      padding: '30px',
      zIndex: 10000
    },
    overlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      zIndex: 9999
    }
  }

  return (
    <div className="map-guess">
      {/* GPS Mode Status */}
      {mode === 'location' && (
        <div className="gps-status">
          {gettingLocation && <p>🌍 Getting your location...</p>}
          {gpsError && (
            <div className="gps-error">
              <p>{gpsError}</p>
              <button onClick={getGPSLocation}>Try Again</button>
            </div>
          )}
          {userGuess && !gettingLocation && (
            <p className="gps-success">✓ Location acquired! Distance calculated.</p>
          )}
        </div>
      )}

      {/* Show map for regular map mode */}
      {mode === 'map' && (
        <LeafletMap 
          target={target} 
          onGuess={handleGuess} 
          initialGuess={userGuess} 
        />
      )}

      {/* Show map in GPS mode after location is acquired */}
      {mode === 'location' && userGuess && (
        <LeafletMap 
          target={target} 
          onGuess={handleGuess} 
          initialGuess={userGuess} 
        />
      )}

      <Modal 
        isOpen={showModal} 
        onRequestClose={() => setShowModal(false)}
        style={modalStyles}
      >
        <h3>{target.title}</h3>
        <img 
          src={target.image || '/placeholder.png'} 
          alt={target.title} 
          style={{ width: '100%', height: 'auto', marginBottom: '15px' }} 
        />
        <button onClick={() => setShowModal(false)}>Close</button>
      </Modal>

      <style jsx>{`
        .gps-status {
          margin: 1rem 0;
          padding: 1rem;
          background: #f0f8ff;
          border-radius: 8px;
          text-align: center;
        }

        .gps-status p {
          margin: 0.5rem 0;
          font-size: 1rem;
          font-weight: 600;
        }

        .gps-success {
          color: #2a9d8f;
        }

        .gps-error {
          background: #ffe6e6;
          padding: 1rem;
          border-radius: 8px;
          color: #d63031;
        }

        .gps-error button {
          margin-top: 0.5rem;
          padding: 8px 16px;
          background: #264653;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }

        .gps-error button:hover {
          background: #1b2f3a;
        }
      `}</style>
    </div>
  )
}