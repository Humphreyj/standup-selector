# Standup Selector Tournament 🏆

A Vue 3 application that uses tournament brackets to determine who will lead the next standup! Participants compete in head-to-head matches using d20 dice rolls, and the winner advances through the bracket until a champion is crowned.

## Features

- 🎮 **Tournament Bracket System** - Automatically generates brackets based on the number of participants
- 🎲 **D20 Dice Rolls** - Each match is decided by rolling a 20-sided die
- 👥 **Dynamic Participant Management** - Add or remove participants before starting
- 🏆 **Winner Announcement** - Celebrate the tournament champion who will lead standup
- 📱 **Responsive Design** - Works on desktop and mobile devices
- ✨ **Modern UI** - Beautiful gradient design with smooth animations

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

Visit `http://localhost:5173` to view the application.

### Build

```bash
# Build for production
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
# Preview production build locally
npm run preview
```

## How to Use

1. **Add Participants**: Enter team member names one by one
2. **Start Tournament**: Click "Start Tournament" when ready (minimum 2 participants)
3. **Start the Bracket**: On the bracket screen, click **Start the Tournament**
4. **Watch it Play**: The app will automatically roll each match and advance winners
5. **Optional Controls**: Use **Auto On/Off**, **Pause/Resume**, and **Speed** to set the vibe
6. **Crown the Champion**: The final winner will lead the next standup!

## Project notes / plan (Jan 2026)

This repo started as a quick “vibe coded” app; this section is our running context so we don’t lose decisions.

### Current behavior (intended)

- Bracket is generated once at mount with a shuffled participant list.
- Byes are handled by auto-advancing the odd participant in round 1.
- Tournament is **automatic** once started:
  - Click **Start the Tournament** to begin.
  - The app highlights the current match and briefly shows a “rolling…” state.
  - Rolls proceed sequentially until a winner is determined.
- Controls:
  - **Auto On/Off**: when Off, you can manually click “Roll Dice!” on matches.
  - **Pause/Resume**: pauses the auto-runner mid-tournament.
  - **Speed**: controls delay between rolls.

### Theme direction

“Classic DnD” palette:

- Background: deep tavern shadows
- Surfaces: parchment cards
- Accents: burgundy + gold
- Success: emerald

Implementation note: the palette is driven by CSS variables in `src/style.css`.

### Next nice-to-haves

- Add sound toggle (dice clack / victory sting).
- Add a “Share winner” button (copy to clipboard).
- Add names import (paste a newline-separated list).
- Add a seeded RNG option for “replayable” tournaments.

## Technology Stack

- **Vue 3** - Progressive JavaScript framework
- **Vite** - Next-generation frontend tooling
- **JavaScript** - ES6+ features
- **CSS3** - Modern styling with gradients and animations
