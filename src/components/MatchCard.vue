<template>
  <div
    class="match-card"
    :class="{
      completed: match.completed,
      current: isCurrent,
      rolling: isRolling,
    }"
  >
    <div
      class="player"
      :class="{ winner: match.completed && isWinner(match.player1) }"
    >
      <div class="player-name">{{ getName(match.player1) || "TBD" }}</div>
      <div v-if="match.roll1 !== null" class="dice-roll">
        🎲 {{ match.roll1 }}
      </div>
      <div v-else-if="isRolling" class="dice-roll rolling-text">
        🎲 rolling…
      </div>
    </div>

    <div class="vs">VS</div>

    <div
      class="player"
      :class="{ winner: match.completed && isWinner(match.player2) }"
    >
      <div class="player-name">{{ getName(match.player2) || "TBD" }}</div>
      <div v-if="match.roll2 !== null" class="dice-roll">
        🎲 {{ match.roll2 }}
      </div>
      <div v-else-if="isRolling" class="dice-roll rolling-text">
        🎲 rolling…
      </div>
    </div>

    <button
      v-if="!match.completed && match.player1 && match.player2"
      @click="$emit('roll')"
      class="roll-btn"
      :disabled="disableRoll || isRolling"
    >
      {{ isRolling ? "Rolling…" : "Roll Dice!" }}
    </button>

    <div v-if="match.completed && match.winner" class="match-winner">
      Winner: {{ getName(match.winner) }}
    </div>
  </div>
</template>

<script>
export default {
  name: "MatchCard",
  props: {
    match: {
      type: Object,
      required: true,
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
    isRolling: {
      type: Boolean,
      default: false,
    },
    disableRoll: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["roll"],
  methods: {
    getName(p) {
      if (!p) return "";
      return typeof p === "object" ? p.name : String(p);
    },
    getId(p) {
      if (!p) return null;
      return typeof p === "object" ? p.id : String(p);
    },
    isWinner(player) {
      if (!this.match?.winner || !player) return false;
      return this.getId(this.match.winner) === this.getId(player);
    },
  },
};
</script>

<style scoped>
.match-card {
  background: linear-gradient(
    180deg,
    var(--parchment) 0%,
    var(--parchment-2) 100%
  );
  border-radius: 15px;
  padding: 1.5rem;
  box-shadow: 0 8px 24px var(--shadow);
  transition: all 0.3s ease;
  position: relative;
  border: 1px solid rgba(212, 175, 55, 0.25);
}

.match-card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.match-card.completed {
  opacity: 0.9;
}

.match-card.current {
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.35),
    0 10px 30px rgba(0, 0, 0, 0.25);
  transform: translateY(-2px);
}

.match-card.rolling::after {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: 16px;
  background: linear-gradient(
    90deg,
    rgba(102, 126, 234, 0.2),
    rgba(118, 75, 162, 0.2),
    rgba(102, 126, 234, 0.2)
  );
  background-size: 200% 200%;
  animation: shimmer 1.1s ease-in-out infinite;
  pointer-events: none;
}

.player {
  padding: 1rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.45);
  margin: 0.5rem 0;
  transition: all 0.3s ease;
}

.player.winner {
  background: linear-gradient(135deg, var(--emerald) 0%, #16613a 100%);
  color: var(--parchment);
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

.rolling-text {
  opacity: 0.75;
}

.vs {
  text-align: center;
  font-weight: bold;
  color: var(--burgundy);
  font-size: 1.2rem;
  margin: 0.5rem 0;
}

.roll-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, var(--gold) 0%, var(--gold-2) 100%);
  color: var(--ink);
  border: none;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: bold;
  margin-top: 1rem;
}

.roll-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.roll-btn:hover {
  transform: translateY(-2px);
}

.match-winner {
  text-align: center;
  margin-top: 1rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, var(--emerald) 0%, #16613a 100%);
  color: var(--parchment);
  border-radius: 8px;
  font-weight: bold;
}

@keyframes shimmer {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
}
</style>
