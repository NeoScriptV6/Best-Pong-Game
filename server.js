const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const ngrok = require('ngrok');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const FgBlue = "\x1b[34m";
const Underscore = "\x1b[4m";
const Reset = "\x1b[0m";
const PADDLE_SPEED = 5;
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 8080;
const USE_NGROK = process.env.USE_NGROK !== 'false';
server.listen(PORT, async () => {
    console.log(`Offline game available at: ${Underscore}http://localhost:${PORT}${Reset}`);
    if (USE_NGROK) {
        try {
            const url = await ngrok.connect({ addr: PORT, authtoken: process.env.NGROK_AUTHTOKEN });
            console.log(`${FgBlue}NGROK${Reset} url at: ${Underscore}${url}${Reset}`);
        } catch (err) {
            console.log(`${FgBlue}NGROK${Reset} disabled or failed: ${err?.message || err}`);
        }
    } else {
        console.log(`${FgBlue}NGROK${Reset} disabled via USE_NGROK=false. Use cloudflared for external access.`);
    }
});

const GAME_H = 600;
const GAME_W = 600;
const BALL_SIZE = 10; 
const PADDLE_WIDTH = 10; 
const PADDLE_LEN = 80;
const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60 degrees clean
const POWERUP_TYPES = {
    SCORE: 'score',
    SLOW: 'slow',
    BIG_PADDLE: 'big_paddle',
    SMALL_BALL: 'small_ball',
    MULTIPLIER: 'multiplier',
    EXTRA_LIFE: 'extra_life',
    REVERSE: 'reverse'
};


let gameActive = false;

const serverConstants = {
    players: [],
    paddles: {},
    balls: [{ x: GAME_W / 2,
        y: GAME_H / 2 + 50,
        vx: 0.5,
        vy: 0.5,
        size: BALL_SIZE,
        speed: 200,
        angle: Math.PI / 4, // 45 degrees if u wonderin
        lastHitPlayerId: null,
        ballId: 0
    }],
    scores: {},

    powerupsEnabled: false,
    powerups: [],
    nextPowerupId: 1,
    powerupWhitelist: {
        score: true,
        slow: true,
        big_paddle: true,
        small_ball: true,
        multiplier: true,
        extra_life: true,
        reverse: true
    },
    lobbyMode: null,
    speedMultiplier: 1,
    multipliers: {}, 
    extraLives: {}, 
    timer: {
        running: false,
        startTime: null,
        duration: 30, 
        direction: 'down', 
        lastSent: null 
    }
};

let gamePaused = false;

const availableTypes = ['host', 'player2', 'player3', 'player4'];
const availableColors = ['purple', 'red', 'blue', 'green'];

io.on('connection', (socket) => {
    console.log(`New player connected: ${socket.id}`);

    function addPlayer() {
        if (serverConstants.players.find(p => p.id === socket.id)) return;
        if (serverConstants.players.length >= 4){
            console.log('Room full, disconnecting user..');
            socket.emit('join-error', 'Room full!');
            return;
        }
        const hostStillPresent = serverConstants.players.some(p => p.id === serverConstants.hostId);
        
        
        let playerType = availableTypes[serverConstants.players.length];
        let playerColor = availableColors[serverConstants.players.length];
        if(playerType == 'host' || !hostStillPresent){
            serverConstants.hostId = socket.id;
            
        }
        const newPlayer = { id: socket.id, type: playerType, color: playerColor, name: ""};
        serverConstants.players.push(newPlayer);
        const validIds = new Set(serverConstants.players.map(p => p.id));
        for (const pid in serverConstants.paddles) {
            if (!validIds.has(pid)) {
                delete serverConstants.paddles[pid];
            }
        }
        // Paddle metadata??
        const isVertical = (playerType === 'host' || playerType === 'player2');
        const wall = playerType === 'host' ? 'left' : playerType === 'player2' ? 'right' : playerType === 'player3' ? 'top' : 'bottom';
        const width = isVertical ? PADDLE_WIDTH : PADDLE_LEN;
        const height = isVertical ? PADDLE_LEN : PADDLE_WIDTH;
        const pos = isVertical ? (GAME_H - height) / 2 : (GAME_W - width) / 2;
        serverConstants.paddles[socket.id] = {
            pos,
            color: playerColor,
            width,
            height,
            orientation: isVertical ? 'vertical' : 'horizontal',
            wall,
            type: playerType
        };

        socket.emit('player-info', newPlayer);
        io.emit('update-players', serverConstants.players);
        io.emit('score-update', serverConstants.scores);
        if (serverConstants.lobbyMode != null){
            io.emit('mode-selected', serverConstants.lobbyMode);
        }
    }


    addPlayer();


    socket.on('join', () => {
        addPlayer();
    });

    socket.on('mode-selected', (index) => {
        serverConstants.lobbyMode = index;
        if (serverConstants.players[0]?.id === socket.id) {
            io.emit('mode-selected', index);
        }
    });


    socket.on('set-name', (name) => {
        name = name.trim();
        if (!name) return;

        const normalize = str => str.replace(/\s+/g, '').toLowerCase();
        const taken = serverConstants.players.some(
            p =>
                (p.name && normalize(p.name) === normalize(name)) ||
                (p.type && normalize(p.type) === normalize(name))
        );
        if (taken) {
            socket.emit('name-error', 'Name already taken!');
        } else {

            const player = serverConstants.players.find(p => p.id === socket.id);
            if (player) {
                player.name = name;
                socket.emit('name-accepted', name);
                io.emit('update-players', serverConstants.players);
            }
        }
    });

    socket.on('disconnect', () => {
        // cleanupw
        console.log(`Player disconnected: ${socket.id}`);
        serverConstants.players = serverConstants.players.filter(p => p.id !== socket.id);
        if (serverConstants.paddles[socket.id]) {
            delete serverConstants.paddles[socket.id];
        }
        if (serverConstants.scores[socket.id] != null) {
            delete serverConstants.scores[socket.id];
        }
        io.emit('update-players', serverConstants.players);
        io.emit('score-update', serverConstants.scores);

        if (serverConstants.players.length === 0) {
            resetGameState();
            
        }
        if (socket.id === serverConstants.hostId && serverConstants.players.length > 0) {
            serverConstants.hostId = serverConstants.players[0].id;
        }
    });
    socket.on('powerups-toggle', (enabled) => {
        const isHost = serverConstants.players[0]?.id === socket.id;
        if (!isHost) return;
        serverConstants.powerupsEnabled = !!enabled;
        io.emit('powerups-enabled', serverConstants.powerupsEnabled);
    });

    socket.on('powerups-set-type', ({ type, enabled }) => {
        const isHost = serverConstants.players[0]?.id === socket.id;
        if (!isHost) return;
        if (type && Object.prototype.hasOwnProperty.call(serverConstants.powerupWhitelist, type)) {
            serverConstants.powerupWhitelist[type] = !!enabled;
            const before = serverConstants.powerups.length;
            serverConstants.powerups = serverConstants.powerups.filter(p => p.type !== type);
            if (serverConstants.powerups.length !== before) {
                io.emit('powerups-update', serverConstants.powerups);
            }
            io.emit('powerups-config', serverConstants.powerupWhitelist);
        }
    });

    socket.on('paddle-move', (data) => {
        const paddle = serverConstants.paddles[data.id];
        if (paddle) {
            // Clamp pos within board based on orientation
            // - vertical paddles move along Y: [0, GAME_H - height]
            // - horizontal paddles move along X: [0, GAME_W - width]
            const maxPos = paddle.orientation === 'vertical' ? (GAME_H - paddle.height) : (GAME_W - paddle.width);
            switch (data.direction) {
                case 'up':
                    paddle.pos -= PADDLE_SPEED;
                    if (paddle.pos < 0) paddle.pos = 0;
                    break;
                case 'down':
                    paddle.pos += PADDLE_SPEED;
                    if (paddle.pos > maxPos) paddle.pos = maxPos;
                    break;
                case 'left':
                    paddle.pos -= PADDLE_SPEED;
                    if (paddle.pos < 0) paddle.pos = 0;
                    break;
                case 'right':
                    paddle.pos += PADDLE_SPEED;
                    if (paddle.pos > maxPos) paddle.pos = maxPos;
                    break;
            }
            io.emit('paddle-update', { id: data.id, pos: paddle.pos });
        }
    });

    socket.on('start-game', () => {
        const isHost = serverConstants.players[0]?.id === socket.id;
        if (isHost) {
            io.emit('game-start', {
                message: 'The host started the game!',
                players: serverConstants.players,
                mode: serverConstants.lobbyMode,
                hostId: serverConstants.hostId,
                powerupsEnabled: serverConstants.powerupsEnabled
            });
        }
    });

    socket.on('countdown-finished', () => {
        const isHost = serverConstants.players[0]?.id === socket.id;
        if (!isHost) return;
        for (const p of serverConstants.players) {
            serverConstants.multipliers[p.id] = false;
            if (serverConstants.lobbyMode === 1) {
                serverConstants.extraLives[p.id] = 5;
            } else {
                serverConstants.scores[p.id] = 0;
                serverConstants.extraLives[p.id] = 0;
            }
        }
 
        serverConstants.speedMultiplier = 1;
        serverConstants.powerups = [];
        serverConstants.timer.running = true;
        serverConstants.timer.startTime = Date.now();
        let duration = 60, direction = 'down';
        if (serverConstants.lobbyMode === 0) { duration = 60; direction = 'down'; }
        else if (serverConstants.lobbyMode === 1) { duration = 0; direction = 'up'; }
        else if (serverConstants.lobbyMode === 2) { duration = 100; direction = 'down'; }
        serverConstants.timer.duration = duration;
        serverConstants.timer.direction = direction;
        serverConstants.timer.lastSent = null;

        gameActive = true;

        gamePaused = false;
        io.emit('game-paused', { paused: false, name: null });

        if (serverConstants.lobbyMode === 1) {
            io.emit('lives-update', { lives: { ...serverConstants.extraLives } });
        } else {
            io.emit('score-update', serverConstants.scores);
        }
        io.emit('powerups-config', serverConstants.powerupWhitelist);

        io.emit('timer-update', {
            running: true,
            startTime: serverConstants.timer.startTime,
            duration: serverConstants.timer.duration,
            direction: serverConstants.timer.direction
        });

        serverConstants.balls = [];
        addNewBall();
    });

    socket.emit('powerups-enabled', serverConstants.powerupsEnabled);
    socket.emit('powerups-config', serverConstants.powerupWhitelist);

    socket.on('player-action', ({ action }) => {
        const player = serverConstants.players.find(p => p.id === socket.id);
        const name = player && player.name ? player.name : player && player.type ? player.type : "Player";
        socket.broadcast.emit('player-action', { action, name });
        if (action === 'pause') {
            io.emit('game-paused', { paused: true, name });
            gamePaused = true;
            if (serverConstants.timer.running) {
                serverConstants.timer.running = false;
                serverConstants.timer.pausedAt = Date.now();
            }

        }
        if (action === 'continue') {
             lastUpdateTime = performance.now();

            io.emit('game-paused', { paused: false, name });
            gamePaused = false;
            if (serverConstants.timer.pausedAt) {
                const pausedDuration = Date.now() - serverConstants.timer.pausedAt;
                serverConstants.timer.startTime += pausedDuration;
                serverConstants.timer.running = true;
                delete serverConstants.timer.pausedAt;
            }
        }
        if (action === 'restart') {
            io.emit('restart-game');
        }
        if (action === 'quit') {
            socket.broadcast.emit('player-action', { action: 'quit', name });

            serverConstants.players = serverConstants.players.filter(p => p.id !== socket.id);
            if (serverConstants.paddles[socket.id]) delete serverConstants.paddles[socket.id];
            if (serverConstants.scores[socket.id] != null) delete serverConstants.scores[socket.id];

            io.emit('update-players', serverConstants.players);
            io.emit('score-update', serverConstants.scores);

            socket.emit('quit-confirmed');

            if(socket.id === serverConstants.hostId || serverConstants.players.length === 0){
            
                resetGameState();
            
                if (serverConstants.players.length > 0) {
                serverConstants.hostId = serverConstants.players[0].id;
            } 
                



                io.emit('force-reload');
            }
        }
    });
});

function resetGameState() {
    serverConstants.hostId = null;
    for (var ball of serverConstants.balls){
        ball.lastHitPlayerId = null;
        ball = { x: GAME_W / 2, y: GAME_H / 2 + 50, vx: 0.5, vy: 0.5, speed: 200, size: BALL_SIZE };
        serverConstants.balls =[];
        serverConstants.balls.push(ball);
        break;
    }
    serverConstants.scores = {};
    serverConstants.powerups = [];
    serverConstants.timer.running = false;
    serverConstants.timer.startTime = null;
    serverConstants.timer.lastSent = null;
    serverConstants.multipliers = {};
    serverConstants.extraLives = {};
    gamePaused = false;
    gameActive = false;
    lastUpdateTime = performance.now();
    firstTime = performance.now();

    for (const pid in serverConstants.paddles) {
        const paddle = serverConstants.paddles[pid];
        const isVertical = paddle.orientation === 'vertical';
        paddle.width = isVertical ? PADDLE_WIDTH : PADDLE_LEN;
        paddle.height = isVertical ? PADDLE_LEN : PADDLE_WIDTH;
        paddle.pos = isVertical ? (GAME_H - paddle.height) / 2 : (GAME_W - paddle.width) / 2;
    }
    
}
var lastUpdateTime = performance.now();
var firstTime = performance.now();

function addNewBall(){

    const speed = 200;
    const angle = Math.random() < 0.5 ? Math.PI / 4 : (3 * Math.PI) / 4;

    const newBall = {
        x: GAME_W / 2,
        y: GAME_H / 2,
        speed: speed,
        vx: speed * Math.cos(angle),
        vy: speed * Math.sin(angle),
        size: BALL_SIZE,
        ballId: serverConstants.balls.length,
        frozenUntil: Date.now() + 1000
    };
    serverConstants.balls.push(newBall);

    firstTime = performance.now();

}

function updateBallPosition(ball, deltaTime) {

     if (ball.frozenUntil && Date.now() < ball.frozenUntil) {
        return;
    } else if (ball.frozenUntil && Date.now() >= ball.frozenUntil) {
        delete ball.frozenUntil;
    }

    const timeNow = performance.now();

    ball.x += ball.vx * deltaTime ;
    ball.y += ball.vy  * deltaTime;

    if(serverConstants.timer.running){ // now in every game mode
        const elapsed = Math.floor((timeNow - firstTime) / 1000);
        if(elapsed >= 10){
            addNewBall();
        }
    }
}

setInterval(() => {
    const timeNow = performance.now();

    if (gamePaused || serverConstants.players.length === 0 || !gameActive) {
        return;
    }

    const deltaTime = (timeNow - lastUpdateTime) / 1000; 
    lastUpdateTime = timeNow;


    serverConstants.balls.forEach((ball)=> {

        updateBallPosition(ball, deltaTime);
    

    if (gamePaused || serverConstants.players.length === 0 || !gameActive) return;

    const validIds = new Set(serverConstants.players.map(p => p.id));
    for (const pid in serverConstants.paddles) {
        if (!validIds.has(pid)) delete serverConstants.paddles[pid];
    }

    if (serverConstants.timer.running) {
        const now = Date.now();
        let elapsed = Math.floor((now - serverConstants.timer.startTime) / 1000);
        let timeVal;
        if (serverConstants.timer.direction === 'down') {
            timeVal = Math.max(0, (serverConstants.timer.duration || 0) - elapsed);
        } else {
            timeVal = elapsed;
        }
        if (serverConstants.timer.lastSent !== timeVal) {
            io.emit('timer-tick', {
                time: timeVal,
                direction: serverConstants.timer.direction,
                running: true
            });
            serverConstants.timer.lastSent = timeVal;
        }
        if (serverConstants.timer.direction === 'down' && timeVal <= 0) {
            serverConstants.timer.running = false;
            io.emit('timer-tick', {
                time: 0,
                direction: serverConstants.timer.direction,
                running: false
            });

            let maxScore = -Infinity;
            let winners = [];
            for (const pid in serverConstants.scores) {
                if (serverConstants.scores[pid] > maxScore) {
                    maxScore = serverConstants.scores[pid];
                    winners = [pid];
                } else if (serverConstants.scores[pid] === maxScore) {
                    winners.push(pid);
                }
            }
            const winnerInfos = winners.map(pid => {
                const player = serverConstants.players.find(p => p.id === pid);
                return player ? (player.name || player.type) : pid;
            });
            io.emit('game-over', { winners: winnerInfos, score: maxScore });
        }
    }



    for (const paddleId in serverConstants.paddles) {
        const paddle = serverConstants.paddles[paddleId];
        const bx = ball.x;
        const by = ball.y;
        const BS = ball.size || BALL_SIZE;
        const br = bx + BS;
        const bb = by + BS;

        if (paddle.orientation === 'vertical') {
            const px = paddle.wall === 'left' ? 10 : (GAME_W - paddle.width - 10);
            const py = paddle.pos;
            const pr = px + paddle.width;
            const pb = py + paddle.height;

            // AABB check against paddle box; angle-based reflection
            const overlap = br > px && bx < pr && bb > py && by < pb;
            if (overlap) {
                const ballCenterY = by + BALL_SIZE / 2;
                const paddleCenterY = py + paddle.height / 2;
                let rel = (ballCenterY - paddleCenterY) / (paddle.height / 2);
                if (rel < -1) rel = -1; else if (rel > 1) rel = 1;
  
                const dirX = (paddle.wall === 'left') ? -1 : 1; 
        
                const angle = rel * MAX_BOUNCE_ANGLE;
                const speed = Math.hypot(ball.vx, ball.vy) || 0.7;
            
                ball.vx = -1 * ball.vx;

                // updateBallPosition(dirX * Math.abs(speed * Math.cos(angle)), speed * Math.sin(angle)); // vx and vy
       
                if (paddle.wall === 'left') {
                    ball.x = pr;

                } else {
                    ball.x = px - BALL_SIZE;  


                }
                ball.lastHitPlayerId = paddleId;
                break;
            }
        } else {
            // Horizontal paddle (top/bottom)
            const py = paddle.wall === 'top' ? 10 : (GAME_H - paddle.height - 10);
            const px = paddle.pos;
            const pr = px + paddle.width;
            const pb = py + paddle.height;

            const overlap = br > px && bx < pr && bb > py && by < pb;
            if (overlap) {
                const ballCenterX = bx + BALL_SIZE / 2;
                const paddleCenterX = px + paddle.width / 2;
                let rel = (ballCenterX - paddleCenterX) / (paddle.width / 2);
                if (rel < -1) rel = -1; else if (rel > 1) rel = 1;
                const angle = rel * MAX_BOUNCE_ANGLE;
                // const speed = Math.hypot(new_vx, serverConstants.ball.vy) || 0.7;
                const dirY = (paddle.wall === 'top') ? -1 : 1; // always bounce away from wall
                ball.vy = -1 * ball.vy;

                // updateBallPosition(speed * Math.sin(angle), dirY * Math.abs(speed * Math.cos(angle)));
                if (paddle.wall === 'top') {
                    ball.y = pb; 
                } else {
                    ball.y = py - BALL_SIZE; 
                }
                ball.lastHitPlayerId = paddleId;
                break;
            }
        }
    }

    // Prevent paddle-paddle overlap (vertical vs horizontal)
    const verts = [], hors = [];
    for (const id in serverConstants.paddles) {
        const p = serverConstants.paddles[id];
        if (p.orientation === 'vertical') verts.push(p);
        else hors.push(p);
    }
    for (const v of verts) {
        const vx = v.wall === 'left' ? 0 : (GAME_W - v.width);
        const vy = v.pos;
        const vr = vx + v.width;
        const vb = vy + v.height;
        for (const h of hors) {
            const hy = h.wall === 'top' ? 0 : (GAME_H - h.height);
            const hx = h.pos;
            const hr = hx + h.width;
            const hb = hy + h.height;
            const overlapX = Math.min(vr, hr) - Math.max(vx, hx);
            const overlapY = Math.min(vb, hb) - Math.max(vy, hy);
            if (overlapX > 0 && overlapY > 0) {
       
       
                if (h.wall === 'top') {
                    v.pos = Math.min(v.pos + overlapY, GAME_H - v.height);
                } else { 
                    v.pos = Math.max(v.pos - overlapY, 0);
                }
                if (v.wall === 'left') {
                    h.pos = Math.min(h.pos + overlapX, GAME_W - h.width);
                } else {
                    h.pos = Math.max(h.pos - overlapX, 0);
                }
            }
        }
    }

    let hasLeft = false, hasRight = false, hasTop = false, hasBottom = false;
    for (const pid in serverConstants.paddles) {
        const p = serverConstants.paddles[pid];
        if (p.orientation === 'vertical') {
            if (p.wall === 'left') hasLeft = true;
            else if (p.wall === 'right') hasRight = true;
        } else {
            if (p.wall === 'top') hasTop = true;
            else if (p.wall === 'bottom') hasBottom = true;
        }
    }

    const BS = ball.size || BALL_SIZE;
    if (ball.x <= 0) {
        if (!hasLeft) {
            ball.x = 0;
            ball.vx = Math.abs(ball.vx);
        }
    } else if (ball.x + BS >= GAME_W) {
        if (!hasRight) {
            ball.x = GAME_W - BS;
            ball.vx = -Math.abs(ball.vx);
        }
    }

    if (ball.y <= 0) {
        if (!hasTop) {
            ball.y = 0;
            ball.vy = Math.abs(ball.vy);
        }
    } else if (ball.y + BS >= GAME_H) {
        if (!hasBottom) {
            ball.y = GAME_H - BS;
            ball.vy = -Math.abs(ball.vy);
        }
    }

    
    if (ball.frozenUntil && Date.now() < ball.frozenUntil) {
        return;
    } else if (ball.frozenUntil && Date.now() >= ball.frozenUntil) {
        delete ball.frozenUntil;
    }

    let outWall = null;
    if (ball.x < 0) outWall = 'left';
    else if (ball.x + BS > GAME_W) outWall = 'right';
    else if (ball.y < 0) outWall = 'top';
    else if (ball.y + BS > GAME_H) outWall = 'bottom';

    if (outWall) {
        let missedPlayerId = null;
        for (const pid in serverConstants.paddles) {
            if (serverConstants.paddles[pid].wall === outWall) { missedPlayerId = pid; break; }
        }
        if (serverConstants.lobbyMode === 1) {
            // Deathmatch: decrement lives, remove paddle if 0, check for winner
            if (missedPlayerId && (serverConstants.extraLives[missedPlayerId] || 0) > 0) {
                serverConstants.extraLives[missedPlayerId] -= 1;
                if (serverConstants.extraLives[missedPlayerId] <= 0) {
                    delete serverConstants.paddles[missedPlayerId];
                }
                io.emit('lives-update', { lives: { ...serverConstants.extraLives } });
                // Check for winner
                const alive = Object.entries(serverConstants.extraLives)
                    .filter(([pid, lives]) => lives > 0 && serverConstants.paddles[pid])
                    .map(([pid]) => pid);
                if (alive.length === 1) {
                    const winnerId = alive[0];
                    const winner = serverConstants.players.find(p => p.id === winnerId);
                    const winnerName = winner ? (winner.name || winner.type) : winnerId;
                    serverConstants.timer.running = false;
                    gameActive = false;
                    io.emit('game-over', { winners: [winnerName], mode: 'deathmatch' });
                }
            }
            // Reset ball to center with random direction
            ball.x = GAME_W / 2;
            ball.y = GAME_H / 2;
            centerFrames = Math.random() * 80;
            ball.frozenUntil = Date.now() + 1500; 
            center = true;
        } else {
            // Classic and Score to Win: score logic
            if (missedPlayerId && (serverConstants.extraLives[missedPlayerId] || 0) > 0) {
                serverConstants.extraLives[missedPlayerId] -= 1;
            } else {
                let winnerId = null;
                for (const pid in serverConstants.scores) {
                    if (pid === missedPlayerId) continue;
                    const bonus = serverConstants.multipliers[pid] ? 2 : 1;
                    serverConstants.scores[pid] = (serverConstants.scores[pid] || 0) + bonus;
                    if (serverConstants.lobbyMode === 2 && serverConstants.scores[pid] >= 10) winnerId = pid;
                }
                // Reset ball to center with random direction
                ball.x = GAME_W / 2;
                ball.y = GAME_H / 2;
                centerFrames = Math.random() * 80;
                ball.frozenUntil = Date.now() + 1500; 

                center = true;
                io.emit('score-update', serverConstants.scores);
                if (serverConstants.lobbyMode === 2 && winnerId) {
                    const winner = serverConstants.players.find(p => p.id === winnerId);
                    const winnerName = winner ? (winner.name || winner.type) : winnerId;
                    serverConstants.timer.running = false;
                    gameActive = false;
                    io.emit('game-over', { winners: [winnerName], mode: 'score' });
                }
            }
        }
    }

    const now = Date.now();
    const beforeExpireLen = serverConstants.powerups.length;
    serverConstants.powerups = serverConstants.powerups.filter(p => p.expiresAt > now);
    if (serverConstants.powerups.length !== beforeExpireLen) {
        io.emit('powerups-update', serverConstants.powerups);
    }
    if (serverConstants.powerupsEnabled && serverConstants.powerups.length < 1) {
        if (Math.random() < 0.05) { // ~5% chance per tick
            const types = [
                POWERUP_TYPES.SCORE,
                POWERUP_TYPES.SLOW,
                POWERUP_TYPES.BIG_PADDLE,
                POWERUP_TYPES.SMALL_BALL,
                POWERUP_TYPES.MULTIPLIER,
                POWERUP_TYPES.EXTRA_LIFE,
                POWERUP_TYPES.REVERSE
            ].filter(t => serverConstants.powerupWhitelist[t]);
            if (types.length === 0) {
            } else {
            const type = types[Math.floor(Math.random() * types.length)];
            const margin = 10;
            const pw = 40, ph = 40;
            const BS_try = ball.size || BALL_SIZE;
            const cx = ball.x + BS_try / 2;
            const cy = ball.y + BS_try / 2;
            let x = 0, y = 0;
            let placed = false;
            const SAFE_RADIUS = 80; // keep reasonable distance from ball center to avoid insta-collect
            for (let tries = 0; tries < 20; tries++) {
                x = Math.floor(Math.random() * (GAME_W - pw - margin * 2)) + margin;
                y = Math.floor(Math.random() * (GAME_H - ph - margin * 2)) + margin;
                const bx0 = x, bx1 = x + pw;
                const by0 = y, by1 = y + ph;
                const inside = (cx > bx0 && cx < bx1 && cy > by0 && cy < by1);
                // Also enforce a radial buffer from box center
                const pcx = x + pw / 2;
                const pcy = y + ph / 2;
                const dx = pcx - cx;
                const dy = pcy - cy;
                const farEnough = (dx * dx + dy * dy) >= (SAFE_RADIUS * SAFE_RADIUS);
                if (!inside && farEnough) { placed = true; break; }
            }
            if (placed) {
                serverConstants.powerups.push({
                    id: serverConstants.nextPowerupId++,
                    type,
                    x,
                    y,
                    expiresAt: now + 5000,
                    spawnedAt: now
                });
                io.emit('powerups-update', serverConstants.powerups);
            }
            }
        }
    }
    if (serverConstants.powerups.length) {
        const BS2 = ball.size || BALL_SIZE;
        const cx = ball.x + BS2 / 2;
        const cy = ball.y + BS2 / 2;
        let collectedIndex = -1;
        for (let i = 0; i < serverConstants.powerups.length; i++) {
            const p = serverConstants.powerups[i];

            if ((now - (p.spawnedAt || 0)) < 300) continue;
            if (cx > p.x && cx < p.x + 40 && cy > p.y && cy < p.y + 40) {
                collectedIndex = i;

                const collector = ball.lastHitPlayerId || serverConstants.players[0]?.id || null;
                applyPowerupServer(p.type, collector);
                break;
            }
        }
        if (collectedIndex >= 0) {
            serverConstants.powerups.splice(collectedIndex, 1);
            io.emit('powerups-update', serverConstants.powerups);
        }
    }

    })
    io.emit('state-update', {
        balls: serverConstants.balls,
        paddles: serverConstants.paddles,
        scores: serverConstants.scores,
        powerups: serverConstants.powerups,
        powerupsEnabled: serverConstants.powerupsEnabled,
        extraLives: serverConstants.extraLives,
        mode: serverConstants.lobbyMode
    });
}, 1000 / 60); 

function applyPowerupServer(type, playerId) {
    switch (type) {
        case POWERUP_TYPES.SCORE:
            if (playerId) {
                serverConstants.scores[playerId] = (serverConstants.scores[playerId] || 0) + 5;
                io.emit('score-update', serverConstants.scores);
            }
            break;
        case POWERUP_TYPES.SLOW:
            serverConstants.speedMultiplier = 0.5;
            setTimeout(() => { serverConstants.speedMultiplier = 1; }, 4000);
            break;
        case POWERUP_TYPES.BIG_PADDLE:
            if (playerId && serverConstants.paddles[playerId]) {
                const p = serverConstants.paddles[playerId];
                if (p.orientation === 'vertical') {
                    p.height = Math.floor(PADDLE_LEN * 1.7);
                    if (p.pos > GAME_H - p.height) p.pos = Math.max(0, GAME_H - p.height);
                } else {
                    p.width = Math.floor(PADDLE_LEN * 1.7);
                    if (p.pos > GAME_W - p.width) p.pos = Math.max(0, GAME_W - p.width);
                }
                setTimeout(() => {
                    if (!serverConstants.paddles[playerId]) return;
                    const pr = serverConstants.paddles[playerId];
                    pr.width = (pr.orientation === 'vertical') ? PADDLE_WIDTH : PADDLE_LEN;
                    pr.height = (pr.orientation === 'vertical') ? PADDLE_LEN : PADDLE_WIDTH;
                    if (pr.orientation === 'vertical' && pr.pos > GAME_H - pr.height) pr.pos = Math.max(0, GAME_H - pr.height);
                    if (pr.orientation === 'horizontal' && pr.pos > GAME_W - pr.width) pr.pos = Math.max(0, GAME_W - pr.width);
                }, 4000);
            }
            break;
        case POWERUP_TYPES.SMALL_BALL:
            serverConstants.balls.forEach((ball) => {
                ball.size = 8;
            setTimeout(() => { ball.size = BALL_SIZE; }, 4000);
               
            });

            break;
        case POWERUP_TYPES.MULTIPLIER:
            if (playerId) {
                serverConstants.multipliers[playerId] = true;
                setTimeout(() => { serverConstants.multipliers[playerId] = false; }, 4000);
            }
            break;
        case POWERUP_TYPES.EXTRA_LIFE:
            if (playerId) {
                serverConstants.extraLives[playerId] = (serverConstants.extraLives[playerId] || 0) + 1;
            }
            break;
        case POWERUP_TYPES.REVERSE:
            const others = serverConstants.players
                .map(p => p.id)
                .filter(id => id !== playerId);
            others.forEach(id => io.to(id).emit('reverse-control', { active: true, durationMs: 4000 }));
            setTimeout(() => {
                others.forEach(id => io.to(id).emit('reverse-control', { active: false }));
            }, 4000);
            break;
        default:
            break;
    }
}