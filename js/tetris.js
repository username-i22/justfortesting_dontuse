// Tetromino Definitions & Colors
const TETROMINOES = {
    I: {
        shape: [
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        color: '#00f0f0',
        glow: 'rgba(0, 240, 240, 0.6)'
    },
    J: {
        shape: [
            [1, 0, 0],
            [1, 1, 1],
            [0, 0, 0]
        ],
        color: '#2040ff',
        glow: 'rgba(32, 64, 255, 0.6)'
    },
    L: {
        shape: [
            [0, 0, 1],
            [1, 1, 1],
            [0, 0, 0]
        ],
        color: '#ff8800',
        glow: 'rgba(255, 136, 0, 0.6)'
    },
    O: {
        shape: [
            [1, 1],
            [1, 1]
        ],
        color: '#f8e71c',
        glow: 'rgba(248, 231, 28, 0.6)'
    },
    S: {
        shape: [
            [0, 1, 1],
            [1, 1, 0],
            [0, 0, 0]
        ],
        color: '#44dd44',
        glow: 'rgba(68, 221, 68, 0.6)'
    },
    T: {
        shape: [
            [0, 1, 0],
            [1, 1, 1],
            [0, 0, 0]
        ],
        color: '#b026ff',
        glow: 'rgba(176, 38, 255, 0.6)'
    },
    Z: {
        shape: [
            [1, 1, 0],
            [0, 1, 1],
            [0, 0, 0]
        ],
        color: '#ff3344',
        glow: 'rgba(255, 51, 68, 0.6)'
    }
};

const PIECE_KEYS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

// Tetris Battle Line Clear Garbage Attack Table
// 1 line -> 0
// 2 lines -> 1
// 3 lines -> 2
// 4 lines (Tetris) -> 4
// Perfect Clear bonus -> +4
// Combo lines: combo 1: 0, combo 2: 1, combo 3: 1, combo 4: 2, combo 5: 2, combo 6: 3, etc.
function calculateGarbage(linesCleared, combo) {
    let base = 0;
    if (linesCleared === 2) base = 1;
    else if (linesCleared === 3) base = 2;
    else if (linesCleared === 4) base = 4;

    let comboBonus = 0;
    if (combo > 1) {
        if (combo <= 2) comboBonus = 1;
        else if (combo <= 4) comboBonus = 2;
        else if (combo <= 6) comboBonus = 3;
        else comboBonus = 4;
    }

    return base + comboBonus;
}

class TetrisEngine {
    constructor(isAI = false, onAttack = null, onKO = null, isRemote = false) {
        this.cols = 10;
        this.rows = 20;
        this.grid = this.createGrid();
        this.isAI = isAI;
        this.isRemote = isRemote; // Remote player in multiplayer

        this.onAttack = onAttack; // Callback to send garbage to opponent
        this.onKO = onKO;         // Callback when topped out

        this.currentPiece = null;
        this.holdPieceType = null;
        this.canHold = true;
        this.bag = [];
        this.queue = [];

        this.garbageQueue = []; // Incoming garbage rows
        this.score = 0;
        this.lines = 0;
        this.koCount = 0;
        this.combo = 0;

        this.dropInterval = 900; // ms
        this.lastDropTime = 0;
        this.lockDelay = 450;
        this.lockTimer = 0;
        this.isLocking = false;

        this.isGameOver = false;
        this.paused = false;

        this.fillQueue();
        this.spawnPiece();
    }

    createGrid() {
        return Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    }

    reset() {
        this.grid = this.createGrid();
        this.currentPiece = null;
        this.holdPieceType = null;
        this.canHold = true;
        this.bag = [];
        this.queue = [];
        this.garbageQueue = [];
        this.score = 0;
        this.lines = 0;
        this.combo = 0;
        this.isGameOver = false;
        this.fillQueue();
        this.spawnPiece();
    }

    generateBag() {
        const bag = [...PIECE_KEYS];
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        return bag;
    }

    fillQueue() {
        while (this.queue.length < 5) {
            if (this.bag.length === 0) {
                this.bag = this.generateBag();
            }
            this.queue.push(this.bag.pop());
        }
    }

    spawnPiece(type = null) {
        const pieceType = type || this.queue.shift();
        this.fillQueue();
        const def = TETROMINOES[pieceType];
        
        // Spawn centered at the top
        const shape = def.shape.map(row => [...row]);
        const x = Math.floor((this.cols - shape[0].length) / 2);
        const y = pieceType === 'I' ? -1 : 0;

        this.currentPiece = {
            type: pieceType,
            shape: shape,
            x: x,
            y: y,
            color: def.color,
            glow: def.glow
        };

        this.canHold = true;
        this.isLocking = false;
        this.lockTimer = 0;

        // Check if spawn position is blocked (Top out)
        if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
            this.triggerKO();
        }
    }

    checkCollision(offsetX, offsetY, shape) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const newX = offsetX + c;
                    const newY = offsetY + r;

                    if (newX < 0 || newX >= this.cols || newY >= this.rows) {
                        return true;
                    }
                    if (newY >= 0 && this.grid[newY][newX] !== 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    rotateMatrix(matrix, dir = 1) {
        const N = matrix.length;
        const result = Array.from({ length: N }, () => Array(N).fill(0));
        for (let r = 0; r < N; r++) {
            for (let c = 0; c < N; c++) {
                if (dir === 1) { // clockwise
                    result[c][N - 1 - r] = matrix[r][c];
                } else { // counter-clockwise
                    result[N - 1 - c][r] = matrix[r][c];
                }
            }
        }
        return result;
    }

    rotate(dir = 1) {
        if (!this.currentPiece || this.isGameOver) return false;
        if (this.currentPiece.type === 'O') return true; // O doesn't need rotation

        const rotated = this.rotateMatrix(this.currentPiece.shape, dir);
        
        // Wall kicks (simple basic kicks)
        const kicks = [0, -1, 1, -2, 2];
        for (let kick of kicks) {
            if (!this.checkCollision(this.currentPiece.x + kick, this.currentPiece.y, rotated)) {
                this.currentPiece.shape = rotated;
                this.currentPiece.x += kick;
                if (this.isLocking) this.lockTimer = 0; // Reset lock delay
                return true;
            }
        }
        return false;
    }

    move(dx) {
        if (!this.currentPiece || this.isGameOver) return false;
        if (!this.checkCollision(this.currentPiece.x + dx, this.currentPiece.y, this.currentPiece.shape)) {
            this.currentPiece.x += dx;
            if (this.isLocking) this.lockTimer = 0; // Reset lock delay
            return true;
        }
        return false;
    }

    moveDown() {
        if (!this.currentPiece || this.isGameOver) return false;
        if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
            this.currentPiece.y += 1;
            return true;
        } else {
            this.isLocking = true;
            return false;
        }
    }

    getGhostY() {
        if (!this.currentPiece) return 0;
        let ghostY = this.currentPiece.y;
        while (!this.checkCollision(this.currentPiece.x, ghostY + 1, this.currentPiece.shape)) {
            ghostY++;
        }
        return ghostY;
    }

    hardDrop() {
        if (!this.currentPiece || this.isGameOver) return 0;
        let dropped = 0;
        while (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.shape)) {
            this.currentPiece.y++;
            dropped++;
        }
        this.lockPiece();
        return dropped;
    }

    hold() {
        if (!this.canHold || !this.currentPiece || this.isGameOver) return false;
        const currentType = this.currentPiece.type;
        if (this.holdPieceType === null) {
            this.holdPieceType = currentType;
            this.spawnPiece();
        } else {
            const nextType = this.holdPieceType;
            this.holdPieceType = currentType;
            this.spawnPiece(nextType);
        }
        this.canHold = false;
        return true;
    }

    lockPiece() {
        if (!this.currentPiece) return;
        const { shape, x, y, color } = this.currentPiece;

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const row = y + r;
                    const col = x + c;
                    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
                        this.grid[row][col] = color;
                    }
                }
            }
        }

        this.clearLines();
    }

    clearLines() {
        let linesCleared = 0;
        for (let r = this.rows - 1; r >= 0; r--) {
            if (this.grid[r].every(cell => cell !== 0)) {
                this.grid.splice(r, 1);
                this.grid.unshift(Array(this.cols).fill(0));
                linesCleared++;
                r++; // Recheck same row
            }
        }

        if (linesCleared > 0) {
            this.combo++;
            this.lines += linesCleared;
            const points = [0, 100, 300, 500, 800][linesCleared] * (this.combo > 1 ? 1.5 : 1);
            this.score += Math.floor(points);

            // Compute attack garbage
            let attack = calculateGarbage(linesCleared, this.combo);

            // Cancel out incoming garbage first!
            if (this.garbageQueue.length > 0 && attack > 0) {
                let toCancel = attack;
                while (this.garbageQueue.length > 0 && toCancel > 0) {
                    if (this.garbageQueue[0] <= toCancel) {
                        toCancel -= this.garbageQueue[0];
                        this.garbageQueue.shift();
                    } else {
                        this.garbageQueue[0] -= toCancel;
                        toCancel = 0;
                    }
                }
                attack = toCancel; // Remainder is sent to opponent
            }

            if (attack > 0 && this.onAttack) {
                this.onAttack(attack);
            }
        } else {
            this.combo = 0;
            // If no lines cleared, push incoming garbage up into the matrix
            this.receiveGarbage();
        }

        this.spawnPiece();
    }

    addGarbage(lines) {
        if (lines > 0) {
            this.garbageQueue.push(lines);
        }
    }

    receiveGarbage() {
        if (this.garbageQueue.length === 0) return;
        const totalLines = this.garbageQueue.reduce((a, b) => a + b, 0);
        this.garbageQueue = [];

        // Insert grey garbage lines with 1 random hole
        for (let i = 0; i < totalLines; i++) {
            const hole = Math.floor(Math.random() * this.cols);
            const garbageRow = Array(this.cols).fill('#555555');
            garbageRow[hole] = 0;

            this.grid.shift(); // Remove top line
            this.grid.push(garbageRow);
        }
    }

    triggerKO() {
        this.koCount++;
        if (this.onKO) {
            this.onKO();
        }
        // In Tetris Battle, KO resets the board and gives the opponent a star/badge
        this.grid = this.createGrid();
        this.garbageQueue = [];
    }

    update(deltaTime) {
        if (this.isGameOver || this.paused || this.isRemote) return;

        this.lastDropTime += deltaTime;
        if (this.lastDropTime >= this.dropInterval) {
            this.lastDropTime = 0;
            if (!this.moveDown()) {
                // If can't move down, start locking
                this.isLocking = true;
            }
        }

        if (this.isLocking) {
            this.lockTimer += deltaTime;
            if (this.lockTimer >= this.lockDelay) {
                this.lockPiece();
            }
        }
    }

    // Export state for multiplayer syncing
    getState() {
        return {
            grid: this.grid,
            currentPiece: this.currentPiece,
            holdPieceType: this.holdPieceType,
            queue: this.queue.slice(0, 3),
            score: this.score,
            lines: this.lines,
            koCount: this.koCount,
            garbageCount: this.garbageQueue.reduce((a, b) => a + b, 0),
            combo: this.combo
        };
    }

    // Apply remote state in multiplayer
    applyState(state) {
        if (!state) return;
        this.grid = state.grid;
        this.currentPiece = state.currentPiece;
        this.holdPieceType = state.holdPieceType;
        this.queue = state.queue || [];
        this.score = state.score;
        this.lines = state.lines;
        this.koCount = state.koCount;
        this.combo = state.combo;
        this.garbageCount = state.garbageCount;
    }
}

window.TetrisEngine = TetrisEngine;
window.TETROMINOES = TETROMINOES;
