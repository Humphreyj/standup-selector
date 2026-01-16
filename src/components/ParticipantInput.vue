<template>
  <div class="participant-input">
    <div class="input-container">
      <h2>Enter Participants</h2>
      <p class="subtitle">Add team members to the tournament</p>

      <div class="input-group">
        <input
          v-model="newParticipant"
          @keyup.enter="addParticipant"
          type="text"
          placeholder="Enter participant name..."
          class="participant-input"
        />
        <button @click="addParticipant" class="btn-add">Add</button>
      </div>

      <div v-if="participants.length > 0" class="participants-list">
        <h3>Participants ({{ participants.length }})</h3>
        <div class="participant-tags">
          <div
            v-for="(p, index) in participants"
            :key="p.id"
            class="participant-tag"
          >
            {{ p.name }}
            <button @click="removeParticipant(index)" class="remove-btn">
              ×
            </button>
          </div>
        </div>

        <button
          v-if="participants.length >= 2"
          @click="start"
          class="start-btn"
        >
          Start Tournament ({{ participants.length }} participants)
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";

export default {
  name: "ParticipantInput",
  emits: ["start-tournament"],
  setup(props, { emit }) {
    const newParticipant = ref("");
    const makeParticipant = (name) => ({
      id:
        globalThis.crypto && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
    });

    const participants = ref([
      makeParticipant("Josh"),
      makeParticipant("Jake"),
      makeParticipant("Jack"),
      makeParticipant("Gideon"),
      makeParticipant("Moe"),
      makeParticipant("David"),
      makeParticipant("William"),
      makeParticipant("Thomas"),
      makeParticipant("Mikhail"),
    ]);

    const addParticipant = () => {
      const name = newParticipant.value.trim();
      // Duplicate names are allowed; identity is handled via unique id.
      if (name) {
        participants.value.push(makeParticipant(name));
        newParticipant.value = "";
      }
    };

    const removeParticipant = (index) => {
      participants.value.splice(index, 1);
    };

    const start = () => {
      // Button is only visible when participants.length >= 2, so no need to check
      emit("start-tournament", participants.value);
    };

    return {
      newParticipant,
      participants,
      addParticipant,
      removeParticipant,
      start,
    };
  },
};
</script>

<style scoped>
.input-container {
  background: linear-gradient(
    180deg,
    var(--parchment) 0%,
    var(--parchment-2) 100%
  );
  border-radius: var(--radius-lg);
  padding: 2rem;
  box-shadow: 0 12px 40px var(--shadow);
  max-width: 600px;
  margin: 0 auto;
  border: 1px solid rgba(212, 175, 55, 0.35);
}

h2 {
  color: var(--burgundy);
  margin-bottom: 0.5rem;
  letter-spacing: 0.5px;
}

.subtitle {
  color: rgba(36, 23, 18, 0.7);
  margin-bottom: 1.5rem;
}

.input-group {
  display: flex;
  gap: 10px;
  margin-bottom: 1.5rem;
}

input {
  flex: 1;
  padding: 12px 20px;
  font-size: 1rem;
  border: 2px solid rgba(107, 29, 29, 0.35);
  border-radius: 8px;
  outline: none;
  background: rgba(255, 255, 255, 0.55);
  color: var(--ink);
}

input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.22);
}

.btn-add {
  padding: 12px 24px;
  background: linear-gradient(135deg, var(--emerald) 0%, #16613a 100%);
  color: var(--parchment);
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
}

.participants-list {
  margin-top: 2rem;
}

.participants-list h3 {
  color: var(--burgundy);
  margin-bottom: 1rem;
}

.participant-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 1.5rem;
}

.participant-tag {
  background: linear-gradient(135deg, var(--burgundy) 0%, #3a1212 100%);
  color: var(--parchment);
  padding: 8px 15px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  border: 1px solid rgba(212, 175, 55, 0.25);
}

.remove-btn {
  background: rgba(255, 255, 255, 0.3);
  color: var(--parchment);
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: rgba(255, 255, 255, 0.5);
}

.start-btn {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, var(--gold) 0%, var(--gold-2) 100%);
  color: var(--ink);
  border: none;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: bold;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
}

@media (max-width: 768px) {
  .input-container {
    padding: 1.5rem;
  }
}
</style>
