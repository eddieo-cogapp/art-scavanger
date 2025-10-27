// components/ScoreScreen.js
import { useState } from 'react'

export default function ScoreScreen({ score, pool, pointsPerArtwork, onRestart }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const total = pool.length
  const current = pool[currentIndex]

  const next = () => setCurrentIndex(i => (i + 1) % total)
  const prev = () => setCurrentIndex(i => (i - 1 + total) % total)

  return (
    <div className="score-screen">
      <h2>🎉 Game Over!</h2>
      <p>
        Total Score: <strong>{score.toFixed(2)}</strong>
      </p>
      <p>
        You completed {total} artwork{total > 1 ? 's' : ''}
      </p>

      <div className="carousel">
        <button onClick={prev}>◀</button>
        <div className="artwork-display">
          <h3>{current.title}</h3>
          <img
            src={current.image || '/placeholder.png'}
            alt={current.title}
            style={{ width: '300px', borderRadius: '6px' }}
          />
          <p>Points: {pointsPerArtwork[currentIndex]?.toFixed(2) || 0}</p>
        </div>
        <button onClick={next}>▶</button>
      </div>

      <button className="restart" onClick={onRestart}>
        Play Again
      </button>

      <style jsx>{`
        .score-screen {
          text-align: center;
          margin: 50px auto;
        }
        h2 {
          font-size: 2rem;
          margin-bottom: 10px;
        }
        p {
          font-size: 1.1rem;
          margin: 5px 0;
        }
        .carousel {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 30px 0;
        }
        .carousel button {
            font-size: 2rem;
            background: none;
            border: none;
            cursor: pointer;
            padding: 0 15px;
            color: #333; /* dark grey for the buttons */
            transition: color 0.2s ease;
        }

        .carousel button:hover {
            color: #000; /* black on hover */   
        }
        .artwork-display {
          text-align: center;
        }
        .artwork-display img {
          display: block;
          margin: 10px auto;
        }
        .restart {
          margin-top: 20px;
          padding: 10px 20px;
          font-size: 1rem;
          border-radius: 6px;
          background-color: #0070f3;
          color: white;
          border: none;
          cursor: pointer;
        }
        .restart:hover {
          background-color: #005bb5;
        }
      `}</style>
    </div>
  )
}
