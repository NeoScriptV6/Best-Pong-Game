export function requestPlayerName(socket, callback, container) {
    const nameInputBox = document.createElement('div');
    Object.assign(nameInputBox.style, {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '18px',
        padding: '14px 18px',
        borderRadius: '14px',
        background: 'rgba(0, 255, 255, 0.07)',
        border: '1.5px solid rgba(0,255,255,0.18)',
        fontFamily: "'Audiowide', 'Orbitron', sans-serif",
        animation: 'powerup-fadein 0.3s',
        color: '#fff',
        zIndex: '1000'
    });


    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 16;
    input.placeholder = 'Change name';
    Object.assign(input.style, {
        marginRight: '10px',
        padding: '10px 16px',
        borderRadius: '8px',
        border: '1.5px solid #00ffff88',
        background: 'rgba(20, 30, 40, 0.85)',
        color: '#fff',
        fontSize: '1em',
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border 0.2s, box-shadow 0.2s'
    });

    input.addEventListener('focus', () => {
        input.style.border = '1.5px solid #00ffff';
        input.style.boxShadow = '0 0 12px #00ffff88';
    });
    input.addEventListener('blur', () => {
        input.style.border = '1.5px solid #00ffff88';
        input.style.boxShadow = '0 0 8px #00ffff44';
    });

    const btn = document.createElement('button');
    btn.innerText = 'Change name';
    Object.assign(btn.style, {
        padding: '10px 22px',
        borderRadius: '8px',
        border: 'none',
        background: 'linear-gradient(90deg, #00ffff, #0077ff)',
        color: '#222',
        fontSize: '1em',
        fontWeight: 'bold',
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'background 0.2s, transform 0.15s'
    });

    btn.onclick = () => {
        const name = input.value.trim();
        if (name.length === 0) {
            alert('Please enter a name!');
            return;
        }
        socket.emit('set-name', name);
    };

    // Only input and button in the box
    nameInputBox.appendChild(input);
    nameInputBox.appendChild(btn);

    if (container) {
        container.insertBefore(nameInputBox, container.firstChild);
    } else {
        document.body.appendChild(nameInputBox);
    }

    socket.on('name-error', (msg) => {
        alert(msg);
    });

    socket.on('name-accepted', (name) => {
        input.value = '';
        input.placeholder = name;
        if (callback) callback(name);
    });
}