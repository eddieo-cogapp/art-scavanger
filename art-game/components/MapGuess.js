// components/MapGuess.js
import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import L from 'leaflet'
import { Marker, TileLayer, Polyline, useMapEvents, Popup } from 'react-leaflet'
import Modal from 'react-modal'

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
})

// Dynamically import MapContainer (client-side only)
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })

// Default center for Brighton
const BRIGHTON_CENTER = [50.821016630851815, -0.13752453533475725]

// Map click handler
function ClickableMap({ onClick }) {
  const [pos, setPos] = useState(null)

  function Events() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng
        setPos([lat, lng])
        onClick({ lat, lon: lng })
      },
    })
    return null
  }

  return (
    <>
      <Events />
      {pos && <Marker position={pos} />}
    </>
  )
}

// Main MapGuess component
export default function MapGuess({ mode, onGuess, target }) {
  const [userPos, setUserPos] = useState(null)
  const [userGuess, setUserGuess] = useState(null)
  const [guessed, setGuessed] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const mapRef = useRef()

  // Ensure React Modal accessibility
  if (typeof window !== 'undefined') {
    Modal.setAppElement('#__next')
  }

  const handleMapGuess = ({ lat, lon }) => {
    setUserGuess({ lat, lon })
    setGuessed(true)
    onGuess({ lat, lon })

    // Fit bounds to show both guess and target
    if (mapRef.current) {
      const bounds = L.latLngBounds([
        [lat, lon],
        [target.coordinates.lat, target.coordinates.lon],
      ])
      mapRef.current.fitBounds(bounds, { padding: [50, 50] })
    }
  }

  const openModal = () => setShowModal(true)
  const closeModal = () => setShowModal(false)

  // Location mode: use device location
  useEffect(() => {
    if (mode === 'location') {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const lat = p.coords.latitude
          const lon = p.coords.longitude
          setUserPos({ lat, lon })
          setUserGuess({ lat, lon })
          setGuessed(true)
          onGuess({ lat, lon })

          // Fit map bounds
          if (mapRef.current) {
            const bounds = L.latLngBounds([
              [lat, lon],
              [target.coordinates.lat, target.coordinates.lon],
            ])
            mapRef.current.fitBounds(bounds, { padding: [50, 50] })
          }
        },
        (err) => {
          console.error('geolocation denied', err)
          alert('Unable to get device location. Please allow location or use map mode.')
        }
      )
    }
  }, [mode, onGuess, target])

  const imageLink = target.image || '/placeholder.png'

  return (
    <div className="map-guess">
      {mode === 'map' && (
        <div className="map-wrap">
          <MapContainer
            center={BRIGHTON_CENTER}
            zoom={14}
            style={{ height: '400px', width: '100%' }}
            whenCreated={(mapInstance) => (mapRef.current = mapInstance)}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {!guessed && <ClickableMap onClick={handleMapGuess} />}
            {userGuess && <Marker position={[userGuess.lat, userGuess.lon]} />}
            {guessed && (
              <Marker
                position={[target.coordinates.lat, target.coordinates.lon]}
                eventHandlers={{ click: openModal }}
              >
                <Popup>Click to view artwork</Popup>
              </Marker>
            )}
            {guessed && userGuess && (
              <Polyline
                positions={[
                  [userGuess.lat, userGuess.lon],
                  [target.coordinates.lat, target.coordinates.lon],
                ]}
                color="red"
              />
            )}
          </MapContainer>
          <p className="map-instruction">
            Click on the map to make your guess. Once guessed, the artwork location will be revealed.
          </p>
        </div>
      )}

      {mode === 'location' && (
        <div className="location-mode">
          <p>Using device location — your coordinates will be compared to the artwork.</p>
          {userPos ? (
            <>
              <p>
                Your coords: {userPos.lat.toFixed(5)}, {userPos.lon.toFixed(5)}
              </p>
              <p>
                Artwork coords: {target.coordinates.lat.toFixed(5)},{' '}
                {target.coordinates.lon.toFixed(5)}
              </p>
            </>
          ) : (
            <p>Getting location...</p>
          )}
        </div>
      )}

      {/* Artwork Modal */}
      <Modal
        isOpen={showModal}
        onRequestClose={closeModal}
        contentLabel="Artwork"
        style={{
          overlay: {
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
          },
          content: {
            maxWidth: '500px',
            margin: 'auto',
            borderRadius: '8px',
            padding: '20px',
            zIndex: 10001,
          },
        }}
      >
        <h3>{target.title}</h3>
        <img src={imageLink} alt={target.title} style={{ width: '100%', borderRadius: '6px' }} />
        <button onClick={closeModal} style={{ marginTop: '10px' }}>
          Close
        </button>
      </Modal>
    </div>
  )
}
