document.addEventListener('DOMContentLoaded', () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const startBtn = document.getElementById('start-btn');
    const sessionContainer = document.getElementById('session-container');
    const captureForm = document.getElementById('capture-form');
    const sessionTimer = document.getElementById('session-timer');
    const endSessionBtn = document.getElementById('end-session-btn');
    const vncFrame = document.getElementById('vnc-frame');
    const captureBtn = document.getElementById('capture-btn');
    const resultContainer = document.getElementById('result-container');
    const viewCaptureLink = document.getElementById('view-capture-link');
    const recentCapturesSection = document.getElementById('recent-captures');
    const capturesList = document.getElementById('captures-list');

    let currentSession = null;
    let timerInterval = null;

    loadRecentCaptures();

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

            vncFrame.src = session.vncUrl.replace('ws://', 'http://').replace('/websockify', '/vnc.html?autoconnect=true');

            startSessionTimer(new Date(session.expiresAt));

        } catch (error) {
            alert('Failed to start session: ' + error.message);
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = 'Start Capture Session';
        }
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
            viewCaptureLink.href = result.viewUrl || `capture.html?id=${result.captureId}`;

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

        if (currentSession) {
            try {
                await api.deleteSession(currentSession.sessionId);
            } catch (e) {
                console.error('Failed to delete session:', e);
            }
            currentSession = null;
        }

        vncFrame.src = '';
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
