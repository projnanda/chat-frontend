/**
 * UI Manager for NANDA Chat
 * Handles DOM interactions and UI updates
 */

/**
 * Add a message to the chat display
 * @param {string} message - The message text
 * @param {boolean} isUser - Whether the message is from the user (true) or agent (false)
 * @param {string} senderId - Optional ID of the sender for agent-to-agent messages
 */
export function addMessage(message, isUser = false, senderId = null) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(isUser ? 'user-message' : 'bot-message');

    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');

    const messageText = document.createElement('p');
    
    // If we have a sender ID and it's not a user message, show who it's from
    if (senderId && !isUser) {
        const senderSpan = document.createElement('span');
        senderSpan.classList.add('message-sender');
        senderSpan.textContent = `${senderId}: `;
        senderSpan.style.fontWeight = 'bold';
        messageText.appendChild(senderSpan);
    }
    
    // Append the actual message text
    messageText.appendChild(document.createTextNode(message));

    messageContent.appendChild(messageText);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);

    // Scroll to the bottom of the chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Display a typing indicator in the chat
 */
export function showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('message', 'bot-message');
    typingDiv.id = 'typing-indicator';

    const typingContent = document.createElement('div');
    typingContent.classList.add('typing-indicator');

    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.classList.add('typing-dot');
        typingContent.appendChild(dot);
    }

    typingDiv.appendChild(typingContent);
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Remove the typing indicator from the chat
 */
export function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

/**
 * Show a status notification for connection status
 * @param {string} message - The message to display
 * @param {string} status - The status type: 'connecting', 'success', or 'error'
 * @param {number} duration - How long to show the message (ms), 0 for permanent
 */
export function showStatusNotification(message, status = 'info', duration = 5000) {
    // Add a status indicator on the page
    const statusDiv = document.createElement('div');
    statusDiv.id = 'status-notification';
    statusDiv.style.position = 'fixed';
    statusDiv.style.bottom = '10px';
    statusDiv.style.right = '10px';
    statusDiv.style.padding = '8px 12px';
    statusDiv.style.borderRadius = '4px';
    statusDiv.style.fontSize = '12px';
    statusDiv.style.zIndex = '9999';
    
    // Remove any existing status indicator
    const existingStatus = document.getElementById('status-notification');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    // Style based on status
    if (status === 'connecting' || status === 'info') {
        statusDiv.style.backgroundColor = '#1a5fb4';
        statusDiv.style.color = 'white';
    } else if (status === 'success') {
        statusDiv.style.backgroundColor = '#2ec27e';
        statusDiv.style.color = 'white';
    } else if (status === 'error') {
        statusDiv.style.backgroundColor = '#e01b24';
        statusDiv.style.color = 'white';
    }
    
    statusDiv.textContent = message;
    document.body.appendChild(statusDiv);
    
    // Remove after specified duration (if not permanent)
    if (duration > 0) {
        setTimeout(() => {
            if (document.body.contains(statusDiv)) {
                document.body.removeChild(statusDiv);
            }
        }, duration);
    }
    
    return statusDiv;
}

/**
 * Show an error message dialog
 * @param {string} message - The error message to display
 */
export function showErrorMessage(message) {
    // Create a dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'error-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'error-dialog';
    
    const header = document.createElement('div');
    header.className = 'error-header';
    header.textContent = 'Error';
    
    const content = document.createElement('div');
    content.className = 'error-content';
    content.textContent = message;
    
    const button = document.createElement('button');
    button.className = 'error-button';
    button.textContent = 'OK';
    button.onclick = () => {
        document.body.removeChild(overlay);
    };
    
    dialog.appendChild(header);
    dialog.appendChild(content);
    dialog.appendChild(button);
    overlay.appendChild(dialog);
    
    document.body.appendChild(overlay);
}

/**
 * Create an agent item element for the sidebar
 * @param {string} name - The agent name
 * @param {string} url - The agent URL
 * @param {number} index - The index for styling
 * @returns {HTMLElement} - The agent item element
 */
export function createAgentItem(name, url, index) {
    // Helper function to get icon class based on index
    function getIconClassForAgent(idx) {
        const icons = [
            'fa-user', 'fa-code', 'fa-search', 
            'fa-edit', 'fa-cog', 'fa-chart-bar', 
            'fa-globe', 'fa-brain', 'fa-comments'
        ];
        return icons[idx % icons.length];
    }
    
    // Helper function to capitalize first letter
    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    const iconClass = getIconClassForAgent(index);
    
    const agentItem = document.createElement('div');
    agentItem.className = 'agent-item';
    agentItem.dataset.agentId = name || `agent-${index}`;
    
    // Only set the URL attribute if it's a valid URL string
    if (url && typeof url === 'string' && url.trim() !== '') {
        agentItem.dataset.agentUrl = url;
    }
    
    agentItem.innerHTML = `
        <div class="agent-avatar">
            <i class="fas ${iconClass}"></i>
        </div>
        <div class="agent-info">
            <h3>${capitalizeFirstLetter(name) || `Agent ${index + 1}`}</h3>
        </div>
    `;
    
    return agentItem;
}

/**
 * Clear all messages from the chat
 */
export function clearChat() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
}

/**
 * Update the chat header with agent information
 * @param {object} agent - The current agent object
 */
export function updateChatHeader(agent) {
    const chatHeader = document.querySelector('.chat-header');
    if (!chatHeader) return;
    
    const avatar = chatHeader.querySelector('.avatar i');
    const title = chatHeader.querySelector('.title h1');
    const description = chatHeader.querySelector('.title p');
    
    if (avatar && title && description) {
        avatar.className = '';
        avatar.classList.add('fas', 'fa-robot');
        title.textContent = agent.name;
        description.textContent = 'NANDA AI Agent';
    }
} 