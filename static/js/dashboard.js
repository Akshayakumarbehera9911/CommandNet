// Dashboard JavaScript Functions

// Weather functionality
class WeatherManager {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateSunTimes();
        this.setWeatherIcon();
        this.startAutoRefresh();
    }

    bindEvents() {
        const updateBtn = document.getElementById('update-weather-btn');
        const locationInput = document.getElementById('location-input');

        if (updateBtn) {
            updateBtn.addEventListener('click', () => this.updateWeather());
        }

        if (locationInput) {
            locationInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.updateWeather();
                }
            });
        }
    }

    async updateWeather() {
        const locationInput = document.getElementById('location-input');
        const updateBtn = document.getElementById('update-weather-btn');
        
        if (!locationInput || !updateBtn) return;

        const location = locationInput.value.trim();
        if (!location) {
            this.showError('Please enter a city name');
            return;
        }

        // Show loading state
        updateBtn.disabled = true;
        updateBtn.textContent = 'LOADING...';
        this.showLoading();

        try {
            const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
            const data = await response.json();

            if (response.ok) {
                this.updateWeatherDisplay(data);
                this.hideError();
            } else {
                throw new Error(data.message || 'Failed to fetch weather data');
            }
        } catch (error) {
            console.error('Weather update error:', error);
            this.showError(`Failed to update weather: ${error.message}`);
        } finally {
            updateBtn.disabled = false;
            updateBtn.textContent = 'UPDATE';
            this.hideLoading();
        }
    }

    updateWeatherDisplay(weather) {
        // Update main weather info
        const locationDisplay = document.querySelector('.location-display');
        const weatherDesc = document.querySelector('.weather-desc');
        
        if (locationDisplay) {
            locationDisplay.textContent = `${weather.city}, ${weather.country}`;
        }
        if (weatherDesc) {
            weatherDesc.textContent = weather.weather_desc;
        }

        // Update weather values
        this.updateElement('temperature', `${weather.temperature}°C`);
        this.updateElement('feels-like', `${weather.feels_like}°C`);
        this.updateElement('humidity', `${weather.humidity}%`);
        this.updateElement('pressure', `${weather.pressure} hPa`);
        this.updateElement('wind-speed', `${weather.wind_speed} m/s`);
        this.updateElement('wind-direction', `${weather.wind_deg}°`);
        this.updateElement('visibility', `${weather.visibility} km`);
        this.updateElement('clouds', `${weather.clouds}%`);

        // Update sun times
        this.updateSunTimes(weather.sunrise, weather.sunset);

        // Update status
        this.updateStatus(weather.status);

        // Update weather icon
        this.setWeatherIcon(weather.weather_main);

        // Update location input
        const locationInput = document.getElementById('location-input');
        if (locationInput) {
            locationInput.value = weather.city;
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateSunTimes(sunrise = null, sunset = null) {
        const sunriseElement = document.getElementById('sunrise');
        const sunsetElement = document.getElementById('sunset');

        if (sunrise && sunset && sunrise > 0 && sunset > 0) {
            if (sunriseElement) {
                sunriseElement.textContent = this.formatTime(sunrise);
            }
            if (sunsetElement) {
                sunsetElement.textContent = this.formatTime(sunset);
            }
        } else {
            if (sunriseElement) sunriseElement.textContent = '--:--';
            if (sunsetElement) sunsetElement.textContent = '--:--';
        }
    }

    updateStatus(status) {
        const statusElement = document.getElementById('weather-status');
        if (!statusElement) return;

        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('span:last-child');

        if (statusDot && statusText) {
            if (status === 'success') {
                statusDot.className = 'status-dot green';
                statusText.textContent = 'ONLINE';
            } else {
                statusDot.className = 'status-dot red';
                statusText.textContent = 'OFFLINE';
            }
        }
    }

    setWeatherIcon(weatherMain = null) {
        const iconElement = document.getElementById('weather-emoji');
        if (!iconElement) return;

        const icons = {
            'Clear': '☀️',
            'Clouds': '☁️',
            'Rain': '🌧️',
            'Drizzle': '🌦️',
            'Thunderstorm': '⛈️',
            'Snow': '🌨️',
            'Mist': '🌫️',
            'Fog': '🌫️',
            'Haze': '🌫️',
            'Dust': '🌪️',
            'Sand': '🌪️',
            'Ash': '🌋',
            'Squall': '💨',
            'Tornado': '🌪️'
        };

        iconElement.textContent = icons[weatherMain] || '🌤️';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    showLoading() {
        // Could add a loading overlay or spinner here
        console.log('Loading weather data...');
    }

    hideLoading() {
        // Hide loading state
        console.log('Weather data loaded');
    }

    showError(message) {
        // Create or update error display
        let errorElement = document.querySelector('.weather-error');
        
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'weather-error';
            const weatherSection = document.querySelector('.weather-section');
            if (weatherSection) {
                weatherSection.insertBefore(errorElement, weatherSection.firstChild);
            }
        }
        
        errorElement.textContent = `ERROR: ${message}`;
        errorElement.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => this.hideError(), 5000);
    }

    hideError() {
        const errorElement = document.querySelector('.weather-error');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    startAutoRefresh() {
        // Auto-refresh weather every 10 minutes
        setInterval(() => {
            const locationInput = document.getElementById('location-input');
            if (locationInput && locationInput.value.trim()) {
                this.updateWeather();
            }
        }, 600000); // 10 minutes
    }
}

// Time Management
class TimeManager {
    constructor() {
        this.init();
    }

    init() {
        this.updateTime();
        this.startClock();
    }

    updateTime() {
        const timeElement = document.getElementById('current-time');
        if (!timeElement) return;

        const now = new Date();
        const timeString = now.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        timeElement.textContent = timeString;
    }

    startClock() {
        setInterval(() => this.updateTime(), 1000);
    }
}

// Utility Functions
class DashboardUtils {
    static addKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + L to focus location input
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                const locationInput = document.getElementById('location-input');
                if (locationInput) {
                    locationInput.focus();
                    locationInput.select();
                }
            }
            
            // Ctrl/Cmd + R to refresh weather
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                if (window.weatherManager) {
                    window.weatherManager.updateWeather();
                }
            }
            
            // Escape to clear focus
            if (e.key === 'Escape') {
                document.activeElement.blur();
            }
        });
    }

    static addClickEffects() {
        // Add click effects to buttons
        document.querySelectorAll('.weather-btn, .logout-btn, .login-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 100);
            });
        });
    }

    static addHoverEffects() {
        // Enhanced hover effects for feature cards
        document.querySelectorAll('.feature-card').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.3)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.boxShadow = 'none';
            });
        });
    }

    static initializeTooltips() {
        // Add tooltips for weather items
        const weatherItems = document.querySelectorAll('.weather-item');
        weatherItems.forEach(item => {
            const label = item.querySelector('.weather-label').textContent;
            item.title = `Current ${label.toLowerCase()}`;
        });
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize managers
    window.weatherManager = new WeatherManager();
    window.timeManager = new TimeManager();
    
    // Initialize utilities
    DashboardUtils.addKeyboardShortcuts();
    DashboardUtils.addClickEffects();
    DashboardUtils.addHoverEffects();
    DashboardUtils.initializeTooltips();
    
    console.log('Military Dashboard initialized successfully');
});

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // Refresh data when page becomes visible again
        if (window.timeManager) {
            window.timeManager.updateTime();
        }
    }
});

// Error handling for unhandled promises
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
});

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WeatherManager,
        TimeManager,
        DashboardUtils
    };
}