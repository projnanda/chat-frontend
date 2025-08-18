/**
 * API Client for NANDA Agent Backend
 * Handles communication with the agent API for messaging and agent listing
 */
class APIClient {
    constructor() {
        this.conversationId = null;
        this.clientId = localStorage.getItem('client_id');
        this.eventSource = null;
        console.log(`APIClient initialized with client_id: ${this.clientId}`);
    }

    /**
     * Send a message to the specified agent endpoint URL
     * @param {string} targetUrl - The full URL of the API endpoint (e.g., `${server_url}/api/send`)
     * @param {string} message - The message text to send
     * @param {string} agentId - Optional target agent ID (used for @mention format)
     * @returns {Promise<object>} - The response from the agent
     */
    async sendMessage(targetUrl, message, agentId) {
        // Check for special commands
        const isQueryCommand = message.startsWith('/query ') || message.startsWith('# ');
        
        // Don't modify messages that already have @mentions
        const hasExistingMention = message.startsWith('@');
        
        // Check if this is a sandbox agent (personal AI assistant)
        const isSandboxAgent = agentId && agentId.toLowerCase().includes('sandbox');
        
        // Format the message appropriately
        let formattedMessage;
        
        if (isQueryCommand) {
            // For query commands (/query or #), keep the format as is
            // Normalize to /query format if it starts with #
            if (message.startsWith('# ')) {
                formattedMessage = '/query ' + message.substring(2);
            } else {
                formattedMessage = message;
            }
        } else if (isSandboxAgent) {
            // For sandbox agents (personal AI), don't add @mention prefix
            // Send the message directly without modification
            formattedMessage = message;
        } else {
            // For regular messages to other agents, apply @mentions if needed
            formattedMessage = hasExistingMention ? message : (agentId ? `@${agentId} ${message}` : message);
        }
        
        try {
            console.log(`Sending message to ${targetUrl}:`, formattedMessage);
            console.log(`Raw message: "${message}", agentId: ${agentId}, hasExistingMention: ${hasExistingMention}, isQueryCommand: ${isQueryCommand}, isSandboxAgent: ${isSandboxAgent}`);
            
            // Get the user's name from localStorage
            let senderName = "Anonymous";
            const userProfileStr = localStorage.getItem('userProfile');
            console.log('Raw userProfile from localStorage:', userProfileStr);
            
            if (userProfileStr) {
                try {
                    const userProfile = JSON.parse(userProfileStr);
                    console.log('Parsed userProfile:', userProfile);
                    if (userProfile && userProfile.name) {
                        senderName = userProfile.name;
                        console.log('✅ Found sender name:', senderName);
                    } else {
                        console.warn('⚠️ userProfile exists but no name field found');
                    }
                } catch (error) {
                    console.error('❌ Error parsing user profile:', error);
                }
            } else {
                console.warn('⚠️ No userProfile found in localStorage');
            }
            
            const requestPayload = {
                message: formattedMessage,
                conversation_id: this.conversationId,
                sender_name: senderName  // Include the sender's name in the request
            };
            
            console.log('📤 Sending request payload:', requestPayload);
            
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestPayload)
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            this.conversationId = data.conversation_id;
            
            // More detailed logging
            console.log('Response received:', data);
            console.log('Response type:', typeof data);
            console.log('Response contains response field:', data.hasOwnProperty('response'));
            console.log('Response contains message field:', data.hasOwnProperty('message'));
            console.log('Response contains from_agent field:', data.hasOwnProperty('from_agent'));
            console.log('Response from agent:', data.agent_id);
            
            // Check if this is a message sent confirmation and what it contains
            if (data.response && data.response.includes('Message sent to')) {
                console.log('This is a message forwarding confirmation:', data.response);
                
                // Let's check if we get any additional polling data in the next few seconds that might contain the actual response
                console.log('Will poll for actual response from target agent');
            }
            
            return data;
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Fetch the list of available agents from the registry URL
     * @param {string} registryListUrl - The full URL of the registry list endpoint (e.g., `${registry_url}/list`)
     * @returns {Promise<object>} - Object with agent IDs as keys and URLs as values
     */
    async fetchAgents(registryListUrl) {
        try {
            console.log(`Fetching agents from ${registryListUrl}`);
            
            const response = await fetch(registryListUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch agents: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching agents:', error);
            throw error;
        }
    }

    /**
     * Register for real-time message updates using Server-Sent Events
     * @param {string} sseStreamUrl - The full URL for the SSE stream endpoint (e.g., `${server_url}/api/messages/stream?client_id=...`)
     * @param {Function} onMessageCallback - Callback function that receives messages
     * @returns {Function} - Cleanup function to close the connection
     */
    registerForMessages(sseStreamUrl, onMessageCallback) {
        // Close any existing connection
        if (this.eventSource) {
            this.eventSource.close();
        }
        
        console.log(`Connecting to SSE stream at: ${sseStreamUrl}`);
        
        try {
            this.eventSource = new EventSource(sseStreamUrl);
            
            this.eventSource.onmessage = (event) => {
                const message = JSON.parse(event.data);
                console.log('Received SSE message:', message);
                onMessageCallback(message);
            };
            
            this.eventSource.onerror = (error) => {
                console.error('EventSource error:', error);
                this.eventSource.close();
                
                // Attempt to reconnect after a delay
                setTimeout(() => {
                    console.log('Attempting to reconnect to SSE...');
                    this.registerForMessages(sseStreamUrl, onMessageCallback);
                }, 5000);
            };
        } catch (error) {
            console.error('Failed to create EventSource:', error);
        }
        
        // Return cleanup function
        return () => {
            console.log('Cleaning up SSE connection');
            if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = null;
            }
        };
    }
    
    /**
     * Check the health of an agent API endpoint
     * @param {string} healthCheckUrl - The full URL of the health check endpoint (e.g., `${server_url}/api/health`)
     * @returns {Promise<object>} - Health status information
     */
    async checkHealth(healthCheckUrl) {
        try {
            console.log(`Checking health at ${healthCheckUrl}`);
            
            const response = await fetch(healthCheckUrl);
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'error', message: error.message };
        }
    }
}

// Export the APIClient class
export default APIClient; 