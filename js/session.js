document.addEventListener('DOMContentLoaded', () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const startBtn = document.getElementById('start-btn');
    const sessionContainer = document.getElementById('session-container');
    const captureForm = document.getElementById('capture-form');
    const sessionTimer = document.getElementById('session-timer');
    const endSessionBtn = document.getElementById('end-session-btn');
    const browserCanvas = document.getElementById('browser-canvas');
    const connectionStatus = document.getElementById('connection-status');
    const captureBtn = document.getElementById('capture-btn');
    const resultContainer = document.getElementById('result-container');
    const viewCaptureLink = document.getElementById('view-capture-link');
    const recentCapturesSection = document.getElementById('recent-captures');
    const capturesList = document.getElementById('captures-list');

    const ctx = browserCanvas.getContext('2d');

    let currentSession = null;
    let timerInterval = null;
    let ws = null;
    let frameImage = new Image();
    let lastMouseMove = 0;
    let lastScroll = 0;
    const MOUSE_THROTTLE_MS = 50;
    const SCROLL_THROTTLE_MS = 32; // ~30 scroll events/sec max

    loadRecentCaptures();

    // Frame rendering
    frameImage.onload = function() {
        browserCanvas.width = frameImage.width;
        browserCanvas.height = frameImage.height;
        ctx.drawImage(frameImage, 0, 0);
    };

    urlForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = urlInput.value.trim();
        if (!url) return;

        startBtn.disabled = true;
        startBtn.textContent = 'Starting session...';

        try {
            const session = await api.createSession();
            currentSession = session;

            await api.openURL(session.sessionId, url);

            captureForm.classList.add('hidden');
            sessionContainer.classList.remove('hidden');
            resultContainer.classList.add('hidden');
            recentCapturesSection.classList.add('hidden');

            // Connect WebSocket (proxy handles streaming automatically)
            connectWebSocket(session.streamUrl);

            startSessionTimer(new Date(session.expiresAt));

        } catch (error) {
            alert('Failed to start session: ' + error.message);
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = 'Start Capture Session';
        }
    });

    function connectWebSocket(streamUrl) {
        connectionStatus.textContent = 'Connecting...';
        connectionStatus.classList.remove('connected');

        ws = new WebSocket(streamUrl);

        ws.onopen = () => {
            connectionStatus.textContent = 'Connected';
            connectionStatus.classList.add('connected');
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'frame' && msg.data) {
                    frameImage.src = 'data:image/jpeg;base64,' + msg.data;
                }
            } catch (e) {
                console.error('Failed to parse frame message:', e);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            connectionStatus.textContent = 'Connection error';
            connectionStatus.classList.remove('connected');
        };

        ws.onclose = () => {
            connectionStatus.textContent = 'Disconnected';
            connectionStatus.classList.remove('connected');
        };
    }

    function disconnectWebSocket() {
        if (ws) {
            ws.close();
            ws = null;
        }
    }

    function sendInput(event) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(event));
        }
    }

    // Get coordinates relative to the canvas content
    function getCanvasCoordinates(e) {
        const rect = browserCanvas.getBoundingClientRect();
        const scaleX = browserCanvas.width / rect.width;
        const scaleY = browserCanvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    // Mouse event handlers (throttled to prevent flooding)
    browserCanvas.addEventListener('mousemove', (e) => {
        const now = Date.now();
        if (now - lastMouseMove < MOUSE_THROTTLE_MS) return;
        lastMouseMove = now;
        const coords = getCanvasCoordinates(e);
        sendInput({ type: 'mousemove', x: coords.x, y: coords.y });
    });

    browserCanvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const coords = getCanvasCoordinates(e);
        sendInput({ type: 'mousedown', x: coords.x, y: coords.y, button: e.button });
    });

    browserCanvas.addEventListener('click', (e) => {
        e.preventDefault();
        const coords = getCanvasCoordinates(e);
        sendInput({ type: 'click', x: coords.x, y: coords.y, button: e.button });
    });

    browserCanvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    browserCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastScroll < SCROLL_THROTTLE_MS) return;
        lastScroll = now;
        const coords = getCanvasCoordinates(e);
        sendInput({
            type: 'wheel',
            x: coords.x,
            y: coords.y,
            deltaX: e.deltaX,
            deltaY: e.deltaY
        });
    }, { passive: false });

    // Keyboard event handlers
    browserCanvas.setAttribute('tabindex', '0');
    browserCanvas.addEventListener('keydown', (e) => {
        e.preventDefault();
        // Handle special keys
        const key = e.key;
        sendInput({ type: 'keydown', key: key });
    });

    // Handle text input for typing (non-special keys)
    browserCanvas.addEventListener('keypress', (e) => {
        if (e.key.length === 1) {
            sendInput({ type: 'text', text: e.key });
        }
    });

    // Focus canvas when clicking on it
    browserCanvas.addEventListener('click', () => {
        browserCanvas.focus();
    });

    endSessionBtn.addEventListener('click', async () => {
        await endSession();
    });

    captureBtn.addEventListener('click', async () => {
        if (!currentSession) return;

        captureBtn.disabled = true;
        captureBtn.textContent = 'Capturing...';

        try {
            const result = await api.capture(currentSession.sessionId);

            sessionContainer.classList.add('hidden');
            resultContainer.classList.remove('hidden');
            viewCaptureLink.href = result.view_url || `capture.html?id=${result.capture_id}`;

            await endSession(false);
            loadRecentCaptures();

        } catch (error) {
            alert('Failed to capture: ' + error.message);
            captureBtn.disabled = false;
            captureBtn.textContent = 'Capture Full Page';
        }
    });

    async function endSession(showForm = true) {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        // Disconnect WebSocket (proxy stops streaming automatically)
        disconnectWebSocket();

        if (currentSession) {
            try {
                await api.deleteSession(currentSession.sessionId);
            } catch (e) {
                console.error('Failed to delete session:', e);
            }
            currentSession = null;
        }

        // Clear canvas
        ctx.clearRect(0, 0, browserCanvas.width, browserCanvas.height);
        sessionContainer.classList.add('hidden');

        if (showForm) {
            captureForm.classList.remove('hidden');
            recentCapturesSection.classList.remove('hidden');
        }
    }

    function startSessionTimer(expiresAt) {
        function updateTimer() {
            const now = new Date();
            const remaining = expiresAt - now;

            if (remaining <= 0) {
                sessionTimer.textContent = 'Session expired';
                endSession();
                return;
            }

            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            sessionTimer.textContent = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    }

    async function loadRecentCaptures() {
        try {
            const response = await api.getRecentEvents(10);
            const events = response.events || [];

            if (events.length === 0) {
                capturesList.innerHTML = '<p class="loading">No captures yet</p>';
                return;
            }

            capturesList.innerHTML = events.map(event => `
                <a href="capture.html?id=${event.capture_id}" class="capture-item">
                    <img src="${api.getScreenshotURL(event.capture_id)}"
                         alt="Screenshot"
                         class="capture-item-thumb"
                         onerror="this.style.display='none'">
                    <div class="capture-item-info">
                        <div class="capture-item-url">${escapeHtml(event.url)}</div>
                        <div class="capture-item-time">${formatRelativeTime(event.captured_at_utc)}</div>
                    </div>
                </a>
            `).join('');

            recentCapturesSection.classList.remove('hidden');

        } catch (error) {
            capturesList.innerHTML = '<p class="loading">Failed to load recent captures</p>';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
