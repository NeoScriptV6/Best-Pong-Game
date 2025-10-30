import { buildMenu, toggleMenu, initMenuSocket } from './menu.js';
import { io } from 'https://cdn.socket.io/4.7.4/socket.io.esm.min.js';
import { initMultiplayerGame } from './multiplayer.js';
import { requestPlayerName } from './playerNames.js';

const socket = io();
const root = document.getElementById('root');



let countdownActive = false;
function createCountdownOverlay() {
  if (document.getElementById('countdown-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'countdown-overlay';
  ov.className = 'countdown-overlay';
  ov.style.display = 'none';
  ov.innerHTML = `<div class="countdown-box"><div id="countdown-number">3</div><div class="countdown-small">Get Ready</div></div>`;
  document.body.appendChild(ov);
}

function startCountdown(seconds = 3, onComplete) {
  createCountdownOverlay();
  const ov = document.getElementById('countdown-overlay');
  const num = document.getElementById('countdown-number');
  ov.style.display = 'flex';
  countdownActive = true;

  let cur = seconds;
  num.textContent = String(cur);

  const t = setInterval(() => {
    cur -= 1;
    if (cur > 0) {
      num.textContent = String(cur);
      const box = ov.querySelector('.countdown-box');
      box.style.animation = 'none';
      void box.offsetWidth;
      box.style.animation = 'pop 0.7s cubic-bezier(.2,.8,.2,1)';
    } else {
      clearInterval(t);
      setTimeout(() => {
        ov.style.display = 'none';
        countdownActive = false;
        if (typeof onComplete === 'function') onComplete();
      }, 250);
    }
  }, 1000);
}

let isHost = false;

if (socket) {

    initMenuSocket(socket);

    socket.on('player-info', (player) => {
        isHost = player.type === 'host';
        // Remove any existing lobby/menu before adding a new one
        const oldLobby = document.getElementById('lobby');
        if (oldLobby) oldLobby.remove();

        const lobby = buildMenu(player.type);
        root.appendChild(lobby);
        const nameSlot = lobby.querySelector('#name-input-slot') || lobby;
        requestPlayerName(socket, null, nameSlot);
    });

    socket.on('game-start', (data) => {
        startCountdown(3, () => {
            if (isHost) {
                socket.emit('countdown-finished');
            }
            initMultiplayerGame(data, socket);
        });
    });

    socket.on('restart-game', () => {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) pauseMenu.classList.remove('active');
        window.paused = false;

        startCountdown(3, () => {
            if (isHost) {
                socket.emit('countdown-finished');
            }
        });
    });

    socket.on('disconnect', () => {
        document.body.innerHTML = `<h1>You were disconnected from the server: The lobby is full, or server down.</h1>`;
        document.body.style.color = "white";
    });
}

