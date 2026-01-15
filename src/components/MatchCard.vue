<template>
  <div class="match-card" :class="{ completed: match.completed }">
    <div class="player" :class="{ winner: match.completed && match.winner === match.player1 }">
      <div class="player-name">{{ match.player1 || 'TBD' }}</div>
      <div v-if="match.roll1 !== null" class="dice-roll">
        🎲 {{ match.roll1 }}
      </div>
    </div>

    <div class="vs">VS</div>

    <div class="player" :class="{ winner: match.completed && match.winner === match.player2 }">
      <div class="player-name">{{ match.player2 || 'TBD' }}</div>
      <div v-if="match.roll2 !== null" class="dice-roll">
        🎲 {{ match.roll2 }}
      </div>
    </div>

    <button
      v-if="!match.completed && match.player1 && match.player2"
      @click="$emit('roll')"
      class="roll-btn"
    >
      Roll Dice!
    </button>

    <div v-if="match.completed && match.winner" class="match-winner">
      Winner: {{ match.winner }}
    </div>
  </div>
</template>

<script>
export default {
  name: 'MatchCard',
  props: {
    match: {
      type: Object,
      required: true
    }
  },
  emits: ['roll']
}
</script>

<style scoped>
.match-card {
  background: white;
  border-radius: 15px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.match-card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.match-card.completed {
  opacity: 0.9;
}

.player {
  padding: 1rem;
  border-radius: 10px;
  background: #f7fafc;
  margin: 0.5rem 0;
  transition: all 0.3s ease;
}

.player.winner {
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  color: white;
  font-weight: bold;
  transform: scale(1.05);
}

.player-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.dice-roll {
  font-size: 1.5rem;
  font-weight: bold;
  margin-top: 0.5rem;
}

.vs {
  text-align: center;
  font-weight: bold;
  color: #667eea;
  font-size: 1.2rem;
  margin: 0.5rem 0;
}

.roll-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: bold;
  margin-top: 1rem;
}

.roll-btn:hover {
  transform: translateY(-2px);
}

.match-winner {
  text-align: center;
  margin-top: 1rem;
  padding: 0.75rem;
  background: #48bb78;
  color: white;
  border-radius: 8px;
  font-weight: bold;
}
</style>
