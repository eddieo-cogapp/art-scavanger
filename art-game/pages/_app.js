import '../styles/globals.css'
import '../styles/index.css'
import '../styles/game.css'
import '../styles/mapGuess.css'
import 'leaflet/dist/leaflet.css'
import Modal from 'react-modal'

if (typeof window !== 'undefined') {
  Modal.setAppElement('#__next') // __next is the default Next.js root
}


export default function App({ Component, pageProps }) {
    return <Component {...pageProps} />
}