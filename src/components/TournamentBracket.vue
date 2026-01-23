<template>
  <div class="tournament-bracket">
    <div v-if="winner" ref="winnerEl" class="winner-announcement">
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
        :ref="(el) => setRoundEl(el, roundIndex)"
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
import { ref, onMounted, watch, onBeforeUnmount, nextTick } from "vue";
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

    // Scrolling targets
    const winnerEl = ref(null);
    const roundEls = ref([]);
    const lastScrolledRoundIndex = ref(null);
    const suppressAutoScrollUntilTs = ref(0);

    const currentMatch = ref(null); // { roundIndex, matchIndex } | null
    const rollingMatch = ref(null); // { roundIndex, matchIndex } | null

    const autoRunEnabled = ref(true);
    const autoRunPaused = ref(false);
    const autoRunDelayMs = ref(400);
    const autoRunInProgress = ref(false);
    const runToken = ref(0);

    const tournamentStarted = ref(false);

    let pendingTimeout = null;

    const setRoundEl = (el, idx) => {
      // Vue will also call this with null during updates/unmounts.
      if (!el) return;
      roundEls.value[idx] = el;
    };

    const markUserScrollActivity = () => {
      // If the user scrolls, don't fight them for a short window.
      suppressAutoScrollUntilTs.value = Date.now() + 1200;
    };

    const shouldAutoScrollNow = () =>
      Date.now() >= suppressAutoScrollUntilTs.value;

    const safeScrollIntoView = (el, block = "center") => {
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: "smooth", block, inline: "nearest" });
      } catch {
        el.scrollIntoView();
      }
    };

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

    // Optional special-case for odd player counts:
    // instead of a bye, we do a "preliminary" match where the odd player
    // faces the winner of Match 0.
    // This guarantees we never end up with a later-round half-filled match that
    // can stall the bracket.
    const prelim = ref({
      enabled: true,
      oddPlayer: null,
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

      dbg("initializeBracket:cleanedParticipants", {
        count: cleaned.length,
        participants: cleaned.map((p) => ({ id: getId(p), name: getName(p) })),
      });

      // If odd number of players, pull one out as the "odd player" to be used in
      // a preliminary match against the winner of Match 0.
      // (This is the behavior you requested: "first matchup winner fights the odd player".)
      const shuffledForRound1 = [...shuffled];
      if (prelim.value.enabled && shuffledForRound1.length % 2 === 1) {
        prelim.value.oddPlayer = shuffledForRound1.pop();
        dbg("initializeBracket:prelimEnabled", {
          oddPlayer: {
            id: getId(prelim.value.oddPlayer),
            name: getName(prelim.value.oddPlayer),
          },
        });
      } else {
        prelim.value.oddPlayer = null;
      }

      // Create first round matches (always even count now)
      const firstRound = [];
      for (let i = 0; i < shuffledForRound1.length; i += 2) {
        // Avoid self-matchups by id (shouldn't happen, but keep it bulletproof)
        let p1 = shuffledForRound1[i];
        let p2 = shuffledForRound1[i + 1];
        if (getId(p1) === getId(p2) && i + 2 < shuffledForRound1.length) {
          p2 = shuffledForRound1[i + 2];
          shuffledForRound1[i + 2] = shuffledForRound1[i + 1];
        }

        firstRound.push({
          player1: p1,
          player2: p2,
          roll1: null,
          roll2: null,
          winner: null,
          completed: false,
        });
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

      dbg("initializeBracket:firstRoundMatchups", {
        matchups: firstRound.map((m, i) => ({
          matchIndex: i,
          player1: m.player1
            ? { id: getId(m.player1), name: getName(m.player1) }
            : null,
          player2: m.player2
            ? { id: getId(m.player2), name: getName(m.player2) }
            : null,
          completed: !!m.completed,
        })),
      });

      // Create empty subsequent rounds.
      // Important invariant:
      // - For a normal even-size field (no prelim), each round has exactly half as many matches.
      // - For the odd-size "prelim" scheme, Round 2 has one extra match slot to host
      //   (winner of match0) vs (odd player). That makes the number of *winners coming out
      //   of Round 1* effectively: firstRound.length + 1.
      //   From there onward, match counts are ceil(advancing/2).

      let advancingWinners = firstRound.length;
      if (prelim.value.enabled && prelim.value.oddPlayer) {
        advancingWinners += 1;
      }

      while (advancingWinners > 1) {
        const numMatches = Math.ceil(advancingWinners / 2);
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
        advancingWinners = numMatches;
      }

      dbg("initializeBracket:rounds", {
        totalRounds: rounds.value.length,
        matchesPerRound: rounds.value.map((r) => r.length),
      });
    };

    const maybeSchedulePrelimMatch = () => {
      // If no prelim odd player, nothing to do.
      if (!prelim.value.oddPlayer) return;
      if (!rounds.value[0] || !rounds.value[0][0]) return;

      const match0 = rounds.value[0][0];
      if (!match0.completed || !match0.winner) return;

      // We attach the prelim match into round 1, match 0, slot player2.
      // Slot player1 is already winner of match0 (from normal advanceWinner).
      const r1 = rounds.value[1];
      if (!r1 || !r1[0]) return;
      const target = r1[0];

      // Only fill if it's empty (don't overwrite if something else is there).
      if (!target.player2) {
        target.player2 = prelim.value.oddPlayer;
        // Consume it so we don't keep trying to schedule over and over.
        prelim.value.oddPlayer = null;
        dbg("prelim:scheduled", {
          roundIndex: 1,
          matchIndex: 0,
          oddPlayer: target.player2
            ? `${getName(target.player2)} (${getId(target.player2)})`
            : null,
          against: target.player1
            ? `${getName(target.player1)} (${getId(target.player1)})`
            : null,
        });
      }
    };

    const autoAdvanceIfSinglePlayer = (roundIndex, matchIndex) => {
      const match = rounds.value?.[roundIndex]?.[matchIndex];
      if (!match || match.completed) return false;

      const hasP1 = !!match.player1;
      const hasP2 = !!match.player2;
      if (hasP1 === hasP2) return false; // both present (real match) or both missing

      const adv = match.player1 || match.player2;
      match.winner = adv;
      match.completed = true;
      dbg(
        "autoAdvance:singlePlayer",
        describeMatch(roundIndex, matchIndex, match)
      );
      advanceWinner(roundIndex, matchIndex, adv);
      return true;
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
        match.roll1 = 20;
        match.roll2 = 1;
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
          const next = findNextRunnableMatch();
          if (!next) {
            // If we're stalled, try to resolve any single-player matches (byes / half-filled)
            // so the bracket can continue. This is a safe fallback and also covers edge cases
            // where a round was sized with an extra slot (prelim scheme).
            let advanced = false;
            for (let r = 0; r < rounds.value.length && !advanced; r++) {
              for (let m = 0; m < rounds.value[r].length && !advanced; m++) {
                advanced = autoAdvanceIfSinglePlayer(r, m);
              }
            }

            if (advanced) {
              await sleep(0);
              continue;
            }

            // Nothing is runnable yet; we're waiting for bracket slots to fill.
            const firstIncompleteRound = rounds.value.findIndex((round) =>
              round.some((m) => !m.completed)
            );
            if (firstIncompleteRound >= 0) {
              dbg("autorun:waiting", {
                firstIncompleteRound,
              });
            }
            currentMatch.value = null;
            rollingMatch.value = null;
            await sleep(50);
            continue;
          }

          dbg("autorun:nextMatch", next);

          currentMatch.value = next;
          rollingMatch.value = next;
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

      // If we're using the prelim scheme, drop the odd player into round 1 match 0
      // as soon as match 0 has a winner.
      maybeSchedulePrelimMatch();

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

      // Detect user scroll so we don't yank the page while they're inspecting.
      window.addEventListener("wheel", markUserScrollActivity, {
        passive: true,
      });
      window.addEventListener("touchmove", markUserScrollActivity, {
        passive: true,
      });
    });

    // Auto-scroll to the round currently in progress.
    watch(
      currentMatch,
      async (cm) => {
        if (!cm) return;
        if (!tournamentStarted.value) return;
        if (!shouldAutoScrollNow()) return;
        if (lastScrolledRoundIndex.value === cm.roundIndex) return;

        lastScrolledRoundIndex.value = cm.roundIndex;
        await nextTick();
        const el = roundEls.value?.[cm.roundIndex];
        safeScrollIntoView(el, "center");
      },
      { deep: true }
    );

    // Auto-scroll to the winner banner when a winner is declared.
    watch(winner, async (w) => {
      if (!w) return;
      await nextTick();
      safeScrollIntoView(winnerEl.value, "start");
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

      window.removeEventListener("wheel", markUserScrollActivity);
      window.removeEventListener("touchmove", markUserScrollActivity);
    });

    return {
      rounds,
      winner,
      rollDice,
      getRoundName,
      getName,
      winnerEl,
      setRoundEl,
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
  gap: 2.25rem;
  overflow-x: hidden;
  padding: 2rem;
  justify-content: center;
  align-items: center;
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
  width: 100%;
  max-width: 1200px;
}

/* Inverted pyramid: later rounds get progressively narrower and stay centered */
.round:nth-child(3) {
  max-width: 1100px;
}

.round:nth-child(4) {
  max-width: 900px;
}

.round:nth-child(5) {
  max-width: 740px;
}

.round:nth-child(6) {
  max-width: 600px;
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
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

@media (max-width: 768px) {
  .matches {
    grid-template-columns: repeat(auto-fill, 184px);
    gap: 0.85rem;
  }
}

@media (max-width: 768px) {
  .bracket-container {
    padding: 1rem;
    gap: 1.75rem;
  }

  .round {
    max-width: 100%;
  }

  .winner-title {
    font-size: 2rem;
  }

  .winner-name {
    font-size: 2rem;
  }
}
</style>
