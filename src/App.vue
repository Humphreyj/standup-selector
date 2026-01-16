<template>
  <div class="app">
    <h1 class="title">🏆 Standup Selector Tournament 🏆</h1>

    <ParticipantInput
      v-if="!tournamentStarted"
      @start-tournament="startTournament"
    />

    <TournamentBracket
      v-else
      :participants="participants"
      @reset="resetTournament"
    />
  </div>
</template>

<script>
import { ref } from "vue";
import ParticipantInput from "./components/ParticipantInput.vue";
import TournamentBracket from "./components/TournamentBracket.vue";

export default {
  name: "App",
  components: {
    ParticipantInput,
    TournamentBracket,
  },
  setup() {
    const participants = ref([]);
    const tournamentStarted = ref(false);

    const startTournament = (names) => {
      participants.value = names;
      tournamentStarted.value = true;
    };

    const resetTournament = () => {
      participants.value = [];
      tournamentStarted.value = false;
    };

    return {
      participants,
      tournamentStarted,
      startTournament,
      resetTournament,
    };
  },
};
</script>

<style scoped>
.app {
  text-align: center;
}

.title {
  color: var(--gold-2);
  font-size: 3rem;
  margin-bottom: 2rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 1px;
}

@media (max-width: 768px) {
  .title {
    font-size: 2rem;
  }
}
</style>
