// Handles the effect of a collected powerup
export function applyPowerup(type, context) {
    switch (type) {
        case POWERUP_TYPES.SCORE:
            context.score.value += 5;
            context.updateHighScore(context.score.value);
            context.scoreDisplay.textContent = 'Score: ' + context.score.value;
            break; 
        case POWERUP_TYPES.SLOW:
            // Only affect main ball
            if (context.balls && context.balls.length > 0) {
                context.balls[0].speedMultiplier *= 0.5;
                setTimeout(() => {
                    if (context.balls && context.balls.length > 0) {
                        context.balls[0].speedMultiplier *= 2;
                    }
                }, 4000);
            }
            break;
        case POWERUP_TYPES.BIG_PADDLE:
            context.paddle.style.transition = 'width 0.3s';
            context.paddle.style.width = (context.paddleWidth * 1.7) + 'px';
            setTimeout(() => {
                context.paddle.style.width = context.paddleWidth + 'px';
            }, 4000);
            break;
        case POWERUP_TYPES.SMALL_BALL:
            // Only shrink main ball DOM element for 4 seconds
            let ballEl = context.ball;
            if (ballEl && ballEl.style) {
                ballEl.style.transition = 'width 0.3s, height 0.3s';
                ballEl.style.width = '8px';
                ballEl.style.height = '8px';
            }
            setTimeout(() => {
                let ballEl = context.ball;
                if (ballEl && ballEl.style) {
                    ballEl.style.width = context.ballSize + 'px';
                    ballEl.style.height = context.ballSize + 'px';
                }
            }, 4000);
            break;
        case POWERUP_TYPES.MULTIPLIER:
            // Double scoring for 4 seconds (except +5 powerup)
            context.multiplierActive.value = true;
            setTimeout(() => {
                context.multiplierActive.value = false;
            }, 4000);
            break;
        case POWERUP_TYPES.EXTRA_LIFE:
            // Grant an extra life (prevent game over once)
            if (context.extraLife) {
                context.extraLife.value++;
            }
            break;
        case POWERUP_TYPES.REVERSE:
            // Reverse paddle controls for 4 seconds
            if (context.reverseActive) {
                context.reverseActive.value = true;
                setTimeout(() => {
                    context.reverseActive.value = false;
                }, 4000);
            }
            break;
        // Add other powerup effects here
    }
}

export const POWERUP_TYPES = {
    SCORE: 'score',
    SLOW: 'slow',
    BIG_PADDLE: 'big_paddle',
    SMALL_BALL: 'small_ball',
    MULTIPLIER: 'multiplier',
    EXTRA_LIFE: 'extra_life',
    REVERSE: 'reverse'
};

export function createPowerup(type, gameWidth, gameHeight) {
    const box = document.createElement('div');
    let label = '';
    let className = '';
    let iconSrc = '';
    switch (type) {
        case POWERUP_TYPES.SCORE:
            label = '';
            className = 'powerup-yellow';
            iconSrc = 'icons/score.png';
            break;
        case POWERUP_TYPES.SLOW:
            label = '';
            className = 'powerup-green';
            iconSrc = 'icons/slow.png';
            break;
        case POWERUP_TYPES.BIG_PADDLE:
            label = '';
            className = 'powerup-green';
            iconSrc = 'icons/big_paddle.png';
            break;
        case POWERUP_TYPES.SMALL_BALL:
            label = '';
            className = 'powerup-red';
            iconSrc = 'icons/small_ball.png';
            break;
        case POWERUP_TYPES.MULTIPLIER:
            label = '';
            className = 'powerup-yellow';
            iconSrc = 'icons/multiplier.png';
            break;
        case POWERUP_TYPES.EXTRA_LIFE:
            label = '';
            className = 'powerup-green';
            iconSrc = 'icons/extra_life.png';
            break;
        case POWERUP_TYPES.REVERSE:
            label = '';
            className = 'powerup-red';
            iconSrc = 'icons/reverse.png';
            break;
        default:
            label = '';
            className = 'powerup-unknown';
    }
    box.className = className;
    if (iconSrc) {
        const icon = document.createElement('img');
        icon.src = iconSrc;
        icon.alt = type;
        icon.style.width = '32px';
        icon.style.height = '32px';
        icon.style.display = 'block';
        icon.style.margin = 'auto';
        box.appendChild(icon);
    } else {
        box.textContent = label;
    }
    const margin = 10;
    const x = Math.floor(Math.random() * (gameWidth - 40 - margin * 2)) + margin;
    const y = Math.floor(Math.random() * (gameHeight - 40 - margin * 2)) + margin;
    box.style.left = x + 'px';
    box.style.top = y + 'px';
    return box;
}
