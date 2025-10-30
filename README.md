# Multiplayer Pong Game

A real-time multiplayer Pong game that supports up to 4 players with customizable game modes and powerups.

## Features

- **Real-time multiplayer** for up to 4 players
- **Three game modes**:
  - Classic (30 seconds time limit)
  - Deathmatch (unlimited time)
  - Score to Win (100 seconds time limit)
- **Dynamic powerups system** with 7 different types:
  - +5 Score: Instantly adds 5 points
  - Slow: Reduces ball speed for 4 seconds
  - Big Paddle: Increases paddle size for 4 seconds
  - Small Ball: Shrinks the ball for 4 seconds
  - 2x Points: Doubles points earned for 4 seconds
  - Extra Life: Prevents game over once
  - Reverse Controls: Reverses other players' controls for 4 seconds
- **Lobby system** with player join/quit functionality
- **Custom player names**
- **Pause system** with in-game menu
- **Responsive visual design** with animations and effects

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup

1. Clone the repository:
   ```
   git clone https://gitea.kood.tech/rannellillinurm/web-game
   cd web-game
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

### External Access (Multiplayer)

The game automatically sets up an ngrok tunnel for external access when available. The ngrok URL will be displayed in the console when the server starts.

## How to Play

### Controls

- **Left/Right Paddles (Vertical)**:
  - W: Move up
  - S: Move down

- **Top/Bottom Paddles (Horizontal)**:
  - A: Move left
  - D: Move right

- **Other Controls**:
  - ESC: Pause game

### Gameplay

1. Players join the lobby and set their names
2. The host selects a game mode and toggles powerups
3. The host starts the game
4. Players control their paddles to hit the ball
5. Score points when other players miss the ball
6. Collect powerups for advantages
7. The winner is determined based on the selected game mode

## Game Modes

- **Classic**: 30-second time limit. Every miss is a point for the enemy.
- **Deathmatch**: Players have unlimited lives. Score as many points as possible in unlimited time.
- **Score to Win**: First player to reach high score within 100 seconds wins.

## Powerup System

The host can enable/disable powerups and choose which ones are active. When enabled, powerups randomly appear during gameplay:

| Powerup | Effect |
|---------|--------|
| +5 Score | Instantly adds 5 points to your score |
| Slow Ball | Slows the ball for 4 seconds (affects all players) |
| Big Paddle | Increases your paddle size for 4 seconds |
| Small Ball | Shrinks the ball for 4 seconds (affects all players) |
| 2x Points | Doubles points earned from hits for 4 seconds |
| Extra Life | Gives one extra life (prevents game over once) |
| Reverse | Reverses other players' controls for 4 seconds |

## Multiplayer Features

- **Player slots**: Up to 4 players (host, player2, player3, player4)
- **Custom names**: Players can set custom names
- **Rejoining**: Players can quit and rejoin the game
- **Real-time updates**: Game state is synchronized across all players

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.IO
- **External Access**: ngrok

## Development

### Project Structure

- `server.js`: Main server file with game logic
- `public/`: Client-side files
  - `index.html`: Main HTML file
  - `index.js`: Client entry point
  - `multiplayer.js`: Multiplayer game logic
  - `menu.js`: Menu and lobby system
  - `powerups.js`: Powerup logic
  - `style.css`: Game styling

### Running in Development Mode

```
npm run dev
```

### Common Issues and Fixes

- **Paddle movement too fast after rejoining**: 
  - Make sure to remove old event listeners before adding new ones
  - Reset the animation frame ID when starting a new game loop

- **Game continues running when all players leave**:
  - The server now correctly pauses the game when all players quit
  - Game state is properly reset when players rejoin

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Socket.IO for real-time communication
- ngrok for external tunneling