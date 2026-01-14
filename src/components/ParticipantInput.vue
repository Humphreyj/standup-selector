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
          <div v-for="(name, index) in participants" :key="index" class="participant-tag">
            {{ name }}
            <button @click="removeParticipant(index)" class="remove-btn">×</button>
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
  import { ref } from 'vue'
  
  export default {
    name: 'ParticipantInput',
    emits: ['start-tournament'],
    setup(props, { emit }) {
      const newParticipant = ref('')
      const participants = ref([])
  
      const addParticipant = () => {
        const name = newParticipant.value.trim()
        if (name && !participants.value.includes(name)) {
          participants.value.push(name)
          newParticipant.value = ''
        }
      }
  
      const removeParticipant = (index) => {
        participants.value.splice(index, 1)
      }
  
      const start = () => {
        if (participants.value.length < 2) {
          alert('Please add at least 2 participants!')
          return
        }
        emit('start-tournament', participants.value)
      }
  
      return {
        newParticipant,
        participants,
        addParticipant,
        removeParticipant,
        start
      }
    }
  }
  </script>
  
  <style scoped>
  .input-container {
    background: white;
    border-radius: 20px;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    max-width: 600px;
    margin: 0 auto;
  }

  h2 {
    color: #667eea;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #666;
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
    border: 2px solid #667eea;
    border-radius: 8px;
    outline: none;
  }
  
  input:focus {
    border-color: #764ba2;
    box-shadow: 0 0 0 3px rgba(118, 75, 162, 0.2);
  }

  .btn-add {
    padding: 12px 24px;
    background: #48bb78;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
  }

  .participants-list {
    margin-top: 2rem;
  }

  .participants-list h3 {
    color: #667eea;
    margin-bottom: 1rem;
  }

  .participant-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 1.5rem;
  }

  .participant-tag {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 8px 15px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }

  .remove-btn {
    background: rgba(255, 255, 255, 0.3);
    color: white;
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
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1.2rem;
    font-weight: bold;
  }

  @media (max-width: 768px) {
    .input-container {
      padding: 1.5rem;
    }
  }
</style>
