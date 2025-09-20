// Commander Dashboard JavaScript

class CommanderDashboard {
    constructor() {
        this.currentFilters = {};
        this.refreshInterval = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadActivityLogs();
        this.startAutoRefresh();
        this.setDefaultDates();
    }

    bindEvents() {
        // Filter controls
        document.getElementById('apply-filters')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('clear-filters')?.addEventListener('click', () => this.clearFilters());
        document.getElementById('refresh-logs')?.addEventListener('click', () => this.loadActivityLogs());

        // Auto-apply filters on Enter key
        document.querySelectorAll('.control-input').forEach(input => {
            if (input.type === 'date' || input.tagName === 'SELECT') {
                input.addEventListener('change', () => this.applyFilters());
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'r':
                        e.preventDefault();
                        this.loadActivityLogs();
                        break;
                    case 'f':
                        e.preventDefault();
                        document.getElementById('soldier-filter')?.focus();
                        break;
                }
            }
        });
    }

    setDefaultDates() {
        const today = new Date();
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(today.getDate() - 7);

        const dateToInput = document.getElementById('date-to');
        const dateFromInput = document.getElementById('date-from');

        if (dateToInput) {
            dateToInput.value = today.toISOString().split('T')[0];
        }
        if (dateFromInput) {
            dateFromInput.value = oneWeekAgo.toISOString().split('T')[0];
        }
    }

    applyFilters() {
        const filters = {
            username: document.getElementById('soldier-filter')?.value || '',
            action_type: document.getElementById('action-filter')?.value || '',
            date_from: document.getElementById('date-from')?.value || '',
            date_to: document.getElementById('date-to')?.value || '',
            limit: 100
        };

        this.currentFilters = filters;
        this.loadActivityLogs();
    }

    clearFilters() {
        document.getElementById('soldier-filter').value = '';
        document.getElementById('action-filter').value = '';
        document.getElementById('date-from').value = '';
        document.getElementById('date-to').value = '';
        
        this.currentFilters = {};
        this.loadActivityLogs();
    }

    async loadActivityLogs() {
        const logsContainer = document.getElementById('activity-logs');
        if (!logsContainer) return;

        // Show loading state
        logsContainer.innerHTML = '<div class="loading">Loading activity logs...</div>';

        try {
            const params = new URLSearchParams(this.currentFilters);
            const response = await fetch(`/api/activity-logs?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const logs = await response.json();
            this.renderActivityLogs(logs);

        } catch (error) {
            console.error('Error loading activity logs:', error);
            logsContainer.innerHTML = `
                <div class="error-message">
                    Failed to load activity logs: ${error.message}
                    <button onclick="commanderDashboard.loadActivityLogs()" class="retry-btn">Retry</button>
                </div>
            `;
        }
    }

    renderActivityLogs(logs) {
        const container = document.getElementById('activity-logs');
        
        if (logs.length === 0) {
            container.innerHTML = '<div class="no-data">No activity logs found for the selected criteria.</div>';
            return;
        }

        const logsHTML = logs.map(log => {
            const timestamp = new Date(log.timestamp);
            const timeString = timestamp.toLocaleString('en-US', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            const actionColor = this.getActionColor(log.action_type);
            const featureText = log.feature_name ? ` → ${log.feature_name.toUpperCase()}` : '';

            return `
                <div class="activity-item">
                    <div class="activity-info">
                        <div class="activity-user">${log.username.toUpperCase()}</div>
                        <div class="activity-action" style="color: ${actionColor}">
                            ${log.action_type.replace('_', ' ').toUpperCase()}${featureText}
                        </div>
                        ${log.ip_address ? `<div class="activity-ip">IP: ${log.ip_address}</div>` : ''}
                    </div>
                    <div class="activity-time">${timeString}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = logsHTML;
    }

    getActionColor(actionType) {
        const colors = {
            'login': '#4CAF50',
            'logout': '#FF9800',
            'feature_access': '#2196F3',
            'dashboard_access': '#9C27B0',
            'login_failed': '#F44336',
            'weather_api_usage': '#00BCD4'
        };
        return colors[actionType] || '#757575';
    }

    async refreshStats() {
        try {
            const response = await fetch('/api/dashboard-stats');
            if (!response.ok) throw new Error('Failed to fetch stats');
            
            const stats = await response.json();
            this.updateStatsDisplay(stats);
            
        } catch (error) {
            console.error('Error refreshing stats:', error);
        }
    }

    updateStatsDisplay(stats) {
        // Update stat cards
        const totalSoldiersEl = document.getElementById('total-soldiers');
        const activeTodayEl = document.getElementById('active-today');
        const totalActionsEl = document.getElementById('total-actions');

        if (totalSoldiersEl) totalSoldiersEl.textContent = stats.total_soldiers || 0;
        if (activeTodayEl) activeTodayEl.textContent = stats.active_today || 0;

        // Calculate total actions
        const totalActions = stats.soldier_summary?.reduce((sum, soldier) => sum + soldier.total_actions, 0) || 0;
        if (totalActionsEl) totalActionsEl.textContent = totalActions;

        // Update soldier summary
        this.updateSoldierSummary(stats.soldier_summary || []);
    }

    updateSoldierSummary(soldierData) {
        const container = document.getElementById('soldier-summary');
        if (!container) return;

        if (soldierData.length === 0) {
            container.innerHTML = '<div class="no-data">No soldier data available.</div>';
            return;
        }

        const summaryHTML = soldierData.map(soldier => {
            const lastActivity = soldier.last_activity ? 
                new Date(soldier.last_activity).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'Never';

            return `
                <div class="soldier-card">
                    <div class="soldier-name">${soldier.username.toUpperCase()}</div>
                    <div class="soldier-stats">
                        <div class="stat-item">
                            <span class="stat-value">${soldier.total_actions}</span>
                            <span class="stat-desc">Total Actions</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${soldier.active_days}</span>
                            <span class="stat-desc">Active Days</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value last-seen">${lastActivity}</span>
                            <span class="stat-desc">Last Seen</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = summaryHTML;
    }

    startAutoRefresh() {
        // Refresh data every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadActivityLogs();
            this.refreshStats();
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Export data functionality
    exportLogs() {
        const params = new URLSearchParams(this.currentFilters);
        params.set('export', 'csv');
        window.open(`/api/activity-logs?${params}`, '_blank');
    }

    // Search functionality
    searchLogs(query) {
        const items = document.querySelectorAll('.activity-item');
        const searchTerm = query.toLowerCase();

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(searchTerm) || !query) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
}

// Utility functions
class DashboardUtils {
    static formatTime(timestamp) {
        return new Date(timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static getTimeSince(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        if (diffMins > 0) return `${diffMins}m ago`;
        return 'Just now';
    }

    static addNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize dashboard when DOM is loaded
let commanderDashboard;

document.addEventListener('DOMContentLoaded', function() {
    commanderDashboard = new CommanderDashboard();
    
    // Add custom CSS for notifications
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: var(--bg-card);
            border: 1px solid var(--border-primary);
            border-radius: 6px;
            color: var(--text-primary);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .error-message {
            text-align: center;
            color: var(--error);
            padding: 2rem;
            border: 1px solid var(--error);
            border-radius: 6px;
            background: rgba(239, 83, 80, 0.1);
        }
        
        .retry-btn {
            background: var(--error);
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            margin-top: 1rem;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .activity-ip {
            font-size: 0.75rem;
            color: var(--text-muted);
        }
    `;
    document.head.appendChild(style);
    
    console.log('Commander Dashboard initialized successfully');
});

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && commanderDashboard) {
        commanderDashboard.loadActivityLogs();
        commanderDashboard.refreshStats();
    }
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    if (commanderDashboard) {
        commanderDashboard.stopAutoRefresh();
    }
});

// Export for global access
window.CommanderDashboard = CommanderDashboard;
window.DashboardUtils = DashboardUtils;