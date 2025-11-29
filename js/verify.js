async function verifyCapture(captureId, metadata, event) {
    const statusEl = document.getElementById('verification-status');
    statusEl.className = 'verification-pending';
    statusEl.querySelector('.status-text').textContent = 'Verifying...';

    const checks = [];

    try {
        const screenshotCheck = await verifyScreenshotHash(captureId, metadata.hashes?.screenshot_sha256);
        checks.push({ name: 'Screenshot hash', passed: screenshotCheck });

        if (event) {
            const eventHashCheck = await verifyEventHash(event);
            checks.push({ name: 'Event hash', passed: eventHashCheck });

            try {
                const keys = await api.getOperatorKeys();
                const operatorKey = keys.keys?.find(k => k.key_id === event.operator_key_id);
                if (operatorKey) {
                    const signatureCheck = await verifySignature(event, operatorKey.public_key);
                    checks.push({ name: 'Signature', passed: signatureCheck });
                } else {
                    checks.push({ name: 'Signature', passed: false, reason: 'Unknown operator key' });
                }
            } catch (e) {
                checks.push({ name: 'Signature', passed: false, reason: 'Failed to fetch keys' });
            }
        }

        const allPassed = checks.every(c => c.passed);

        statusEl.className = allPassed ? 'verification-success' : 'verification-error';
        statusEl.querySelector('.status-text').textContent = allPassed
            ? 'All verification checks passed'
            : 'Some verification checks failed';

        console.log('Verification results:', checks);

    } catch (error) {
        console.error('Verification failed:', error);
        statusEl.className = 'verification-error';
        statusEl.querySelector('.status-text').textContent = 'Verification failed: ' + error.message;
    }
}

async function verifyScreenshotHash(captureId, expectedHash) {
    if (!expectedHash) return false;

    try {
        const response = await fetch(api.getScreenshotURL(captureId));
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return hashHex === expectedHash;
    } catch (e) {
        console.error('Screenshot hash verification failed:', e);
        return false;
    }
}

async function verifyEventHash(event) {
    const forHashing = {
        event_id: event.event_id,
        prev_event_hash: event.prev_event_hash,
        capture_id: event.capture_id,
        url: event.url,
        captured_at_utc: event.captured_at_utc,
        hashes: event.hashes,
        operator_key_id: event.operator_key_id
    };

    try {
        const canonical = canonicalStringify(forHashing);
        const encoder = new TextEncoder();
        const data = encoder.encode(canonical);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return hashHex === event.event_hash;
    } catch (e) {
        console.error('Event hash verification failed:', e);
        return false;
    }
}

async function verifySignature(event, publicKeyHex) {
    try {
        const publicKeyBytes = hexToBytes(publicKeyHex);
        const signatureBytes = hexToBytes(event.signature);
        const messageBytes = new TextEncoder().encode(event.event_hash);

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            publicKeyBytes,
            { name: 'Ed25519' },
            false,
            ['verify']
        );

        const isValid = await crypto.subtle.verify(
            'Ed25519',
            cryptoKey,
            signatureBytes,
            messageBytes
        );

        return isValid;
    } catch (e) {
        console.error('Signature verification failed:', e);
        return false;
    }
}

function canonicalStringify(obj) {
    if (obj === null) return 'null';
    if (typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalStringify).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(obj[k]));
    return '{' + pairs.join(',') + '}';
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}
