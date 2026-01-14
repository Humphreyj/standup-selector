<template>
  <div class="tournament-bracket">
    <div v-if="winner" class="winner-announcement">
      <h1 class="winner-title">🎉 Tournament Winner! 🎉</h1>
      <div class="winner-name">{{ winner }}</div>
      <p class="winner-text">Will lead the next standup!</p>
      <button @click="$emit('reset')" class="reset-btn">Start New Tournament</button>
    </div>

    <div v-else class="bracket-container">
      <div v-for="(round, roundIndex) in rounds" :key="roundIndex" class="round">
        <h3 class="round-title">{{ getRoundName(roundIndex) }}</h3>
        <div class="matches">
          <MatchCard
            v-for="(match, matchIndex) in round"
            :key="`${roundIndex}-${matchIndex}`"
            :match="match"
            @roll="rollDice(roundIndex, matchIndex)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import MatchCard from './MatchCard.vue'

export default {
  name: 'TournamentBracket',
  components: {
    MatchCard
  },
  props: {
    participants: {
      type: Array,
      required: true
    }
  },
  emits: ['reset'],
  setup(props) {
    const rounds = ref([])
    const winner = ref(null)

    const initializeBracket = () => {
      // Shuffle participants
      const shuffled = [...props.participants].sort(() => Math.random() - 0.5)
      
      // Create first round matches
      const firstRound = []
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          firstRound.push({
            player1: shuffled[i],
            player2: shuffled[i + 1],
            roll1: null,
            roll2: null,
            winner: null,
            completed: false
          })
        } else {
          // Bye for odd number of participants
          firstRound.push({
            player1: shuffled[i],
            player2: null,
            roll1: 20,
            roll2: 0,
            winner: shuffled[i],
            completed: true
          })
        }
      }
      
      rounds.value = [firstRound]
      
      // Create empty subsequent rounds
      let numMatches = Math.ceil(firstRound.length / 2)
      while (numMatches >= 1) {
        const round = []
        for (let i = 0; i < numMatches; i++) {
          round.push({
            player1: null,
            player2: null,
            roll1: null,
            roll2: null,
            winner: null,
            completed: false
          })
        }
        rounds.value.push(round)
        numMatches = Math.ceil(numMatches / 2)
      }
    }

    const rollD20 = () => {
      return Math.floor(Math.random() * 20) + 1
    }

    const rollDice = (roundIndex, matchIndex) => {
      const match = rounds.value[roundIndex][matchIndex]
      
      if (match.completed || !match.player1 || !match.player2) return

      // Roll dice
      match.roll1 = rollD20()
      match.roll2 = rollD20()

      // Handle ties
      while (match.roll1 === match.roll2) {
        match.roll1 = rollD20()
        match.roll2 = rollD20()
      }

      // Determine winner
      match.winner = match.roll1 > match.roll2 ? match.player1 : match.player2
      match.completed = true

      // Advance winner to next round
      advanceWinner(roundIndex, matchIndex, match.winner)
    }

    const advanceWinner = (roundIndex, matchIndex, winnerName) => {
      const nextRoundIndex = roundIndex + 1
      
      if (nextRoundIndex >= rounds.value.length) {
        // Tournament complete
        winner.value = winnerName
        return
      }

      const nextMatchIndex = Math.floor(matchIndex / 2)
      const nextMatch = rounds.value[nextRoundIndex][nextMatchIndex]

      if (matchIndex % 2 === 0) {
        nextMatch.player1 = winnerName
      } else {
        nextMatch.player2 = winnerName
      }

      // Check if this was the final match
      if (nextRoundIndex === rounds.value.length - 1 && nextMatch.player1 && nextMatch.player2) {
        // Auto-start final match after a short delay
        setTimeout(() => {
          if (!nextMatch.completed) {
            rollDice(nextRoundIndex, nextMatchIndex)
          }
        }, 1000)
      }
    }

    const getRoundName = (index) => {
      const totalRounds = rounds.value.length
      const fromEnd = totalRounds - index - 1
      
      if (fromEnd === 0) return 'Final'
      if (fromEnd === 1) return 'Semi-Finals'
      if (fromEnd === 2) return 'Quarter-Finals'
      return `Round ${index + 1}`
    }

    onMounted(() => {
      initializeBracket()
    })

    return {
      rounds,
      winner,
      rollDice,
      getRoundName
    }
  }
}
</script>

<style scoped>
.tournament-bracket {
  padding: 2rem 0;
}

.winner-announcement {
  background: white;
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  margin: 0 auto;
}

.winner-title {
  color: #667eea;
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.winner-name {
  font-size: 3rem;
  font-weight: bold;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 1rem 0;
}

.winner-text {
  font-size: 1.5rem;
  color: #666;
  margin-bottom: 2rem;
}

.reset-btn {
  padding: 15px 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: bold;
}

.bracket-container {
  display: flex;
  gap: 3rem;
  overflow-x: auto;
  padding: 2rem;
  justify-content: center;
}

.round {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 300px;
}

.round-title {
  color: white;
  text-align: center;
  font-size: 1.5rem;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
}

.matches {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  justify-content: space-around;
  flex: 1;
}

@media (max-width: 768px) {
  .bracket-container {
    padding: 1rem;
    gap: 2rem;
  }

  .round {
    min-width: 250px;
  }

  .winner-title {
    font-size: 2rem;
  }

  .winner-name {
    font-size: 2rem;
  }
}
</style>
