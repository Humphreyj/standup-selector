<template>
  <div class="tournament-bracket">
    <div v-if="winner" class="winner-announcement">
      <h1 class="winner-title">🎉 Tournament Winner! 🎉</h1>
      <div class="winner-name">{{ getName(winner) }}</div>
      <p class="winner-text">Will lead the next standup!</p>
      <div class="winner-actions">
        <button @click="$emit('reset')" class="reset-btn">
          Start New Tournament
        </button>
      </div>
    </div>

    <div class="bracket-container" :class="{ completed: !!winner }">
      <div class="controls">
        <button
          v-if="!tournamentStarted"
          class="control-btn primary"
          @click="startTournament"
        >
          Start the Tournament
        </button>

        <button
          class="control-btn"
          :class="{ active: autoRunEnabled }"
          @click="toggleAutoRun"
        >
          {{ autoRunEnabled ? "Auto: On" : "Auto: Off" }}
        </button>

        <button
          v-if="tournamentStarted && autoRunEnabled"
          class="control-btn"
          :class="{ active: !autoRunPaused }"
          @click="togglePause"
        >
          {{ autoRunPaused ? "Resume" : "Pause" }}
        </button>

        <label class="speed">
          <span>Speed</span>
          <select v-model.number="autoRunDelayMs" class="speed-select">
            <option :value="150">Fast</option>
            <option :value="400">Normal</option>
            <option :value="900">Dramatic</option>
          </select>
        </label>
      </div>

      <div v-if="tournamentStarted" class="status">
        <span v-if="winner"
          >Tournament complete — scroll to inspect the bracket below.</span
        >
        <span
          v-else-if="
            isRollingMatch(currentMatch?.roundIndex, currentMatch?.matchIndex)
          "
        >
          Rolling…
        </span>
        <span v-else-if="currentMatch">
          Next up: {{ getRoundName(currentMatch.roundIndex) }} — Match
          {{ currentMatch.matchIndex + 1 }}
        </span>
        <span v-else> Waiting for the next matchup… </span>
      </div>

      <div
        v-for="(round, roundIndex) in rounds"
        :key="roundIndex"
        class="round"
      >
        <h3 class="round-title">{{ getRoundName(roundIndex) }}</h3>
        <div class="matches">
          <MatchCard
            v-for="(match, matchIndex) in round"
            :key="`${roundIndex}-${matchIndex}`"
            :match="match"
            :is-current="isCurrentMatch(roundIndex, matchIndex)"
            :is-rolling="isRollingMatch(roundIndex, matchIndex)"
            :disable-roll="autoRunEnabled"
            @roll="rollDice(roundIndex, matchIndex)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, onBeforeUnmount } from "vue";
import MatchCard from "./MatchCard.vue";

export default {
  name: "TournamentBracket",
  components: {
    MatchCard,
  },
  props: {
    participants: {
      type: Array,
      required: true,
    },
  },
  emits: ["reset"],
  setup(props) {
    const rounds = ref([]);
    const winner = ref(null);

    const currentMatch = ref(null); // { roundIndex, matchIndex } | null
    const rollingMatch = ref(null); // { roundIndex, matchIndex } | null

    const autoRunEnabled = ref(true);
    const autoRunPaused = ref(false);
    const autoRunDelayMs = ref(400);
    const autoRunInProgress = ref(false);
    const runToken = ref(0);

    const tournamentStarted = ref(false);

    let pendingTimeout = null;

    // Constants for bye rounds
    const BYE_WIN_ROLL = 20;
    const BYE_LOSE_ROLL = 0;

    const getName = (p) => (p && typeof p === "object" ? p.name : p);
    const getId = (p) => (p && typeof p === "object" ? p.id : p);

    // Debug logging
    // Enable in the browser console:
    //   localStorage.setItem('STANDUP_DEBUG_TOURNAMENT', '1')
    // Disable:
    //   localStorage.removeItem('STANDUP_DEBUG_TOURNAMENT')
    const isTournamentDebugEnabled = () => {
      try {
        return localStorage.getItem("STANDUP_DEBUG_TOURNAMENT") === "1";
      } catch {
        // localStorage may be unavailable in some environments
        return false;
      }
    };

    const dbg = (event, data) => {
      if (!isTournamentDebugEnabled()) return;
      const ts = new Date().toISOString();
      // Keep logs compact but structured for easy scanning.
      if (data !== undefined) {
        console.log(`[tournament ${ts}] ${event}`, data);
      } else {
        console.log(`[tournament ${ts}] ${event}`);
      }
    };

    // Run-level counters to help confirm we're actually playing all expected matches.
    const tournamentStats = ref({
      expectedRealMatches: 0, // players - 1 in single-elimination
      realMatchesRolled: 0,
      byesApplied: 0,
    });

    const describeMatch = (roundIndex, matchIndex, match) => {
      const p1 = match?.player1
        ? `${getName(match.player1)} (${getId(match.player1)})`
        : "—";
      const p2 = match?.player2
        ? `${getName(match.player2)} (${getId(match.player2)})`
        : "—";
      return {
        roundIndex,
        matchIndex,
        player1: p1,
        player2: p2,
        completed: !!match?.completed,
        roll1: match?.roll1 ?? null,
        roll2: match?.roll2 ?? null,
        winner: match?.winner
          ? `${getName(match.winner)} (${getId(match.winner)})`
          : null,
      };
    };

    const initializeBracket = () => {
      // Treat each participant as a unique entity via its id.
      // This allows duplicate names without risking "playing yourself".
      const cleaned = [];
      for (const p of props.participants) {
        if (!p) continue;
        if (typeof p === "object") {
          if (!p.id || !p.name) continue;
          cleaned.push(p);
        } else {
          const name = String(p).trim();
          if (!name) continue;
          cleaned.push({ id: name, name });
        }
      }

      // Fisher-Yates shuffle for proper randomness
      const shuffled = [...cleaned];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Create first round matches
      const firstRound = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          // Avoid self-matchups by id (shouldn't happen, but keep it bulletproof)
          let p1 = shuffled[i];
          let p2 = shuffled[i + 1];
          if (getId(p1) === getId(p2) && i + 2 < shuffled.length) {
            p2 = shuffled[i + 2];
            shuffled[i + 2] = shuffled[i + 1];
          }

          firstRound.push({
            player1: p1,
            player2: p2,
            roll1: null,
            roll2: null,
            winner: null,
            completed: false,
          });
        } else {
          // Bye for odd number of participants
          firstRound.push({
            player1: shuffled[i],
            player2: null,
            roll1: BYE_WIN_ROLL,
            roll2: BYE_LOSE_ROLL,
            winner: shuffled[i],
            completed: true,
          });
        }
      }

      rounds.value = [firstRound];

      tournamentStats.value = {
        expectedRealMatches: Math.max(0, cleaned.length - 1),
        realMatchesRolled: 0,
        byesApplied: 0,
      };

      dbg("initializeBracket:firstRound", {
        participants: cleaned.length,
        matches: firstRound.length,
        byes: firstRound.filter((m) => m.player1 && !m.player2).length,
        expectedRealMatches: tournamentStats.value.expectedRealMatches,
      });

      // Create empty subsequent rounds
      // Each round needs ceil(winners/2) matches to accommodate all winners
      // Winners from a round = number of matches in that round (each match yields one winner).
      // So the number of players advancing is firstRound.length, and next round match count is ceil(players/2).
      let numAdvancingPlayers = firstRound.length;
      while (numAdvancingPlayers > 1) {
        const numMatches = Math.ceil(numAdvancingPlayers / 2);
        const round = [];
        for (let i = 0; i < numMatches; i++) {
          round.push({
            player1: null,
            player2: null,
            roll1: null,
            roll2: null,
            winner: null,
            completed: false,
          });
        }
        rounds.value.push(round);
        // Each match produces exactly one winner; that becomes the number of advancing players.
        numAdvancingPlayers = numMatches;
      }

      dbg("initializeBracket:rounds", {
        totalRounds: rounds.value.length,
        matchesPerRound: rounds.value.map((r) => r.length),
      });
    };

    const rollD20 = () => {
      return Math.floor(Math.random() * 20) + 1;
    };

    const rollDice = (roundIndex, matchIndex) => {
      const match = rounds.value[roundIndex][matchIndex];

      if (match.completed || !match.player1 || !match.player2) return;

      dbg("roll:start", describeMatch(roundIndex, matchIndex, match));

      // If a match ever ends up being the same participant (by id), auto-advance.
      // This should be impossible with unique ids, but it keeps us safe.
      if (getId(match.player1) === getId(match.player2)) {
        match.roll1 = BYE_WIN_ROLL;
        match.roll2 = BYE_LOSE_ROLL;
        match.winner = match.player1;
        match.completed = true;

        dbg(
          "roll:selfMatchAutoAdvance",
          describeMatch(roundIndex, matchIndex, match)
        );

        advanceWinner(roundIndex, matchIndex, match.winner);
        return;
      }

      // Roll dice
      match.roll1 = rollD20();
      match.roll2 = rollD20();

      // Handle ties
      // (A tie is totally possible on d20; we re-roll until it's not.)
      // Add a hard cap just in case RNG is overridden in some environment.
      let tieGuard = 0;
      while (match.roll1 === match.roll2) {
        match.roll1 = rollD20();
        match.roll2 = rollD20();
        tieGuard++;
        if (tieGuard > 100) break;
      }

      if (tieGuard > 0) {
        dbg("roll:tieReroll", {
          roundIndex,
          matchIndex,
          rerolls: tieGuard,
        });
      }

      // Determine winner
      match.winner = match.roll1 > match.roll2 ? match.player1 : match.player2;
      match.completed = true;

      tournamentStats.value.realMatchesRolled++;

      dbg("roll:complete", describeMatch(roundIndex, matchIndex, match));

      // Advance winner to next round
      advanceWinner(roundIndex, matchIndex, match.winner);
    };

    const isSameMatch = (a, roundIndex, matchIndex) => {
      return !!a && a.roundIndex === roundIndex && a.matchIndex === matchIndex;
    };

    const isCurrentMatch = (roundIndex, matchIndex) =>
      isSameMatch(currentMatch.value, roundIndex, matchIndex);
    const isRollingMatch = (roundIndex, matchIndex) =>
      isSameMatch(rollingMatch.value, roundIndex, matchIndex);

    const sleep = (ms) =>
      new Promise((resolve) => {
        pendingTimeout = setTimeout(resolve, ms);
      });

    const clearPendingSleep = () => {
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
    };

    const findNextRunnableMatch = () => {
      for (let r = 0; r < rounds.value.length; r++) {
        for (let m = 0; m < rounds.value[r].length; m++) {
          const match = rounds.value[r][m];
          if (!match.completed && match.player1 && match.player2) {
            return { roundIndex: r, matchIndex: m };
          }
        }
      }
      return null;
    };

    const findNextBye = () => {
      // IMPORTANT:
      // Byes are only valid in the *first* round (created during initialization when the
      // participant count is odd). In later rounds, an "incomplete" match (one player
      // present, one missing) usually means we're still waiting for the opponent to
      // arrive from another unfinished match in the previous round.
      //
      // Auto-advancing these later-round incomplete matches causes premature winners
      // (e.g., an 8-person bracket finishing after a single roll).
      const r = 0;
      if (!rounds.value[r]) return null;
      for (let m = 0; m < rounds.value[r].length; m++) {
        const match = rounds.value[r][m];
        if (match.completed) continue;
        const hasP1 = !!match.player1;
        const hasP2 = !!match.player2;
        if ((hasP1 && !hasP2) || (!hasP1 && hasP2)) {
          return { roundIndex: r, matchIndex: m };
        }
      }
      return null;
    };

    const applyBye = (roundIndex, matchIndex) => {
      const match = rounds.value[roundIndex][matchIndex];
      if (!match || match.completed) return;

      dbg("bye:apply", describeMatch(roundIndex, matchIndex, match));

      const hasP1 = !!match.player1;
      const hasP2 = !!match.player2;
      if (hasP1 && !hasP2) {
        tournamentStats.value.byesApplied++;
        match.roll1 = BYE_WIN_ROLL;
        match.roll2 = BYE_LOSE_ROLL;
        match.winner = match.player1;
        match.completed = true;

        dbg("bye:complete", describeMatch(roundIndex, matchIndex, match));

        advanceWinner(roundIndex, matchIndex, match.winner);
      } else if (!hasP1 && hasP2) {
        tournamentStats.value.byesApplied++;
        match.roll1 = BYE_LOSE_ROLL;
        match.roll2 = BYE_WIN_ROLL;
        match.winner = match.player2;
        match.completed = true;

        dbg("bye:complete", describeMatch(roundIndex, matchIndex, match));

        advanceWinner(roundIndex, matchIndex, match.winner);
      }
    };

    const runTournamentAutomatically = async () => {
      if (autoRunInProgress.value) return;
      if (!tournamentStarted.value) return;
      if (!autoRunEnabled.value || autoRunPaused.value || winner.value) return;

      autoRunInProgress.value = true;
      const myToken = ++runToken.value;

      dbg("autorun:start", {
        token: myToken,
        delayMs: autoRunDelayMs.value,
      });

      try {
        // Keep rolling until a winner is decided or the run is cancelled/paused.
        while (
          myToken === runToken.value &&
          autoRunEnabled.value &&
          !autoRunPaused.value &&
          !winner.value
        ) {
          // Handle byes, but only one per tick so the speed setting still matters.
          const bye = findNextBye();
          if (bye) {
            dbg("autorun:nextBye", bye);
            currentMatch.value = bye;
            rollingMatch.value = bye;
            await sleep(200);
            if (myToken !== runToken.value) break;

            applyBye(bye.roundIndex, bye.matchIndex);
            rollingMatch.value = null;
            await sleep(autoRunDelayMs.value);
            continue;
          }

          const next = findNextRunnableMatch();
          if (!next) {
            // No match is currently runnable. This can happen briefly while the bracket fills.
            // Yield and try again.
            currentMatch.value = null;
            rollingMatch.value = null;
            await sleep(50);
            continue;
          }

          dbg("autorun:nextMatch", next);

          currentMatch.value = next;
          rollingMatch.value = next;
          // Pre-roll anticipation scales with speed so it doesn't feel disconnected.
          await sleep(Math.max(120, Math.floor(autoRunDelayMs.value * 0.6)));
          if (myToken !== runToken.value) break;

          rollDice(next.roundIndex, next.matchIndex);
          rollingMatch.value = null;
          await sleep(autoRunDelayMs.value);
        }
      } finally {
        if (myToken === runToken.value) {
          autoRunInProgress.value = false;
          currentMatch.value = null;
          rollingMatch.value = null;
        }

        dbg("autorun:stop", {
          token: myToken,
          winner: winner.value
            ? `${getName(winner.value)} (${getId(winner.value)})`
            : null,
          enabled: autoRunEnabled.value,
          paused: autoRunPaused.value,
        });
      }
    };

    const advanceWinner = (roundIndex, matchIndex, winnerName) => {
      const nextRoundIndex = roundIndex + 1;

      if (nextRoundIndex >= rounds.value.length) {
        // Tournament complete: only set winner when a match in the final round completes.
        // (Defensive: prevents any accidental early completion if round structure changes.)
        if (roundIndex === rounds.value.length - 1) {
          winner.value = winnerName;
          dbg("tournament:winner", {
            winner: `${getName(winnerName)} (${getId(winnerName)})`,
            finalRoundIndex: roundIndex,
            finalMatchIndex: matchIndex,
            stats: { ...tournamentStats.value },
          });

          if (
            tournamentStats.value.realMatchesRolled <
            tournamentStats.value.expectedRealMatches
          ) {
            dbg("tournament:warning_incompleteRun", {
              message:
                "Winner decided before all expected real matches were rolled. This usually means byes are advancing through later rounds, or the bracket was filled unevenly.",
              stats: { ...tournamentStats.value },
            });
          }
        }
        return;
      }

      const nextMatchIndex = Math.floor(matchIndex / 2);
      const nextMatch = rounds.value[nextRoundIndex][nextMatchIndex];

      if (matchIndex % 2 === 0) {
        nextMatch.player1 = winnerName;
      } else {
        nextMatch.player2 = winnerName;
      }

      dbg("advanceWinner", {
        from: { roundIndex, matchIndex },
        to: { roundIndex: nextRoundIndex, matchIndex: nextMatchIndex },
        slot: matchIndex % 2 === 0 ? "player1" : "player2",
        winner: `${getName(winnerName)} (${getId(winnerName)})`,
      });

      // If auto-run is enabled, keep the runner progressing as soon as new players arrive.
      // Use a macrotask so we don't create a microtask avalanche that ignores delays.
      setTimeout(() => runTournamentAutomatically(), 0);
    };

    const toggleAutoRun = () => {
      autoRunEnabled.value = !autoRunEnabled.value;
      if (autoRunEnabled.value) {
        autoRunPaused.value = false;
        runTournamentAutomatically();
      } else {
        autoRunPaused.value = true;
        runToken.value++;
        autoRunInProgress.value = false;
        currentMatch.value = null;
        rollingMatch.value = null;
        clearPendingSleep();
      }
    };

    const togglePause = () => {
      autoRunPaused.value = !autoRunPaused.value;
      if (!autoRunPaused.value) {
        runTournamentAutomatically();
      } else {
        runToken.value++;
        autoRunInProgress.value = false;
        currentMatch.value = null;
        rollingMatch.value = null;
        clearPendingSleep();
      }
    };

    const getRoundName = (index) => {
      const totalRounds = rounds.value.length;
      const fromEnd = totalRounds - index - 1;

      if (fromEnd === 0) return "Final";
      if (fromEnd === 1) return "Semi-Finals";
      if (fromEnd === 2) return "Quarter-Finals";
      return `Round ${index + 1}`;
    };

    onMounted(() => {
      initializeBracket();
    });

    const startTournament = () => {
      tournamentStarted.value = true;

      dbg("tournament:start", {
        participants: props.participants?.length ?? 0,
        rounds: rounds.value.length,
        expectedRealMatches: tournamentStats.value.expectedRealMatches,
      });

      if (autoRunEnabled.value) {
        autoRunPaused.value = false;
        runTournamentAutomatically();
      }
    };

    watch(autoRunDelayMs, () => {
      // If user changes speed while running, just let the loop pick up the new delay.
    });

    onBeforeUnmount(() => {
      runToken.value++;
      currentMatch.value = null;
      rollingMatch.value = null;
      clearPendingSleep();
    });

    return {
      rounds,
      winner,
      rollDice,
      getRoundName,
      getName,
      autoRunEnabled,
      autoRunPaused,
      autoRunDelayMs,
      toggleAutoRun,
      togglePause,
      isCurrentMatch,
      isRollingMatch,
      currentMatch,
      rollingMatch,
      tournamentStarted,
      startTournament,
    };
  },
};
</script>

<style scoped>
.tournament-bracket {
  padding: 2rem 0;
}

.winner-announcement {
  background: linear-gradient(
    180deg,
    var(--parchment) 0%,
    var(--parchment-2) 100%
  );
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
  box-shadow: 0 14px 50px var(--shadow);
  max-width: 600px;
  margin: 0 auto;
  border: 1px solid rgba(212, 175, 55, 0.35);
}

.winner-title {
  color: var(--burgundy);
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.winner-name {
  font-size: 3rem;
  font-weight: bold;
  color: var(--ink);
  margin: 1rem 0;
}

.winner-text {
  font-size: 1.5rem;
  color: rgba(36, 23, 18, 0.7);
  margin-bottom: 2rem;
}

.reset-btn {
  padding: 15px 40px;
  background: linear-gradient(135deg, var(--gold) 0%, var(--gold-2) 100%);
  color: var(--ink);
  border: none;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: bold;
}

.bracket-container {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  overflow-x: auto;
  padding: 2rem;
  justify-content: center;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.control-btn {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-weight: 700;
}

.control-btn.primary {
  background: rgba(255, 255, 255, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.control-btn.active {
  background: rgba(255, 255, 255, 0.3);
}

.speed {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  color: white;
  font-weight: 700;
}

.speed-select {
  border-radius: 10px;
  padding: 8px 10px;
  border: none;
}

.status {
  margin-top: -1rem;
  text-align: center;
  color: rgba(243, 231, 198, 0.85);
  font-weight: 700;
  letter-spacing: 0.3px;
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
