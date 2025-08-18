/**
 * UI Manager for NANDA Chat
 * Handles DOM interactions and UI updates
 */

/**
 * Add a message to the chat display
 * @param {string} message - The message text
 * @param {boolean} isUser - Whether the message is from the user (true) or agent (false)
 * @param {string} senderId - Optional ID of the sender for agent-to-agent messages
 * @param {object} messageData - Optional full message data object with sender_name, from_agent, etc.
 */
export function addMessage(message, isUser = false, senderId = null, messageData = null) {
    // Filter out system notification messages
    if (!isUser && message) {
        // Skip system notification messages
        if (message.includes('[AGENT') && message.includes('Message sent to')) {
            console.log("UI filtered out system message:", message);
            return;
        }
        
        // First, try to remove specific agent prefix patterns (e.g., "agent2: FROM agent2:")
        const agentPrefixPattern = /^agent\d+:\s+FROM\s+agent\d+:/;
        if (agentPrefixPattern.test(message)) {
            message = message.replace(agentPrefixPattern, '');
            console.log("Removed agent prefix pattern, new message:", message);
        }
        
        // Also try to remove any "FROM agent2:" anywhere in the message
        if (message.includes('FROM ') || message.toLowerCase().includes('from agent')) {
            message = message.replace(/FROM\s+agent\d+\s*:\s*/i, '');
            message = message.replace(/FROM\s+\w+\s*:\s*/i, '');
            console.log("Removed FROM agent text, new message:", message);
        }
    }
    
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    // Use the addMessageToContainer function to add the message to the default container
    addMessageToContainer(chatMessages, message, isUser, senderId, messageData);
}

/**
 * Add a message to a specific chat container
 * @param {HTMLElement} container - The container to add the message to
 * @param {string} message - The message text
 * @param {boolean} isUser - Whether the message is from the user (true) or agent (false)
 * @param {string} senderId - Optional ID of the sender for agent-to-agent messages
 * @param {object} messageData - Optional full message data object with sender_name, from_agent, etc.
 */
export function addMessageToContainer(container, message, isUser = false, senderId = null, messageData = null) {
    if (!container) return;
    
    // Filter out system notification messages
    if (!isUser && message) {
        // Skip system notification messages
        if (message.includes('[AGENT') && message.includes('Message sent to')) {
            console.log("UI filtered out system message:", message);
            return;
        }
    }
    
    // Check if this is an agent-enhanced message (contains @mention and agent info)
    // Check the message content regardless of isUser value since app.js may pass isUser=true for enhanced messages
    const isAgentEnhanced = message.includes('[AGENT');
    
    // Extract original message and agent enhancement if it's an agent-enhanced message
    let originalMessage = '';
    let agentEnhancement = '';
    let targetUser = '';
    let isActuallyUserMessage = isUser; // Track the corrected user status
    
    if (isAgentEnhanced) {
        console.log(`🔍 Detected potential agent-enhanced message: "${message}"`);
        
        // Parse the actual message format we're seeing:
        // "@mihirsheth9999: [AGENT agentm33 Sending]: Dear Mihir, I hope you're well. Best regards"
        // Fixed regex to handle additional text after agent ID (like "Sending") and multiline content
        let agentMatch = message.match(/^@(\w+):\s*\[AGENT\s+([^\]]+)\]:\s*([\s\S]+)$/);
        let agentId = null;
        
        if (agentMatch) {
            // Format: @user: [AGENT agentId ...]: message
            targetUser = agentMatch[1];
            agentId = agentMatch[2].split(/\s+/)[0]; // Get just the agent ID, ignore additional text
            agentEnhancement = agentMatch[3];
            console.log(`📝 Enhanced message detected - Target: ${targetUser}, Agent: ${agentId}, Message: "${agentEnhancement}"`);
        } else {
            // Fallback: try simpler pattern [AGENT id]: message (with multiline support)
            agentMatch = message.match(/^\[AGENT\s+([^\]]+)\]:\s*([\s\S]+)$/);
            if (agentMatch) {
                agentId = agentMatch[1].split(/\s+/)[0]; // Get just the agent ID, ignore additional text
                agentEnhancement = agentMatch[2];
                console.log(`📝 Simple enhanced message detected - Agent: ${agentId}, Message: "${agentEnhancement}"`);
            }
        }
        
        console.log(`🔬 Debug values: agentMatch=${!!agentMatch}, agentId="${agentId}", agentEnhancement="${agentEnhancement}"`);
        
        if (agentMatch && agentId) {
            // For agent-enhanced messages, we should ALWAYS treat them as user messages
            // because they represent the user's original message that was enhanced by their agent
            isActuallyUserMessage = true;
            console.log(`✅ Agent-enhanced message will be treated as USER message (right side)`);
            console.log(`🎯 Enhanced content: "${agentEnhancement}"`);
            console.log(`📤 Target user: "${targetUser}"`);
        } else {
            console.log(`❌ Agent match failed - treating as regular message`);
        }
    }
    
    // Clean up agent prefix patterns for regular messages
    if (!isActuallyUserMessage && !isAgentEnhanced && message) {
        const agentPrefixPattern = /^agent\d+:\s+FROM\s+agent\d+:/;
        if (agentPrefixPattern.test(message)) {
            message = message.replace(agentPrefixPattern, '');
        }
        
        if (message.includes('FROM ') || message.toLowerCase().includes('from agent')) {
            message = message.replace(/FROM\s+agent\d+\s*:\s*/i, '');
            message = message.replace(/FROM\s+\w+\s*:\s*/i, '');
        }
    }
    
    // Create the message container
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message-wrapper');
    
    // For agent-enhanced messages, create a special grouped layout
    if (isAgentEnhanced && isActuallyUserMessage && agentEnhancement) {
        console.log(`🎨 Creating enhanced message UI for: "${agentEnhancement}"`);
        messageDiv.classList.add('enhanced-message-group');
        
        // Create enhanced message bubble (main message)
        const enhancedBubble = document.createElement('div');
        enhancedBubble.classList.add('message', 'user-message', 'enhanced-message');
        
        const enhancedContent = document.createElement('div');
        enhancedContent.classList.add('message-content');
        
        // Add "AI Enhanced" indicator at the top
        const enhancedIndicator = document.createElement('div');
        enhancedIndicator.classList.add('enhanced-indicator');
        enhancedIndicator.innerHTML = '🤖 AI Enhanced';
        
        const enhancedText = document.createElement('div');
        enhancedText.classList.add('message-text');
        
        const enhancedP = document.createElement('p');
        enhancedP.textContent = agentEnhancement;
        enhancedText.appendChild(enhancedP);
        
        // Add target user info if available
        if (targetUser) {
            const targetInfo = document.createElement('div');
            targetInfo.classList.add('target-user-info');
            targetInfo.textContent = `→ @${targetUser}`;
            enhancedText.appendChild(targetInfo);
        }
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.classList.add('message-timestamp');
        const now = new Date();
        timestamp.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Add delivery status
        const deliveryStatus = document.createElement('div');
        deliveryStatus.classList.add('delivery-status');
        deliveryStatus.innerHTML = '<i class="fas fa-check-double"></i>';
        timestamp.appendChild(deliveryStatus);
        
        enhancedContent.appendChild(enhancedIndicator);
        enhancedContent.appendChild(enhancedText);
        enhancedContent.appendChild(timestamp);
        enhancedBubble.appendChild(enhancedContent);
        
        messageDiv.appendChild(enhancedBubble);
        
        console.log(`✅ Enhanced message UI created successfully!`);
    }
    // Handle regular messages (original logic)
    else {
        console.log(`📝 Creating regular message UI. isUser: ${isActuallyUserMessage}, isAgentEnhanced: ${isAgentEnhanced}`);
    
    // Create the message bubble
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message');
    messageBubble.classList.add(isActuallyUserMessage ? 'user-message' : 'bot-message');
    
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    
    // Create message text element
    const messageText = document.createElement('div');
    messageText.classList.add('message-text');
    
        const messageP = document.createElement('p');
        
        // Special style for System messages
        if (senderId === 'System') {
            messageBubble.classList.add('system-message');
            messageP.style.fontStyle = 'italic';
            messageP.style.color = '#6e6e6e';
        } 
        // Show sender name for bot messages from other agents
        else if (senderId && !isActuallyUserMessage && senderId !== 'System') {
            let displayName = senderId;
            
            // Map agent IDs to human names
            if (senderId.startsWith('agent')) {
                const containerIdMatch = container.id.match(/chat-messages-(\w+)/);
                if (containerIdMatch && containerIdMatch[1]) {
                    let agentName = containerIdMatch[1];
                    if (!agentName.startsWith('@')) {
                        displayName = `@${agentName}`;
                    } else {
                        displayName = agentName;
                    }
                }
            }
            
            const senderSpan = document.createElement('span');
            senderSpan.classList.add('message-sender');
            senderSpan.textContent = `${displayName}: `;
            senderSpan.style.fontWeight = 'bold';
            messageP.appendChild(senderSpan);
        }
        
        // Handle file emoji styling
        if (message.includes('📄')) {
            const parts = message.split('📄');
            messageP.appendChild(document.createTextNode(parts[0]));
            
            const emojiSpan = document.createElement('span');
            emojiSpan.classList.add('file-emoji');
            emojiSpan.textContent = '📄';
            messageP.appendChild(emojiSpan);
            
            if (parts.length > 1) {
                messageP.appendChild(document.createTextNode(parts[1]));
            }
        } else {
            messageP.appendChild(document.createTextNode(message));
        }
        
        messageText.appendChild(messageP);
    
    // Add timestamp
    const timestamp = document.createElement('div');
    timestamp.classList.add('message-timestamp');
    const now = new Date();
    timestamp.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add delivery status for user messages
    if (isActuallyUserMessage) {
        const deliveryStatus = document.createElement('div');
        deliveryStatus.classList.add('delivery-status');
        deliveryStatus.innerHTML = '<i class="fas fa-check-double"></i>';
        timestamp.appendChild(deliveryStatus);
    }
    
    messageContent.appendChild(messageText);
    messageContent.appendChild(timestamp);
    messageBubble.appendChild(messageContent);
    messageDiv.appendChild(messageBubble);
    }
    
    console.log(`🎛️ Final values: isAgentEnhanced=${isAgentEnhanced}, isActuallyUserMessage=${isActuallyUserMessage}, agentEnhancement="${agentEnhancement}"`);
    
    container.appendChild(messageDiv);
    
    // Scroll to the bottom of the chat
    container.scrollTop = container.scrollHeight;
}

/**
 * Display a typing indicator in the chat
 */
export function showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    showTypingIndicatorInContainer(chatMessages);
}

/**
 * Display a typing indicator in a specific chat container
 * @param {HTMLElement} container - The container to add the typing indicator to
 */
export function showTypingIndicatorInContainer(container) {
    if (!container) return;
    
    // Remove any existing typing indicator first
    removeTypingIndicatorFromContainer(container);
    
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('message', 'bot-message');
    typingDiv.id = 'typing-indicator-' + (container.id || Math.random().toString(36).substring(7));

    const typingContent = document.createElement('div');
    typingContent.classList.add('typing-indicator');

    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.classList.add('typing-dot');
        typingContent.appendChild(dot);
    }

    typingDiv.appendChild(typingContent);
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
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
 * Remove the typing indicator from a specific chat container
 * @param {HTMLElement} container - The container to remove the typing indicator from
 */
export function removeTypingIndicatorFromContainer(container) {
    if (!container) return;
    
    // Find all typing indicators in this container
    const typingIndicators = container.querySelectorAll('[id^="typing-indicator-"]');
    typingIndicators.forEach(indicator => {
        indicator.remove();
    });
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
    // Helper function to get background color based on index
    function getAvatarColorForAgent(idx) {
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
            '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
            '#3742fa', '#2f3542', '#ff3838', '#00d8d6', '#17c0eb'
        ];
        return colors[idx % colors.length];
    }
    
    // Helper function to capitalize first letter
    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // Helper function to get initials from name
    function getInitials(name) {
        if (!name) return '?';
        
        // Handle names with special characters (like "mariagorskikh - Sandbox")
        const cleanName = name.replace(/\s*-\s*sandbox\s*/i, '').trim();
        
        const words = cleanName.split(/\s+/);
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase();
        } else {
            return cleanName.slice(0, 2).toUpperCase();
        }
    }
    
    const avatarColor = getAvatarColorForAgent(index);
    const initials = getInitials(name);
    
    const agentItem = document.createElement('div');
    agentItem.className = 'agent-item';
    agentItem.dataset.agentId = name || `agent-${index}`;
    
    // Only set the URL attribute if it's a valid URL string
    if (url && typeof url === 'string' && url.trim() !== '') {
        agentItem.dataset.agentUrl = url;
    }
    
    agentItem.innerHTML = `
        <div class="agent-avatar" style="background-color: ${avatarColor};">
            <span class="avatar-initials">${initials}</span>
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
    
    const avatar = chatHeader.querySelector('.avatar');
    const title = chatHeader.querySelector('.title h1');
    const description = chatHeader.querySelector('.title p');
    
    if (avatar && title && description) {
        // Helper function to get initials from name
        function getInitials(name) {
            if (!name) return '?';
            
            // Handle names with special characters (like "mariagorskikh - Sandbox")
            const cleanName = name.replace(/\s*-\s*sandbox\s*/i, '').trim();
            
            const words = cleanName.split(/\s+/);
            if (words.length >= 2) {
                return (words[0][0] + words[1][0]).toUpperCase();
            } else {
                return cleanName.slice(0, 2).toUpperCase();
            }
        }
        
        // Helper function to get color based on agent name
        function getAvatarColorForName(name) {
            const colors = [
                '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
                '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
                '#3742fa', '#2f3542', '#ff3838', '#00d8d6', '#17c0eb'
            ];
            // Generate a consistent color based on name hash
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
                hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            return colors[Math.abs(hash) % colors.length];
        }
        
        const initials = getInitials(agent.name);
        const avatarColor = getAvatarColorForName(agent.name);
        
        // Replace icon with initials
        avatar.innerHTML = `<span class="avatar-initials">${initials}</span>`;
        avatar.style.backgroundColor = avatarColor;
        
        title.textContent = agent.name;
        
        // Hide or clear the description
        description.textContent = ''; // Remove the description text
        description.style.display = 'none'; // Hide the description element
    }
} 