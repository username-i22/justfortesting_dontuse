// Renderer for rendering game boards, ghost pieces, and mini pieces (hold/next)
class Renderer {
    constructor() {
        this.cellSize = 24; // 10 cols * 24 = 240px width, 20 rows * 24 = 480px height
    }

    drawBoard(canvas, engine, isOpponent = false) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const cellSize = width / engine.cols;

        // Clear background
        ctx.fillStyle = '#080d1a';
        ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += cellSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += cellSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw placed blocks
        for (let r = 0; r < engine.rows; r++) {
            for (let c = 0; c < engine.cols; c++) {
                const color = engine.grid[r][c];
                if (color) {
                    this.drawBlock(ctx, c * cellSize, r * cellSize, cellSize, color);
                }
            }
        }

        // Draw current falling piece and ghost piece
        if (engine.currentPiece && !engine.isGameOver) {
            const piece = engine.currentPiece;

            // Draw ghost piece (player only)
            if (!isOpponent) {
                const ghostY = engine.getGhostY();
                ctx.save();
                ctx.globalAlpha = 0.28;
                for (let r = 0; r < piece.shape.length; r++) {
                    for (let c = 0; c < piece.shape[r].length; c++) {
                        if (piece.shape[r][c]) {
                            const px = (piece.x + c) * cellSize;
                            const py = (ghostY + r) * cellSize;
                            if (py >= 0) {
                                this.drawBlock(ctx, px, py, cellSize, piece.color, true);
                            }
                        }
                    }
                }
                ctx.restore();
            }

            // Draw active piece
            for (let r = 0; r < piece.shape.length; r++) {
                for (let c = 0; c < piece.shape[r].length; c++) {
                    if (piece.shape[r][c]) {
                        const px = (piece.x + c) * cellSize;
                        const py = (piece.y + r) * cellSize;
                        if (py >= 0) {
                            this.drawBlock(ctx, px, py, cellSize, piece.color);
                        }
                    }
                }
            }
        }
    }

    drawBlock(ctx, x, y, size, color, isGhost = false) {
        ctx.save();
        if (isGhost) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
            ctx.fillStyle = color;
            ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
            ctx.restore();
            return;
        }

        // Beveled block style
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(x + 1, y + 1);
        ctx.lineTo(x + size - 1, y + 1);
        ctx.lineTo(x + size - 4, y + 4);
        ctx.lineTo(x + 4, y + 4);
        ctx.lineTo(x + 4, y + size - 4);
        ctx.lineTo(x + 1, y + size - 1);
        ctx.closePath();
        ctx.fill();

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.moveTo(x + size - 1, y + 1);
        ctx.lineTo(x + size - 1, y + size - 1);
        ctx.lineTo(x + 1, y + size - 1);
        ctx.lineTo(x + 4, y + size - 4);
        ctx.lineTo(x + size - 4, y + size - 4);
        ctx.lineTo(x + size - 4, y + 4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    drawMiniPiece(canvas, pieceType) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);
        if (!pieceType || !TETROMINOES[pieceType]) return;

        const def = TETROMINOES[pieceType];
        const shape = def.shape;
        const blockSize = 16;

        const pieceW = shape[0].length * blockSize;
        const pieceH = shape.length * blockSize;
        const offsetX = Math.floor((width - pieceW) / 2);
        const offsetY = Math.floor((height - pieceH) / 2);

        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    this.drawBlock(ctx, offsetX + c * blockSize, offsetY + r * blockSize, blockSize, def.color);
                }
            }
        }
    }
}

window.renderer = new Renderer();
