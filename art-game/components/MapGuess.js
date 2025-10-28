import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import Modal from 'react-modal'

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false })

export default function MapGuess({ mode, target, onGuess }) {
  const [showModal, setShowModal] = useState(false)
  const [userGuess, setUserGuess] = useState(null)

  if (typeof window !== 'undefined') {
    Modal.setAppElement('#__next')
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
      {mode === 'map' && (
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
    </div>
  )
}