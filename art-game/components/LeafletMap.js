// components/LeafletMap.js
'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
})

const BRIGHTON_CENTER = [50.821016630851815, -0.13752453533475725]

// Clickable map subcomponent
function ClickableMap({ onClick, userGuess }) {
    useMapEvents({
        click(e) {
            if (!userGuess) {
                const { lat, lng } = e.latlng
                onClick({ lat, lon: lng })
            }
        },
    })
    return null
}

export default function LeafletMap({ target, onGuess, initialGuess = null }) {
    const [userGuess, setUserGuess] = useState(initialGuess)
    const mapRef = useRef()

    const handleMapClick = ({ lat, lon }) => {
        setUserGuess({ lat, lon })
        onGuess({ lat, lon })

        if (mapRef.current) {
            const bounds = L.latLngBounds([
                [lat, lon],
                [target.coordinates.lat, target.coordinates.lon],
            ])
            mapRef.current.fitBounds(bounds, { padding: [50, 50] })
        }
    }

    return (
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
            {!userGuess && <ClickableMap onClick={handleMapClick} userGuess={userGuess} />}
            {userGuess && <Marker position={[userGuess.lat, userGuess.lon]} />}
            {userGuess && (
                <Marker
                    position={[target.coordinates.lat, target.coordinates.lon]}
                    eventHandlers={{
                        click: () => {
                            // Just trigger modal open without passing coordinates
                            if (onGuess) {
                                onGuess({ openModal: true })
                            }
                        }
                    }}
                >
                    <Popup>Click to view artwork</Popup>
                </Marker>
            )}
            {userGuess && (
                <Polyline
                    positions={[
                        [userGuess.lat, userGuess.lon],
                        [target.coordinates.lat, target.coordinates.lon],
                    ]}
                    color="red"
                />
            )}
        </MapContainer>
    )
}
