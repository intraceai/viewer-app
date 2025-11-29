document.addEventListener('DOMContentLoaded', async () => {
    const captureId = getQueryParam('id');

    if (!captureId) {
        showError();
        return;
    }

    try {
        const [metadata, manifest] = await Promise.all([
            api.getCaptureMetadata(captureId),
            api.getCaptureManifest(captureId).catch(() => null)
        ]);

        let event = null;
        if (metadata.event_id) {
            try {
                event = await api.getEvent(metadata.event_id);
            } catch (e) {
                console.error('Failed to load event:', e);
            }
        }

        displayCapture(captureId, metadata, manifest, event);

        verifyCapture(captureId, metadata, event);

    } catch (error) {
        console.error('Failed to load capture:', error);
        showError();
    }
});

function displayCapture(captureId, metadata, manifest, event) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('capture-content').classList.remove('hidden');

    document.title = `${metadata.url} - Intrace`;

    document.getElementById('capture-url').textContent = metadata.url;
    document.getElementById('capture-time').textContent = formatDate(metadata.captured_at_utc);

    document.getElementById('screenshot').src = api.getScreenshotURL(captureId);

    document.getElementById('capture-id').textContent = captureId;
    document.getElementById('original-url').textContent = metadata.url;
    document.getElementById('final-url').textContent = metadata.final_url || metadata.url;
    document.getElementById('captured-at').textContent = formatDate(metadata.captured_at_utc);
    document.getElementById('browser-info').textContent =
        `${metadata.browser?.name || 'Unknown'} ${metadata.browser?.version || ''}`;
    document.getElementById('viewport-info').textContent =
        `${metadata.viewport?.width || 0} x ${metadata.viewport?.height || 0}`;

    document.getElementById('hash-screenshot').textContent =
        metadata.hashes?.screenshot_sha256 || 'N/A';
    document.getElementById('hash-dom').textContent =
        metadata.hashes?.dom_sha256 || 'N/A';
    document.getElementById('hash-manifest').textContent =
        metadata.hashes?.manifest_sha256 || 'N/A';

    if (event) {
        document.getElementById('event-id').textContent = event.event_id;
        document.getElementById('event-hash').textContent = event.event_hash;
        document.getElementById('prev-hash').textContent = event.prev_event_hash || 'Genesis (first event)';
        document.getElementById('operator-key').textContent = event.operator_key_id;
        document.getElementById('signature').textContent = event.signature;
    } else {
        document.getElementById('event-id').textContent = 'Pending';
        document.getElementById('event-hash').textContent = 'Pending';
        document.getElementById('prev-hash').textContent = 'Pending';
        document.getElementById('operator-key').textContent = 'Pending';
        document.getElementById('signature').textContent = 'Pending';
    }

    document.getElementById('download-bundle').href = api.getBundleURL(captureId);
    document.getElementById('view-dom').href = api.getDOMURL(captureId);
    document.getElementById('view-manifest').href = api.getManifestURL(captureId);

    document.getElementById('verify-btn').addEventListener('click', () => {
        verifyCapture(captureId, metadata, event);
    });
}

function showError() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
}
