let selectedModeIndex = 0;
let socket = null;
let playerType = null;
let modeListRef = null; 
let powerupTypeInputs = {};

export function initMenuSocket(ioInstance) {
    socket = ioInstance;

    socket.on('update-players', (players) => {
        const playersBox = document.querySelector('.players-box');
        if (playersBox) {
            playersBox.innerHTML = '';
            players.forEach((plr) => {
                const card = document.createElement('div');
                card.className = 'player-card';
                card.style.background = plr.color;
                card.innerText = plr.name ? plr.name : plr.type;
                playersBox.appendChild(card);
            });
        }
    });


    socket.on('mode-selected', (index) => {
        selectedModeIndex = index;
        updateModeHighlight();
    });

    socket.on('powerups-enabled', (enabled) => {
        const t = document.getElementById('powerups-toggle-text');
        if (t) t.textContent = enabled ? 'Powerups: ON' : 'Powerups: OFF';
        const legend = document.getElementById('powerups-legend');
        if (legend) legend.style.opacity = enabled ? '1' : '0.5';
        const note = document.getElementById('powerups-note');
        if (note) note.textContent = enabled ? 'Powerups are enabled for this match.' : 'Powerups are disabled.';
        const sw = document.getElementById('powerups-toggle-switch');
        if (sw) {
            if (enabled) {
                sw.classList.add('on');
                sw.setAttribute('aria-checked', 'true');
            } else {
                sw.classList.remove('on');
                sw.setAttribute('aria-checked', 'false');
            }
        }
        const toggles = document.getElementById('powerups-toggles');
        if (toggles) {
            toggles.querySelectorAll('input[type="checkbox"]').forEach(chk => {
                chk.disabled = !enabled || playerType !== 'host';
            });
        }
    });

    socket.on('powerups-config', (config) => {
        Object.entries(config || {}).forEach(([type, en]) => {
            if (powerupTypeInputs[type]) {
                powerupTypeInputs[type].checked = !!en;
            }
        });
        const enabled = document.getElementById('powerups-toggle-switch')?.classList.contains('on');
        const toggles = document.getElementById('powerups-toggles');
        if (toggles) {
            toggles.querySelectorAll('input[type="checkbox"]').forEach(chk => {
                chk.disabled = !enabled || playerType !== 'host';
            });
        }
    });

    socket.on('game-start', (data) => {
        const lobby = document.getElementById('lobby');
        if (lobby) lobby.style.display = 'none';
        else {
            const mb = document.querySelector('.menu-box');
            if (mb) mb.style.display = 'none';
        }
        document.getElementById('game').style.display = 'block';
    });
}

export function buildMenu(type) {
    playerType = type;
    const lobby = document.createElement('div');
    lobby.id = 'lobby';
    lobby.style.display = 'flex';
    lobby.style.alignItems = 'flex-start';
    lobby.style.gap = '16px';
    lobby.style.flexWrap = 'nowrap';

    const menuBox = document.createElement('div');
    menuBox.className = 'menu-box';

    const nameSlot = document.createElement('div');
    nameSlot.id = 'name-input-slot';
    nameSlot.style.width = '100%';
    nameSlot.style.marginBottom = '8px';
    menuBox.appendChild(nameSlot);

    const playersBox = document.createElement('div');
    playersBox.className = 'players-box';
    menuBox.appendChild(playersBox);

    const modeList = document.createElement('ul');
    modeList.className = 'mode-list';
    modeList.style.position = 'relative';
    modeListRef = modeList;

    // time in modes is in seconds (s)
    const modes = [
        { name: 'Classic', desc: 'Every miss is a point for the enemy', time: 60 },
        { name: 'Deathmatch', desc: 'Players have 5 lives. Last player standing wins.', time: null },
        { name: 'Score to Win', desc: 'First player to reach 10 points in time wins. ', time: 150 }
    ];


    const descBox = document.createElement('div');
    descBox.className = 'description';
    descBox.style.display = 'none';
    menuBox.appendChild(descBox);

    modes.forEach((mode, idx) => {
        const item = document.createElement('li');
        item.className = 'mode-item';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between'; 
        item.style.padding = '6px 10px';
        item.style.boxSizing = 'border-box';

        const modeName = document.createElement('span');
        modeName.innerText = mode.name;
        modeName.style.flex = '1 1 auto';

        const rightGroup = document.createElement('div');
        rightGroup.style.display = 'flex';
        rightGroup.style.alignItems = 'center';
        rightGroup.style.gap = '8px';
        rightGroup.style.position = 'absolute'
        const modeTime = document.createElement('span');
        modeTime.className = 'icon';
        
        modeTime.style.display = 'inline-block';
        modeTime.style.backgroundRepeat = 'no-repeat';
        modeTime.style.backgroundSize = 'contain';

        const modeTimeText = document.createElement('span');
        modeTimeText.innerText = mode.time == null ? 'Ꝏ' : mode.time;

        if(!mode.time){
            modeTime.style.fontSize = '30px';
        }

        
        modeTimeText.style.transition = 'color 100ms ease-in-out'
        
        rightGroup.appendChild(modeTime);
        rightGroup.appendChild(modeTimeText);

        item.appendChild(modeName);
        item.appendChild(rightGroup);

        item.onmouseenter = () => {
            descBox.innerText = mode.desc;
            descBox.style.display = 'block';
        };
        item.onmouseleave = () => {
            descBox.style.display = 'none';
        };
        item.onclick = () => {
            if (playerType === 'host') {
            selectMode(idx, modeList);
            if (socket) socket.emit('mode-selected', idx);
            }
     
        };

   
        modeList.appendChild(item);
    });



    menuBox.appendChild(modeList);

    const powerupsPanel = document.createElement('aside');
    powerupsPanel.id = 'powerups-panel';
    powerupsPanel.style.padding = '10px 12px';
    powerupsPanel.style.background = 'rgba(0,0,0,0.35)';
    powerupsPanel.style.border = '1px solid #555';
    powerupsPanel.style.borderRadius = '8px';
    powerupsPanel.style.display = 'flex';
    powerupsPanel.style.flexDirection = 'column';
    powerupsPanel.style.gap = '10px';
    powerupsPanel.style.width = '320px';

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.alignItems = 'center';
    headerRow.style.justifyContent = 'space-between';

    const headerTitle = document.createElement('div');
    headerTitle.textContent = 'Powerups';
    headerTitle.style.fontWeight = '600';
    headerRow.appendChild(headerTitle);

    const toggleWrap = document.createElement('div');
    toggleWrap.style.display = 'flex';
    toggleWrap.style.alignItems = 'center';
    toggleWrap.style.gap = '10px';
    const toggleText = document.createElement('div');
    toggleText.id = 'powerups-toggle-text';
    toggleText.textContent = 'Powerups: OFF';
    const switchEl = document.createElement('div');
    switchEl.id = 'powerups-toggle-switch';
    switchEl.className = 'toggle-switch';
    switchEl.setAttribute('role', 'switch');
    switchEl.setAttribute('aria-checked', 'false');
    const knob = document.createElement('span');
    knob.className = 'knob';
    switchEl.appendChild(knob);
    if (playerType === 'host') {
        switchEl.onclick = () => {
            const next = !switchEl.classList.contains('on');
            if (socket) socket.emit('powerups-toggle', next);
        };
    } else {
        switchEl.style.pointerEvents = 'none';
        switchEl.style.opacity = '0.7';
    }
    toggleWrap.appendChild(toggleText);
    toggleWrap.appendChild(switchEl);
    headerRow.appendChild(toggleWrap);
    powerupsPanel.appendChild(headerRow);

    const legendNote = document.createElement('div');
    legendNote.id = 'powerups-note';
    legendNote.style.fontSize = '12px';
    legendNote.style.opacity = '0.85';
    legendNote.textContent = 'Powerups are disabled.';
    powerupsPanel.appendChild(legendNote);

    const togglesBox = document.createElement('div');
    togglesBox.id = 'powerups-toggles';
    togglesBox.style.display = 'grid';
    togglesBox.style.gridTemplateColumns = '1fr';
    togglesBox.style.gap = '8px';
    const items = [
        { type: 'score', label: '+5 Score', icon: 'icons/score.png' },
        { type: 'slow', label: 'Slow ball (global)', icon: 'icons/slow.png' },
        { type: 'big_paddle', label: 'Big paddle', icon: 'icons/big_paddle.png' },
        { type: 'small_ball', label: 'Small ball (global)', icon: 'icons/small_ball.png' },
        { type: 'multiplier', label: '2x points', icon: 'icons/multiplier.png' },
        { type: 'extra_life', label: 'Extra life', icon: 'icons/extra_life.png' },
        { type: 'reverse', label: 'Reverse others\' controls', icon: 'icons/reverse.png' }
    ];
    powerupTypeInputs = {};
    items.forEach(it => {
        const row = document.createElement('label');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.gap = '8px';
        row.style.padding = '6px 8px';
        row.style.background = 'rgba(255,255,255,0.03)';
        row.style.border = '1px solid rgba(255,255,255,0.06)';
        row.style.borderRadius = '6px';

        const leftGrp = document.createElement('div');
        leftGrp.style.display = 'flex';
        leftGrp.style.alignItems = 'center';
        leftGrp.style.gap = '8px';
        const img = document.createElement('img');
        img.src = it.icon; img.alt = it.type; img.width = 22; img.height = 22;
        const span = document.createElement('span');
        span.textContent = it.label;
        leftGrp.appendChild(img); leftGrp.appendChild(span);
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.dataset.type = it.type;
        chk.disabled = playerType !== 'host';
        chk.addEventListener('change', () => {
            if (playerType !== 'host') { chk.checked = !chk.checked; return; }
            const enabled = chk.checked;
            socket && socket.emit('powerups-set-type', { type: it.type, enabled });
        });
        powerupTypeInputs[it.type] = chk;

        row.appendChild(leftGrp);
        row.appendChild(chk);
        togglesBox.appendChild(row);
    });
    powerupsPanel.appendChild(togglesBox);

    const legend = document.createElement('div');
    legend.id = 'powerups-legend';
    legend.style.paddingTop = '4px';
    legend.style.display = 'grid';
    legend.style.gridTemplateColumns = '1fr';
    legend.style.gap = '6px';

    function row(icon, text) {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '8px';
        const img = document.createElement('img');
        img.src = icon; img.alt = text; img.width = 20; img.height = 20;
        const span = document.createElement('span');
        span.textContent = text;
        wrap.appendChild(img); wrap.appendChild(span);
        return wrap;
    }
    legend.appendChild(row('icons/score.png', '+5 Score'));
    legend.appendChild(row('icons/slow.png', 'Slow ball (4s)'));
    legend.appendChild(row('icons/big_paddle.png', 'Big paddle (4s)'));
    legend.appendChild(row('icons/small_ball.png', 'Small ball (4s)'));
    legend.appendChild(row('icons/multiplier.png', '2x points (4s)'));
    legend.appendChild(row('icons/extra_life.png', 'Extra life (save once)'));
    legend.appendChild(row('icons/reverse.png', 'Reverse controls (4s)'));
    powerupsPanel.appendChild(legend);

    let startOrWait;
    if (playerType === 'host') {
        startOrWait = document.createElement('button');
        startOrWait.className = 'start-button';
        startOrWait.innerText = 'Start Game';
        startOrWait.addEventListener('click', () => {
            if (socket) socket.emit('start-game');
            startGame();
        });
    } else {
        startOrWait = document.createElement('div');
        startOrWait.style.marginTop = '20px';
        startOrWait.style.fontSize = '1.2em';
        startOrWait.style.color = '#FFD700';
        startOrWait.innerText = 'Waiting for host...';
    }
    menuBox.appendChild(startOrWait);

    const joinBtn = document.createElement('button');
    joinBtn.id = 'join-btn';
    joinBtn.className = 'start-button';
    joinBtn.innerText = 'Join Game';
    joinBtn.style.display = 'none';
    joinBtn.onclick = () => {
        if (socket) socket.emit('join');
        joinBtn.style.display = 'none';
    };
    menuBox.appendChild(joinBtn);

    lobby.appendChild(menuBox);
    lobby.appendChild(powerupsPanel);


    setTimeout(updateModeHighlight, 0);

    return lobby;
}

export function toggleMenu(menuBox) {
    menuBox.style.display = menuBox.style.display === 'none' ? 'block' : 'none';
}

function selectMode(index, modeList) {
    selectedModeIndex = index;
    updateModeHighlight();
}

function updateModeHighlight() {
    if (!modeListRef) return;
    modeListRef.querySelectorAll('.mode-item').forEach((item, idx) => {
        if (idx === selectedModeIndex) {
            item.classList.add('selected');
            
        } else {
            item.classList.remove('selected');
        }
    });
}

export function startGame() {
    const lobby = document.getElementById('lobby');
    if (lobby) lobby.style.display = 'none';
    else {
        const mb = document.querySelector('.menu-box');
        if (mb) mb.style.display = 'none';
    }
    document.getElementById('game').style.display = 'block';
}