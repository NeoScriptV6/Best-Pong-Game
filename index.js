const game = document.getElementById('game');
const paddle = document.getElementById('paddle');
const ball = document.getElementById('ball');
const scoreDisplay = document.getElementById('score');

const gameWidth = 600;
const gameHeight = 600;
const paddleWidth = 80;
const paddleHeight = 15;
const ballSize = 15;
 
let paddleX = (gameWidth - paddleWidth) / 2;
let ballX = (gameWidth - ballSize) / 2;
let ballY = 80; 
let lastTime = null;
let paddleSpeed = 400; // pixels per second
let baseBallSpeed = 400; // pixels per second
let ballSpeedX = baseBallSpeed * (Math.random() > 0.5 ? 1 : -1);
let ballSpeedY = baseBallSpeed;
let score = 0;
let leftPressed = false;
let rightPressed = false;
let gameActive = false;
let restartBtn;
let startBtn;

function draw() {
    paddle.style.left = paddleX + 'px';
    ball.style.left = ballX + 'px';
    ball.style.top = ballY + 'px';
    scoreDisplay.textContent = 'Score: ' + score;
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
            score = 0;
            ballX = (gameWidth - ballSize) / 2;
            ballY = 80;
            ballSpeedY = baseBallSpeed;
            ballSpeedX = baseBallSpeed * (Math.random() > 0.5 ? 1 : -1);
            paddleX = (gameWidth - paddleWidth) / 2; // Reset paddle to mid
            gameActive = true;
            lastTime = null;
            startBtn.remove();
            startBtn = null;
            requestAnimationFrame(update);
        };
        game.appendChild(startBtn);
    }
}

// Restart button for when you losex
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
            score = 0;
            ballX = (gameWidth - ballSize) / 2;
            ballY = 80;
            ballSpeedY = baseBallSpeed;
            ballSpeedX = baseBallSpeed * (Math.random() > 0.5 ? 1 : -1);
            paddleX = (gameWidth - paddleWidth) / 2; // Reset paddle to mid
            gameActive = true;
            lastTime = null;
            restartBtn.remove();
            restartBtn = null;
            requestAnimationFrame(update);
        };
        game.appendChild(restartBtn);
    }
}

function update(currentTime) {
    if (!gameActive) return;
    if (!lastTime) lastTime = currentTime;
    const delta = (currentTime - lastTime) / 1000; // seconds
    lastTime = currentTime;

    // Move paddle
    if (leftPressed) paddleX -= paddleSpeed * delta;
    if (rightPressed) paddleX += paddleSpeed * delta;
    paddleX = Math.max(0, Math.min(gameWidth - paddleWidth, paddleX));

    // Move ball
    ballX += ballSpeedX * delta;
    ballY += ballSpeedY * delta;

    // Ball collision with walls
    if (ballX <= 0 || ballX + ballSize >= gameWidth) {
        ballSpeedX *= -1;
    }
    if (ballY <= 0) {
        ballSpeedY *= -1;
    }

    if (
        ballY + ballSize >= gameHeight - paddleHeight - 10 &&
        ballX + ballSize > paddleX &&
        ballX < paddleX + paddleWidth
    ) {
        ballSpeedY *= -1;
        ballY = gameHeight - paddleHeight - ballSize - 10;
        score++;
        if (score % 5 === 0) {
            ballSpeedX *= 1.1;
            ballSpeedY *= 1.1;
        }
    }

    if (ballY + ballSize > gameHeight) {
        gameActive = false;
        showRestartButton();
        lastTime = null;
        return;
    }

    draw();
    requestAnimationFrame(update);
}

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