const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : '/api';

const EVENT_LOG_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8081'
    : '/events';

const api = {
    async createSession() {
        const response = await fetch(`${API_BASE}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to create session');
        const data = await response.json();
        // Normalize snake_case to camelCase
        return {
            sessionId: data.session_id,
            streamUrl: data.stream_url,
            expiresAt: data.expires_at
        };
    },

    async deleteSession(sessionId) {
        const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        return response.ok;
    },

    async openURL(sessionId, url) {
        const response = await fetch(`${API_BASE}/sessions/${sessionId}/open`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        if (!response.ok) throw new Error('Failed to open URL');
        return response.json();
    },

    async startStream(sessionId) {
        const response = await fetch(`${API_BASE}/sessions/${sessionId}/start-stream`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to start stream');
        return response.json();
    },

    async stopStream(sessionId) {
        const response = await fetch(`${API_BASE}/sessions/${sessionId}/stop-stream`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to stop stream');
        return response.json();
    },

    async capture(sessionId) {
        const response = await fetch(`${API_BASE}/sessions/${sessionId}/capture`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to capture');
        return response.json();
    },

    async getCaptureMetadata(captureId) {
        const response = await fetch(`${API_BASE}/captures/${captureId}`);
        if (!response.ok) throw new Error('Capture not found');
        return response.json();
    },

    async getCaptureManifest(captureId) {
        const response = await fetch(`${API_BASE}/captures/${captureId}/manifest`);
        if (!response.ok) throw new Error('Manifest not found');
        return response.json();
    },

    getScreenshotURL(captureId) {
        return `${API_BASE}/captures/${captureId}/screenshot`;
    },

    getDOMURL(captureId) {
        return `${API_BASE}/captures/${captureId}/dom`;
    },

    getManifestURL(captureId) {
        return `${API_BASE}/captures/${captureId}/manifest`;
    },

    getBundleURL(captureId) {
        return `${API_BASE}/captures/${captureId}/bundle`;
    },

    async getRecentEvents(limit = 10) {
        const response = await fetch(`${EVENT_LOG_BASE}/events?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to get events');
        return response.json();
    },

    async getEvent(eventId) {
        const response = await fetch(`${EVENT_LOG_BASE}/events/${eventId}`);
        if (!response.ok) throw new Error('Event not found');
        return response.json();
    },

    async getOperatorKeys() {
        const response = await fetch(`${EVENT_LOG_BASE}/keys`);
        if (!response.ok) throw new Error('Failed to get keys');
        return response.json();
    }
};

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString();
}

function formatRelativeTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(isoString);
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function truncateHash(hash, length = 16) {
    if (!hash) return 'N/A';
    if (hash.length <= length) return hash;
    return hash.substring(0, length) + '...';
}
