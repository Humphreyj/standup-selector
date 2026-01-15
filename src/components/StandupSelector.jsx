import React, { useState } from 'react'
import './StandupSelector.css'

function StandupSelector() {
  const [participants, setParticipants] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [isSpinning, setIsSpinning] = useState(false)

  const addParticipant = (e) => {
    e.preventDefault()
    if (inputValue.trim() && !participants.includes(inputValue.trim())) {
      setParticipants([...participants, inputValue.trim()])
      setInputValue('')
    }
  }

  const removeParticipant = (name) => {
    setParticipants(participants.filter(p => p !== name))
  }

  const selectRandom = () => {
    if (participants.length === 0) return
    
    setIsSpinning(true)
    setSelectedPerson(null)
    
    let counter = 0
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * participants.length)
      setSelectedPerson(participants[randomIndex])
      counter++
      
      if (counter >= 20) {
        clearInterval(interval)
        setIsSpinning(false)
      }
    }, 100)
  }

  return (
    <div className="selector-container">
      <div className="selector-card">
        <h1 className="title">🎲 Standup Selector 🎲</h1>
        <p className="subtitle">Roll for Initiative!</p>

        <form onSubmit={addParticipant} className="input-form">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter adventurer name..."
            className="name-input"
          />
          <button type="submit" className="add-button">
            Add to Party
          </button>
        </form>

        <div className="participants-list">
          {participants.map((name, index) => (
            <div key={index} className="participant-item">
              <span className="participant-name">{name}</span>
              <button
                onClick={() => removeParticipant(name)}
                className="remove-button"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {participants.length > 0 && (
          <button
            onClick={selectRandom}
            disabled={isSpinning}
            className={`select-button ${isSpinning ? 'spinning' : ''}`}
          >
            {isSpinning ? 'Rolling the Dice...' : 'Roll for Leader!'}
          </button>
        )}

        {selectedPerson && !isSpinning && (
          <div className="result-container">
            <div className="result-card">
              <h2 className="result-title">The Chosen One!</h2>
              <p className="result-name">{selectedPerson}</p>
              <p className="result-subtitle">shall lead today's standup</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StandupSelector
