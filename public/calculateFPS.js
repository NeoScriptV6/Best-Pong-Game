let lastFrameTime = performance.now();
let frameCount = 0;
let fps = 0;

const FPSDisplay = document.createElement('div');

FPSDisplay.style.position = 'absolute';
FPSDisplay.style.top = '10px';
FPSDisplay.style.left = '10px';
FPSDisplay.style.color = 'white';
FPSDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
FPSDisplay.style.padding = '5px 10px';
FPSDisplay.style.borderRadius = '5px';
FPSDisplay.style.textAlign = 'center';


function calculateFPS() {
    const currentTime = performance.now();
    frameCount++;

    if (currentTime - lastFrameTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFrameTime = currentTime;
        FPSDisplay.textContent = fps;
    }

    requestAnimationFrame(calculateFPS);
}

requestAnimationFrame(calculateFPS);


document.body.appendChild(FPSDisplay);