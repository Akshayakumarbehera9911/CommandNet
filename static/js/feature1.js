// Feature 1: Battlefield Decision Support AI - Frontend Logic
function selectRadio(radioId) {
    // Remove active class from all radio buttons
    document.querySelectorAll('.radio-btn').forEach(btn => btn.classList.remove('active'));
    
    // Check the radio and add active class to its label
    document.getElementById(radioId).checked = true;
    document.querySelector(`label[for="${radioId}"]`).classList.add('active');
}
document.addEventListener('DOMContentLoaded', function() {
    // Initialize event listeners
    initializeSliders();
    initializeForm();
    initializeButtons();
});

function initializeSliders() {
    // Visibility slider
    const visibilitySlider = document.getElementById('visibility');
    const visibilityValue = document.getElementById('visibility-value');
    
    visibilitySlider.addEventListener('input', function() {
        visibilityValue.textContent = this.value;
    });

    // Intelligence confidence slider
    const intelSlider = document.getElementById('intel_confidence');
    const intelValue = document.getElementById('intel-value');
    
    intelSlider.addEventListener('input', function() {
        intelValue.textContent = this.value;
    });
}

function initializeForm() {
    const form = document.getElementById('battlefield-form');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (validateForm()) {
            submitBattlefieldAnalysis();
        }
    });
}

function initializeButtons() {
    const anotherAnalysisBtn = document.getElementById('another-analysis-btn');
    
    anotherAnalysisBtn.addEventListener('click', function() {
        resetForm();
        showWaitingMessage();
    });
}

function validateForm() {
    const requiredFields = [
        'friendly_forces', 'enemy_forces', 'terrain', 'weather',
        'mission_type', 'time_constraint'
    ];
    
    let isValid = true;
    
    // Check required text/number/select fields
    for (const fieldName of requiredFields) {
        const field = document.getElementById(fieldName);
        if (!field.value.trim()) {
            field.style.borderColor = '#FF0000';
            isValid = false;
        } else {
            field.style.borderColor = '#FFFFFF';
        }
    }
    
    // Check radio buttons for civilian presence
    const civilianRadios = document.querySelectorAll('input[name="civilian_presence"]');
    const civilianSelected = Array.from(civilianRadios).some(radio => radio.checked);
    
    if (!civilianSelected) {
        // Highlight radio group container
        const radioGroup = document.querySelector('.radio-group');
        radioGroup.style.borderColor = '#FF0000';
        isValid = false;
    } else {
        const radioGroup = document.querySelector('.radio-group');
        radioGroup.style.borderColor = 'transparent';
    }
    
    // Validate numeric ranges
    const friendlyForces = parseInt(document.getElementById('friendly_forces').value);
    const enemyForces = parseInt(document.getElementById('enemy_forces').value);
    
    if (friendlyForces < 1 || friendlyForces > 10000) {
        document.getElementById('friendly_forces').style.borderColor = '#FF0000';
        isValid = false;
    }
    
    if (enemyForces < 0 || enemyForces > 10000) {
        document.getElementById('enemy_forces').style.borderColor = '#FF0000';
        isValid = false;
    }
    
    if (!isValid) {
        showError('Please fill in all required fields with valid values.');
    }
    
    return isValid;
}

function submitBattlefieldAnalysis() {
    // Collect form data
    const formData = {
        friendly_forces: document.getElementById('friendly_forces').value,
        enemy_forces: document.getElementById('enemy_forces').value,
        terrain: document.getElementById('terrain').value,
        weather: document.getElementById('weather').value,
        visibility: document.getElementById('visibility').value,
        intel_confidence: document.getElementById('intel_confidence').value,
        mission_type: document.getElementById('mission_type').value,
        time_constraint: document.getElementById('time_constraint').value,
        civilian_presence: document.querySelector('input[name="civilian_presence"]:checked').value
    };
    
    // Show processing animation
    showProcessingAnimation();
    
    // Submit to backend
    fetch('/feature1/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            displayResults(data);
        } else {
            showError(data.error || 'Analysis failed');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showError('Network error: Unable to complete analysis');
        showWaitingMessage();
    });
}

function showProcessingAnimation() {
    document.getElementById('waiting-message').style.display = 'none';
    document.getElementById('results-content').classList.remove('active');
    document.getElementById('processing-animation').classList.add('active');
    
    // Disable form submission
    document.getElementById('analyze-btn').disabled = true;
    document.getElementById('analyze-btn').textContent = 'ANALYZING...';
}

function displayResults(data) {
    // Hide processing animation
    document.getElementById('processing-animation').classList.remove('active');
    
    // Display tactical options
    displayTacticalOptions(data.tactical_options);
    
    // Display fog of war analysis
    displayFogOfWarAnalysis(data.fog_of_war);
    
    // Display force analysis
    displayForceAnalysis(data.force_analysis);
    
    // Display commander's recommendation
    displayCommanderRecommendation(data.commander_recommendation);
    
    // Show results panel
    document.getElementById('results-content').classList.add('active');
    
    // Re-enable form
    document.getElementById('analyze-btn').disabled = false;
    document.getElementById('analyze-btn').textContent = 'ANALYZE BATTLEFIELD SCENARIO';
}

function displayTacticalOptions(options) {
    const container = document.getElementById('tactical-options');
    container.innerHTML = '';
    
    options.forEach((option, index) => {
        const optionElement = createTacticalOptionElement(option, index + 1);
        container.appendChild(optionElement);
    });
}

function createTacticalOptionElement(option, rank) {
    const div = document.createElement('div');
    div.className = 'tactical-option';
    
    const successClass = getSuccessClass(option.success_probability);
    const riskClass = getRiskClass(option.risk_level);
    
    div.innerHTML = `
        <div class="option-header">
            <div class="option-rank">OPTION #${rank}</div>
            <div class="option-name">${option.name}</div>
        </div>
        
        <div class="option-description">
            <strong>Description:</strong> ${option.description}
        </div>
        
        <div class="option-details">
            <div class="detail-item">
                <span class="detail-label">Success Probability:</span>
                <span class="${successClass}">${option.success_probability}%</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Confidence Score:</span>
                <span>${option.confidence_score}%</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Risk Level:</span>
                <span class="${riskClass}">${option.risk_level}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Expected Casualties:</span>
                <span>${option.expected_casualties}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Time Required:</span>
                <span>${option.time_required}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Resources Needed:</span>
                <span>${option.resource_requirement}</span>
            </div>
        </div>
    `;
    
    return div;
}

function displayFogOfWarAnalysis(fogData) {
    document.getElementById('uncertainty-factor').textContent = fogData.uncertainty_factor + '%';
    document.getElementById('intel-quality').textContent = fogData.intelligence_quality;
    document.getElementById('visibility-conditions').textContent = fogData.visibility_conditions;
}

function displayForceAnalysis(forceData) {
    document.getElementById('force-ratio').textContent = forceData.force_ratio;
    document.getElementById('force-assessment').textContent = forceData.assessment;
}

function displayCommanderRecommendation(recommendation) {
    document.getElementById('recommended-action').textContent = recommendation.recommended_action;
    document.getElementById('recommendation-rationale').textContent = recommendation.rationale;
    document.getElementById('recommendation-confidence').textContent = recommendation.confidence;
}

function getSuccessClass(probability) {
    if (probability >= 70) {
        return 'success-high';
    } else if (probability >= 50) {
        return 'success-medium';
    } else {
        return 'success-low';
    }
}

function getRiskClass(riskLevel) {
    switch (riskLevel.toLowerCase()) {
        case 'low':
            return 'risk-low';
        case 'medium':
            return 'risk-medium';
        case 'high':
            return 'risk-high';
        case 'critical':
            return 'risk-critical';
        default:
            return '';
    }
}

function showError(message) {
    // Create or update error message
    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.style.cssText = `
            background-color: #FF0000;
            color: #FFFFFF;
            padding: 1rem;
            margin: 1rem 0;
            border: 2px solid #FFFFFF;
            text-align: center;
            font-weight: bold;
        `;
        document.querySelector('.input-panel').appendChild(errorDiv);
    }
    
    errorDiv.textContent = '⚠ ERROR: ' + message;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorDiv) {
            errorDiv.remove();
        }
    }, 5000);
}

function showWaitingMessage() {
    document.getElementById('processing-animation').classList.remove('active');
    document.getElementById('results-content').classList.remove('active');
    document.getElementById('waiting-message').style.display = 'block';
    
    // Clear any error messages
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.remove();
    }
}

function resetForm() {
    // Reset form fields to default values
    document.getElementById('battlefield-form').reset();
    
    // Reset sliders
    document.getElementById('visibility').value = 5;
    document.getElementById('visibility-value').textContent = '5';
    document.getElementById('intel_confidence').value = 5;
    document.getElementById('intel-value').textContent = '5';
    
    // Reset field border colors
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.style.borderColor = '#FFFFFF';
    });
    
    // Reset radio group
    const radioGroup = document.querySelector('.radio-group');
    radioGroup.style.borderColor = 'transparent';
    
    // Re-enable form
    document.getElementById('analyze-btn').disabled = false;
    document.getElementById('analyze-btn').textContent = 'ANALYZE BATTLEFIELD SCENARIO';
}

// Utility functions for enhanced user experience
function scrollToResults() {
    const resultsPanel = document.querySelector('.results-panel');
    resultsPanel.scrollIntoView({ behavior: 'smooth' });
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter to submit form
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.getElementById('battlefield-form');
        form.dispatchEvent(new Event('submit'));
    }
    
    // Escape to reset form
    if (e.key === 'Escape') {
        e.preventDefault();
        resetForm();
        showWaitingMessage();
    }
});

// Add form auto-save functionality (optional)
function saveFormData() {
    const formData = {
        friendly_forces: document.getElementById('friendly_forces').value,
        enemy_forces: document.getElementById('enemy_forces').value,
        terrain: document.getElementById('terrain').value,
        weather: document.getElementById('weather').value,
        visibility: document.getElementById('visibility').value,
        intel_confidence: document.getElementById('intel_confidence').value,
        mission_type: document.getElementById('mission_type').value,
        time_constraint: document.getElementById('time_constraint').value
    };
    
    // Save to sessionStorage (not localStorage due to artifact restrictions)
    try {
        sessionStorage.setItem('feature1_form_data', JSON.stringify(formData));
    } catch (e) {
        // Ignore storage errors
        console.log('Form auto-save not available');
    }
}

function loadFormData() {
    try {
        const savedData = sessionStorage.getItem('feature1_form_data');
        if (savedData) {
            const formData = JSON.parse(savedData);
            
            // Restore form values
            Object.keys(formData).forEach(key => {
                const element = document.getElementById(key);
                if (element && formData[key]) {
                    element.value = formData[key];
                    
                    // Update slider displays
                    if (key === 'visibility') {
                        document.getElementById('visibility-value').textContent = formData[key];
                    }
                    if (key === 'intel_confidence') {
                        document.getElementById('intel-value').textContent = formData[key];
                    }
                }
            });
        }
    } catch (e) {
        // Ignore storage errors
        console.log('Form auto-load not available');
    }
}

// Auto-save form data on changes
document.addEventListener('change', function(e) {
    if (e.target.closest('#battlefield-form')) {
        saveFormData();
    }
});

// Load saved form data on page load
window.addEventListener('load', function() {
    loadFormData();
});