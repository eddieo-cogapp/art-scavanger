export default function ClueBox({ clues, usedClues, nextClue, onGuess }) {
  const levels = Math.min(usedClues, clues.length)
  const currentClue = levels > 0 ? clues[levels - 1] : null

  return (
    <div className="clue-box">
      <h3>Clue</h3>

      {levels === 0 ? (
        <p className="hint">
          Press <span>“Show me the next clue”</span> to reveal the first clue.
        </p>
      ) : (
        <div className="clue-content">
          <p className="clue-text">{currentClue.clue}</p>
          <p className="clue-meta">
            <strong>Level:</strong> {currentClue.level} · <strong>Type:</strong> {currentClue.type}
          </p>
        </div>
      )}

      <div className="controls">
        <button onClick={nextClue}>Show me the next clue</button>
        <button className="guess" onClick={onGuess}>Guess location</button>
      </div>

      <style jsx>{`
        .clue-box {
          max-width: 700px; /* wider */
          margin: 2rem auto;
          padding: 2rem 2.5rem;
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
          text-align: center;
          font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }

        .clue-box h3 {
          font-size: 1.9rem;
          color: #333;
          margin-bottom: 1.2rem;
          border-bottom: 2px solid #eee;
          display: inline-block;
          padding-bottom: 0.4rem;
        }

        .hint {
          color: #777;
          font-style: italic;
          font-size: 1rem;
        }

        .hint span {
          font-weight: 500;
          color: #444;
        }

        .clue-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.2rem;
          animation: fadeIn 0.5s ease-in-out;
        }

        .clue-text {
          font-size: 1.15rem;
          line-height: 1.6;
          color: #444;
          max-width: 650px;
        }

        .clue-meta {
          font-size: 0.9rem;
          color: #888;
        }

        .controls {
          margin-top: 2rem;
          display: flex;
          justify-content: center; /* center buttons */
          gap: 1rem; /* space between buttons */
          flex-wrap: wrap; /* wrap on smaller screens */
        }

        .controls button {
          padding: 0.8rem 1.5rem;
          font-size: 1rem;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #0070f3;
          color: white;
          min-width: 180px;
        }

        .controls button:hover {
          background: #005bb5;
        }

        .controls button.guess {
          background: #2a9d8f; /* teal-green */
          color: #fff;
        }

        .controls button.guess:hover {
          background: #21867a; /* slightly darker on hover */
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
