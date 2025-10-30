// singleplayer.js

import { createPowerup, POWERUP_TYPES, applyPowerup } from './powerups.js';
// Singleplayer Ping Pong Game Logic

const gameWidth = 400;
const gameHeight = 400; 
const paddleWidth = 80;
const paddleHeight = 15;
const ballSize = 15;
let paddleX, score, leftPressed, rightPressed, gameActive, lastTime, startBtn, restartBtn;
let balls = [];
let baseBallSpeed = 300;
let paddleSpeed = 500;
let highScore = 0;
let highScoreDisplay;
let hitSound;
let bgMusic = new Audio('https://opengameart.org/sites/default/files/song18.mp3');
let powerup = null;
let powerupTimeout = null;
bgMusic.loop = true;
bgMusic.volume = 0.3;


function showParticles(x, y) {
    const colors = ['#FFD700', '#00ffe7', '#ff00cc', '#00ff88', '#fff'];
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.width = '7px';
        particle.style.height = '7px';
        particle.style.background = colors[i % colors.length];
        particle.style.borderRadius = '50%';
        particle.style.opacity = '0.85';
        particle.style.pointerEvents = 'none';
        particle.style.boxShadow = `0 0 12px 2px ${colors[i % colors.length]}`;
        particle.style.transition = 'all 0.7s cubic-bezier(.4,2,.6,1)';
        game.appendChild(particle);
        setTimeout(() => {
            particle.style.left = (x + Math.cos(i * Math.PI / 6) * 36) + 'px';
            particle.style.top = (y + Math.sin(i * Math.PI / 6) * 36) + 'px';
            particle.style.opacity = '0';
            particle.style.transform = 'scale(1.5)';
        }, 10);
        setTimeout(() => {
            if (particle.parentNode) particle.parentNode.removeChild(particle);
        }, 700);
    }
}

function updateHighScore(newScore) {
    if (newScore > highScore) {
        highScore = newScore;
        localStorage.setItem('pingpong_highscore', highScore);
        if (highScoreDisplay) {
            highScoreDisplay.textContent = 'High Score: ' + highScore;
            highScoreDisplay.style.transform = 'scale(1.2)';
            setTimeout(() => highScoreDisplay.style.transform = '', 200);
        }
    }
}

export function initSingleplayerGame() {
    const game = document.getElementById('game');
    const gameArea = document.getElementById('game-area');


    const paddle = document.createElement('div');//  should actually be in Singleplayer.js
    const ball = document.createElement('div');
    const extraLifeIndicator = document.createElement('div');
    gameArea.appendChild(extraLifeIndicator)

    paddle.id = 'paddle';
    ball.id = 'ball';
    game.appendChild(paddle)
    game.appendChild(ball);

    const scoreDisplay = document.getElementById('score');
    game.style.display = 'block';
    game.style.height = '400px';
    paddle.style.background = 'red';

    let multiplierActive = { value: false };
    let extraLife = { value: 0 };
    let reverseActive = { value: false };

    if (!extraLifeIndicator) {
        extraLifeIndicator = document.createElement('div');
        extraLifeIndicator.id = 'extralife-indicator';
        extraLifeIndicator.style.position = 'absolute';
        extraLifeIndicator.style.top = (gameHeight + 10) + 'px';
        extraLifeIndicator.style.left = '50%';
        extraLifeIndicator.style.transform = 'translateX(-50%)';
        extraLifeIndicator.style.fontSize = '18px';
        extraLifeIndicator.style.color = '#00ff88';
        extraLifeIndicator.style.fontWeight = 'bold';
        extraLifeIndicator.style.textShadow = '1px 1px 2px #333';
        extraLifeIndicator.textContent = '';
        game.appendChild(extraLifeIndicator);
    }

    function spawnPowerup() {
        if (powerup) return; 
        const powerupTypes = [
          POWERUP_TYPES.SCORE,
          POWERUP_TYPES.SLOW,
          POWERUP_TYPES.BIG_PADDLE,
          POWERUP_TYPES.SMALL_BALL,
          POWERUP_TYPES.MULTIPLIER,
          POWERUP_TYPES.EXTRA_LIFE,
          POWERUP_TYPES.REVERSE,
        ];
        const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        const box = createPowerup(type, gameWidth, gameHeight);
        box.dataset.type = type;
        game.appendChild(box);
        powerup = box;
        powerupTimeout = setTimeout(() => {
            if (powerup && powerup.parentNode) powerup.parentNode.removeChild(powerup);
            powerup = null;
        }, 5000);
    }
    function resetBalls() {
        balls = [{
            x: (gameWidth - ballSize) / 2,
            y: 80,
            speedX: baseBallSpeed * (Math.random() > 0.5 ? 1 : -1),
            speedY: baseBallSpeed,
            speedMultiplier: 1
        }];
    }

    function draw() {
    // Use actual paddle width for clamping
    const currentPaddleWidth = parseInt(paddle.style.width) || paddleWidth;
    paddleX = Math.max(0, Math.min(gameWidth - currentPaddleWidth, paddleX));
    paddle.style.left = paddleX + 'px';
    paddle.style.transition = 'left 0.08s cubic-bezier(.4,2,.6,1)';
        scoreDisplay.textContent = 'Score: ' + score;
        // Update extra life indicator
        if (extraLife.value > 0) {
            extraLifeIndicator.textContent = 'Extra Lives: ' + extraLife.value;
            extraLifeIndicator.style.visibility = 'visible';
        } else {
            extraLifeIndicator.textContent = '';
            extraLifeIndicator.style.visibility = 'hidden';
        }
        Array.from(game.children).forEach(child => {
            if (child.id && child.id.startsWith('ball') && child.id !== 'ball') {
                game.removeChild(child);
            }
        });
        balls.forEach((ballObj, i) => {
            let ballEl;
            if (i === 0) {
                ballEl = ball;
            } else {
                ballEl = document.getElementById('ball' + i);
                if (!ballEl) {
                    ballEl = document.createElement('div');
                    ballEl.id = 'ball' + i;
                    ballEl.style.position = 'absolute';
                    ballEl.style.width = ballSize + 'px';
                    ballEl.style.height = ballSize + 'px';
                    ballEl.style.background = '#E6EAFF';
                    ballEl.style.borderRadius = '50%';
                    ballEl.style.transition = 'left 0.08s, top 0.08s cubic-bezier(.4,2,.6,1)';
                    game.appendChild(ballEl);
                }
            }
            ballEl.style.left = ballObj.x + 'px';
            ballEl.style.top = ballObj.y + 'px';
        });
    }

    function showStartButton() {
        if (!startBtn) {
            startBtn = document.createElement('button');
            startBtn.textContent = 'Start';
            startBtn.style.position = 'absolute';
            startBtn.style.top = '50%';
            startBtn.style.left = '50%';
            startBtn.style.transform = 'translate(-50%, -50%)';
            startBtn.style.fontSize = '24px';
            startBtn.style.padding = '12px 32px';
            startBtn.style.zIndex = '10';
            startBtn.onclick = () => {
                // Load sound after user interaction
                if (!hitSound) {
                    hitSound = new Audio('bounce.wav');
                }
                if (bgMusic.paused) {
                    bgMusic.play();
                }
                score = 0;
                paddleX = (gameWidth - paddleWidth) / 2;
                gameActive = true;
                lastTime = null;
                resetBalls();
                update.mainBallHits = 0; // Reset extra ball spawn count
                // Reset extra life indicator
                extraLife.value = 0;
                extraLifeIndicator.textContent = '';
                extraLifeIndicator.style.visibility = 'hidden';
                startBtn.remove();
                startBtn = null;
                requestAnimationFrame(update);
            };
            game.appendChild(startBtn);
        }
    }

    function showRestartButton() {
        if (!restartBtn) {
            restartBtn = document.createElement('button');
            restartBtn.textContent = 'Restart';
            restartBtn.style.position = 'absolute';
            restartBtn.style.top = '50%';
            restartBtn.style.left = '50%';
            restartBtn.style.transform = 'translate(-50%, -50%)';
            restartBtn.style.fontSize = '24px';
            restartBtn.style.padding = '12px 32px';
            restartBtn.style.zIndex = '10';
            restartBtn.onclick = () => {
                // Load sound after user interaction
                if (!hitSound) {
                    hitSound = new Audio('bounce.wav');
                }

                score = 0;
                paddleX = (gameWidth - paddleWidth) / 2;
                gameActive = true;
                lastTime = null;
                resetBalls();
                update.mainBallHits = 0; // Reset extra ball spawn count
                // Reset paddle size
                paddle.style.width = paddleWidth + 'px';
                // Reset ball sizes
                ball.style.width = ballSize + 'px';
                ball.style.height = ballSize + 'px';
                // Reset extra balls if present
                for (let i = 1; i < balls.length; i++) {
                    const ballEl = document.getElementById('ball' + i);
                    if (ballEl) {
                        ballEl.style.width = ballSize + 'px';
                        ballEl.style.height = ballSize + 'px';
                    }
                }
                // Reset powerup state
                if (powerupTimeout) clearTimeout(powerupTimeout);
                if (powerup && powerup.parentNode) powerup.parentNode.removeChild(powerup);
                powerup = null;
                // Reset extra life indicator
                extraLife.value = 0;
                extraLifeIndicator.textContent = '';
                extraLifeIndicator.style.visibility = 'hidden';
                restartBtn.remove();
                restartBtn = null;
                requestAnimationFrame(update);
            };
            game.appendChild(restartBtn);
        }
    }

    function update(currentTime) {
        // Randomly spawn powerup (1% chance per frame if none exists, for testing)
        if (!powerup && Math.random() < 0.01) {
            spawnPowerup();
        }
        // Powerup collision detection
        if (powerup && typeof powerup.style === 'object' && powerup.style !== null) {
            balls.forEach(ballObj => {
                const ballCenterX = ballObj.x + ballSize / 2;
                const ballCenterY = ballObj.y + ballSize / 2;
                const boxX = parseInt(powerup.style.left);

                const boxY = parseInt(powerup.style.top);
                // Simple AABB collision
                if (
                    ballCenterX > boxX && ballCenterX < boxX + 40 &&
                    ballCenterY > boxY && ballCenterY < boxY + 40
                ) {
                    const type = powerup.dataset.type || POWERUP_TYPES.SCORE;
                    let scoreObj = { value: score };
                    applyPowerup(type, {
                        balls,
                        paddle: paddle,
                        paddleWidth,
                        score: scoreObj,
                        scoreDisplay,
                        updateHighScore,
                        ball,
                        ballSize,
                        multiplierActive,
                        extraLife,
                        reverseActive
                    });
                    score = scoreObj.value;
                    if (powerupTimeout) clearTimeout(powerupTimeout);
                    if (powerup.parentNode) powerup.parentNode.removeChild(powerup);
                    powerup = null;
                }
            });
        }
        if (!gameActive) return;
        if (!lastTime) lastTime = currentTime;
        const delta = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
         if (reverseActive.value) {
             if (leftPressed) paddleX += paddleSpeed * delta;
             if (rightPressed) paddleX -= paddleSpeed * delta;
         } else {
             if (leftPressed) paddleX -= paddleSpeed * delta;
             if (rightPressed) paddleX += paddleSpeed * delta;
         }
         const currentPaddleWidth = parseInt(paddle.style.width) || paddleWidth;
         paddleX = Math.max(0, Math.min(gameWidth - currentPaddleWidth, paddleX));
        let ballsToRemove = [];
        if (typeof update.mainBallHits === 'undefined') update.mainBallHits = 0;
        balls.forEach((ballObj, i) => {
            ballObj.x += ballObj.speedX * ballObj.speedMultiplier * delta;
            ballObj.y += ballObj.speedY * ballObj.speedMultiplier * delta;
            if (!ballObj.lastBounce) ballObj.lastBounce = false;
            if (ballObj.x <= 0) {
                ballObj.x = 0;
                ballObj.speedX *= -1;
                showParticles(ballObj.x, ballObj.y);
                hitSound.currentTime = 0; hitSound.play();
            }
            if (ballObj.x + ballSize >= gameWidth) {
                ballObj.x = gameWidth - ballSize;
                ballObj.speedX *= -1;
                showParticles(ballObj.x + ballSize, ballObj.y);
                hitSound.currentTime = 0; hitSound.play();
            }
            if (ballObj.y <= 0) {
                ballObj.y = 0;
                ballObj.speedY *= -1;
                showParticles(ballObj.x, ballObj.y);
                hitSound.currentTime = 0; hitSound.play();
            }
            const currentPaddleWidth = parseInt(paddle.style.width) || paddleWidth;
            let hitPaddle = (
                ballObj.y + ballSize >= gameHeight - paddleHeight - 10 &&
                ballObj.x + ballSize > paddleX &&
                ballObj.x < paddleX + currentPaddleWidth
            );
            if (hitPaddle && !ballObj.lastBounce) {
                ballObj.speedY *= -1;
                ballObj.y = gameHeight - paddleHeight - ballSize - 10;
                showParticles(ballObj.x, ballObj.y + ballSize);
                hitSound.currentTime = 0; hitSound.play();
                if (multiplierActive.value) {
                    score += 2;
                } else {
                    score++;
                }
                updateHighScore(score);
                ballObj.lastBounce = true;
                paddle.style.transform = 'scale(1.1)';
                ball.style.transform = 'scale(1.15)';
                setTimeout(() => {
                    paddle.style.transform = '';
                    ball.style.transform = '';
                }, 120);
                if (i === 0) {
                    update.mainBallHits++;
                    if (score % 5 === 0) {
                        balls.forEach(b => b.speedMultiplier *= 1.1);
                    }
                    if (update.mainBallHits % 20 === 0) {
                        balls.push({
                            x: (gameWidth - ballSize) / 2,
                            y: 80,
                            speedX: baseBallSpeed * (Math.random() > 0.5 ? 1 : -1),
                            speedY: baseBallSpeed,
                            speedMultiplier: 1
                        });
                    }
                }
                scoreDisplay.style.transform = 'scale(1.2)';
                scoreDisplay.style.color = '#FFD700';
                setTimeout(() => {
                    scoreDisplay.style.transform = '';
                    scoreDisplay.style.color = '#fff';
                }, 180);
            }
            if (!hitPaddle) {
                ballObj.lastBounce = false;
            }
            if (ballObj.y + ballSize > gameHeight) {
                if (i === 0) {
                    if (extraLife.value > 0) {
                        extraLife.value--;
                        ballObj.x = (gameWidth - ballSize) / 2;
                        ballObj.y = 80;
                        ballObj.speedX = baseBallSpeed * (Math.random() > 0.5 ? 1 : -1);
                        ballObj.speedY = baseBallSpeed;
                        ballObj.speedMultiplier = 1;
                        paddle.style.background = '#00ff88';
                        setTimeout(() => paddle.style.background = '', 400);
                    } else {
                        gameActive = false;
                        showRestartButton();
                        lastTime = null;
                        return;
                    }
                } else {
                    ballsToRemove.push(i);
                    score = Math.max(0, score - 2);
                    updateHighScore(score);
                }
            }
        });
        if (ballsToRemove.length > 0) {
            ballsToRemove.sort((a, b) => b - a).forEach(idx => balls.splice(idx, 1));
        }
        draw();
        requestAnimationFrame(update);
    }

    paddleX = (gameWidth - paddleWidth) / 2;
    score = 0;
    leftPressed = false;
    rightPressed = false;
    gameActive = false;
    lastTime = null;
    highScore = parseInt(localStorage.getItem('pingpong_highscore')) || 0;
    highScoreDisplay = document.getElementById('highscore');
    if (!highScoreDisplay) {
        highScoreDisplay = document.createElement('div');
        highScoreDisplay.id = 'highscore';
        highScoreDisplay.style.position = 'absolute';
        highScoreDisplay.style.top = '10px';
        highScoreDisplay.style.right = '20px';
        highScoreDisplay.style.fontSize = '18px';
        highScoreDisplay.style.color = '#FFD700';
        highScoreDisplay.style.fontWeight = 'bold';
        highScoreDisplay.style.textShadow = '1px 1px 2px #333';
        game.appendChild(highScoreDisplay);
    }
    highScoreDisplay.textContent = 'High Score: ' + highScore;
    resetBalls();
    draw();
    showStartButton(); 
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') leftPressed = true;
        if (e.key === 'ArrowRight' || e.key === 'd') rightPressed = true;
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') leftPressed = false;
        if (e.key === 'ArrowRight' || e.key === 'd') rightPressed = false;
    });
}
