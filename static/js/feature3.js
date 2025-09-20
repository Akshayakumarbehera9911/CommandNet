// Feature 3: Advanced Object Detection System - JavaScript (No Live Feed)
// Global variables
let currentImageSession = null;
let currentVideoSession = null;
let uploadedImageFiles = [];
let uploadedVideoFiles = [];
let videoProcessingInterval = null;

// Tab Management
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

// Get selected detection filter
function getSelectedFilter(filterType) {
    const filterName = filterType === 'image' ? 'image-filter' : 'video-filter';
    const checkboxes = document.querySelectorAll(`input[name="${filterName}"]:checked`);
    const selected = Array.from(checkboxes).map(cb => cb.value);
    
    // Logic for combinations
    if (selected.includes('all') || selected.length === 0) return 'all';
    if (selected.includes('person') && selected.includes('car')) return 'person_car';
    if (selected.includes('person')) return 'person';
    if (selected.includes('car')) return 'car';
    return 'all'; // default
}

// Initialize Drag and Drop
function initializeDragDrop() {
    // Image drag and drop
    const imageUploadArea = document.getElementById('image-upload-area');
    const imageInput = document.getElementById('image-files');
    setupDragDrop(imageUploadArea, imageInput, handleImageFiles);
    imageInput.addEventListener('change', (e) => handleImageFiles(e.target.files));

    // Video drag and drop
    const videoUploadArea = document.getElementById('video-upload-area');
    const videoInput = document.getElementById('video-files');
    setupDragDrop(videoUploadArea, videoInput, handleVideoFiles);
    videoInput.addEventListener('change', (e) => handleVideoFiles(e.target.files));
}

function setupDragDrop(uploadArea, input, handler) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('drag-over'), false);
    });

    uploadArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handler(files);
    }, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Image Processing Functions
function handleImageFiles(files) {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
        const isImage = file.type.startsWith('image/');
        const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB
        return isImage && isValidSize;
    });

    if (validFiles.length !== fileArray.length) {
        showStatus('image-processing-status', 'Some files were filtered out (non-images or > 50MB)', 'warning');
    }

    uploadedImageFiles = [...uploadedImageFiles, ...validFiles];
    updateImageFileList();

    // Check total size
    const totalSize = uploadedImageFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 200 * 1024 * 1024) { // 200MB
        showStatus('image-processing-status', 'Total file size exceeds 200MB limit', 'error');
        uploadedImageFiles = uploadedImageFiles.slice(0, -validFiles.length); // Remove last added files
        updateImageFileList();
        return;
    }

    document.getElementById('process-images-btn').disabled = uploadedImageFiles.length === 0;
}

function updateImageFileList() {
    const fileList = document.getElementById('image-file-list');
    if (uploadedImageFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    const totalSize = uploadedImageFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

    fileList.innerHTML = `
        <h3>UPLOADED FILES (${uploadedImageFiles.length})</h3>
        <p>Total size: ${totalSizeMB} MB / 200 MB</p>
        <div class="file-items">
            ${uploadedImageFiles.map((file, index) => `
                <div class="file-item">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button onclick="removeImageFile(${index})" class="remove-btn">✕</button>
                </div>
            `).join('')}
        </div>
    `;
}

function removeImageFile(index) {
    uploadedImageFiles.splice(index, 1);
    updateImageFileList();
    document.getElementById('process-images-btn').disabled = uploadedImageFiles.length === 0;
}

function clearImages() {
    uploadedImageFiles = [];
    updateImageFileList();
    document.getElementById('process-images-btn').disabled = true;
    document.getElementById('image-results').style.display = 'none';
    currentImageSession = null;
}

async function processImages() {
    if (uploadedImageFiles.length === 0) return;

    const selectedFilter = getSelectedFilter('image');
    showImageProcessingStatus(`Uploading files for ${getFilterDisplayName(selectedFilter)} detection...`, 'processing');
    document.getElementById('process-images-btn').disabled = true;

    try {
        // Upload files
        const formData = new FormData();
        uploadedImageFiles.forEach(file => {
            formData.append('images', file);
        });

        const uploadResponse = await fetch('/feature3/upload_images', {
            method: 'POST',
            body: formData
        });

        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) {
            throw new Error(uploadResult.error);
        }

        currentImageSession = uploadResult.session_id;
        showImageProcessingStatus(`Processing images with YOLO11x (${getFilterDisplayName(selectedFilter)})...`, 'processing');

        // Process images with filter
        const processResponse = await fetch('/feature3/process_images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: currentImageSession,
                detection_filter: selectedFilter
            })
        });

        const processResult = await processResponse.json();
        if (!processResult.success) {
            throw new Error(processResult.error);
        }

        showImageProcessingStatus(`Processing complete! (${getFilterDisplayName(selectedFilter)})`, 'success');
        displayImageResults(processResult);

    } catch (error) {
        showImageProcessingStatus('Processing failed: ' + error.message, 'error');
        console.error('Image processing error:', error);
    } finally {
        document.getElementById('process-images-btn').disabled = false;
    }
}

function displayImageResults(results) {
    const resultsSection = document.getElementById('image-results');
    const gallery = document.getElementById('image-gallery');
    const statistics = document.getElementById('image-statistics');

    // Create gallery grid
    gallery.innerHTML = `
        <div class="gallery-header">
            <h4>PROCESSED IMAGES (${results.processed_images.length}) - ${getFilterDisplayName(results.detection_filter).toUpperCase()}</h4>
            <button onclick="downloadAllImages()" class="download-btn">DOWNLOAD ALL</button>
        </div>
        <div class="gallery-grid">
            ${results.processed_images.map((img, index) => `
                <div class="gallery-item" onclick="openImageModal('${img.url}', ${JSON.stringify(img).replace(/"/g, '&quot;')})">
                    <img src="${img.url}" alt="${img.original_name}" loading="lazy">
                    <div class="image-overlay">
                        <p class="image-name">${img.original_name}</p>
                        <p class="detection-count">${img.object_count} objects</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Create statistics
    statistics.innerHTML = `
        <h4>DETECTION STATISTICS - ${getFilterDisplayName(results.detection_filter).toUpperCase()}</h4>
        <div class="stat-grid">
            <div class="stat-item">
                <span class="stat-label">Processing Time</span>
                <span class="stat-value">${results.processing_time}s</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Objects</span>
                <span class="stat-value">${results.total_objects}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Average Confidence</span>
                <span class="stat-value">${results.average_confidence}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Images Processed</span>
                <span class="stat-value">${results.processed_images.length}</span>
            </div>
        </div>
        <h4>OBJECT BREAKDOWN</h4>
        <div class="object-breakdown">
            ${Object.entries(results.object_counts).map(([obj, count]) => `
                <div class="object-item">
                    <span class="object-name">${obj}</span>
                    <span class="object-count">${count}</span>
                </div>
            `).join('')}
        </div>
    `;

    resultsSection.style.display = 'block';
}

// Video Processing Functions
function handleVideoFiles(files) {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
        const isVideo = file.type.startsWith('video/');
        const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB
        return isVideo && isValidSize;
    });

    if (validFiles.length !== fileArray.length) {
        showStatus('video-processing-status', 'Some files were filtered out (non-videos or > 50MB)', 'warning');
    }

    uploadedVideoFiles = [...uploadedVideoFiles, ...validFiles];
    updateVideoFileList();

    // Check total size
    const totalSize = uploadedVideoFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 200 * 1024 * 1024) { // 200MB
        showStatus('video-processing-status', 'Total file size exceeds 200MB limit', 'error');
        uploadedVideoFiles = uploadedVideoFiles.slice(0, -validFiles.length);
        updateVideoFileList();
        return;
    }

    document.getElementById('process-videos-btn').disabled = uploadedVideoFiles.length === 0;
}

function updateVideoFileList() {
    const fileList = document.getElementById('video-file-list');
    if (uploadedVideoFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    const totalSize = uploadedVideoFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

    fileList.innerHTML = `
        <h3>UPLOADED VIDEOS (${uploadedVideoFiles.length})</h3>
        <p>Total size: ${totalSizeMB} MB / 200 MB</p>
        <div class="file-items">
            ${uploadedVideoFiles.map((file, index) => `
                <div class="file-item">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button onclick="removeVideoFile(${index})" class="remove-btn">✕</button>
                </div>
            `).join('')}
        </div>
    `;
}

function removeVideoFile(index) {
    uploadedVideoFiles.splice(index, 1);
    updateVideoFileList();
    document.getElementById('process-videos-btn').disabled = uploadedVideoFiles.length === 0;
}

function clearVideos() {
    uploadedVideoFiles = [];
    updateVideoFileList();
    document.getElementById('process-videos-btn').disabled = true;
    document.getElementById('video-results').style.display = 'none';
    currentVideoSession = null;
    if (videoProcessingInterval) {
        clearInterval(videoProcessingInterval);
        videoProcessingInterval = null;
    }
}

async function processVideos() {
    if (uploadedVideoFiles.length === 0) return;

    const selectedFilter = getSelectedFilter('video');
    showVideoProcessingStatus(`Uploading videos for ${getFilterDisplayName(selectedFilter)} detection...`, 'processing');
    document.getElementById('process-videos-btn').disabled = true;
    document.getElementById('cancel-videos-btn').style.display = 'inline-block';
    document.getElementById('cancel-videos-btn').disabled = false;

    try {
        // Upload files
        const formData = new FormData();
        uploadedVideoFiles.forEach(file => {
            formData.append('videos', file);
        });

        const uploadResponse = await fetch('/feature3/upload_videos', {
            method: 'POST',
            body: formData
        });

        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) {
            throw new Error(uploadResult.error);
        }

        currentVideoSession = uploadResult.session_id;
        showVideoProcessingStatus(`Starting video processing (${getFilterDisplayName(selectedFilter)})...`, 'processing');

        // Start processing with filter
        const processResponse = await fetch('/feature3/process_videos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: currentVideoSession,
                detection_filter: selectedFilter
            })
        });

        const processResult = await processResponse.json();
        if (!processResult.success) {
            throw new Error(processResult.error);
        }

        // Start polling for progress
        startVideoProgressPolling();

    } catch (error) {
        showVideoProcessingStatus('Processing failed: ' + error.message, 'error');
        console.error('Video processing error:', error);
        resetVideoProcessingUI();
    }
}

function startVideoProgressPolling() {
    videoProcessingInterval = setInterval(async () => {
        try {
            const response = await fetch(`/feature3/video_progress/${currentVideoSession}`);
            const progress = await response.json();

            if (progress.status === 'processing') {
                showVideoProcessingStatus(`Processing: ${progress.progress.toFixed(1)}% - ${progress.current_file || 'Processing...'}`, 'processing');
            } else if (progress.status === 'completed') {
                clearInterval(videoProcessingInterval);
                videoProcessingInterval = null;
                showVideoProcessingStatus('Video processing complete!', 'success');
                displayVideoResults(progress.results);
                resetVideoProcessingUI();
            } else if (progress.status === 'error') {
                clearInterval(videoProcessingInterval);
                videoProcessingInterval = null;
                showVideoProcessingStatus('Processing failed: ' + progress.error, 'error');
                resetVideoProcessingUI();
            } else if (progress.status === 'not_found') {
                clearInterval(videoProcessingInterval);
                videoProcessingInterval = null;
                showVideoProcessingStatus('Session not found', 'error');
                resetVideoProcessingUI();
            }
        } catch (error) {
            console.error('Progress polling error:', error);
        }
    }, 2000); // Poll every 2 seconds
}

async function cancelVideoProcessing() {
    if (!currentVideoSession) return;

    try {
        await fetch(`/feature3/cancel_video/${currentVideoSession}`, {
            method: 'POST'
        });
        showVideoProcessingStatus('Cancelling processing...', 'warning');
    } catch (error) {
        console.error('Cancel error:', error);
    }
}

function resetVideoProcessingUI() {
    document.getElementById('process-videos-btn').disabled = false;
    document.getElementById('cancel-videos-btn').style.display = 'none';
    document.getElementById('cancel-videos-btn').disabled = true;
}

function displayVideoResults(results) {
    const resultsSection = document.getElementById('video-results');
    const videoList = document.getElementById('video-list');
    const statistics = document.getElementById('video-statistics');

    // Create video list
    videoList.innerHTML = `
        <div class="video-header">
            <h4>PROCESSED VIDEOS (${results.processed_videos.length}) - ${getFilterDisplayName(results.detection_filter).toUpperCase()}</h4>
        </div>
        <div class="video-items">
            ${results.processed_videos.map(video => `
                <div class="video-item">
                    <div class="video-info">
                        <h5>${video.original_name}</h5>
                        <p>Processed: ${video.processed_name}</p>
                        <p>Frames: ${video.total_frames} | Detections: ${video.detections}</p>
                    </div>
                    <div class="video-controls">
                        <button onclick="downloadVideo('${video.processed_name}')" class="download-btn">DOWNLOAD</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Create statistics
    statistics.innerHTML = `
        <h4>PROCESSING STATISTICS - ${getFilterDisplayName(results.detection_filter).toUpperCase()}</h4>
        <div class="stat-grid">
            <div class="stat-item">
                <span class="stat-label">Processing Time</span>
                <span class="stat-value">${results.processing_time}s</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Objects</span>
                <span class="stat-value">${results.total_objects}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Videos Processed</span>
                <span class="stat-value">${results.processed_videos.length}</span>
            </div>
        </div>
        <h4>OBJECT BREAKDOWN</h4>
        <div class="object-breakdown">
            ${Object.entries(results.object_counts || {}).map(([obj, count]) => `
                <div class="object-item">
                    <span class="object-name">${obj}</span>
                    <span class="object-count">${count}</span>
                </div>
            `).join('')}
        </div>
    `;

    resultsSection.style.display = 'block';
}

// Helper Functions
function getFilterDisplayName(filter) {
    const filterNames = {
        'all': 'All Objects',
        'person': 'Person Only',
        'car': 'Vehicles Only',
        'person_car': 'Person + Vehicles'
    };
    return filterNames[filter] || 'All Objects';
}

// Modal Functions
function openImageModal(imageUrl, imageData) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalDetails = document.getElementById('modal-details');

    const data = typeof imageData === 'string' ? JSON.parse(imageData.replace(/&quot;/g, '"')) : imageData;

    modalImage.src = imageUrl;
    modalDetails.innerHTML = `
        <h3>${data.original_name}</h3>
        <p><strong>Objects Detected:</strong> ${data.object_count}</p>
        <div class="detection-list">
            ${data.detections.map(det => `
                <div class="detection-item">
                    <span class="detection-class">${det.class}</span>
                    <span class="detection-confidence">${(det.confidence * 100).toFixed(1)}%</span>
                    <span class="detection-bbox">[${det.bbox.join(', ')}]</span>
                </div>
            `).join('')}
        </div>
        <button onclick="downloadSingleImage('${data.processed_name}')" class="download-btn">DOWNLOAD IMAGE</button>
    `;

    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('image-modal').style.display = 'none';
}

// Download Functions
async function downloadSingleImage(filename) {
    try {
        const response = await fetch(`/feature3/download_image/${currentImageSession}/${filename}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Download error:', error);
    }
}

async function downloadAllImages() {
    if (!currentImageSession) return;

    try {
        const response = await fetch(`/feature3/download_all_images/${currentImageSession}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `detected_images_${new Date().toISOString().slice(0, 10)}.zip`;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Download error:', error);
    }
}

async function downloadVideo(filename) {
    if (!currentVideoSession) return;

    try {
        const response = await fetch(`/feature3/download_video/${currentVideoSession}/${filename}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Download error:', error);
    }
}

// Status Functions
function showImageProcessingStatus(message, type) {
    showStatus('image-processing-status', message, type);
}

function showVideoProcessingStatus(message, type) {
    showStatus('video-processing-status', message, type);
}

function showStatus(elementId, message, type) {
    const statusElement = document.getElementById(elementId);
    if (statusElement) {
        statusElement.innerHTML = `<div class="status-message ${type}">${message}</div>`;
        statusElement.style.display = 'block';
    } else {
        console.log(`Status (${type}): ${message}`);
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (currentImageSession) {
        navigator.sendBeacon(`/feature3/cleanup_session/${currentImageSession}`, '');
    }
    if (currentVideoSession) {
        navigator.sendBeacon(`/feature3/cleanup_session/${currentVideoSession}`, '');
    }
});

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('image-modal');
    if (event.target === modal) {
        closeModal();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initializeDragDrop();
    initializeCheckboxLogic(); // Add this line
});

function initializeCheckboxLogic() {
    // Handle image filter checkboxes
    const imageAllCheckbox = document.getElementById('image-filter-all');
    const imageOtherCheckboxes = document.querySelectorAll('input[name="image-filter"]:not(#image-filter-all)');
    
    if (imageAllCheckbox) {
        imageAllCheckbox.addEventListener('change', function() {
            if (this.checked) {
                imageOtherCheckboxes.forEach(cb => cb.checked = false);
            }
        });
    }
    
    imageOtherCheckboxes.forEach(cb => {
        cb.addEventListener('change', function() {
            if (this.checked && imageAllCheckbox) {
                imageAllCheckbox.checked = false;
            }
        });
    });

    // Handle video filter checkboxes
    const videoAllCheckbox = document.getElementById('video-filter-all');
    const videoOtherCheckboxes = document.querySelectorAll('input[name="video-filter"]:not(#video-filter-all)');
    
    if (videoAllCheckbox) {
        videoAllCheckbox.addEventListener('change', function() {
            if (this.checked) {
                videoOtherCheckboxes.forEach(cb => cb.checked = false);
            }
        });
    }
    
    videoOtherCheckboxes.forEach(cb => {
        cb.addEventListener('change', function() {
            if (this.checked && videoAllCheckbox) {
                videoAllCheckbox.checked = false;
            }
        });
    });
}