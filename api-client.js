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
     * @param {string} targetUrl - The full URL of the API endpoint (e.g., `${server_url}/api/send_message`)
     * @param {string} message - The message text to send
     * @param {string} agentId - Optional target agent ID (used for @mention format)
     * @returns {Promise<object>} - The response from the agent
     */
    async sendMessage(targetUrl, message, agentId) {
        const formattedMessage = agentId ? `@${agentId} ${message}` : message;
        
        try {
            console.log(`Sending message to ${targetUrl}:`, formattedMessage);
            
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: formattedMessage,
                    conversation_id: this.conversationId
                })
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            this.conversationId = data.conversation_id;
            console.log('Response received:', data);
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