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
3. **Roll Dice**: Click "Roll Dice!" for each match to determine the winner
4. **Crown the Champion**: The final winner will lead the next standup!

## Technology Stack

- **Vue 3** - Progressive JavaScript framework
- **Vite** - Next-generation frontend tooling
- **JavaScript** - ES6+ features
- **CSS3** - Modern styling with gradients and animations
