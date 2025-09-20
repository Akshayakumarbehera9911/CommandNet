// Feature 6 - Camouflage Detection System JavaScript (Simplified)

let uploadedFiles = [];
let currentSessionId = null;

// DOM Elements
const imageFiles = document.getElementById('image-files');
const imageFileList = document.getElementById('image-file-list');
const processBtn = document.getElementById('process-images-btn');
const clearBtn = document.getElementById('clear-images-btn');
const processingStatus = document.getElementById('image-processing-status');
const imageGallery = document.getElementById('image-gallery');
const imageStatistics = document.getElementById('image-statistics');
const imageResults = document.getElementById('image-results');
const uploadArea = document.getElementById('image-upload-area');

// Initialize drag and drop
document.addEventListener('DOMContentLoaded', function() {
    initializeDragAndDrop();
    setupFileInput();
});

function initializeDragAndDrop() {
    const uploadZone = uploadArea.querySelector('.upload-zone');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, unhighlight, false);
    });
    
    uploadZone.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    e.currentTarget.classList.add('dragover');
}

function unhighlight(e) {
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function setupFileInput() {
    imageFiles.addEventListener('change', function(e) {
        handleFiles(e.target.files);
    });
}

function handleFiles(files) {
    processingStatus.innerHTML = '';
    
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            uploadedFiles.push(file);
        }
    });
    
    updateFileList();
    updateProcessButton();
}

function updateFileList() {
    if (uploadedFiles.length === 0) {
        imageFileList.innerHTML = '';
        return;
    }
    
    let totalSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);
    
    imageFileList.innerHTML = `
        <div class="file-list-header">
            <h4>UPLOADED FILES (${uploadedFiles.length})</h4>
            <span class="total-size">Total: ${(totalSize / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <div class="file-items">
            ${uploadedFiles.map((file, index) => `
                <div class="file-item">
                    <div class="file-info">
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <button class="remove-file-btn" onclick="removeFile(${index})">×</button>
                </div>
            `).join('')}
        </div>
    `;
}

function updateProcessButton() {
    processBtn.disabled = uploadedFiles.length === 0;
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    updateFileList();
    updateProcessButton();
}

function clearImages() {
    uploadedFiles = [];
    currentSessionId = null;
    imageFiles.value = '';
    updateFileList();
    updateProcessButton();
    processingStatus.innerHTML = '';
    imageGallery.innerHTML = '';
    imageStatistics.innerHTML = '';
    imageResults.style.display = 'none';
}

async function processImages() {
    if (uploadedFiles.length === 0) {
        showError('No images selected');
        return;
    }
    
    try {
        processBtn.disabled = true;
        clearBtn.disabled = true;
        showProcessingStatus('Uploading images...');
        
        // Upload files
        const formData = new FormData();
        uploadedFiles.forEach(file => {
            formData.append('images', file);
        });
        
        const uploadResponse = await fetch('/feature6/upload_images', {
            method: 'POST',
            body: formData
        });
        
        const uploadResult = await uploadResponse.json();
        
        if (!uploadResult.success) {
            throw new Error(uploadResult.error);
        }
        
        currentSessionId = uploadResult.session_id;
        showProcessingStatus('Processing camouflage detection...');
        
        // Process images
        const processResponse = await fetch('/feature6/process_images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: currentSessionId
            })
        });
        
        const processResult = await processResponse.json();
        
        if (!processResult.success) {
            throw new Error(processResult.error || 'Processing failed');
        }
        
        displayResults(processResult);
        
    } catch (error) {
        showError(`Error: ${error.message}`);
    } finally {
        processBtn.disabled = false;
        clearBtn.disabled = false;
    }
}

function showProcessingStatus(message) {
    processingStatus.innerHTML = `
        <div class="processing-message">
            <div class="processing-spinner"></div>
            <span>${message}</span>
        </div>
    `;
}

function showError(message) {
    processingStatus.innerHTML = `
        <div class="error-message">
            <span>⚠ ${message}</span>
        </div>
    `;
}

function displayResults(results) {
    processingStatus.innerHTML = `
        <div class="success-message">
            <span>✅ Processing completed: ${results.total_processed} images processed</span>
        </div>
    `;
    
    // Display gallery
    if (results.processed_images.length > 0) {
        const successfulImages = results.processed_images.filter(img => !img.failed);
        
        imageGallery.innerHTML = successfulImages.map(image => `
            <div class="gallery-item" onclick="showImageModal('${image.processed_path}', '${image.original_filename}')">
                <img src="${image.processed_path}" alt="${image.original_filename}">
                <div class="image-overlay">
                    <div class="image-title">${image.original_filename}</div>
                </div>
                <div class="image-actions">
                    <button onclick="event.stopPropagation(); downloadImage('${image.processed_filename}')" class="download-btn">
                        📥 Download
                    </button>
                </div>
            </div>
        `).join('');
        
        // Display statistics
        displayStatistics(results);
        
        // Show download all button
        if (successfulImages.length > 1) {
            imageStatistics.innerHTML += `
                <div class="bulk-actions">
                    <button onclick="downloadAllImages()" class="download-all-btn">
                        📦 Download All Images
                    </button>
                </div>
            `;
        }
        
        imageResults.style.display = 'block';
    }
}

function displayStatistics(results) {
    imageStatistics.innerHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">${results.total_processed}</div>
                <div class="stat-label">Processed</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${results.total_failed}</div>
                <div class="stat-label">Failed</div>
            </div>
        </div>
    `;
}

function showImageModal(imagePath, filename) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modalDetails = document.getElementById('modal-details');
    
    modalImage.src = imagePath;
    modalDetails.innerHTML = `
        <h4>${filename}</h4>
        <p><strong>Status:</strong> Camouflaged objects detected and highlighted</p>
    `;
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('image-modal').style.display = 'none';
}

async function downloadImage(filename) {
    if (!currentSessionId) {
        showError('No active session');
        return;
    }
    
    try {
        const response = await fetch(`/feature6/download_image/${currentSessionId}/${filename}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            throw new Error('Download failed');
        }
    } catch (error) {
        showError(`Download error: ${error.message}`);
    }
}

async function downloadAllImages() {
    if (!currentSessionId) {
        showError('No active session');
        return;
    }
    
    try {
        const response = await fetch(`/feature6/download_all_images/${currentSessionId}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `camouflage_detection_results_${new Date().toISOString().slice(0,10)}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            throw new Error('Download failed');
        }
    } catch (error) {
        showError(`Download error: ${error.message}`);
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('image-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}