class LiveDetectionController {
    constructor() {
        this.isRunning = false;
        this.frameUpdateInterval = null;
        this.statusUpdateInterval = null;
        this.detectionLogInterval = null;
        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        this.initializeElements();
        this.setupEventListeners();
        this.loadCameras();
        this.startStatusMonitoring();
    }

    initializeElements() {
        this.elements = {
            cameraSelect: document.getElementById('camera-select'),
            startBtn: document.getElementById('start-btn'),
            stopBtn: document.getElementById('stop-btn'),
            videoFrame: document.getElementById('video-frame'),
            statusDot: document.getElementById('status-dot'),
            statusText: document.getElementById('status-text'),
            detectionLog: document.getElementById('detection-log'),
            detectionCount: document.getElementById('detection-count'),
            fpsCounter: document.getElementById('fps-counter'),
            loadingOverlay: document.getElementById('loading-overlay'),
            urlModal: document.getElementById('url-modal')
        };
    }

    setupEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.startDetection());
        this.elements.stopBtn.addEventListener('click', () => this.stopDetection());
        this.elements.cameraSelect.addEventListener('change', (e) => {
            const isCustomUrl = e.target.value === 'ip' || e.target.value === 'rtsp';
            this.elements.startBtn.disabled = !e.target.value;
            if (isCustomUrl && e.target.value) {
                this.showUrlModal(e.target.value);
            }
        });
    }

    async loadCameras() {
        try {
            const response = await fetch('/feature4/api/cameras');
            const data = await response.json();
            if (data.success) {
                this.populateCameraDropdown(data.cameras);
            } else {
                this.showError('Failed to load cameras: ' + data.error);
            }
        } catch (error) {
            this.showError('Error loading cameras: ' + error.message);
        }
    }

    populateCameraDropdown(cameras) {
        this.elements.cameraSelect.innerHTML = '<option value="">SELECT CAMERA</option>';
        cameras.forEach(camera => {
            const option = document.createElement('option');
            option.value = camera.id;
            option.textContent = camera.name.toUpperCase();
            option.dataset.type = camera.type;
            this.elements.cameraSelect.appendChild(option);
        });
    }

    showUrlModal(type) {
        const modal = this.elements.urlModal;
        const urlInput = document.getElementById('camera-url');
        if (type === 'ip') {
            urlInput.placeholder = 'http://192.168.1.100:8080/video';
        } else if (type === 'rtsp') {
            urlInput.placeholder = 'rtsp://admin:password@192.168.1.100:554/stream1';
        }
        modal.style.display = 'flex';
        urlInput.focus();
    }

    async startDetection() {
        const cameraSource = this.elements.cameraSelect.value;
        if (!cameraSource) {
            this.showError('PLEASE SELECT A CAMERA FIRST');
            return;
        }

        this.showLoading(true);
        this.elements.startBtn.disabled = true;

        try {
            const response = await fetch('/feature4/api/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    camera_source: cameraSource
                })
            });

            const data = await response.json();
            if (data.success) {
                this.isRunning = true;
                this.updateControlsState();
                this.startFrameUpdates();
                this.startDetectionLogUpdates();
                this.clearNoFeedMessage();
                this.showSuccess('DETECTION STARTED SUCCESSFULLY');
            } else {
                this.showError('FAILED TO START DETECTION: ' + data.error);
                this.elements.startBtn.disabled = false;
            }
        } catch (error) {
            this.showError('ERROR STARTING DETECTION: ' + error.message);
            this.elements.startBtn.disabled = false;
        } finally {
            this.showLoading(false);
        }
    }

    async stopDetection() {
        this.elements.stopBtn.disabled = true;
        try {
            const response = await fetch('/feature4/api/stop', {
                method: 'POST'
            });

            const data = await response.json();
            if (data.success) {
                this.isRunning = false;
                this.stopAllUpdates();
                this.updateControlsState();
                this.showNoFeedMessage();
                this.showSuccess('DETECTION STOPPED');
            } else {
                this.showError('FAILED TO STOP DETECTION: ' + data.error);
            }
        } catch (error) {
            this.showError('ERROR STOPPING DETECTION: ' + error.message);
        } finally {
            this.elements.stopBtn.disabled = false;
        }
    }

    startFrameUpdates() {
        this.frameUpdateInterval = setInterval(async () => {
            await this.updateFrame();
        }, 100);
    }

    async updateFrame() {
        if (!this.isRunning) return;

        try {
            const response = await fetch('/feature4/api/frame');
            const data = await response.json();

            if (data.success && data.frame) {
                this.displayFrame(data.frame);
                this.updateFPS();
            }
        } catch (error) {
            console.error('Error updating frame:', error);
        }
    }

    displayFrame(frameData) {
        this.elements.videoFrame.innerHTML = `
            <img src="data:image/jpeg;base64,${frameData}" 
                 alt="Live Detection Feed" 
                 class="live-frame">
        `;
    }

    updateFPS() {
        this.frameCount++;
        const now = Date.now();
        const elapsed = now - this.lastFrameTime;

        if (elapsed >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / elapsed);
            this.elements.fpsCounter.textContent = `${fps} FPS`;
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
    }

    startDetectionLogUpdates() {
        this.detectionLogInterval = setInterval(async () => {
            await this.updateDetectionLog();
        }, 1000);
    }

    async updateDetectionLog() {
        if (!this.isRunning) return;

        try {
            const response = await fetch('/feature4/api/detections');
            const data = await response.json();
            if (data.success) {
                this.displayDetectionLog(data.detections);
            }
        } catch (error) {
            console.error('Error updating detection log:', error);
        }
    }

    displayDetectionLog(detections) {
        if (!detections || detections.length === 0) {
            this.elements.detectionLog.innerHTML = `
            <div class="log-empty">
                <p>NO DETECTIONS</p>
            </div>
        `;
            this.elements.detectionCount.textContent = '0 OBJECTS';
            return;
        }

        // Show latest detections at bottom (newest first due to flex-direction: column-reverse)
        const logHtml = detections.map(detection => `
        <div class="detection-item">
            <span class="detection-time">${detection.timestamp}</span>
            <span class="detection-object">${detection.object}</span>
            <span class="detection-confidence">${detection.confidence}</span>
        </div>
    `).join('');

        this.elements.detectionLog.innerHTML = logHtml;
        this.elements.detectionCount.textContent = `${detections.length} OBJECTS`;
    }

    startStatusMonitoring() {
        this.statusUpdateInterval = setInterval(async () => {
            await this.updateStatus();
        }, 2000);
    }

    async updateStatus() {
        try {
            const response = await fetch('/feature4/api/status');
            const data = await response.json();

            if (data.is_running) {
                this.updateStatusIndicator('ONLINE', 'online');
            } else {
                this.updateStatusIndicator('OFFLINE', 'offline');
            }

            // Update detection state if it changed externally
            if (data.is_running !== this.isRunning) {
                this.isRunning = data.is_running;
                this.updateControlsState();
                if (!this.isRunning) {
                    this.stopAllUpdates();
                    this.showNoFeedMessage();
                }
            }
        } catch (error) {
            this.updateStatusIndicator('ERROR', 'error');
        }
    }

    updateStatusIndicator(text, status) {
        this.elements.statusText.textContent = text;
        this.elements.statusDot.className = `status-dot ${status}`;
    }

    updateControlsState() {
        if (this.isRunning) {
            this.elements.startBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
            this.elements.cameraSelect.disabled = true;
        } else {
            this.elements.startBtn.disabled = !this.elements.cameraSelect.value;
            this.elements.stopBtn.disabled = true;
            this.elements.cameraSelect.disabled = false;
        }
    }

    stopAllUpdates() {
        if (this.frameUpdateInterval) {
            clearInterval(this.frameUpdateInterval);
            this.frameUpdateInterval = null;
        }
        if (this.detectionLogInterval) {
            clearInterval(this.detectionLogInterval);
            this.detectionLogInterval = null;
        }
    }

    clearNoFeedMessage() {
        // Frame updates will replace the no-feed message
    }

    showNoFeedMessage() {
        this.elements.videoFrame.innerHTML = `
            <div class="no-feed-message">
                <i class="icon">📡</i>
                <p>SELECT CAMERA AND START DETECTION</p>
            </div>
        `;
        this.elements.fpsCounter.textContent = '0 FPS';
    }

    showLoading(show) {
        this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    showError(message) {
        alert('ERROR: ' + message);
    }

    showSuccess(message) {
        console.log('SUCCESS: ' + message);
    }
}

// Modal functions (global scope for onclick handlers)
function closeUrlModal() {
    const modal = document.getElementById('url-modal');
    modal.style.display = 'none';

    // Reset camera selection if modal was closed without setting URL
    const cameraSelect = document.getElementById('camera-select');
    if (cameraSelect.value === 'ip' || cameraSelect.value === 'rtsp') {
        cameraSelect.value = '';
        document.getElementById('start-btn').disabled = true;
    }
}

function setCustomUrl() {
    const urlInput = document.getElementById('camera-url');
    const url = urlInput.value.trim();

    if (!url) {
        alert('PLEASE ENTER A VALID URL');
        return;
    }

    // Validate URL format
    if (!url.startsWith('http') && !url.startsWith('rtsp')) {
        alert('URL MUST START WITH http:// OR rtsp://');
        return;
    }

    // Store the custom URL in the select option
    const cameraSelect = document.getElementById('camera-select');
    const selectedOption = cameraSelect.options[cameraSelect.selectedIndex];
    selectedOption.value = url;

    closeUrlModal();

    // Enable start button
    document.getElementById('start-btn').disabled = false;
    urlInput.value = '';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    new LiveDetectionController();
});

// Handle modal clicks outside content
document.addEventListener('click', function (e) {
    const modal = document.getElementById('url-modal');
    if (e.target === modal) {
        closeUrlModal();
    }
});

// Handle escape key for modal
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('url-modal');
        if (modal.style.display === 'flex') {
            closeUrlModal();
        }
    }
});