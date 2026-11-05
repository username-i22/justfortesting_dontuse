class TetrisAI {
    constructor(engine) {
        this.engine = engine;
        this.actionTimer = 0;
        this.actionInterval = 140; // Speed of AI (lower = faster)
        this.targetPlan = null;
    }

    reset() {
        this.actionTimer = 0;
        this.targetPlan = null;
    }

    update(deltaTime) {
        if (!this.engine.currentPiece || this.engine.isGameOver || this.engine.paused) return;

        this.actionTimer += deltaTime;
        if (this.actionTimer < this.actionInterval) return;
        this.actionTimer = 0;

        // If no plan, compute the best placement
        if (!this.targetPlan || this.targetPlan.pieceType !== this.engine.currentPiece.type) {
            this.targetPlan = this.computeBestMove();
        }

        if (!this.targetPlan) {
            this.engine.moveDown();
            return;
        }

        // Execute step-by-step
        if (this.targetPlan.rotation > 0) {
            this.engine.rotate(1);
            this.targetPlan.rotation--;
            return;
        }

        if (this.engine.currentPiece.x < this.targetPlan.targetX) {
            this.engine.move(1);
            return;
        } else if (this.engine.currentPiece.x > this.targetPlan.targetX) {
            this.engine.move(-1);
            return;
        }

        // At target X and rotation, perform hard drop
        this.engine.hardDrop();
        this.targetPlan = null;
    }

    computeBestMove() {
        const piece = this.engine.currentPiece;
        if (!piece) return null;

        let bestScore = -Infinity;
        let bestMove = null;

        // Try all 4 rotations
        let currentShape = piece.shape;
        for (let rot = 0; rot < 4; rot++) {
            const shapeWidth = currentShape[0].length;
            
            // Try all horizontal placements
            for (let x = -2; x <= this.engine.cols - shapeWidth + 2; x++) {
                if (this.engine.checkCollision(x, piece.y, currentShape)) continue;

                // Find landing Y
                let y = piece.y;
                while (!this.engine.checkCollision(x, y + 1, currentShape)) {
                    y++;
                }

                // Evaluate board state after placing piece
                const score = this.evaluatePlacement(x, y, currentShape);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = {
                        pieceType: piece.type,
                        rotation: rot,
                        targetX: x
                    };
                }
            }

            currentShape = this.engine.rotateMatrix(currentShape, 1);
        }

        return bestMove;
    }

    evaluatePlacement(x, y, shape) {
        // Clone grid representation
        const tempGrid = this.engine.grid.map(row => [...row]);

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const row = y + r;
                    const col = x + c;
                    if (row >= 0 && row < this.engine.rows && col >= 0 && col < this.engine.cols) {
                        tempGrid[row][col] = 1;
                    }
                }
            }
        }

        // Metrics:
        // 1. Lines cleared (strongly favored)
        let linesCleared = 0;
        for (let r = 0; r < this.engine.rows; r++) {
            if (tempGrid[r].every(cell => cell !== 0)) {
                linesCleared++;
            }
        }

        // 2. Aggregate height
        let aggregateHeight = 0;
        const columnHeights = Array(this.engine.cols).fill(0);
        for (let c = 0; c < this.engine.cols; c++) {
            for (let r = 0; r < this.engine.rows; r++) {
                if (tempGrid[r][c] !== 0) {
                    columnHeights[c] = this.engine.rows - r;
                    break;
                }
            }
            aggregateHeight += columnHeights[c];
        }

        // 3. Holes (empty spaces with blocks above them)
        let holes = 0;
        for (let c = 0; c < this.engine.cols; c++) {
            let blockAbove = false;
            for (let r = 0; r < this.engine.rows; r++) {
                if (tempGrid[r][c] !== 0) {
                    blockAbove = true;
                } else if (blockAbove && tempGrid[r][c] === 0) {
                    holes++;
                }
            }
        }

        // 4. Bumpiness (sum of absolute differences in height between adjacent columns)
        let bumpiness = 0;
        for (let c = 0; c < this.engine.cols - 1; c++) {
            bumpiness += Math.abs(columnHeights[c] - columnHeights[c + 1]);
        }

        // Heuristic weights for AI personality
        const a = -0.510066; // aggregate height
        const b = 0.860666;  // complete lines
        const c = -0.45663;  // holes
        const d = -0.184483; // bumpiness

        return (a * aggregateHeight) + (b * linesCleared * 1.5) + (c * holes * 2.5) + (d * bumpiness);
    }
}

window.TetrisAI = TetrisAI;
