/**
 * Main Application Logic for NANDA Chat
 */
import APIClient from './api-client.js';
import config from './config.js';
import * as ui from './ui-manager.js';
import { getUserProfile, logout } from './auth-utils.js';

// Global state
let apiClient = null;
let assignedServerUrl = null;
let currentAgent = {
    id: '',
    url: '',
    name: '',
    description: 'AI Agent'
};
// let cleanupSSE = null; // Commented out - Not using SSE
let pollingIntervalId = null; // Added for polling

/**
 * Initialize the application
 */
export async function initApp() {
    console.log('Initializing NANDA Chat application...');
    
    // Get user profile from auth utils
    const user = getUserProfile();
    if (!user) {
        console.error('No user profile found');
        return;
    }
    
    // Display user profile in the header
    setupUserProfile(user);

    // Initialize API client instance (without base URL initially)
    apiClient = new APIClient();
    console.log('API client instance created.');

    // Get assigned server URL (fetch if necessary)
    const serverUrl = await initializeServerUrl();
    if (!serverUrl) {
        console.error("Failed to get assigned server URL. Cannot proceed.");
        // Optional: Add UI feedback that connection failed
        return; // Stop initialization if we don't have a server URL
    }
    console.log(`Using assigned server URL: ${assignedServerUrl}`);
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize the chat interface
    initializeChatInterface();
    
    // Start polling for messages
    startPolling(); 
}

/**
 * Set up the user profile in the header
 * @param {object} user - The user profile object
 */
function setupUserProfile(user) {
    const headerElement = document.querySelector('.chat-header');
    if (headerElement) {
        const userInfoElement = document.createElement('div');
        userInfoElement.className = 'user-info';
        
        // Create separate element for the user picture to ensure it's clickable
        const userPictureElement = document.createElement('img');
        userPictureElement.src = user.picture;
        userPictureElement.alt = user.name;
        userPictureElement.className = 'user-picture';
        userPictureElement.id = 'user-picture';
        
        // Create dropdown container
        const dropdownElement = document.createElement('div');
        dropdownElement.className = 'user-dropdown';
        
        // Add name display and edit button
        const nameDisplayElement = document.createElement('div');
        nameDisplayElement.className = 'name-display';
        nameDisplayElement.innerHTML = `
            <span id="user-display-name">${user.name}</span>
            <button class="edit-name-btn" id="edit-name-btn">Edit</button>
        `;
        
        // Add edit form (initially hidden)
        const editContainerElement = document.createElement('div');
        editContainerElement.id = 'edit-name-container';
        editContainerElement.style.display = 'none';
        editContainerElement.innerHTML = `
            <form class="edit-name-form" id="edit-name-form">
                <input type="text" id="name-input" value="${user.name}" placeholder="Enter your name">
                <div class="edit-buttons">
                    <button type="submit">Save</button>
                    <button type="button" class="cancel-btn" id="cancel-edit">Cancel</button>
                </div>
            </form>
        `;
        
        // Add logout button
        const logoutButton = document.createElement('button');
        logoutButton.id = 'logout-button';
        logoutButton.textContent = 'Sign Out';
        
        // Assemble the dropdown
        dropdownElement.appendChild(nameDisplayElement);
        dropdownElement.appendChild(editContainerElement);
        dropdownElement.appendChild(logoutButton);
        
        // Assemble the user info element
        userInfoElement.appendChild(userPictureElement);
        userInfoElement.appendChild(dropdownElement);
        
        // Add to header
        headerElement.appendChild(userInfoElement);
        
        // Add click handler for user picture to manually toggle dropdown
        userPictureElement.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent event from propagating
            const isVisible = dropdownElement.style.display === 'flex';
            dropdownElement.style.display = isVisible ? 'none' : 'flex';
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!userInfoElement.contains(e.target)) {
                dropdownElement.style.display = 'none';
            }
        });
        
        // Add name editing functionality
        setupNameEditing(user);
        
        // Add sign out functionality
        logoutButton.addEventListener('click', () => {
            logout(); // Use the logout utility
        });
    }
}

/**
 * Set up name editing functionality
 * @param {object} user - The user profile object
 */
function setupNameEditing(user) {
    const editBtn = document.getElementById('edit-name-btn');
    const nameForm = document.getElementById('edit-name-form');
    const nameInput = document.getElementById('name-input');
    const cancelBtn = document.getElementById('cancel-edit');
    const nameDisplay = document.getElementById('user-display-name');
    const editContainer = document.getElementById('edit-name-container');
    
    if (!editBtn || !nameForm || !nameInput || !cancelBtn || !nameDisplay || !editContainer) {
        console.error('Could not find all required elements for name editing');
        return;
    }
    
    // Show edit form
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from closing dropdown
        editBtn.parentElement.style.display = 'none';
        editContainer.style.display = 'block';
        nameInput.focus();
        nameInput.select();
    });
    
    // Cancel editing
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event from propagating
        editContainer.style.display = 'none';
        editBtn.parentElement.style.display = 'flex';
        nameInput.value = user.name;
    });
    
    // Save name changes
    nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event from propagating
        
        const newName = nameInput.value.trim();
        
        if (newName && newName !== user.name) {
            // Update the user profile
            user.name = newName;
            localStorage.setItem('userProfile', JSON.stringify(user));
            
            // Update the display
            nameDisplay.textContent = newName;
        }
        
        // Hide the form
        editContainer.style.display = 'none';
        editBtn.parentElement.style.display = 'flex';
    });
}

/**
 * Set up event listeners for user interactions
 */
function setupEventListeners() {
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    
    // Add send button click event
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }
    
    // Add enter key press event
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
}

/**
 * Send a message to the current agent
 */
async function sendMessage() {
    const userInput = document.getElementById('user-input');
    if (!userInput || !assignedServerUrl) return; // Check if assignedServerUrl is available
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    ui.addMessage(message, true);
    userInput.value = '';
    
    // Show typing indicator
    ui.showTypingIndicator();
    
    try {
        // Construct the target URL using the assigned server URL
        const targetUrl = `${assignedServerUrl}/api/send`; 

        // Send message to agent via API, passing the current agent's ID if needed for @mention
        // The API client now includes client_id automatically
        const response = await apiClient.sendMessage(targetUrl, message, currentAgent.id);
        
        // Remove typing indicator
        ui.removeTypingIndicator();
        
        // Display the bot's response
        if (response && response.response) {
            ui.addMessage(response.response, false, response.agent_id);
        } else {
            throw new Error('Invalid response format');
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        
        // Remove typing indicator
        ui.removeTypingIndicator();
        
        // Display error and fallback to client-side response
        ui.showStatusNotification(`Error: ${error.message}. Using fallback response.`, 'error');
        
        // Generate a generic fallback response
        setTimeout(() => {
            const fallbackResponse = getFallbackResponse(message);
            ui.addMessage(fallbackResponse, false);
        }, 500);
    }
}

/**
 * Get a generic fallback response if API fails
 * @param {string} userMessage - The user's message
 * @returns {string} - A fallback response
 */
function getFallbackResponse(userMessage) {
    const responses = [
        "I apologize, but I'm having trouble connecting to the server right now.",
        "Sorry, I couldn't process your request. Please try again later.",
        "It seems there's a connection issue. Can you try again in a moment?",
        "I'm experiencing technical difficulties. Please be patient.",
        "Your message was received, but I couldn't connect to the server for a response."
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Initialize the chat interface
 */
function initializeChatInterface() {
    ui.clearChat();
    
    // Add an initial loading message
    ui.addMessage('Connecting to agent network...', false);
    
    // Try to get agents directly from API first
    fetchAgentsFromAPI();
}

/**
 * Fetch agents from the API
 */
async function fetchAgentsFromAPI() {
    ui.showStatusNotification('Fetching agents from registry...', 'connecting');
    
    try {
        // Get online clients from the /clients endpoint
        // Construct URL using config.apiBaseUrl and /clients path
        const clientsListUrl = `${config.apiBaseUrl}/clients`; 
        console.log("Fetching online clients from:", clientsListUrl); // Log updated URL
        
        // Use the apiClient to fetch (method name is generic)
        const agentsData = await apiClient.fetchAgents(clientsListUrl); 

        if (!agentsData || Object.keys(agentsData).length === 0) {
            throw new Error('No online clients found'); // Update error message
        }
        
        ui.showStatusNotification('Successfully loaded online clients', 'success'); // Update success message
        
        // Load the agents (clients) from the data
        loadAgentsFromData(agentsData);
        
    } catch (error) {
        console.error('Error fetching agents from registry:', error);
        ui.showStatusNotification('Failed to load agents from registry', 'error');
        
        // Fall back to manual data
        ui.showStatusNotification('Using fallback agent data', 'info');
        loadAgentsFromData(config.fallbackAgents);
    }
}

/**
 * Load agents from data
 * @param {object} agentsData - Object with agent IDs as keys and URLs as values
 */
function loadAgentsFromData(agentsData) {
    const agentList = document.getElementById('agent-list');
    if (!agentList) return;
    
    // Clear existing agents
    agentList.innerHTML = '';
    
    // Populate with fetched agents
    let index = 0;
    Object.entries(agentsData).forEach(([name, url]) => {
        console.log(`Creating agent: ${name} with URL: ${url}`);
        const agentItem = ui.createAgentItem(name, url, index);
        agentList.appendChild(agentItem);
        
        // Set the first agent as active if none is set
        if (index === 0) {
            agentItem.classList.add('active');
            setCurrentAgent(name, url, name.charAt(0).toUpperCase() + name.slice(1));
        }
        
        index++;
    });
    
    // Add event listeners to agent items
    setupAgentSelection();
}

/**
 * Set up agent selection event handlers
 */
function setupAgentSelection() {
    const agentList = document.getElementById('agent-list');
    if (!agentList) return;
    
    const agentItems = agentList.querySelectorAll('.agent-item');
    agentItems.forEach(item => {
        item.addEventListener('click', () => {
            const agentId = item.dataset.agentId;
            const agentUrl = item.dataset.agentUrl || null;
            const name = item.querySelector('h3').textContent;
            
            // Remove active class from all items
            agentItems.forEach(i => i.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            // Set the current agent
            setCurrentAgent(agentId, agentUrl, name);
        });
    });
}

/**
 * Set the current agent and update the UI
 * @param {string} id - The agent ID
 * @param {string} url - The agent URL (ignored, we use central API)
 * @param {string} name - The agent name
 */
function setCurrentAgent(id, url, name) {
    // Clean up any existing SSE connection
    // if (cleanupSSE) { // Commented out - Not using SSE
    //     cleanupSSE();
    //     cleanupSSE = null;
    // }
    
    if (!assignedServerUrl) {
        console.error("Cannot set current agent, assignedServerUrl is not set.");
        return;
    }
    
    // If the agent ID is the same, don't change anything
    if (id === currentAgent.id && currentAgent.id) return;
    
    currentAgent = {
        id: id, 
        name: name || id,
        description: 'AI Agent'
    };
    
    console.log("Current agent set to:", currentAgent);
    
    // DO NOT update API client base URL - keep using the main API endpoint
    // Instead, we'll pass the agent ID in messages
    
    // Set up real-time messaging with the agent using the assigned server URL
    /* // Commented out - Not using SSE, will implement polling later (Task 7)
    try {
        // Construct the SSE stream URL
        const sseStreamUrl = `${assignedServerUrl}/api/messages/stream?client_id=${localStorage.getItem('client_id')}`;
        cleanupSSE = apiClient.registerForMessages(sseStreamUrl, (message) => {
            if (message.message) {
                ui.addMessage(message.message, false, message.from_agent || currentAgent.id);
            }
        });
    } catch (error) {
        console.error('Failed to set up real-time messaging:', error);
    }
    */
    
    // Update UI
    ui.updateChatHeader(currentAgent);
    
    // Clear chat and add greeting
    ui.clearChat();
    ui.addMessage(`Hello! I'm ${currentAgent.name}, your NANDA AI assistant. How can I help you today?`);
    
    // Check agent health
    checkAgentHealth();
    
    // Restart polling (although likely not strictly necessary if endpoint is client_id based)
    // startPolling(); // Re-enable if switching agent should affect polling target
}

/**
 * Check if the agent API is healthy
 */
async function checkAgentHealth() {
    if (!apiClient || !assignedServerUrl) return; // Use assignedServerUrl
    
    try {
        // Construct the health check URL using assigned server URL
        const healthCheckUrl = `${assignedServerUrl}/api/health`;
        const health = await apiClient.checkHealth(healthCheckUrl);
        if (health.status === 'ok') {
            ui.showStatusNotification(`Connected to ${currentAgent.name} agent`, 'success');
        } else {
            ui.showStatusNotification(`Agent ${currentAgent.name} reported status: ${health.status}`, 'info');
        }
    } catch (error) {
        console.error('Health check failed:', error);
        ui.showStatusNotification(`Could not check ${currentAgent.name} agent health`, 'error');
    }
}

// Function to get/fetch the assigned server URL
async function initializeServerUrl() {
    let serverUrl = localStorage.getItem('server_url');
    if (serverUrl) {
        console.log("Found existing server_url:", serverUrl);
        assignedServerUrl = serverUrl;
        return serverUrl;
    }

    console.log("No server_url found, fetching from registry...");
    const clientId = localStorage.getItem('client_id'); // Get client_id
    const userProfileString = localStorage.getItem('userProfile');
    
    if (!clientId || !userProfileString) {
        console.error("Client ID or User Profile not found in localStorage, cannot fetch server URL.");
        ui.showErrorMessage("Initialization error: Client ID or User Profile missing.");
        return null;
    }
    
    let userProfile = null;
    try {
        userProfile = JSON.parse(userProfileString);
    } catch (error) {
        console.error("Failed to parse user profile for allocate request:", error);
        ui.showErrorMessage("Initialization error: Cannot read user profile.");
        return null;
    }

    if (!userProfile.name) {
        console.error("User profile name is missing, cannot allocate.");
        ui.showErrorMessage("Initialization error: User profile name missing.");
        return null;
    }
    
    const clientName = userProfile.name; // Already spaceless

    // Construct the combined payload
    const payload = {
      client_id: clientId,
      userProfile: {
        name: clientName
      }
    };

    try {
        const allocateUrl = `${config.apiBaseUrl}/api/allocate`;
        console.log("Requesting server URL from:", allocateUrl);
        console.log("Sending payload:", payload); // Log the combined payload

        const response = await fetch(allocateUrl, {
          method: 'POST', 
          headers: {
            'Content-Type': 'application/json'
          },
          // Send the combined payload
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch server URL: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        if (!data.agent_url) { 
          throw new Error("Invalid response from server URL assignment endpoint (missing agent_url).");
        }

        // Store the received URL under 'server_url' key in localStorage for now
        serverUrl = data.agent_url; 
        localStorage.setItem('server_url', serverUrl); 
        console.log("Assigned and stored server_url:", serverUrl);
        assignedServerUrl = serverUrl;
        return serverUrl;

    } catch (error) {
        console.error("Error fetching/assigning server URL:", error);
        ui.showErrorMessage(`Failed to connect to assignment service: ${error.message}`);
        // Handle failure - maybe redirect or show permanent error?
        // For now, just return null
        assignedServerUrl = null;
        return null;
    }
}

// --- Polling Implementation (Task 7) ---

/**
 * Polls the backend for new messages for the current client.
 */
async function pollForMessages() {
    if (!assignedServerUrl) {
        console.warn("Polling skipped: assignedServerUrl not set.");
        return;
    }
    // const clientId = localStorage.getItem('client_id'); // No longer needed for /api/render
    // if (!clientId) { // No longer needed for /api/render
    //     console.warn("Polling skipped: clientId not found.");
    //     return;
    // }

    // Use the new /api/render endpoint
    const pollUrl = `${assignedServerUrl}/api/render`;
    console.log("Polling for messages at:", pollUrl); // Updated log

    try {
        const response = await fetch(pollUrl);
        if (!response.ok) {
            // Don't spam errors for expected empty polls or temporary issues
            if (response.status !== 404 && response.status !== 204) { 
                 console.error(`Polling failed: ${response.status} ${response.statusText}`);
            }
            return; 
        }

        // Assuming /api/render returns a single message object or null/empty if none
        const message = await response.json(); 

        // Check if a valid message object was received, using keys from backend
        if (message && message.message) { // Check for 'message' key
            console.log(`Received message via polling:`, message);
            // Use 'message' key for content and 'from_agent' for sender
            ui.addMessage(message.message, false, message.from_agent || 'Agent');
            // TODO: Backend needs to clear latest_message.json after it's read, 
            // or implement a way to prevent re-displaying the same message.
        } else {
             // console.log("No new message."); // Optional: debug logging
        }

    } catch (error) {
        console.error("Error during polling fetch:", error);
        // Maybe stop polling after too many consecutive errors?
    }
}

/**
 * Starts the polling mechanism.
 */
function startPolling() {
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        console.log("Cleared previous polling interval.");
    }
    if (!assignedServerUrl) {
         console.warn("Cannot start polling: assignedServerUrl not set.");
         return;
    }
    console.log("Starting message polling...");
    // Poll immediately first, then set interval
    pollForMessages(); 
    pollingIntervalId = setInterval(pollForMessages, 4000); // Poll every 4 seconds
}

/**
 * Stops the polling mechanism.
 */
function stopPolling() {
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
        console.log("Stopped message polling.");
    }
}

// --- End Polling Implementation ---

// Add listener to stop polling on page unload
window.addEventListener('beforeunload', stopPolling); 