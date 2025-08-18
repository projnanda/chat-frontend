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

// Add a chat history storage object to store messages for each agent
const chatHistories = {};

// Load saved chat histories from localStorage if available
function loadChatHistoriesFromStorage() {
    try {
        const savedChatHistories = localStorage.getItem('chatHistories');
        if (savedChatHistories) {
            Object.assign(chatHistories, JSON.parse(savedChatHistories));
            console.log('Loaded chat histories from localStorage');
        }
    } catch (error) {
        console.error('Error loading chat histories from localStorage:', error);
        // Clear potentially corrupted data
        localStorage.removeItem('chatHistories');
    }
}

// Save chat histories to localStorage
function saveChatHistoriesToStorage() {
    try {
        localStorage.setItem('chatHistories', JSON.stringify(chatHistories));
    } catch (error) {
        console.error('Error saving chat histories to localStorage:', error);
    }
}

// Object to keep track of chat windows
const chatWindows = {};

/**
 * Creates a chat window for an agent if it doesn't exist yet
 * @param {string} agentId - The ID of the agent
 * @returns {HTMLElement} The chat messages container for this agent
 */
function getOrCreateChatWindow(agentId) {
    // If we already have a window for this agent, return its chat messages element
    if (chatWindows[agentId]) {
        return document.getElementById(`chat-messages-${agentId}`);
    }

    // Otherwise, create a new chat window
    const chatWindowsContainer = document.getElementById('chat-windows-container');
    if (!chatWindowsContainer) {
        console.error('Chat windows container not found');
        return null;
    }

    // Create new chat window
    const chatWindow = document.createElement('div');
    chatWindow.id = `chat-window-${agentId}`;
    chatWindow.className = 'chat-window';
    
    // Create messages container for this window
    const chatMessagesDiv = document.createElement('div');
    chatMessagesDiv.id = `chat-messages-${agentId}`;
    chatMessagesDiv.className = 'chat-messages';
    
    // Add to DOM
    chatWindow.appendChild(chatMessagesDiv);
    chatWindowsContainer.appendChild(chatWindow);
    
    // Register in our tracking object
    chatWindows[agentId] = chatWindow;
    
    return chatMessagesDiv;
}

/**
 * Activates a specific chat window and hides others
 * @param {string} agentId - The ID of the agent whose window to activate
 */
function activateChatWindow(agentId) {
    // Get or create the window
    const chatMessagesContainer = getOrCreateChatWindow(agentId);
    if (!chatMessagesContainer) return;
    
    // Hide all windows first
    Object.values(chatWindows).forEach(window => {
        window.classList.remove('active');
    });
    
    // Show this window
    const windowElement = document.getElementById(`chat-window-${agentId}`);
    if (windowElement) {
        windowElement.classList.add('active');
        
        // Restore chat history if available
        if (chatHistories[agentId] && chatMessagesContainer.innerHTML !== chatHistories[agentId]) {
            chatMessagesContainer.innerHTML = chatHistories[agentId];
        }
        
        // Scroll to the bottom of the chat after a short delay to ensure content is rendered
        setTimeout(() => {
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }, 100);
    }
}

/**
 * Initialize the application
 */
export async function initApp() {
    console.log('Initializing NANDA Chat application...');
    
    // Load saved chat histories from localStorage
    loadChatHistoriesFromStorage();
    
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
    // Use displayName (with @) if available, otherwise fall back to name
    const displayName = user.displayName || user.name;
    
    const headerElement = document.querySelector('.chat-header');
    if (headerElement) {
        const userInfoElement = document.createElement('div');
        userInfoElement.className = 'user-info';
        
        // Add username as data attribute for CSS display
        userInfoElement.setAttribute('data-username', displayName);
        
        // Create separate element for the user picture to ensure it's clickable
        const userPictureElement = document.createElement('img');
        userPictureElement.src = user.picture;
        userPictureElement.alt = displayName;
        userPictureElement.className = 'user-picture';
        userPictureElement.id = 'user-picture';
        
        // Create dropdown container
        const dropdownElement = document.createElement('div');
        dropdownElement.className = 'user-dropdown';
        
        // Add name display and edit button
        const nameDisplayElement = document.createElement('div');
        nameDisplayElement.className = 'name-display';
        nameDisplayElement.innerHTML = `
            <span id="user-display-name">${displayName}</span>
            <button class="edit-name-btn" id="edit-name-btn">Edit</button>
        `;
        
        // Add edit form (initially hidden)
        const editContainerElement = document.createElement('div');
        editContainerElement.id = 'edit-name-container';
        editContainerElement.style.display = 'none';
        editContainerElement.innerHTML = `
            <form class="edit-name-form" id="edit-name-form">
                <input type="text" id="name-input" value="${user.name}" placeholder="Enter your username">
                <p class="edit-help">Don't include the @ symbol</p>
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
            const dropdown = dropdownElement;
            const isVisible = dropdown.classList.contains('visible') || dropdown.style.display === 'flex';
            
            // Hide all other dropdowns first
            document.querySelectorAll('.user-dropdown').forEach(d => {
                d.classList.remove('visible');
                d.style.display = 'none';
            });
            
            if (!isVisible) {
                dropdown.classList.add('visible');
                dropdown.style.display = 'flex';
                console.log('User dropdown opened');
            } else {
                dropdown.classList.remove('visible');
                dropdown.style.display = 'none';
                console.log('User dropdown closed');
            }
        });
        
        // Also handle clicks on the user info container
        userInfoElement.addEventListener('click', function(e) {
            if (e.target === userInfoElement || e.target === userPictureElement) {
                e.stopPropagation();
                const dropdown = dropdownElement;
                const isVisible = dropdown.classList.contains('visible') || dropdown.style.display === 'flex';
                
                if (!isVisible) {
                    dropdown.classList.add('visible');
                    dropdown.style.display = 'flex';
                    console.log('User dropdown opened via container click');
                }
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!userInfoElement.contains(e.target)) {
                dropdownElement.classList.remove('visible');
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
        
        // Validate the new username
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        if (!usernameRegex.test(newName)) {
            alert('Username must be 3-20 characters long and can only contain letters, numbers, underscores, and hyphens (no spaces).');
            return;
        }
        
        if (newName && newName !== user.name) {
            // Update the user profile with new name and displayName
            user.name = newName;
            user.displayName = `@${newName}`; // Always show with @ prefix
            localStorage.setItem('userProfile', JSON.stringify(user));
            
            // Update the display
            nameDisplay.textContent = user.displayName;
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
    
    let message = userInput.value.trim();
    if (!message) return;
    
    // Check if message contains the file emoji and replace it with the actual context
    if (message.includes("📄") && window.hiddenLlmContext) {
        message = message.replace("📄", window.hiddenLlmContext);
        // Clear the hidden context after using it
        window.hiddenLlmContext = null;
        
        // Remove the hidden context element
        const hiddenContext = document.getElementById('hidden-llm-context');
        if (hiddenContext) {
            hiddenContext.remove();
        }
    }
    
    // Check if this is a direct query to the personal LLM using the # prefix
    const isHashCommand = message.startsWith('# ');
    
    // Get the current chat window
    const chatMessages = document.getElementById(`chat-messages-${currentAgent.id}`);
    if (!chatMessages) {
        console.error(`Chat window for ${currentAgent.id} not found`);
        return;
    }
    
    // Check if this is a message to another agent (starts with @)
    const isMentionMessage = message.startsWith('@');
    let mentionedAgent = '';
    
    if (isMentionMessage) {
        // Extract the mentioned agent name from the message
        const mentionMatch = message.match(/^@(\w+)/);
        if (mentionMatch && mentionMatch[1]) {
            mentionedAgent = mentionMatch[1];
        }
    }
    
    // For display in the UI, simplify the message if it contains the context
    let displayMessage = userInput.value.trim();
    if (displayMessage.includes("📄")) {
        // For display purposes, keep the emoji to indicate attached context
        displayMessage = displayMessage; // Keep as is with emoji
    }
    
    // Add user message to chat with the display version (emoji instead of full context)
    ui.addMessageToContainer(chatMessages, displayMessage, true);
    userInput.value = '';
    
    // Save the updated chat to the current agent's history
    if (currentAgent.id) {
        chatHistories[currentAgent.id] = chatMessages.innerHTML;
        saveChatHistoriesToStorage();
    }
    
    // Show typing indicator in the specific chat window
    ui.showTypingIndicatorInContainer(chatMessages);
    
    try {
        // Construct the target URL using the assigned server URL
        const targetUrl = `${assignedServerUrl}/api/send`;

        // If this is a direct query to the personal LLM (# command),
        // or a message to another agent (@mention), we need special handling
        const senderAgentId = (isHashCommand || isMentionMessage) ? null : currentAgent.id;
        
        // Log important details about the message being sent
        console.log(`Sending message "${message}" with these details:`);
        console.log(`- isHashCommand: ${isHashCommand}`);
        console.log(`- isMentionMessage: ${isMentionMessage}`);
        console.log(`- mentionedAgent: ${mentionedAgent}`);
        console.log(`- senderAgentId: ${senderAgentId}`);
        console.log(`- targeting URL: ${targetUrl}`);

        // Send message to agent via API
        const response = await apiClient.sendMessage(targetUrl, message, senderAgentId);
        
        // Remove typing indicator from the specific chat window
        ui.removeTypingIndicatorFromContainer(chatMessages);
        
        // Check the response
        if (response && response.response) {
            // Check for system message about message forwarding
            const isSystemMessageSent = response.response.includes('[AGENT') && response.response.includes('Message sent to');
            
            // For messages to other agents, display a friendly confirmation that the message was sent
            if (isMentionMessage && mentionedAgent && isSystemMessageSent) {
                // Display a clean confirmation in the chat that the message was sent
                const confirmationMessage = `✓ Message sent to ${mentionedAgent}`;
                ui.addMessageToContainer(chatMessages, confirmationMessage, false, 'System');
                console.log(`Displayed clean confirmation for message to ${mentionedAgent}`);
                
                // If this is a message to another user, also add it to their chat window
                // so the conversation history is preserved in both places
                const mentionedChatWindow = getOrCreateChatWindow(mentionedAgent);
                if (mentionedChatWindow) {
                    // Add the user's message to the recipient's chat window
                    ui.addMessageToContainer(mentionedChatWindow, message, true);
                    
                    // Save this to the mentioned agent's chat history
                    chatHistories[mentionedAgent] = mentionedChatWindow.innerHTML;
                    saveChatHistoriesToStorage();
                    console.log(`Added outgoing message to ${mentionedAgent}'s chat window`);
                }
            } else if (!isSystemMessageSent) {
                // Only display the response if it's not a system message
                ui.addMessageToContainer(chatMessages, response.response, false, response.agent_id);
                
                // If this was a hash command, also store it in the LLM conversation context
                if (isHashCommand) {
                    const query = message.substring(2).trim();
                    updateLlmConversationContext(query, response.response);
                }
            }
            
            // Save the updated chat to the current agent's history
            if (currentAgent.id) {
                chatHistories[currentAgent.id] = chatMessages.innerHTML;
                saveChatHistoriesToStorage();
            }
        } else {
            throw new Error('Invalid response format');
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        // Remove typing indicator from the specific chat window
        ui.removeTypingIndicatorFromContainer(chatMessages);
        // Display error notification only, do not generate fallback response
        ui.showStatusNotification(`Error: ${error.message}.`, 'error');
    }
}

/**
 * Initialize the chat interface
 */
function initializeChatInterface() {
    ui.clearChat();
    
    // Add the LLM toggle button to the chat input area
    addLlmToggleButton();
    
    // Remove the initial loading message
    // Try to get agents directly from API first
    fetchAgentsFromAPI();
}

/**
 * Add the LLM toggle button to the chat interface
 */
function addLlmToggleButton() {
    const chatInput = document.querySelector('.chat-input');
    if (!chatInput) return;
    
    // Create the toggle button
    const toggleButton = document.createElement('button');
    toggleButton.id = 'llm-toggle-button';
    toggleButton.className = 'llm-toggle';
    toggleButton.title = 'Toggle Personal LLM Chat';
    toggleButton.innerHTML = '<i class="fas fa-robot"></i>';
    
    // Insert before the send button
    const sendButton = document.getElementById('send-button');
    if (sendButton) {
        chatInput.insertBefore(toggleButton, sendButton);
    } else {
        chatInput.appendChild(toggleButton);
    }
    
    // Add click handler
    toggleButton.addEventListener('click', toggleLlmChat);
    
    // Create the LLM popup chat container (initially hidden)
    createLlmChatPopup();
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
    
    // Get current user profile to add personal sandbox
    const userProfile = getUserProfile();
    let index = 0;
    
    // Add personal sandbox agent first (only for the logged-in user)
    if (userProfile && userProfile.name) {
        const sandboxName = `${userProfile.name} - Sandbox`;
        const sandboxId = `${userProfile.name}-sandbox`;
        console.log(`Creating personal sandbox agent: ${sandboxName}`);
        
        const sandboxItem = ui.createAgentItem(sandboxName, null, index);
        sandboxItem.dataset.agentId = sandboxId;
        sandboxItem.classList.add('sandbox-agent'); // Add special class for styling
        agentList.appendChild(sandboxItem);
        
        // Set sandbox as active by default
        sandboxItem.classList.add('active');
        setCurrentAgent(sandboxId, null, sandboxName);
        
        index++;
    }
    
    // Filter out any agents that match the current user's name (case-insensitive)
    // This ensures users see their own sandbox instead of their registry agent,
    // but other users can still see their registry agent normally
    const currentUserName = userProfile ? userProfile.name.toLowerCase() : '';
    
    // Populate with fetched agents from the registry (excluding user's own agent)
    Object.entries(agentsData).forEach(([name, url]) => {
        // Skip agents that match the current user's name - they see their sandbox instead
        if (currentUserName && name.toLowerCase() === currentUserName) {
            console.log(`Filtering out agent "${name}" for current user "${userProfile.name}" - they see their sandbox instead`);
            return; // Skip this agent - user sees their sandbox instead
        }
        
        console.log(`Creating agent: ${name} with URL: ${url}`);
        const agentItem = ui.createAgentItem(name, url, index);
        agentList.appendChild(agentItem);
        
        // If no sandbox was created (no user profile), set first agent as active
        if (index === 1 && !userProfile) { // index 1 because sandbox would be 0
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
            
            // Remove unread indicator if present
            item.classList.remove('has-unread');
            
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
    if (!assignedServerUrl) {
        console.error("Cannot set current agent, assignedServerUrl is not set.");
        return;
    }
    
    // If the agent ID is the same, don't change anything
    if (id === currentAgent.id && currentAgent.id) return;
    
    // Save current chat before switching
    if (currentAgent.id) {
        const currentChatMessagesContainer = document.getElementById(`chat-messages-${currentAgent.id}`);
        if (currentChatMessagesContainer) {
            chatHistories[currentAgent.id] = currentChatMessagesContainer.innerHTML;
            saveChatHistoriesToStorage();
            console.log(`Saved chat history for ${currentAgent.id}`);
        }
    }
    
    // Update current agent
    currentAgent = {
        id: id, 
        name: name || id,
        description: 'AI Agent'
    };
    
    console.log("Current agent set to:", currentAgent);
    
    // Check if this is a sandbox agent and apply special styling
    const chatContainer = document.querySelector('.chat-container');
    const userInput = document.getElementById('user-input');
    const isSandboxAgent = id.toLowerCase().includes('sandbox') || name.toLowerCase().includes('sandbox');
    
    if (isSandboxAgent) {
        console.log("🤖 Activating sandbox mode for AI assistant chat");
        chatContainer.classList.add('sandbox-mode');
        if (userInput) {
            userInput.placeholder = "Ask your AI assistant anything...";
        }
    } else {
        console.log("👥 Activating regular mode for peer-to-peer chat");
        chatContainer.classList.remove('sandbox-mode');
        if (userInput) {
            userInput.placeholder = "Type your message here...";
        }
    }
    
    // Update UI
    ui.updateChatHeader(currentAgent);
    
    // Activate the appropriate chat window
    activateChatWindow(id);
    
    // Check agent health
    checkAgentHealth();
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

    console.log("No server_url found, looking up user's assigned agent...");
    const userProfileString = localStorage.getItem('userProfile');
    
    if (!userProfileString) {
        console.error("User Profile not found in localStorage, cannot fetch server URL.");
        ui.showErrorMessage("Initialization error: User Profile missing.");
        return null;
    }
    
    let userProfile = null;
    try {
        userProfile = JSON.parse(userProfileString);
    } catch (error) {
        console.error("Failed to parse user profile for lookup request:", error);
        ui.showErrorMessage("Initialization error: Cannot read user profile.");
        return null;
    }

    if (!userProfile.name) {
        console.error("User profile name is missing, cannot lookup agent.");
        ui.showErrorMessage("Initialization error: User profile name missing.");
        return null;
    }
    
    const username = userProfile.name; // The username

    try {
        // First try to lookup the user's assigned agent using the /lookup endpoint
        const lookupUrl = `${config.apiBaseUrl}/lookup/${username}`;
        console.log("Looking up user's assigned agent from:", lookupUrl);

        const response = await fetch(lookupUrl, {
          method: 'GET', 
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.api_url) {
                serverUrl = data.api_url;
                localStorage.setItem('server_url', serverUrl);
                console.log("Found and stored user's assigned server_url:", serverUrl);
                assignedServerUrl = serverUrl;
                return serverUrl;
            } else {
                console.warn("Lookup response missing api_url, falling back to allocation");
            }
        } else {
            console.warn(`Lookup failed with status ${response.status}, falling back to allocation`);
        }

        // Fallback: If lookup fails, use the original allocation logic
        console.log("Falling back to allocation...");
        const clientId = localStorage.getItem('client_id') || 'client-' + Date.now();
        localStorage.setItem('client_id', clientId);

    const payload = {
      client_id: clientId,
      userProfile: {
            name: username
      }
    };

        const allocateUrl = `${config.apiBaseUrl}/api/allocate`;
        console.log("Requesting server URL from:", allocateUrl);
        console.log("Sending payload:", payload);

        const allocateResponse = await fetch(allocateUrl, {
          method: 'POST', 
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!allocateResponse.ok) {
            const errorText = await allocateResponse.text();
            throw new Error(`Failed to fetch server URL: ${allocateResponse.status} ${allocateResponse.statusText} - ${errorText}`);
        }

        const allocateData = await allocateResponse.json();
        if (!allocateData.api_url) {
          throw new Error("Invalid response from server URL assignment endpoint (missing api_url).");
        }
        serverUrl = allocateData.api_url;
        localStorage.setItem('server_url', serverUrl);
        console.log("Assigned and stored server_url:", serverUrl);
        assignedServerUrl = serverUrl;
        return serverUrl;

    } catch (error) {
        console.error("Error fetching/assigning server URL:", error);
        ui.showErrorMessage(`Failed to connect to assignment service: ${error.message}`);
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

    // Use the new /api/render endpoint
    const pollUrl = `${assignedServerUrl}/api/render`;
    console.log("Polling for messages at:", pollUrl);

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

        // Accept both `message` (old) and `message_content` (new) keys
        const textField = message ? (message.message || message.message_content) : null;

        if (textField) {
            console.log(`Received message via polling:`, message);
            
            // FIXED: Removed timestamp filtering that was causing issues with timezone differences
            // Messages will now be displayed regardless of timestamp differences between server and browser
                let messageText = textField;
                
                // Check if this is a system notification message that we should filter out
                const isSystemNotification = messageText.includes('[AGENT') && messageText.includes('Message sent to');
                
                // Skip system notification messages completely
                if (isSystemNotification) {
                    console.log("Filtering out system notification:", messageText);
                    return;
                }
                
                // Determine sender for potential future use
                const senderName = message.sender_name || message.from_agent || message.sender_client_id || 'Agent';
                
                // Check if this message is being relayed from one agent to another
                const isRelayedMessage = messageText.includes('FROM ') || messageText.toLowerCase().includes('from agent');
                
                // Clean up relayed messages for better display
                if (isRelayedMessage) {
                    // Clean up any "FROM agent:" prefixes
                    messageText = messageText.replace(/FROM\s+agent\d+\s*:\s*/i, '');
                    messageText = messageText.replace(/FROM\s+\w+\s*:\s*/i, '');
                    console.log("Cleaned up relayed message:", messageText);
                }
                
                // IMPORTANT: Determine the correct chat window for this message
                // Message should appear in the sender's chat window, not in the from_agent's window
                let chatWindowAgentId;
                
                // Get current user's name for comparison
                const currentUserProfile = localStorage.getItem('userProfile');
                let currentUserName = null;
                if (currentUserProfile) {
                    try {
                        const userProfile = JSON.parse(currentUserProfile);
                        currentUserName = userProfile.name;
                    } catch (error) {
                        console.error('Error parsing current user profile:', error);
                    }
                }
                
                // For message routing, we use these rules:
                // 1. If it's a direct message from a human user to me (my client), show in that user's chat
                // 2. If it's a message from an agent with a different sender_name, show in sender_name's chat
                // 3. If it's a response from an agent to my @mention, show in that agent's chat window
                // 4. If it's a message from an agent without sender_name, show in that agent's chat
                
                // Note: in the JSON payload:
                // - from_agent is the agent who sent the message
                // - sender_name is the original human who triggered the conversation
                
                // Case 1 & 2: Message has sender_name - show in that person's chat window
                if (message.sender_name && message.sender_name !== "Anonymous") {
                    chatWindowAgentId = message.sender_name;
                    console.log(`Message originally from ${message.sender_name}, will display in their chat window`);
                }
                // Case 3: No sender_name but has from_agent - this could be a response to our @mention
                else if (message.from_agent) {
                    // If this is likely a response to our @mention (we are the current user), 
                    // show it in the agent's chat window so the conversation flows properly
                    chatWindowAgentId = message.from_agent;
                    console.log(`Message is from ${chatWindowAgentId}, will display in the agent's chat window`);
                }
                // If backend only sends sender_client_id use that
                else if (message.sender_client_id) {
                    chatWindowAgentId = message.sender_client_id;
                }
                // Fallback: Default to current agent if we can't determine
                else {
                    chatWindowAgentId = currentAgent.id;
                    console.log(`Cannot determine appropriate window, defaulting to current agent: ${chatWindowAgentId}`);
                }
                
                // Get the appropriate chat container for the correct agent
                const chatContainer = getOrCreateChatWindow(chatWindowAgentId);
                
                if (!chatContainer) {
                    console.error(`Failed to get chat container for agent ${chatWindowAgentId}`);
                    return;
                }
                
                // Add the message to the appropriate chat window and specify the chat window ID as the context
                // This allows the UI to use the current chat window's ID to determine the proper display name
                // Pass the full message object so UI can check sender_name for agent-enhanced messages
                
                // Check if this is an agent-enhanced message that should be treated as a user message
                const isAgentEnhancedMessage = messageText.includes('[AGENT');
            
            // For agent-enhanced messages, only treat as user message if it's from the current user's conversation
            // Logic: If sender_name exists and matches current user, OR if no sender_name and we're in the agent's own chat
            let shouldTreatAsUserMessage = false;
            
            if (isAgentEnhancedMessage) {
                // Case 1: Message has sender_name - treat as user message only if sender is current user
                if (message.sender_name && message.sender_name !== "Anonymous") {
                    shouldTreatAsUserMessage = (message.sender_name === currentUserName);
                    console.log(`📋 Agent-enhanced message from ${message.sender_name}, current user: ${currentUserName}, treating as ${shouldTreatAsUserMessage ? 'USER' : 'BOT'} message`);
                }
                // Case 2: No sender_name - treat as user message only if we're viewing the agent's own chat
                else {
                    shouldTreatAsUserMessage = (chatWindowAgentId === currentAgent.id);
                    console.log(`📋 Agent-enhanced message without sender_name, in ${chatWindowAgentId} chat (current: ${currentAgent.id}), treating as ${shouldTreatAsUserMessage ? 'USER' : 'BOT'} message`);
                }
            } else {
                // Non-agent-enhanced messages: treat as user message only if from current user
                shouldTreatAsUserMessage = (message.sender_name === currentUserName);
            }
                
                console.log(`🔍 Message analysis: "${messageText}"`);
                console.log(`📝 Is agent-enhanced: ${isAgentEnhancedMessage}`);
                console.log(`👤 Will treat as user message: ${shouldTreatAsUserMessage}`);
            console.log(`🏷️ Sender: ${message.sender_name}, Current user: ${currentUserName}, Chat window: ${chatWindowAgentId}`);
                
                ui.addMessageToContainer(chatContainer, messageText, shouldTreatAsUserMessage, chatWindowAgentId, message);
                console.log(`Message from ${message.from_agent} added to ${chatWindowAgentId}'s chat window as ${shouldTreatAsUserMessage ? 'USER' : 'BOT'} message`);
                
                // Save the updated chat to the agent's history
                chatHistories[chatWindowAgentId] = chatContainer.innerHTML;
                saveChatHistoriesToStorage();
                
                // If this is a message for a different agent than the current one,
                // we should notify the user that there's a new message in another chat
                if (chatWindowAgentId !== currentAgent.id) {
                    // Add a visual indicator to the agent item in the sidebar
                    const agentItem = document.querySelector(`.agent-item[data-agent-id="${chatWindowAgentId}"]`);
                    if (agentItem) {
                        agentItem.classList.add('has-unread');
                        console.log(`Added unread indicator to ${chatWindowAgentId}'s sidebar item`);
                    }
            }
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
    // Clear any existing polling interval
    stopPolling();
    
    if (!assignedServerUrl) {
        console.warn("Cannot start polling: assignedServerUrl not set.");
        return;
    }
    
    console.log("Starting message polling...");
    
    // Poll immediately first
    pollForMessages()
        .catch(err => console.error("Error in initial poll:", err));
    
    // Then set interval with error handling
    pollingIntervalId = setInterval(() => {
        pollForMessages()
            .catch(err => {
                console.error("Error in polling interval:", err);
                // After 3 consecutive failures, we could restart polling
                // For now, we'll just let it continue trying
            });
    }, 4000); // Poll every 4 seconds
    
    console.log("Polling interval started with ID:", pollingIntervalId);
}

/**
 * Stops the polling mechanism.
 */
function stopPolling() {
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
        console.log("Stopped message polling.");
        
        // Save chat histories to localStorage when stopping polling
        saveChatHistoriesToStorage();
    }
}

// --- End Polling Implementation ---

// Add listener to stop polling on page unload
window.addEventListener('beforeunload', stopPolling);

/**
 * Create the LLM popup chat interface
 */
function createLlmChatPopup() {
    // Check if popup already exists
    if (document.getElementById('llm-chat-popup')) return;
    
    // Create the popup container
    const popupContainer = document.createElement('div');
    popupContainer.id = 'llm-chat-popup';
    popupContainer.className = 'llm-chat-popup';
    popupContainer.style.display = 'none';
    
    // Create popup header
    const popupHeader = document.createElement('div');
    popupHeader.className = 'llm-popup-header';
    
    const popupTitle = document.createElement('h3');
    popupTitle.textContent = 'Personal LLM Chat';
    
    const commandToggle = document.createElement('button');
    commandToggle.id = 'command-toggle';
    commandToggle.className = 'command-toggle';
    commandToggle.title = 'Toggle between /query and # command';
    commandToggle.textContent = '/query';
    commandToggle.dataset.mode = 'query'; // Default to /query mode
    commandToggle.addEventListener('click', toggleCommandMode);
    
    const clearButton = document.createElement('button');
    clearButton.id = 'llm-clear-button';
    clearButton.className = 'llm-clear-button';
    clearButton.title = 'Clear chat history';
    clearButton.innerHTML = '<i class="fas fa-trash"></i>';
    clearButton.addEventListener('click', clearLlmChat);
    
    const closeButton = document.createElement('button');
    closeButton.className = 'llm-close-button';
    closeButton.innerHTML = '×';
    closeButton.addEventListener('click', toggleLlmChat);
    
    popupHeader.appendChild(popupTitle);
    popupHeader.appendChild(commandToggle);
    popupHeader.appendChild(clearButton);
    popupHeader.appendChild(closeButton);
    
    // Create chat messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.id = 'llm-chat-messages';
    messagesContainer.className = 'llm-chat-messages';
    
    // Create input area
    const inputContainer = document.createElement('div');
    inputContainer.className = 'llm-chat-input';
    
    const queryInput = document.createElement('input');
    queryInput.type = 'text';
    queryInput.id = 'llm-query-input';
    queryInput.placeholder = 'Ask me anything...';
    queryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendLlmQuery();
        }
    });
    
    const queryButton = document.createElement('button');
    queryButton.id = 'llm-query-button';
    queryButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
    queryButton.addEventListener('click', sendLlmQuery);
    
    const dragButton = document.createElement('button');
    dragButton.id = 'llm-drag-button';
    dragButton.title = 'Drag this conversation to the chat';
    dragButton.className = 'llm-drag-button';
    dragButton.innerHTML = '<i class="fas fa-arrows-alt"></i>';
    
    // Add multiple event listeners to ensure it works
    dragButton.addEventListener('mousedown', (e) => {
        console.log('Drag button mousedown triggered');
        startDragging(e);
    });
    dragButton.addEventListener('touchstart', (e) => {
        console.log('Drag button touchstart triggered');
        startDragging(e);
    }, { passive: false });
    
    // Add click fallback for testing
    dragButton.addEventListener('click', (e) => {
        console.log('Drag button clicked - fallback triggered');
        e.preventDefault();
        e.stopPropagation();
        
        // If no conversation context, show message
        if (llmConversationContext.length === 0) {
            ui.showStatusNotification('No conversation to drag! Start chatting first.', 'info', 3000);
            return;
        }
        
        // Fallback: directly add context to input
        ui.showStatusNotification('Adding context directly to chat input...', 'info', 1000);
        setTimeout(() => {
            appendLlmContextToInput();
        }, 1000);
    });
    
    inputContainer.appendChild(queryInput);
    inputContainer.appendChild(queryButton);
    inputContainer.appendChild(dragButton);
    
    // Assemble the popup
    popupContainer.appendChild(popupHeader);
    popupContainer.appendChild(messagesContainer);
    popupContainer.appendChild(inputContainer);
    
    // Add to document
    document.body.appendChild(popupContainer);
    
    // Make popup draggable
    makeDraggable(popupContainer);
}

/**
 * Toggle between /query and # command modes
 */
function toggleCommandMode() {
    const toggle = document.getElementById('command-toggle');
    if (!toggle) return;
    
    const currentMode = toggle.dataset.mode;
    
    if (currentMode === 'query') {
        toggle.dataset.mode = 'hash';
        toggle.textContent = '#';
    } else {
        toggle.dataset.mode = 'query';
        toggle.textContent = '/query';
    }
}

/**
 * Toggle the LLM chat popup visibility
 */
function toggleLlmChat() {
    const popup = document.getElementById('llm-chat-popup');
    if (!popup) return;
    
    const isVisible = popup.style.display === 'flex';
    popup.style.display = isVisible ? 'none' : 'flex';
    
    // If showing, position near the toggle button and focus the input
    if (!isVisible) {
        const toggleButton = document.getElementById('llm-toggle-button');
        if (toggleButton) {
            const rect = toggleButton.getBoundingClientRect();
            
            // Position popup above the button
            popup.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
            popup.style.left = rect.left + 'px';
            
            // Focus the input field
            setTimeout(() => {
                const input = document.getElementById('llm-query-input');
                if (input) input.focus();
            }, 100);
        }
    }
}

/**
 * Send a query to the personal LLM
 */
async function sendLlmQuery() {
    const queryInput = document.getElementById('llm-query-input');
    const messagesContainer = document.getElementById('llm-chat-messages');
    
    if (!queryInput || !messagesContainer || !assignedServerUrl) return;
    
    const query = queryInput.value.trim();
    if (!query) return;
    
    // Add user message to the chat
    const userMessage = document.createElement('div');
    userMessage.className = 'llm-message llm-user-message';
    userMessage.textContent = query;
    messagesContainer.appendChild(userMessage);
    
    // Clear input
    queryInput.value = '';
    
    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'llm-message llm-typing-indicator';
    typingIndicator.innerHTML = '<span>•</span><span>•</span><span>•</span>';
    messagesContainer.appendChild(typingIndicator);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    try {
        // Get the current command mode from the toggle button
        const commandToggle = document.getElementById('command-toggle');
        const useHashFormat = commandToggle && commandToggle.dataset.mode === 'hash';
        const commandPrefix = useHashFormat ? '# ' : '/query ';
        
        const response = await apiClient.sendMessage(
            `${assignedServerUrl}/api/send`, 
            `${commandPrefix}${query}`, 
            null
        );
        
        // Remove typing indicator
        typingIndicator.remove();
        
        if (response && response.response) {
            // Add bot response
            const botMessage = document.createElement('div');
            botMessage.className = 'llm-message llm-bot-message';
            botMessage.textContent = response.response;
            messagesContainer.appendChild(botMessage);
            
            // Store the conversation for drag-and-drop
            updateLlmConversationContext(query, response.response);
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } catch (error) {
        console.error('Error sending LLM query:', error);
        
        // Remove typing indicator
        typingIndicator.remove();
        
        // Add error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'llm-message llm-error-message';
        errorMessage.textContent = 'Error: Could not get a response. Please try again.';
        messagesContainer.appendChild(errorMessage);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Store the conversation context for drag and drop
let llmConversationContext = [];

/**
 * Update the stored LLM conversation context
 */
function updateLlmConversationContext(query, response) {
    llmConversationContext.push({ role: 'user', content: query });
    llmConversationContext.push({ role: 'assistant', content: response });
}

/**
 * Make an element draggable
 */
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    const header = element.querySelector('.llm-popup-header');
    if (header) {
        header.onmousedown = dragMouseDown;
        header.ontouchstart = dragMouseDown;
    } else {
        element.onmousedown = dragMouseDown;
        element.ontouchstart = dragMouseDown;
    }
    
    function dragMouseDown(e) {
        e = e || window.event;
        if (e.preventDefault) e.preventDefault();
        
        // Get touch or mouse position
        if (e.type === 'touchstart') {
            pos3 = e.touches[0].clientX;
            pos4 = e.touches[0].clientY;
            document.ontouchend = closeDragElement;
            document.ontouchmove = elementDrag;
        } else {
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
    }
    
    function elementDrag(e) {
        e = e || window.event;
        if (e.preventDefault) e.preventDefault();
        
        // Calculate new position
        if (e.type === 'touchmove') {
            pos1 = pos3 - e.touches[0].clientX;
            pos2 = pos4 - e.touches[0].clientY;
            pos3 = e.touches[0].clientX;
            pos4 = e.touches[0].clientY;
        } else {
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
        }
        
        // Set element's new position
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        element.style.bottom = 'auto';
    }
    
    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}

/**
 * Start dragging the LLM conversation to the chat
 */
function startDragging(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Add dragging class for visual feedback
    const dragButton = e.target.closest('.llm-drag-button');
    if (dragButton) {
        dragButton.classList.add('dragging');
    }
    
    // Check if there's conversation context to drag
    if (llmConversationContext.length === 0) {
        ui.showStatusNotification('No conversation to drag! Start chatting first.', 'info', 3000);
        if (dragButton) {
            dragButton.classList.remove('dragging');
        }
        return;
    }
    
    // Create a drag preview element
    const dragPreview = document.createElement('div');
    dragPreview.className = 'llm-drag-preview';
    dragPreview.textContent = `Drop to add ${llmConversationContext.length} messages`;
    dragPreview.style.display = 'block';
    dragPreview.style.position = 'fixed';
    dragPreview.style.pointerEvents = 'none';
    dragPreview.style.zIndex = '2000';
    
    // Attach the drag preview to the cursor
    document.body.appendChild(dragPreview);
    
    // Position the drag preview at the cursor
    const updatePreviewPosition = (clientX, clientY) => {
        dragPreview.style.left = (clientX + 10) + 'px';
        dragPreview.style.top = (clientY + 10) + 'px';
    };
    
    // Get initial position
    let initialX, initialY;
    if (e.type === 'touchstart') {
        initialX = e.touches[0].clientX;
        initialY = e.touches[0].clientY;
        updatePreviewPosition(initialX, initialY);
    } else {
        initialX = e.clientX;
        initialY = e.clientY;
        updatePreviewPosition(initialX, initialY);
    }
    
    // Show notification
    ui.showStatusNotification('Drag to the chat input to add context', 'info', 2000);
    
    // Set up event listeners for dragging
    const moveHandler = (moveEvent) => {
        moveEvent.preventDefault();
        
        if (moveEvent.type === 'touchmove') {
            updatePreviewPosition(moveEvent.touches[0].clientX, moveEvent.touches[0].clientY);
        } else {
            updatePreviewPosition(moveEvent.clientX, moveEvent.clientY);
        }
        
        // Highlight the chat input when hovering over it
        const userInput = document.getElementById('user-input');
        if (userInput) {
            const inputRect = userInput.getBoundingClientRect();
            const hoverX = moveEvent.type === 'touchmove' ? 
                moveEvent.touches[0].clientX : moveEvent.clientX;
            const hoverY = moveEvent.type === 'touchmove' ? 
                moveEvent.touches[0].clientY : moveEvent.clientY;
            
            if (hoverX >= inputRect.left && hoverX <= inputRect.right &&
                hoverY >= inputRect.top && hoverY <= inputRect.bottom) {
                userInput.style.borderColor = '#7c3aed';
                userInput.style.boxShadow = '0 0 0 2px rgba(124, 58, 237, 0.3)';
                dragPreview.textContent = 'Release to add context';
                dragPreview.style.background = 'linear-gradient(135deg, #059669, #10b981)';
            } else {
                userInput.style.borderColor = '';
                userInput.style.boxShadow = '';
                dragPreview.textContent = `Drop to add ${llmConversationContext.length} messages`;
                dragPreview.style.background = 'linear-gradient(135deg, #7c3aed, #8b5cf6)';
            }
        }
    };
    
    const endHandler = (endEvent) => {
        // Clean up event listeners
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('touchmove', moveHandler);
        document.removeEventListener('mouseup', endHandler);
        document.removeEventListener('touchend', endHandler);
        
        // Remove visual feedback
        if (dragButton) {
            dragButton.classList.remove('dragging');
        }
        
        // Remove the preview
        if (dragPreview && dragPreview.parentNode) {
        dragPreview.remove();
        }
        
        // Reset input styling
        const userInput = document.getElementById('user-input');
        if (userInput) {
            userInput.style.borderColor = '';
            userInput.style.boxShadow = '';
            
            // Check if dropped on the chat input
            const inputRect = userInput.getBoundingClientRect();
            const dropX = endEvent.type === 'touchend' ? 
                endEvent.changedTouches[0].clientX : endEvent.clientX;
            const dropY = endEvent.type === 'touchend' ? 
                endEvent.changedTouches[0].clientY : endEvent.clientY;
            
            if (dropX >= inputRect.left && dropX <= inputRect.right &&
                dropY >= inputRect.top && dropY <= inputRect.bottom) {
                // Dropped on input - append conversation context
                appendLlmContextToInput();
                ui.showStatusNotification('Context added successfully! 📄', 'success', 2000);
            } else {
                ui.showStatusNotification('Drop cancelled - drag to chat input', 'info', 2000);
            }
        }
    };
    
    // Add event listeners
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('mouseup', endHandler);
    document.addEventListener('touchend', endHandler);
}

/**
 * Append the LLM conversation context to the chat input
 */
function appendLlmContextToInput() {
    if (llmConversationContext.length === 0) return;
    
    const userInput = document.getElementById('user-input');
    if (!userInput) return;
    
    // Format the context as a clean, human-readable string (this will be sent to the backend)
    let contextText = '\n\n```\n';
    
    llmConversationContext.forEach(item => {
        const role = item.role === 'user' ? 'Me' : 'Assistant';
        contextText += `${role}: ${item.content}\n`;
    });
    
    contextText += '```\n\n';
    
    // Create hidden context data that will be transmitted but not shown directly
    const hiddenContext = document.createElement('span');
    hiddenContext.id = 'hidden-llm-context';
    hiddenContext.style.display = 'none';
    hiddenContext.dataset.context = JSON.stringify(llmConversationContext);
    document.body.appendChild(hiddenContext);
    
    // Store the context in a global variable for use when sending the message
    window.hiddenLlmContext = contextText;
    
    // Instead of adding raw text, add a file emoji with a tooltip
    const emojiText = " 📄 "; // File emoji with spaces
    
    // Add the emoji to the input value
    const cursorPosition = userInput.selectionStart;
    const currentText = userInput.value;
    
    // Insert at cursor position if available, otherwise append
    if (cursorPosition !== undefined) {
        userInput.value = currentText.substring(0, cursorPosition) + 
                        emojiText + 
                        currentText.substring(cursorPosition);
        // Position cursor after emoji
        userInput.selectionStart = cursorPosition + emojiText.length;
        userInput.selectionEnd = cursorPosition + emojiText.length;
    } else {
        userInput.value += emojiText;
    }
    
    // Add tooltip so users know what it is
    ui.showStatusNotification('LLM context added! 📄', 'success', 2000);
    
    // Focus on the input field
    userInput.focus();
}

/**
 * Clear the LLM chat history
 */
function clearLlmChat() {
    // Show confirmation dialog
    const confirmClear = confirm("Are you sure you want to clear the chat history?");
    
    if (confirmClear) {
        // Clear the messages container
        const messagesContainer = document.getElementById('llm-chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        
        // Clear the conversation context
        llmConversationContext = [];
        
        // Show confirmation message
        ui.showStatusNotification('Chat history cleared', 'success', 2000);
    }
} 