class NetworkManager {
    constructor(onConnected, onData, onError) {
        this.peer = null;
        this.conn = null;
        this.onConnected = onConnected;
        this.onData = onData;
        this.onError = onError;
        this.isHost = false;
        this.roomCode = null;
    }

    createRoom(callback) {
        this.isHost = true;
        // Generate random 5-letter room code
        const code = Math.random().toString(36).substring(2, 7).toUpperCase();
        const peerId = 'tb-' + code;

        try {
            this.peer = new Peer(peerId, {
                debug: 1
            });
        } catch (e) {
            if (this.onError) this.onError(e);
            return;
        }

        this.peer.on('open', (id) => {
            this.roomCode = code;
            if (callback) callback(code);
        });

        this.peer.on('connection', (conn) => {
            this.conn = conn;
            this.setupConnection();
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS Host Error:', err);
            if (this.onError) this.onError(err);
        });
    }

    joinRoom(code, callback) {
        this.isHost = false;
        const targetId = 'tb-' + code.toUpperCase().trim();
        this.roomCode = code.toUpperCase().trim();

        try {
            this.peer = new Peer({ debug: 1 });
        } catch (e) {
            if (this.onError) this.onError(e);
            return;
        }

        this.peer.on('open', (id) => {
            this.conn = this.peer.connect(targetId, { reliable: true });
            this.setupConnection();
            if (callback) callback();
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS Client Error:', err);
            if (this.onError) this.onError(err);
        });
    }

    setupConnection() {
        if (!this.conn) return;

        this.conn.on('open', () => {
            console.log('Connected to peer!');
            if (this.onConnected) this.onConnected(this.isHost);
        });

        this.conn.on('data', (data) => {
            if (this.onData) this.onData(data);
        });

        this.conn.on('close', () => {
            console.log('Peer disconnected');
            if (this.onError) this.onError(new Error('Opponent disconnected.'));
        });
    }

    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }

    disconnect() {
        if (this.conn) this.conn.close();
        if (this.peer) this.peer.destroy();
        this.peer = null;
        this.conn = null;
    }
}

window.NetworkManager = NetworkManager;
