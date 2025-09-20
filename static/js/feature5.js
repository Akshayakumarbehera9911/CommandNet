// Feature 5 - Military Communication System JavaScript

let isProcessing = false; // Prevent duplicate sends

document.addEventListener('DOMContentLoaded', function() {
    initializeMessaging();
    setupEventListeners();
    startAutoRefresh();
});

function initializeMessaging() {
    // Set up initial message type selection
    updateMessageTypeDisplay();
    updateCharacterCount();
    
    // Mark visible messages as read
    markVisibleMessagesAsRead();
}

function setupEventListeners() {
    // Message type radio buttons
    const messageTypeRadios = document.querySelectorAll('input[name="messageType"]');
    messageTypeRadios.forEach(radio => {
        radio.addEventListener('change', updateMessageTypeDisplay);
    });
    
    // Message input character count
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', updateCharacterCount);
        messageInput.addEventListener('keypress', function(e) {
            // Send message on Ctrl+Enter
            if (e.ctrlKey && e.key === 'Enter') {
                sendMessage();
            }
        });
    }
    
    // Send button
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // Refresh button
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshMessages);
    }
}

function updateMessageTypeDisplay() {
    const directRadio = document.getElementById('directMessage');
    const recipientSection = document.getElementById('recipientSection');
    
    if (directRadio && recipientSection) {
        if (directRadio.checked) {
            recipientSection.style.display = 'block';
        } else {
            recipientSection.style.display = 'none';
        }
    }
}

function updateCharacterCount() {
    const messageInput = document.getElementById('messageInput');
    const charCount = document.getElementById('charCount');
    
    if (messageInput && charCount) {
        const currentLength = messageInput.value.length;
        charCount.textContent = currentLength;
        
        // Change color based on usage
        if (currentLength > 400) {
            charCount.style.color = '#ff6b6b';
        } else if (currentLength > 300) {
            charCount.style.color = '#ffd93d';
        } else {
            charCount.style.color = '#90ee90';
        }
    }
}

function sendMessage() {
    // Prevent duplicate sends
    if (isProcessing) {
        return;
    }
    
    const messageInput = document.getElementById('messageInput');
    const recipientSelect = document.getElementById('recipientSelect');
    const directRadio = document.getElementById('directMessage');
    const broadcastRadio = document.getElementById('broadcastMessage');
    const sendBtn = document.getElementById('sendMessageBtn');
    const statusDiv = document.getElementById('sendStatus');
    
    // Get form values
    const message = messageInput ? messageInput.value.trim() : '';
    const recipient = recipientSelect ? recipientSelect.value : '';
    const isDirect = directRadio && directRadio.checked;
    const isBroadcast = broadcastRadio && broadcastRadio.checked;
    
    // Validation
    if (!message) {
        showStatus('Message cannot be empty', 'error');
        return;
    }
    
    if (isDirect && !recipient) {
        showStatus('Please select a recipient', 'error');
        return;
    }
    
    // Set processing flag and disable button
    isProcessing = true;
    sendBtn.disabled = true;
    sendBtn.textContent = 'SENDING...';
    
    // Prepare data
    const messageData = {
        message: message,
        recipient: isDirect ? recipient : null,
        is_broadcast: isBroadcast
    };
    
    // Send message
    fetch('/feature5/send_message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showStatus('Message sent successfully', 'success');
            messageInput.value = '';
            recipientSelect.value = '';
            updateCharacterCount();
            
            // Refresh messages after a short delay
            setTimeout(refreshMessages, 1000);
        } else {
            showStatus(data.error || 'Failed to send message', 'error');
        }
    })
    .catch(error => {
        console.error('Error sending message:', error);
        showStatus('Network error occurred', 'error');
    })
    .finally(() => {
        // Re-enable send button and reset processing flag
        isProcessing = false;
        sendBtn.disabled = false;
        sendBtn.textContent = 'SEND MESSAGE';
    });
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('sendStatus');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `send-status ${type}`;
        
        // Clear status after 3 seconds
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'send-status';
        }, 3000);
    }
}

function refreshMessages() {
    fetch('/feature5/get_messages')
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            updateMessagesList(data.messages);
            updateUnreadCount(data.unread_count);
        } else {
            console.error('Failed to refresh messages:', data.error);
        }
    })
    .catch(error => {
        console.error('Error refreshing messages:', error);
    });
}

function updateMessagesList(messages) {
    const messagesList = document.getElementById('messagesList');
    if (!messagesList) return;
    
    if (messages.length === 0) {
        messagesList.innerHTML = `
            <div class="no-messages">
                <p>NO MESSAGES AVAILABLE</p>
                <p>Send your first message to start communicating</p>
            </div>
        `;
        return;
    }
    
    let messagesHTML = '';
    messages.forEach(message => {
        const messageType = message.message_type;
        const isUnread = !message.is_read && messageType === 'received';
        const timestamp = new Date(message.timestamp).toLocaleString();
        
        messagesHTML += `
            <div class="message-item ${messageType} ${isUnread ? 'unread' : ''}" 
                 data-message-id="${message.id}">
                
                <div class="message-header">
                    ${messageType === 'sent' 
                        ? `<span class="message-direction">TO: ${message.recipient ? message.recipient.toUpperCase() : 'ALL SOLDIERS'}</span>`
                        : `<span class="message-direction">FROM: ${message.sender.toUpperCase()}</span>`
                    }
                    
                    ${message.is_broadcast ? '<span class="broadcast-badge">BROADCAST</span>' : ''}
                    
                    <span class="message-time">${timestamp}</span>
                </div>
                
                <div class="message-content">
                    ${escapeHtml(message.message)}
                </div>
                
                ${isUnread ? '<div class="unread-indicator">NEW</div>' : ''}
            </div>
        `;
    });
    
    messagesList.innerHTML = messagesHTML;
    
    // Mark visible messages as read after a short delay
    setTimeout(markVisibleMessagesAsRead, 500);
}

function updateUnreadCount(count) {
    const unreadBadge = document.getElementById('unreadBadge');
    if (unreadBadge) {
        unreadBadge.textContent = `${count} UNREAD`;
        
        // Update badge color based on count
        if (count > 0) {
            unreadBadge.style.background = '#FF6347';
        } else {
            unreadBadge.style.background = '#228B22';
        }
    }
}

function markVisibleMessagesAsRead() {
    const unreadMessages = document.querySelectorAll('.message-item.unread');
    
    unreadMessages.forEach(messageElement => {
        const messageId = messageElement.getAttribute('data-message-id');
        if (messageId) {
            // Mark as read on server
            fetch('/feature5/mark_read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message_id: messageId })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Remove unread styling
                    messageElement.classList.remove('unread');
                    const unreadIndicator = messageElement.querySelector('.unread-indicator');
                    if (unreadIndicator) {
                        unreadIndicator.remove();
                    }
                }
            })
            .catch(error => {
                console.error('Error marking message as read:', error);
            });
        }
    });
}

function startAutoRefresh() {
    // Refresh messages every 30 seconds
    setInterval(refreshMessages, 30000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Utility function to format time
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}