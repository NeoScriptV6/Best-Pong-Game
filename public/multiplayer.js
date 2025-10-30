const GAME_WIDTH = 600; 
const GAME_HEIGHT = 600; 
const PADDLE_WIDTH = 10; 
const BASE_BALL_SIZE = 10;
let paddles = {};
let ball = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 50, vx: 0.5, vy: 0.5, size: BASE_BALL_SIZE, };
let balls = [{ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 50, vx: 0.5, vy: 0.5, size: BASE_BALL_SIZE }];
let ballHistories = {};
let powerups = [];
let reverseControl = false;
let powerupsDrawn = false;
const ballHistory = [];
const INTERP_DELAY_MS = 100;
const keyState = {
    up: false,
    down: false,
    left: false,
    right: false
};

const controls = {
    host: { up: 'w', down: 's' },
    player2: { up: 'w', down: 's' },
    player3: { left: 'a', right: 'd' },
    player4: { left: 'a', right: 'd' }
};

const gameElement = document.getElementById('game');

let bounceAudio = null;
function playBounce() {
    if (!bounceAudio) {
        try { bounceAudio = new Audio('bounce.wav'); } catch(e){ return; }
    }
    try {
        if (bounceAudio.paused) {
            bounceAudio.currentTime = 0;
            bounceAudio.play().catch(()=>{});
        } else {
            const clone = bounceAudio.cloneNode();
            clone.play().catch(()=>{});
        }
    } catch(e){ }
}

let winnerSound = null;
function playWinnerSound() {
    if (!winnerSound) {
        try { winnerSound = new Audio('winnerGameSound.mp3'); } catch(e){ return; }
    }
    try {
        winnerSound.currentTime = 0;
        winnerSound.play().catch(()=>{});
    } catch(e) { }
}

const scoreBoard = document.createElement('div');
scoreBoard.id = 'score-board';
scoreBoard.style.position = 'absolute';
scoreBoard.style.top = '8px';
scoreBoard.style.left = '50%';
scoreBoard.style.transform = 'translateX(-50%)';
scoreBoard.style.background = 'rgba(0,0,0,0.6)';
scoreBoard.style.color = 'white';
scoreBoard.style.padding = '6px 12px';
scoreBoard.style.borderRadius = '8px';
scoreBoard.style.fontSize = '14px';
scoreBoard.style.zIndex = '1000';
document.body.appendChild(scoreBoard);

const timerDisplay = document.createElement('div');
timerDisplay.id = 'game-timer';
timerDisplay.style.position = 'absolute';
timerDisplay.style.top = '40px';
timerDisplay.style.left = '50%';
timerDisplay.style.transform = 'translateX(-50%)';
timerDisplay.style.background = 'rgba(0,0,0,0.7)';
timerDisplay.style.color = '#FFD700';
timerDisplay.style.fontSize = '28px';
timerDisplay.style.padding = '8px 24px';
timerDisplay.style.borderRadius = '10px';
timerDisplay.style.zIndex = '1001';
timerDisplay.style.display = 'none';
document.body.appendChild(timerDisplay);

let currentMode = 0; // 0=classic, 1=deathmatch, 2=timed
let latestLives = null;
let latestScores = null;
function getDefaultLives() {
    const lives = {};
    for (const id in paddles) {
        lives[id] = 5;
    }
    return lives;
}
function renderScoresOrLives() {
    const parts = [];
    const isDeathmatch = currentMode === 1;
    if (isDeathmatch) {
        const livesData = latestLives || getDefaultLives();
        for (const id in livesData) {
            const p = paddles[id];
            if (!p) continue;
            const lives = livesData[id];
            const hearts = lives > 0 ? '❤️'.repeat(lives) : '<span style="color:#888">☠️</span>';
            parts.push(`<span style="color:${p.color};margin-right:14px;font-weight:600">${p.type}: <span style='color:#FFD700;font-size:18px;letter-spacing:1px'>${hearts}</span></span>`);
        }
    } else {
        const scoresData = latestScores || {};
        for (const id in scoresData) {
            const p = paddles[id];
            if (!p) continue;
            parts.push(`<span style="color:${p.color};margin-right:10px">${p.type}: ${scoresData[id]}</span>`);
        }
    }
    scoreBoard.innerHTML = parts.length ? parts.join('') : '';
}

let keydownHandler = null;
let keyupHandler = null;
let pauseListenerAdded = false;
let paddleListenersAdded = false;
let paused = false;
let gameInitialized = false;
let animationFrameId = null;

export function initMultiplayerGame(data, sock) {
    gameInitialized = false; 
    setupGame(data.players);
    renderScoresOrLives();

    sock.on('update-players', (players) => {
        setupGame(players);
        renderScoresOrLives();
    });

    if (keydownHandler) {
        window.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
    }
    if (keyupHandler) {
        window.removeEventListener('keyup', keyupHandler);
        keyupHandler = null;
    }
    paddleListenersAdded = false;

    if (!paddleListenersAdded) {
        keydownHandler = (event) => {
            const playerId = sock.id;
            const type = paddles[playerId]?.type;
            const control = controls[type] || {};
            if (!type) return;
            if (!bounceAudio) {
                try { bounceAudio = new Audio('bounce.wav'); } catch(e){}
            }
            const keyPressed = event.key.toLowerCase();
            if (keyPressed=== control.up) keyState.up = true;
            if (keyPressed === control.down) keyState.down = true;
            if (keyPressed === control.left) keyState.left = true;
            if (keyPressed === control.right) keyState.right = true;
        };
        keyupHandler = (event) => {
            const playerId = sock.id;
            const type = paddles[playerId]?.type;
            const control = controls[type] || {};
            if (!type) return;
            const keyPressed = event.key.toLowerCase();

            if (keyPressed === control.up) keyState.up = false;
            if (keyPressed === control.down) keyState.down = false;
            if (keyPressed === control.left) keyState.left = false;
            if (keyPressed === control.right) keyState.right = false;
        };
        window.addEventListener('keydown', keydownHandler);
        window.addEventListener('keyup', keyupHandler);
        paddleListenersAdded = true;
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    sock.off('timer-tick');
    sock.off('timer-update');
    sock.off('game-paused');
    sock.off('player-action');
    sock.off('quit-confirmed');
    sock.on('force-reload', ()=>{
        window.location.reload();
    })
    sock.on('mode-selected', (mode) => {
        currentMode = mode;
        renderScoresOrLives();
    });



    sock.on('game-start', (
        { mode }) => {
        currentMode = mode;
        renderScoresOrLives();
    });

    startGame(sock);

    sock.on('lives-update', ({ lives }) => {
        latestLives = lives;
        renderScoresOrLives();
    });

    sock.on('score-update', (scores) => {
        latestScores = scores;
        renderScoresOrLives();
    });

    sock.on('timer-tick', ({ time, direction, running }) => {
        if (!running) {
            timerDisplay.style.display = 'none';
            return;
        }
        timerDisplay.style.display = 'block';
        timerDisplay.textContent = direction === 'down'
            ? `Time Left: ${time}s`
            : `Time: ${time}s`;
    });

    sock.on('timer-update', ({ running }) => {
        timerDisplay.style.display = running ? 'block' : 'none';
    });

    function showPauseMenu() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) pauseMenu.classList.add('active');
    }
    function hidePauseMenu() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) pauseMenu.classList.remove('active');
    }
    function getPlayerName() {
        if (paddles[sock.id] && paddles[sock.id].name) return paddles[sock.id].name;
        if (window.playerName) return window.playerName;
        return "Player";
    }

    if (!pauseListenerAdded) {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !paused) {
                sock.emit('player-action', { action: 'pause', name: getPlayerName() });
            }
        });
        pauseListenerAdded = true;
    }

    const pauseContinue = document.getElementById('pause-continue');
    const pauseRestart = document.getElementById('pause-restart');
    const pauseQuit = document.getElementById('pause-quit');

    if (pauseContinue) {
        pauseContinue.onclick = () => {
            sock.emit('player-action', { action: 'continue', name: getPlayerName() });
        };
    }
    if (pauseRestart) {
        pauseRestart.onclick = () => {
            sock.emit('player-action', { action: 'restart', name: getPlayerName() });
        };
    }
    if (pauseQuit) {
        pauseQuit.onclick = () => {
            sock.emit('player-action', { action: 'quit', name: getPlayerName() });
        };
    }

    sock.on('game-paused', ({ paused: isPaused }) => {
        paused = isPaused;
        if (paused) {
            showPauseMenu();
        } else {
            hidePauseMenu();
        }
    });

    sock.on('player-action', ({ action, name }) => {
        let msg = '';
        if (action === 'pause') msg = `${name} paused the game.`;
        if (action === 'continue') msg = `${name} continued the game.`;
        if (action === 'restart') msg = `${name} restarted the game.`;
        if (action === 'quit') msg = `${name} quit the game.`;
        showActionMessage(msg);
    });

    sock.on('quit-confirmed', () => {
        // So i just commented all code, lets just reload at this point
            window.location.reload();

        if (paddles[sock.id]?.type != 'host') {
            window.location.reload();
        } else {
            document.getElementById('game').style.display = 'none';
            const pauseMenu = document.getElementById('pause-menu');
            if (pauseMenu) pauseMenu.classList.remove('active');
            const lobby = document.getElementById('lobby');
            if (lobby) lobby.style.display = 'flex';
 
        }
        // document.getElementById('game').style.display = 'none';
        // const pauseMenu = document.getElementById('pause-menu');
        // if (pauseMenu) pauseMenu.classList.remove('active');
        // const lobby = document.getElementById('lobby');
        // if (lobby) lobby.style.display = 'flex';
        // let btn = document.getElementById('join-btn');
        // if (!btn) {
        //     btn = document.createElement('button');
        //     btn.id = 'join-btn';
        //     btn.textContent = 'Join Game';
        //     btn.className = 'start-button';
        //     btn.style.marginTop = '24px';
        //     btn.onclick = () => {
        //         sock.emit('join');
        //         btn.style.display = 'none';
        //     };
        //     lobby.appendChild(btn);
        // } else {
        //     btn.style.display = 'block';
        // }
    });

    function showActionMessage(msg) {
        let el = document.getElementById('action-message');
        if (!el) {
            el = document.createElement('div');
            el.id = 'action-message';
            el.style.position = 'fixed';
            el.style.top = '30px';
            el.style.left = '50%';
            el.style.transform = 'translateX(-50%)';
            el.style.background = 'rgba(0,0,0,0.8)';
            el.style.color = '#fff';
            el.style.padding = '14px 32px';
            el.style.borderRadius = '12px';
            el.style.fontSize = '1.3em';
            el.style.zIndex = '9999';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.display = 'block';
        clearTimeout(el._hideTimeout);
        el._hideTimeout = setTimeout(() => { el.style.display = 'none'; }, 2500);
    }


    sock.on('game-over', ({ winners, score, mode }) => {
        let overlay = document.getElementById('winner-overlay');
        if (overlay) overlay.remove();

        overlay = document.createElement('div');
        overlay.id = 'winner-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'rgba(0,0,0,0.85)';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '99999';

        const winnerText = document.createElement('div');
        winnerText.style.color = '#FFD700';
        winnerText.style.fontSize = '2.5em';
        winnerText.style.fontWeight = 'bold';
        winnerText.style.marginBottom = '24px';
        if (mode === 'deathmatch') {
            winnerText.textContent = `Winner: ${winners[0]} (Last survivor!)`;
        } else if (mode === 'score') {
            winnerText.textContent = `Winner: ${winners[0]}!`;
        } else {
            winnerText.textContent = winners.length > 1
                ? `It's a tie! Winners: ${winners.join(', ')} (Score: ${score})`
                : `Winner: ${winners[0]} (Score: ${score})`;
        }

        overlay.appendChild(winnerText);
        if (paddles[sock.id]?.type == 'host') {
            const btn = document.createElement('button');
            btn.textContent = 'Back to Lobby';
            btn.className = 'start-button';
            btn.onclick = () => {
            
                overlay.remove();
                sock.emit('player-action', { action: 'quit' });
            };
            overlay.appendChild(btn);
        }


        document.body.appendChild(overlay);

        playWinnerSound();
    });


    function gameLoop() {
        if (!paused) {
            const playerId = sock.id;
            const control = controls[paddles[playerId]?.type] || {};
            if (control) {
                const up = reverseControl ? 'down' : 'up';
                const down = reverseControl ? 'up' : 'down';
                const left = reverseControl ? 'right' : 'left';
                const right = reverseControl ? 'left' : 'right';
                if (keyState.up) sock.emit('paddle-move', { id: playerId, direction: up });
                if (keyState.down) sock.emit('paddle-move', { id: playerId, direction: down });
                if (keyState.left) sock.emit('paddle-move', { id: playerId, direction: left });
                if (keyState.right) sock.emit('paddle-move', { id: playerId, direction: right });
            }
            draw();
        }
        animationFrameId = requestAnimationFrame(gameLoop); 
    }
    animationFrameId = requestAnimationFrame(gameLoop);
}

function setupGame(players) {
    paddles = {}; 
    document.getElementById('game').style.display = 'block';
    Array.from(gameElement.querySelectorAll('.paddle')).forEach(el => el.remove());
    let ballElement = document.querySelector('.ball');
    if (!ballElement) {
        ballElement = document.createElement('div');
        ballElement.className = 'ball';
        ballElement.id = 'ball-0';
        ballElement.style.width = `${ball.size || BASE_BALL_SIZE}px`;
        ballElement.style.height = `${ball.size || BASE_BALL_SIZE}px`;
        ballElement.style.backgroundColor = 'white';
        ballElement.style.position = 'absolute';
        ballElement.style.borderRadius = '50%';
        gameElement.appendChild(ballElement);
    }
}

function startGame(socket) {
    socket.off('game-reset');
    socket.off('paddle-update');
    socket.off('score-update');
    socket.off('state-update');
    socket.off('powerups-update');
    socket.off('reverse-control');

    socket.on('game-reset', () => {
        Array.from(gameElement.querySelectorAll('.paddle')).forEach(el => el.remove());
        paddles = {};
    });

    socket.on('paddle-update', (data) => {
        if (paddles[data.id]) {
            paddles[data.id].pos = data.pos;
            const p = paddles[data.id];
            const el = document.getElementById(data.id);
            if (el && p.wall) {
                if (p.wall === 'left') {
                    el.style.left = '0px';
                    el.style.top = `${data.pos}px`;
                } else if (p.wall === 'right') {
                    el.style.left = `${GAME_WIDTH - (p.width || PADDLE_WIDTH)}px`;
                    el.style.top = `${data.pos}px`;
                } else if (p.wall === 'top') {
                    el.style.top = '0px';
                    el.style.left = `${data.pos}px`;
                } else if (p.wall === 'bottom') {
                    el.style.top = `${GAME_HEIGHT - (p.height || PADDLE_WIDTH)}px`;
                    el.style.left = `${data.pos}px`;
                }
            }
        }
    });

    socket.on('score-update', (scores) => {
        latestScores = scores;
        renderScoresOrLives();
    });

    socket.on('state-update', (gameState) => {
        if (!gameInitialized) {
            gameInitialized = true;

        }
        ball = gameState.balls[0] || ball;
        balls = gameState.balls;

        if (typeof gameState.mode === 'number') {
            currentMode = gameState.mode;
        }
        if (gameState.extraLives) {
            latestLives = gameState.extraLives;
        }

        for (const b of balls) {
            const id = b.ballId != null ? b.ballId : String(b.x) + ',' + String(b.y);

            if (!ballHistories[id]) {
                ballHistories[id] = [];
            }
            ballHistories[id].push({
                t: gameState.serverTime || performance.now(),
                x: b.x,
                y: b.y,
                size: b.size,
                vx: b.vx,
                vy: b.vy,
            });
            if (ballHistories[id].length > 20) {
                ballHistories[id].shift();
            }
        }

    
       for (const b of balls) {
            let el = document.getElementById(`ball-${b.ballId}`);
            if (!el) {
                el = document.createElement('div');
                el.className = 'ball';
                el.id = `ball-${b.ballId}`;
                el.style.position = 'absolute';
                el.style.borderRadius = '50%';
                el.style.backgroundColor = 'white';
                gameElement.appendChild(el);
            }
            el.style.width = (b.size || BASE_BALL_SIZE) + 'px';
            el.style.height = (b.size || BASE_BALL_SIZE) + 'px';
            const prevVx = parseFloat(el.dataset.prevVx || '0');
            const prevVy = parseFloat(el.dataset.prevVy || '0');
            if (prevVx && prevVx !== b.vx) playBounce();
            else if (prevVy && prevVy !== b.vy) playBounce();
            el.dataset.prevVx = b.vx;
            el.dataset.prevVy = b.vy;
        }

        Array.from(gameElement.querySelectorAll('.ball')).forEach(el => {// remove if doesnt exist anymor
            const id = el.id;
            const parts = id.split('-');
            if (parts[0] === 'ball') {
                const bid = parts[1];
                if (!balls.some(b => String(b.ballId) === String(bid))) {
                    el.remove();
                    delete ballHistories[bid];
                }
            }
        });

        powerups = gameState.powerups || powerups;
        paddles = gameState.paddles || paddles;
        updateBallPosition();
        if (gameState.scores) latestScores = gameState.scores;
        renderScoresOrLives();
        if (!powerupsDrawn) {
            renderPowerups();
            powerupsDrawn = true;
        }

        for (const id in paddles) {
            const p = paddles[id];
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement('div');
                el.className = 'paddle';
                el.style.position = 'absolute';
                el.style.backgroundColor = p.color || 'white';
                el.id = id;
                gameElement.appendChild(el);
            }
            if (p.width && p.height) {
                el.style.width = `${p.width}px`;
                el.style.height = `${p.height}px`;
            }
            if (p.wall === 'left') {
                el.style.left = '10px';
                el.style.top = `${p.pos}px`;
                if (!document.getElementById('danger-left')) 
                    ensureDangerZones('danger-left', 0, 0, Math.min(10, GAME_WIDTH/2), GAME_HEIGHT);

            } else if (p.wall === 'right') {
                el.style.left = `${GAME_WIDTH - p.width - 10}px`;
                el.style.top = `${p.pos}px`;
                if (!document.getElementById('danger-right')) 
                    ensureDangerZones('danger-right', GAME_WIDTH - Math.min(10, GAME_WIDTH/2), 0, Math.min(10, GAME_WIDTH/2), GAME_HEIGHT);

            } else if (p.wall === 'top') {
                el.style.top = '10px';
                el.style.left = `${p.pos}px`;
                if (!document.getElementById('danger-top')) 
                ensureDangerZones('danger-top', 0, 0, GAME_WIDTH, Math.min(10, GAME_HEIGHT/2));

            } else if (p.wall === 'bottom') {
                el.style.top = `${GAME_HEIGHT - p.height - 10}px`;
                el.style.left = `${p.pos}px`;
                if (!document.getElementById('danger-bottom')) 
                    ensureDangerZones('danger-bottom', 0, GAME_HEIGHT - Math.min(10, GAME_HEIGHT/2), GAME_WIDTH, Math.min(10, GAME_HEIGHT/2));

            }

            el.style.backgroundColor = p.color || 'white';
            el.setAttribute('orientation', p.orientation || (p.height > p.width ? 'vertical' : 'horizontal'));
                
            el.style.color = p.color || '#00aaff';
            el.classList.add('glow');

            function ensureDangerZones(id, left, top, w, h) {
                const d = document.createElement('div');
                d.id = id;
                d.className = 'danger-area';
                d.style.position = 'absolute';
                d.style.left = `${left}px`;
                d.style.top = `${top}px`;
                d.style.width = `${w}px`;
                d.style.height = `${h}px`;
                d.style.pointerEvents = 'none';
                gameElement.appendChild(d);
            }
 
        }

        Array.from(gameElement.querySelectorAll('.paddle')).forEach(el => {
            if (!(el.id in paddles)) el.remove();
        });
    });

    socket.on('powerups-update', (list) => {
        powerups = list || [];
        renderPowerups();
        powerupsDrawn = true;
    });

    socket.on('reverse-control', (payload) => {
        reverseControl = !!payload?.active;
    });
}

function draw() {
    const renderTime = performance.now() - INTERP_DELAY_MS; 

     for (const b of balls) {
        const id = b.ballId;
        const history = ballHistories[id];
        const el = document.getElementById(`ball-${id}`);
        if (!history || history.length < 2 || !el) {
            

            continue;
        }

        let A = history[0];
        let index2 = (history.length - 1) <= 0 ? 0 : history.length - 1; 
        let B = history[index2];
        for (let i = 0; i < history.length - 1; i++) {
            if (history[i].t <= renderTime && renderTime <= history[i+1].t) {
                A = history[i];
                B = history[i+1];
                break;
            }
        }
        const dt = (B.t - A.t) || 1;
        const alpha = Math.min(1, Math.max(0, (renderTime - A.t) / dt));

        const ix = A.x + (B.x - A.x) * alpha;
        const iy = A.y + (B.y - A.y) * alpha;

        el.style.transform = `translate3d(${ix}px, ${iy}px, 0)`;

    }


    for (const paddleId in paddles) {
        const paddle = paddles[paddleId];
        const paddleElement = document.getElementById(paddleId);
        if (paddleElement) {
            if (paddle.wall === 'left') {
                paddleElement.style.left = '10px';
                paddleElement.style.top = `${paddle.pos}px`;
            } else if (paddle.wall === 'right') {
                paddleElement.style.left = `${GAME_WIDTH - (paddle.width || PADDLE_WIDTH) - 10}px`;
                paddleElement.style.top = `${paddle.pos}px`;
            } else if (paddle.wall === 'top') {
                paddleElement.style.top = '10px';
                paddleElement.style.left = `${paddle.pos}px`;
            } else if (paddle.wall === 'bottom') {
                paddleElement.style.top = `${GAME_HEIGHT - (paddle.height || PADDLE_WIDTH) - 10}px`;
                paddleElement.style.left = `${paddle.pos}px`;
            }
        }
    }
}

function updateBallPosition() {}

function renderPowerups() {
    const currentIds = new Set((powerups || []).map(p => String(p.id)));
    Array.from(gameElement.querySelectorAll('[data-pu-id]')).forEach(el => {
        if (!currentIds.has(el.getAttribute('data-pu-id'))) {
            el.remove();
        }
    });
    if (!powerups || !powerups.length) return;
    powerups.forEach(p => {
        const idStr = String(p.id);
        let node = gameElement.querySelector(`[data-pu-id="${idStr}"]`);
        let cls = 'powerup-box';
        let icon = '';
        switch (p.type) {
            case 'score':
                cls = 'powerup-yellow';
                icon = 'icons/score.png';
                break;
            case 'slow':
                cls = 'powerup-green';
                icon = 'icons/slow.png';
                break;
            case 'big_paddle':
                cls = 'powerup-green';
                icon = 'icons/big_paddle.png';
                break;
            case 'small_ball':
                cls = 'powerup-red';
                icon = 'icons/small_ball.png';
                break;
            case 'multiplier':
                cls = 'powerup-yellow';
                icon = 'icons/multiplier.png';
                break;
            case 'extra_life':
                cls = 'powerup-green';
                icon = 'icons/extra_life.png';
                break;
            case 'reverse':
                cls = 'powerup-red';
                icon = 'icons/reverse.png';
                break;
            default:
                cls = 'powerup-box';
        }

        if (!node) {
            node = document.createElement('div');
            node.setAttribute('data-pu-id', idStr);
            node.className = cls;
            node.style.position = 'absolute';
            node.style.width = '40px';
            node.style.height = '40px';
            if (icon) {
                const img = document.createElement('img');
                img.src = icon;
                img.alt = p.type;
                img.style.width = '32px';
                img.style.height = '32px';
                img.style.display = 'block';
                img.style.margin = 'auto';
                node.appendChild(img);
            }
            gameElement.appendChild(node);
        } else {
            if (!node.classList.contains(cls)) {
                node.className = cls;
                const img = node.querySelector('img');
                if (img) { img.src = icon; img.alt = p.type; }
                else if (icon) {
                    const nimg = document.createElement('img');
                    nimg.src = icon; nimg.alt = p.type; nimg.style.width = '32px'; nimg.style.height = '32px'; nimg.style.display = 'block'; nimg.style.margin = 'auto';
                    node.appendChild(nimg);
                }
            }
        }
        node.style.left = p.x + 'px';
        node.style.top = p.y + 'px';
    });
}

