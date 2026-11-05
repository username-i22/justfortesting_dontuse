// Main Game Controller
document.addEventListener('DOMContentLoaded', () => {
    // Screens
    const screenMenu = document.getElementById('screen-menu');
    const screenLobby = document.getElementById('screen-lobby');
    const screenBattle = document.getElementById('screen-battle');

    // Menu Buttons
    const btnSolo = document.getElementById('btn-solo');
    const btnMulti = document.getElementById('btn-multi');
    const btnCreateRoom = document.getElementById('btn-create-room');
    const btnJoinRoom = document.getElementById('btn-join-room');
    const btnLobbyBack = document.getElementById('btn-lobby-back');
    const btnBattleExit = document.getElementById('btn-battle-exit');
    const btnPlayAgain = document.getElementById('btn-play-again');
    const btnSoundToggle = document.getElementById('btn-sound-toggle');

    // Inputs & Lobby UI
    const inputRoomCode = document.getElementById('input-room-code');
    const hostInfo = document.getElementById('host-info');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const lobbyStatus = document.getElementById('lobby-status');

    // Battle Canvases & HUD
    const p1Canvas = document.getElementById('p1-board');
    const p1HoldCanvas = document.getElementById('p1-hold');
    const p1NextCanvas = document.getElementById('p1-next');
    const p1GarbageBar = document.getElementById('p1-garbage');
    const p1ScoreEl = document.getElementById('p1-score');
    const p1KosEl = document.getElementById('p1-kos');
    const p1NameEl = document.getElementById('p1-name');

    const p2Canvas = document.getElementById('p2-board');
    const p2HoldCanvas = document.getElementById('p2-hold');
    const p2NextCanvas = document.getElementById('p2-next');
    const p2GarbageBar = document.getElementById('p2-garbage');
    const p2ScoreEl = document.getElementById('p2-score');
    const p2KosEl = document.getElementById('p2-kos');
    const p2NameEl = document.getElementById('p2-name');

    const matchTimerEl = document.getElementById('match-timer');
    const matchBanner = document.getElementById('match-banner');
    const gameOverModal = document.getElementById('gameover-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');

    // State Variables
    let gameMode = 'solo'; // 'solo' or 'multi'
    let p1Engine = null;
    let p2Engine = null;
    let aiController = null;
    let network = null;
    let lastTime = 0;
    let matchTimeLeft = 120; // 2 minutes Tetris Battle standard
    let matchTimerInterval = null;
    let animationFrameId = null;
    let isMatchRunning = false;

    // Sound toggle button
    btnSoundToggle.addEventListener('click', () => {
        const isMuted = window.soundManager.toggleMute();
        btnSoundToggle.textContent = isMuted ? '🔇' : '🔊';
    });

    // Screen navigation
    function showScreen(screen) {
        [screenMenu, screenLobby, screenBattle].forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    // Banner message popups (e.g., TETRIS, KO!)
    function showBanner(text, cssClass = 'banner-tetris') {
        matchBanner.className = `banner-overlay ${cssClass} show`;
        matchBanner.textContent = text;
        setTimeout(() => {
            matchBanner.className = 'banner-overlay';
        }, 1200);
    }

    // Input handlers with DAS (Delayed Auto Shift) & ARR (Auto Repeat Rate)
    // DAS: delay before auto-repeating starts (ms)
    // ARR: interval between repeated moves once active (ms)
    const DAS = 160;
    const ARR = 40;
    const SOFT_DROP_INTERVAL = 45;

    const inputState = {
        left: { pressed: false, timePressed: 0, timer: 0 },
        right: { pressed: false, timePressed: 0, timer: 0 },
        down: { pressed: false, timer: 0 }
    };

    window.addEventListener('keydown', (e) => {
        if (!isMatchRunning || !p1Engine) return;

        // Prevent scrolling with arrows and space
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }

        if (e.repeat) return; // Prevent erratic browser default OS repeat

        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                inputState.left.pressed = true;
                inputState.left.timePressed = performance.now();
                inputState.left.timer = 0;
                // Move immediately on tap
                if (p1Engine.move(-1)) window.soundManager.play('move');
                syncPlayerState();
                break;
            case 'ArrowRight':
            case 'KeyD':
                inputState.right.pressed = true;
                inputState.right.timePressed = performance.now();
                inputState.right.timer = 0;
                // Move immediately on tap
                if (p1Engine.move(1)) window.soundManager.play('move');
                syncPlayerState();
                break;
            case 'ArrowDown':
            case 'KeyS':
                inputState.down.pressed = true;
                inputState.down.timer = 0;
                if (p1Engine.moveDown()) window.soundManager.play('drop');
                syncPlayerState();
                break;
            case 'ArrowUp':
            case 'KeyW':
                if (p1Engine.rotate(1)) window.soundManager.play('rotate');
                syncPlayerState();
                break;
            case 'Space':
                p1Engine.hardDrop();
                window.soundManager.play('hardDrop');
                syncPlayerState();
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
            case 'KeyC':
                if (p1Engine.hold()) window.soundManager.play('hold');
                syncPlayerState();
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                inputState.left.pressed = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                inputState.right.pressed = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                inputState.down.pressed = false;
                break;
        }
    });

    function updateInputs(deltaTime) {
        if (!isMatchRunning || !p1Engine) return;

        // Resolve left/right holding
        let activeDir = null;
        if (inputState.left.pressed && inputState.right.pressed) {
            // Prioritize the more recently pressed key
            activeDir = inputState.left.timePressed > inputState.right.timePressed ? 'left' : 'right';
        } else if (inputState.left.pressed) {
            activeDir = 'left';
        } else if (inputState.right.pressed) {
            activeDir = 'right';
        }

        if (activeDir) {
            const state = inputState[activeDir];
            state.timer += deltaTime;

            if (state.timer >= DAS) {
                // Once DAS delay passed, slide piece repeatedly based on ARR
                const repeatTime = state.timer - DAS;
                const steps = Math.floor(repeatTime / ARR);
                if (steps > 0) {
                    const dx = activeDir === 'left' ? -1 : 1;
                    let moved = false;
                    for (let i = 0; i < steps; i++) {
                        if (p1Engine.move(dx)) {
                            moved = true;
                        }
                    }
                    if (moved) {
                        window.soundManager.play('move');
                        syncPlayerState();
                    }
                    // Keep remainder to preserve smooth sliding timing
                    state.timer = DAS + (repeatTime % ARR);
                }
            }
        }

        // Soft drop repeat while holding down
        if (inputState.down.pressed) {
            inputState.down.timer += deltaTime;
            if (inputState.down.timer >= SOFT_DROP_INTERVAL) {
                inputState.down.timer = 0;
                if (p1Engine.moveDown()) {
                    window.soundManager.play('drop');
                    syncPlayerState();
                }
            }
        }
    }

    // Touch Controls support for mobile / small screens
    const touchButtons = document.querySelectorAll('[data-action]');
    touchButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isMatchRunning || !p1Engine) return;
            const action = btn.dataset.action;
            if (action === 'left') { if (p1Engine.move(-1)) window.soundManager.play('move'); }
            else if (action === 'right') { if (p1Engine.move(1)) window.soundManager.play('move'); }
            else if (action === 'down') { if (p1Engine.moveDown()) window.soundManager.play('drop'); }
            else if (action === 'rotate') { if (p1Engine.rotate(1)) window.soundManager.play('rotate'); }
            else if (action === 'drop') { p1Engine.hardDrop(); window.soundManager.play('hardDrop'); }
            else if (action === 'hold') { if (p1Engine.hold()) window.soundManager.play('hold'); }
            syncPlayerState();
        });
    });

    // Sync player state over WebRTC in multiplayer
    function syncPlayerState() {
        if (gameMode === 'multi' && network) {
            network.send({
                type: 'state',
                state: p1Engine.getState()
            });
        }
    }

    // Start Battle Match
    function startMatch(mode) {
        gameMode = mode;
        showScreen(screenBattle);
        gameOverModal.classList.remove('active');

        // Reset input state
        inputState.left.pressed = false;
        inputState.right.pressed = false;
        inputState.down.pressed = false;

        // Setup Player 1
        p1Engine = new TetrisEngine(false, (lines) => {
            // Player 1 attacks Opponent
            window.soundManager.play(lines >= 4 ? 'tetris' : 'attack');
            if (lines >= 4) showBanner('TETRIS!');

            if (gameMode === 'solo' && p2Engine) {
                p2Engine.addGarbage(lines);
                window.soundManager.play('receiveAttack');
            } else if (gameMode === 'multi' && network) {
                network.send({ type: 'attack', lines: lines });
            }
        }, () => {
            // Player 1 KO'd
            window.soundManager.play('ko');
            showBanner('KO!', 'banner-ko');
            if (p2Engine) p2Engine.koCount++;
            if (gameMode === 'multi' && network) {
                network.send({ type: 'ko' });
            }
        });

        // Setup Opponent (P2)
        if (gameMode === 'solo') {
            p2NameEl.innerHTML = '🤖 AI Bot';
            p1NameEl.innerHTML = '👤 You';

            p2Engine = new TetrisEngine(true, (lines) => {
                // AI attacks Player 1
                p1Engine.addGarbage(lines);
                window.soundManager.play('receiveAttack');
            }, () => {
                // AI KO'd
                window.soundManager.play('ko');
                p1Engine.koCount++;
                showBanner('YOU SCORED A KO!', 'banner-tetris');
            });

            aiController = new TetrisAI(p2Engine);
        } else {
            p1NameEl.innerHTML = '👤 You';
            p2NameEl.innerHTML = '⚔️ Opponent';
            p2Engine = new TetrisEngine(false, null, null, true); // remote engine
            aiController = null;
        }

        // Timer setup (2 minutes standard)
        matchTimeLeft = 120;
        updateTimerDisplay();
        if (matchTimerInterval) clearInterval(matchTimerInterval);
        matchTimerInterval = setInterval(() => {
            matchTimeLeft--;
            updateTimerDisplay();
            if (matchTimeLeft <= 0) {
                endMatch();
            }
        }, 1000);

        window.soundManager.play('start');
        window.soundManager.playBGM();
        isMatchRunning = true;
        lastTime = performance.now();

        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function updateTimerDisplay() {
        const mins = Math.floor(matchTimeLeft / 60);
        const secs = matchTimeLeft % 60;
        matchTimerEl.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // Main Game Loop
    function gameLoop(time) {
        if (!isMatchRunning) return;
        const deltaTime = time - lastTime;
        lastTime = time;

        // Process holding keys (DAS / ARR auto-shift and soft-drop)
        updateInputs(deltaTime);

        // Update player 1
        p1Engine.update(deltaTime);

        // Update AI in solo mode
        if (gameMode === 'solo' && p2Engine && aiController) {
            p2Engine.update(deltaTime);
            aiController.update(deltaTime);
        }

        // Render boards
        window.renderer.drawBoard(p1Canvas, p1Engine, false);
        window.renderer.drawBoard(p2Canvas, p2Engine, true);

        // Render Hold & Next pieces
        window.renderer.drawMiniPiece(p1HoldCanvas, p1Engine.holdPieceType);
        window.renderer.drawMiniPiece(p1NextCanvas, p1Engine.queue[0]);

        window.renderer.drawMiniPiece(p2HoldCanvas, p2Engine.holdPieceType);
        window.renderer.drawMiniPiece(p2NextCanvas, p2Engine.queue[0]);

        // Render Garbage Meters
        const p1GarbageTotal = p1Engine.garbageQueue.reduce((a, b) => a + b, 0);
        p1GarbageBar.style.height = `${Math.min(100, (p1GarbageTotal / 20) * 100)}%`;

        const p2GarbageTotal = p2Engine.garbageCount !== undefined ? p2Engine.garbageCount : p2Engine.garbageQueue.reduce((a, b) => a + b, 0);
        p2GarbageBar.style.height = `${Math.min(100, (p2GarbageTotal / 20) * 100)}%`;

        // Update KO & Score labels
        p1KosEl.textContent = p1Engine.koCount;
        p2KosEl.textContent = p2Engine.koCount;
        p1ScoreEl.textContent = p1Engine.score;
        p2ScoreEl.textContent = p2Engine.score;

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function endMatch() {
        isMatchRunning = false;
        clearInterval(matchTimerInterval);
        window.soundManager.stopBGM();

        let won = false;
        if (p1Engine.koCount > p2Engine.koCount) {
            won = true;
        } else if (p1Engine.koCount === p2Engine.koCount) {
            won = p1Engine.score >= p2Engine.score;
        }

        if (won) {
            modalTitle.textContent = 'VICTORY!';
            modalTitle.style.color = '#38bdf8';
            modalDesc.textContent = `You won the battle with ${p1Engine.koCount} KO(s) and ${p1Engine.score} points!`;
            window.soundManager.play('win');
        } else {
            modalTitle.textContent = 'DEFEAT!';
            modalTitle.style.color = '#ef4444';
            modalDesc.textContent = `Opponent won with ${p2Engine.koCount} KO(s). Better luck next time!`;
            window.soundManager.play('lose');
        }

        gameOverModal.classList.add('active');
    }

    // Button event listeners
    btnSolo.addEventListener('click', () => {
        startMatch('solo');
    });

    btnMulti.addEventListener('click', () => {
        showScreen(screenLobby);
        hostInfo.style.display = 'none';
        lobbyStatus.textContent = 'Create a room to invite a friend, or enter their room code.';
    });

    btnLobbyBack.addEventListener('click', () => {
        if (network) network.disconnect();
        showScreen(screenMenu);
    });

    btnBattleExit.addEventListener('click', () => {
        isMatchRunning = false;
        clearInterval(matchTimerInterval);
        window.soundManager.stopBGM();
        if (network) network.disconnect();
        showScreen(screenMenu);
    });

    btnPlayAgain.addEventListener('click', () => {
        gameOverModal.classList.remove('active');
        if (gameMode === 'solo') {
            startMatch('solo');
        } else {
            startMatch('multi');
        }
    });

    // Multiplayer Networking
    btnCreateRoom.addEventListener('click', () => {
        lobbyStatus.textContent = 'Creating room on peer-to-peer network...';
        btnCreateRoom.disabled = true;

        network = new NetworkManager(
            // On Connected
            (isHost) => {
                lobbyStatus.textContent = 'Opponent connected! Starting battle...';
                setTimeout(() => {
                    startMatch('multi');
                }, 1000);
            },
            // On Data Received
            (data) => {
                handleNetworkData(data);
            },
            // On Error
            (err) => {
                lobbyStatus.textContent = 'Connection error: ' + (err.message || 'Could not connect.');
                btnCreateRoom.disabled = false;
            }
        );

        network.createRoom((code) => {
            roomCodeDisplay.textContent = code;
            hostInfo.style.display = 'block';
            lobbyStatus.textContent = 'Share this code with your friend. Waiting for them to join...';
        });
    });

    btnJoinRoom.addEventListener('click', () => {
        const code = inputRoomCode.value.trim();
        if (!code) {
            alert('Please enter a valid 5-letter Room Code.');
            return;
        }

        lobbyStatus.textContent = `Connecting to room ${code}...`;
        btnJoinRoom.disabled = true;

        network = new NetworkManager(
            (isHost) => {
                lobbyStatus.textContent = 'Connected to host! Starting battle...';
                setTimeout(() => {
                    startMatch('multi');
                }, 1000);
            },
            (data) => {
                handleNetworkData(data);
            },
            (err) => {
                lobbyStatus.textContent = 'Connection failed. Check the room code and try again.';
                btnJoinRoom.disabled = false;
            }
        );

        network.joinRoom(code);
    });

    function handleNetworkData(data) {
        if (!data || !p2Engine) return;

        if (data.type === 'state') {
            p2Engine.applyState(data.state);
        } else if (data.type === 'attack') {
            p1Engine.addGarbage(data.lines);
            window.soundManager.play('receiveAttack');
        } else if (data.type === 'ko') {
            p1Engine.koCount++;
            window.soundManager.play('ko');
            showBanner('YOU SCORED A KO!', 'banner-tetris');
        }
    }
});
