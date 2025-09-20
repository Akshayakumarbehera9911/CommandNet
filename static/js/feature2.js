// Feature 2 - UAV Object Detection JavaScript

class UAVDetectionApp {
    constructor() {
        this.selectedFiles = [];
        this.currentSessionId = null;
        this.totalDetections = 0;
        
        this.initializeElements();
        this.bindEvents();
        this.debugSession(); // Add session debugging
    }
    
    initializeElements() {
        // Main elements
        this.uploadArea = document.getElementById('uploadArea');
        this.imageInput = document.getElementById('imageInput');
        this.fileList = document.getElementById('fileList');
        this.fileItems = document.getElementById('fileItems');
        this.progressSection = document.getElementById('progressSection');
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsGallery = document.getElementById('resultsGallery');
        
        // Buttons
        this.processBtn = document.getElementById('processBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.newScanBtn = document.getElementById('newScanBtn');
        
        // Progress elements
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        
        // Stats elements
        this.processedCount = document.getElementById('processedCount');
        this.totalDetectionsEl = document.getElementById('totalDetections');
        this.sessionIdEl = document.getElementById('sessionId');
        
        // Modal elements
        this.modal = document.getElementById('imageModal');
        this.modalImage = document.getElementById('modalImage');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalDetections = document.getElementById('modalDetections');
        this.modalClose = document.querySelector('.modal-close');
    }
    
    bindEvents() {
        // File input change
        this.imageInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Buttons
        this.processBtn.addEventListener('click', () => this.processImages());
        this.clearBtn.addEventListener('click', () => this.clearFiles());
        this.downloadBtn.addEventListener('click', () => this.downloadResults());
        this.newScanBtn.addEventListener('click', () => this.startNewScan());
        
        // Modal events
        this.modalClose.addEventListener('click', () => this.closeModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });
        
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }
    
    async debugSession() {
        try {
            const response = await fetch('/feature2/debug-session');
            const sessionData = await response.json();
            console.log('🔍 Session Debug Info:', sessionData);
        } catch (error) {
            console.warn('Session debug failed:', error);
        }
    }
    
    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.addFiles(files);
    }
    
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.addFiles(files);
    }
    
    addFiles(files) {
        // Filter valid image files
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            alert('Please select valid image files.');
            return;
        }
        
        // Add to selected files
        this.selectedFiles = [...this.selectedFiles, ...imageFiles];
        this.updateFileList();
        this.showFileList();
    }
    
    updateFileList() {
        this.fileItems.innerHTML = '';
        
        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const sizeText = this.formatFileSize(file.size);
            const sizeClass = file.size > 16 * 1024 * 1024 ? 'size-error' : 'size-ok';
            
            fileItem.innerHTML = `
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size ${sizeClass}">${sizeText}</span>
                </div>
                <button class="remove-file" onclick="app.removeFile(${index})">✖</button>
            `;
            
            this.fileItems.appendChild(fileItem);
        });
    }
    
    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFileList();
        
        if (this.selectedFiles.length === 0) {
            this.hideFileList();
        }
    }
    
    clearFiles() {
        this.selectedFiles = [];
        this.hideFileList();
        this.imageInput.value = '';
    }
    
    showFileList() {
        this.fileList.style.display = 'block';
    }
    
    hideFileList() {
        this.fileList.style.display = 'none';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async processImages() {
        if (this.selectedFiles.length === 0) {
            alert('Please select images to process.');
            return;
        }
        
        console.log('🔄 Starting image processing...');
        
        // Show progress section
        this.showProgress();
        this.hideResults();
        
        // Prepare FormData
        const formData = new FormData();
        this.selectedFiles.forEach(file => {
            formData.append('images', file);
        });
        
        try {
            // Simulate progress updates
            this.updateProgress(10, 'Uploading images...');
            
            // Send request with enhanced options
            const response = await fetch('/feature2/upload', {
                method: 'POST',
                body: formData,
                credentials: 'same-origin', // Include session cookies
            });
            
            console.log('📡 Upload response status:', response.status);
            
            this.updateProgress(50, 'Processing with YOLO model...');
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                
                try {
                    const errorData = await response.json();
                    console.log('❌ Upload error response:', errorData);
                    errorMessage = errorData.error || errorMessage;
                    
                    if (response.status === 403) {
                        errorMessage += '\n\nPlease refresh the page and login again.';
                    }
                } catch (e) {
                    const errorText = await response.text();
                    console.log('❌ Upload error text:', errorText);
                    errorMessage = errorText || errorMessage;
                }
                
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log('📦 Upload response data:', data);
            
            this.updateProgress(90, 'Finalizing results...');
            
            if (data.success) {
                this.currentSessionId = data.session_id;
                console.log('✅ Session ID received:', this.currentSessionId);
                
                this.displayResults(data.results);
                this.updateProgress(100, 'Detection complete!');
                
                setTimeout(() => {
                    this.hideProgress();
                    this.showResults();
                }, 1000);
            } else {
                throw new Error(data.error || 'Processing failed');
            }
            
        } catch (error) {
            console.error('❌ Processing error:', error);
            this.hideProgress();
            alert(`Error processing images: ${error.message}`);
        }
    }
    
    displayResults(results) {
        this.resultsGallery.innerHTML = '';
        this.totalDetections = 0;
        let processedImages = 0;
        
        results.forEach((result, index) => {
            if (result.success) {
                processedImages++;
                this.totalDetections += result.detection_count;
                this.createResultCard(result, index);
            } else {
                this.createErrorCard(result, index);
            }
        });
        
        // Update stats
        this.processedCount.textContent = processedImages;
        this.totalDetectionsEl.textContent = this.totalDetections;
        this.sessionIdEl.textContent = this.currentSessionId || '---';
    }
    
    createResultCard(result, index) {
        const card = document.createElement('div');
        card.className = 'result-card';
        
        const detectionText = result.detection_count === 1 ? 
            '1 object detected' : 
            `${result.detection_count} objects detected`;
        
        card.innerHTML = `
            <div class="result-image-container">
                <img src="${result.processed_url}" alt="${result.filename}" 
                     onclick="app.openModal('${result.processed_url}', '${result.filename}', ${JSON.stringify(result.detections).replace(/"/g, '&quot;')})">
                <div class="detection-overlay">
                    <span class="detection-count">${detectionText}</span>
                </div>
            </div>
            <div class="result-info">
                <h4>${result.filename}</h4>
                <div class="detection-summary">
                    ${this.formatDetectionSummary(result.detections)}
                </div>
            </div>
        `;
        
        this.resultsGallery.appendChild(card);
    }
    
    createErrorCard(result, index) {
        const card = document.createElement('div');
        card.className = 'result-card error-card';
        
        card.innerHTML = `
            <div class="error-content">
                <div class="error-icon">⚠️</div>
                <h4>${result.filename}</h4>
                <p class="error-message">${result.error}</p>
            </div>
        `;
        
        this.resultsGallery.appendChild(card);
    }
    
    formatDetectionSummary(detections) {
        if (!detections || detections.length === 0) {
            return '<span class="no-detections">No objects detected</span>';
        }
        
        // Group detections by class
        const grouped = {};
        detections.forEach(det => {
            if (!grouped[det.class]) {
                grouped[det.class] = 0;
            }
            grouped[det.class]++;
        });
        
        // Create summary
        const summary = Object.entries(grouped)
            .map(([className, count]) => `${className}: ${count}`)
            .join(', ');
            
        return `<span class="detection-classes">${summary}</span>`;
    }
    
    openModal(imageSrc, filename, detections) {
        this.modalImage.src = imageSrc;
        this.modalTitle.textContent = filename;
        
        // Parse detections if string
        const dets = typeof detections === 'string' ? JSON.parse(detections) : detections;
        
        this.modalDetections.innerHTML = '';
        if (dets && dets.length > 0) {
            dets.forEach(detection => {
                const detDiv = document.createElement('div');
                detDiv.className = 'detection-item';
                detDiv.innerHTML = `
                    <span class="detection-class">${detection.class}</span>
                    <span class="detection-confidence">${(detection.confidence * 100).toFixed(1)}%</span>
                    <span class="detection-bbox">
                        [${detection.bbox.xmin}, ${detection.bbox.ymin}, ${detection.bbox.xmax}, ${detection.bbox.ymax}]
                    </span>
                `;
                this.modalDetections.appendChild(detDiv);
            });
        } else {
            this.modalDetections.innerHTML = '<p>No detections found</p>';
        }
        
        this.modal.style.display = 'block';
    }
    
    closeModal() {
        this.modal.style.display = 'none';
    }
    
    showProgress() {
        this.progressSection.style.display = 'block';
        this.fileList.style.display = 'none';
    }
    
    hideProgress() {
        this.progressSection.style.display = 'none';
    }
    
    showResults() {
        this.resultsSection.style.display = 'block';
    }
    
    hideResults() {
        this.resultsSection.style.display = 'none';
    }
    
    updateProgress(percentage, message) {
        this.progressFill.style.width = percentage + '%';
        this.progressText.textContent = message;
    }
    
    async downloadResults() {
        console.log('🔄 Download requested');
        console.log('📋 Current session ID:', this.currentSessionId);
        
        if (!this.currentSessionId) {
            alert('No session to download');
            return;
        }
        
        try {
            console.log('🔄 Starting download for session:', this.currentSessionId);
            
            const response = await fetch(`/feature2/download/${this.currentSessionId}`, {
                method: 'GET',
                credentials: 'same-origin', // Ensure cookies/session are sent
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            console.log('📡 Download response status:', response.status);
            console.log('📡 Download response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                
                try {
                    const errorData = await response.json();
                    console.log('❌ Download error response:', errorData);
                    errorMessage = errorData.error || errorMessage;
                    
                    if (errorData.debug) {
                        console.log('🔍 Debug info:', errorData.debug);
                    }
                    
                    // Handle specific error types
                    if (response.status === 403) {
                        errorMessage += '\n\n🔄 Try refreshing the page and logging in again.';
                    } else if (response.status === 404) {
                        errorMessage += '\n\n⏰ The session may have expired. Try processing images again.';
                    }
                } catch (e) {
                    // If response isn't JSON, get text
                    const errorText = await response.text();
                    console.log('❌ Download error text:', errorText);
                    errorMessage = errorText || errorMessage;
                }
                
                throw new Error(errorMessage);
            }
            
            // Check if response is actually a ZIP file
            const contentType = response.headers.get('content-type');
            console.log('📄 Content type:', contentType);
            
            if (!contentType || !contentType.includes('application/zip')) {
                console.warn('⚠️  Unexpected content type:', contentType);
                const responseText = await response.text();
                console.log('📄 Response body:', responseText);
                
                // Try to parse as JSON error
                try {
                    const errorData = JSON.parse(responseText);
                    throw new Error(errorData.error || 'Invalid response format');
                } catch (parseError) {
                    throw new Error('Invalid response format - expected ZIP file');
                }
            }
            
            const blob = await response.blob();
            console.log('📦 Blob size:', blob.size, 'bytes');
            
            if (blob.size === 0) {
                throw new Error('Empty file received');
            }
            
            // Create download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `uav_detection_results_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            console.log('✅ Download completed successfully');
            
        } catch (error) {
            console.error('❌ Download failed:', error);
            alert(`Download failed: ${error.message}`);
        }
    }
    
    async startNewScan() {
        console.log('🔄 Starting new scan...');
        
        // Cleanup current session
        if (this.currentSessionId) {
            try {
                console.log('🧹 Cleaning up session:', this.currentSessionId);
                await fetch(`/feature2/cleanup/${this.currentSessionId}`, {
                    method: 'POST',
                    credentials: 'same-origin'
                });
            } catch (error) {
                console.warn('⚠️  Cleanup warning:', error);
            }
        }
        
        // Reset state
        this.selectedFiles = [];
        this.currentSessionId = null;
        this.totalDetections = 0;
        
        // Reset UI
        this.clearFiles();
        this.hideResults();
        this.hideProgress();
        this.imageInput.value = '';
        
        // Scroll to top
        window.scrollTo(0, 0);
        
        console.log('✅ New scan ready');
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing UAV Detection App...');
    app = new UAVDetectionApp();
});

// Handle page unload cleanup
window.addEventListener('beforeunload', function() {
    if (app && app.currentSessionId) {
        console.log('🧹 Page unload cleanup for session:', app.currentSessionId);
        // Send cleanup request (best effort)
        navigator.sendBeacon(`/feature2/cleanup/${app.currentSessionId}`);
    }
});