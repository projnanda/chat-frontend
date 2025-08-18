document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    const userProfile = localStorage.getItem('userProfile');
    if (!userProfile && !window.location.pathname.endsWith('landing.html')) {
        // Redirect to landing page if not authenticated and not already there
        window.location.href = 'landing.html';
        return;
    }

    // Parse user profile from localStorage
    const user = JSON.parse(userProfile);
    
    // Display user profile in the header
    setupUserProfile(user);

    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const agentList = document.getElementById('agent-list');
    const chatHeader = document.querySelector('.chat-header');
    
    // Initialize the chat interface
    initializeChatInterface();
    
    // Function to fetch agents from the registry
    async function fetchAgentsFromRegistry() {
        console.group('📡 Registry Connection Attempts');
        console.log('Starting registry connection process');
        
        // Add a DOM indicator when starting connection
        showConnectionStatus('Connecting to registry...', 'connecting');
        
        try {
            console.log("🔍 ATTEMPT 1: Direct fetch");
            
            // Try direct fetch first (works if API supports CORS)
            try {
                const targetUrl = 'https://chat.nanda-registry.com:6900/list';
                console.log(`🌐 Requesting: ${targetUrl}`);
                
                const response = await fetch(targetUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    credentials: 'same-origin'
                });
                
                console.log(`📊 Response status: ${response.status} ${response.statusText}`);
                
                if (response.ok) {
                    const agentsData = await response.json();
                    console.log("✅ SUCCESS! Registry data retrieved:", agentsData);
                    console.groupEnd();
                    showConnectionStatus('Connected to registry API directly! ✅', 'success');
                    loadAgentsFromData(agentsData);
                    return;
                }
                console.warn("❌ Direct fetch failed");
            } catch (directFetchError) {
                console.warn("❌ Direct fetch error:", directFetchError);
                console.log("💡 This is likely a CORS issue. Trying proxy...");
            }
            
            // Try with CORS proxy as second attempt
            console.log("🔍 ATTEMPT 2: CORS proxy");
            try {
                const proxyUrl = 'https://corsproxy.io/?';
                const targetUrl = 'https://chat.nanda-registry.com:6900/list';
                
                console.log(`🌐 Requesting via proxy: ${proxyUrl}${encodeURIComponent(targetUrl)}`);
                
                const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                console.log(`📊 Proxy response status: ${response.status} ${response.statusText}`);
                
                if (response.ok) {
                    const agentsData = await response.json();
                    console.log("✅ SUCCESS! Registry data retrieved via proxy:", agentsData);
                    console.groupEnd();
                    showConnectionStatus('Connected to registry API via CORS proxy! ✅', 'success');
                    loadAgentsFromData(agentsData);
                    return;
                }
                
                console.warn(`❌ Proxy fetch failed: ${response.status} ${response.statusText}`);
            } catch (proxyError) {
                console.warn("❌ Proxy fetch error:", proxyError);
            }
            
            // Third attempt - try with another proxy
            console.log("🔍 ATTEMPT 3: Alternative proxy");
            try {
                const anotherProxyUrl = 'https://api.allorigins.win/raw?url=';
                const targetUrl = 'https://chat.nanda-registry.com:6900/list';
                
                console.log(`🌐 Requesting via second proxy: ${anotherProxyUrl}${encodeURIComponent(targetUrl)}`);
                
                const response = await fetch(anotherProxyUrl + encodeURIComponent(targetUrl));
                
                console.log(`📊 Second proxy response status: ${response.status} ${response.statusText}`);
                
                if (response.ok) {
                    const agentsData = await response.json();
                    console.log("✅ SUCCESS! Registry data retrieved via second proxy:", agentsData);
                    console.groupEnd();
                    showConnectionStatus('Connected to registry API via backup proxy! ✅', 'success');
                    loadAgentsFromData(agentsData);
                    return;
                }
                
                console.warn(`❌ Second proxy fetch failed: ${response.status} ${response.statusText}`);
            } catch (secondProxyError) {
                console.warn("❌ Second proxy fetch error:", secondProxyError);
            }
            
            // If all fetch attempts fail, try JSONP approach
            console.log("🔍 ATTEMPT 4: JSONP approach");
            console.log("⚠️ All fetch attempts failed, trying JSONP approach...");
            
            // Create a script tag to load the data (JSONP-like approach)
            const script = document.createElement('script');
            script.type = 'text/javascript';
            
            // Define a timeout for the JSONP request
            let jsonpTimeout = setTimeout(() => {
                console.error("❌ JSONP request timed out after 5 seconds");
                console.groupEnd();
                showConnectionStatus('JSONP connection attempt timed out ❌', 'error');
                // Clean up
                if (window.handleRegistryData) {
                    delete window.handleRegistryData;
                }
                if (document.body.contains(script)) {
                    document.body.removeChild(script);
                }
                // Fall back to manual data
                loadRegistryDataManually();
            }, 5000);
            
            // When the script loads, it should call a global function we define
            window.handleRegistryData = function(data) {
                console.log("✅ SUCCESS! Received registry data via JSONP:", data);
                clearTimeout(jsonpTimeout);
                console.groupEnd();
                showConnectionStatus('Connected to registry API via JSONP! ✅', 'success');
                loadAgentsFromData(data);
                // Clean up
                delete window.handleRegistryData;
                document.body.removeChild(script);
            };
            
            // Point to a URL that returns JSONP
            const jsonpUrl = `https://chat.nanda-registry.com:6900/list?callback=handleRegistryData`;
            console.log(`🌐 Requesting JSONP: ${jsonpUrl}`);
            script.src = jsonpUrl;
            document.body.appendChild(script);
            
        } catch (error) {
            console.error("❌ All connection attempts failed:", error);
            console.groupEnd();
            // Use the manual registry data as final fallback
            console.log("⚠️ Using manual registry data as final fallback");
            showConnectionStatus('Failed to connect to registry API ❌', 'error');
            loadRegistryDataManually();
        }
    }
    
    // Function to load agents from any data source
    function loadAgentsFromData(agentsData) {
        // Clear existing agents
        if (agentList) {
            agentList.innerHTML = '';
            
            // Populate with fetched agents
            let index = 0;
            Object.entries(agentsData).forEach(([name, url]) => {
                console.log(`Creating agent: ${name} with URL: ${url}`);
                const agentItem = createAgentItem(name, url, index);
                agentList.appendChild(agentItem);
                
                // Set the first agent as active if none is set
                if (index === 0) {
                    agentItem.classList.add('active');
                    setCurrentAgent(name, url, capitalizeFirstLetter(name));
                }
                
                index++;
            });
            
            // Add event listeners to agent items
            setupAgentSelection();
        }
    }
    
    // Function to create an agent item element
    function createAgentItem(name, url, index) {
        // Helper function to get background color based on index
        function getAvatarColorForAgent(idx) {
            const colors = [
                '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
                '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
                '#3742fa', '#2f3542', '#ff3838', '#00d8d6', '#17c0eb'
            ];
            return colors[idx % colors.length];
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
    
    // Helper function to capitalize first letter
    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // Set up agent selection event listeners
    function setupAgentSelection() {
        if (agentList) {
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
                    
                    // Set the current agent (without description)
                    setCurrentAgent(agentId, agentUrl, name);
                });
            });
        }
    }
    
    // Set up name editing functionality
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
    
    // Current active agent
    let currentAgent = {
        id: '',
        url: null,
        name: '',
        description: ''
    };
    
    // Function to set the current agent
    function setCurrentAgent(id, url = null, name = null) {
        // Ensure we have an id
        if (!id) {
            console.warn("No agent ID provided to setCurrentAgent");
            id = "default-agent";
        }
        // If the agent ID is the same, don't change anything
        if (id === currentAgent.id && currentAgent.id) return;
        currentAgent = {
            id: id,
            url: url || null,
            name: name || capitalizeFirstLetter(id),
            description: 'AI Agent' // Simple default description
        };
        console.log("Current agent set to:", currentAgent);
        
        // Check if this is a sandbox agent and apply special styling
        const chatContainer = document.querySelector('.chat-container');
        const isSandboxAgent = id.toLowerCase().includes('sandbox') || (name && name.toLowerCase().includes('sandbox'));
        
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
        updateAgentHeader();
        // Clear chat (no greeting message)
        clearChat();
    }
    
    // Update the chat header with current agent info
    function updateAgentHeader() {
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
            
            const initials = getInitials(currentAgent.name);
            const avatarColor = getAvatarColorForName(currentAgent.name);
            
            // Replace icon with initials
            avatar.innerHTML = `<span class="avatar-initials">${initials}</span>`;
            avatar.style.backgroundColor = avatarColor;
            
            title.textContent = currentAgent.name;
        }
    }
    
    // Clear the chat messages
    function clearChat() {
        chatMessages.innerHTML = '';
    }

    // Function to add a new message to the chat
    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(isUser ? 'user-message' : 'bot-message');

        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        const messageText = document.createElement('p');
        messageText.textContent = message;

        messageContent.appendChild(messageText);
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);

        // Scroll to the bottom of the chat
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Function to simulate the bot typing
    function showTypingIndicator() {
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

    // Function to remove the typing indicator
    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // Agent-specific responses
    const agentResponses = {
        default: [
            "I'd be happy to help you with that!",
            "Let me see what I can do for you.",
            "Is there anything else you need assistance with?",
            "I'm here to help. What else can I do for you?",
            "Let me help you with that."
        ]
    };

    // Function to get a response based on the current agent
    function getBotResponse(userMessage) {
        const lowercaseMessage = userMessage.toLowerCase();
        
        // Get the current user's name (which may have been updated)
        const currentUser = JSON.parse(localStorage.getItem('userProfile'));
        const userName = currentUser.name.split(' ')[0]; // Get first name
        
        // Generic responses for all agents
        if (lowercaseMessage.includes('hello') || lowercaseMessage.includes('hi')) {
            return `Hi ${userName}! I'm ${currentAgent.name}. How can I help you today?`;
        } else if (lowercaseMessage.includes('thank')) {
            return `You're welcome, ${userName}! Happy to help. Anything else you need?`;
        } else if (lowercaseMessage.includes('bye') || lowercaseMessage.includes('goodbye')) {
            return `Goodbye, ${userName}! Feel free to chat again whenever you need assistance.`;
        } else if (lowercaseMessage.includes('help')) {
            return `I'm ${currentAgent.name}, and I can help with ${currentAgent.description.toLowerCase()}. What do you need help with, ${userName}?`;
        } else if (lowercaseMessage.includes('switch') || lowercaseMessage.includes('change agent')) {
            return "You can chat with a different agent by clicking on their profile in the left panel.";
        } else if (lowercaseMessage.includes('who are you')) {
            return `I'm ${currentAgent.name}, your ${currentAgent.description.toLowerCase()}. I'm here to help you with whatever you need, ${userName}!`;
        } else if (lowercaseMessage.includes('my name') || lowercaseMessage.includes('who am i')) {
            return `You're ${currentUser.name}, and your email is ${currentUser.email}. How can I assist you today?`;
        } else {
            // Return a response specific to the current agent
            return getRandomResponse();
        }
    }
    
    // Get a random response appropriate for the current agent
    function getRandomResponse() {
        const responses = agentResponses[currentAgent.id] || agentResponses.default;
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Function to handle sending a message
    function sendMessage() {
        const message = userInput.value.trim();
        if (message) {
            // Add user message to chat
            addMessage(message, true);
            userInput.value = '';

            // Show typing indicator
            showTypingIndicator();

            // Simulate delay for bot response
            setTimeout(() => {
                removeTypingIndicator();
                const botResponse = getBotResponse(message);
                addMessage(botResponse);
            }, 1000 + Math.random() * 1000); // Random delay between 1-2 seconds
        }
    }

    // Function to show an error message to the user
    function showErrorMessage(message) {
        // Create a dialog overlay
        const overlay = document.createElement('div');
        overlay.className = 'error-overlay';
        
        const dialog = document.createElement('div');
        dialog.className = 'error-dialog';
        
        const header = document.createElement('div');
        header.className = 'error-header';
        header.textContent = 'Connection Error';
        
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

    // Helper function to initialize the chat interface
    function initializeChatInterface() {
        // Clear any existing loading message
        if (chatMessages) {
            chatMessages.innerHTML = '';
            
            // Add an initial loading message
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', 'bot-message');
            messageDiv.innerHTML = `
                <div class="message-content">
                    <p>Loading agents from NANDA registry...</p>
                </div>
            `;
            chatMessages.appendChild(messageDiv);
        }
        
        // Focus the input field
        if (userInput) {
            userInput.focus();
        }
        
        // Add event listeners
        if (sendButton) {
            sendButton.addEventListener('click', sendMessage);
        }
        
        if (userInput) {
            userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        }
        
        // Add window error event to handle network errors
        window.addEventListener('error', function(e) {
            // Only handle network-related errors
            if (e.message === 'Script error.' || e.message.includes('network') || e.message.includes('connection')) {
                console.error('Network error detected:', e);
                showErrorMessage('Network connection issue detected. The application will use locally stored data if the connection to registry fails.');
            }
        });
        
        // Fetch agents from registry (or use manual data)
        console.log("Starting to fetch agents from registry...");
        fetchAgentsFromRegistry().catch(error => {
            console.error("Fatal error in fetchAgentsFromRegistry:", error);
            loadRegistryDataManually();
        });
    }

    // Helper function to set up the user profile in the header
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
                localStorage.removeItem('userProfile');
                window.location.href = 'landing.html';
            });
        }
    }

    // Function to show connection status in the UI
    function showConnectionStatus(message, status) {
        // Add a status indicator on the page
        const statusDiv = document.createElement('div');
        statusDiv.id = 'connection-status';
        statusDiv.style.position = 'fixed';
        statusDiv.style.bottom = '10px';
        statusDiv.style.right = '10px';
        statusDiv.style.padding = '8px 12px';
        statusDiv.style.borderRadius = '4px';
        statusDiv.style.fontSize = '12px';
        statusDiv.style.zIndex = '9999';
        
        // Remove any existing status indicator
        const existingStatus = document.getElementById('connection-status');
        if (existingStatus) {
            existingStatus.remove();
        }
        
        // Style based on status
        if (status === 'connecting') {
            statusDiv.style.backgroundColor = '#1a5fb4';
            statusDiv.style.color = 'white';
        } else if (status === 'error') {
            statusDiv.style.backgroundColor = '#e01b24';
            statusDiv.style.color = 'white';
        }
        
        statusDiv.textContent = message;
        document.body.appendChild(statusDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(statusDiv)) {
                document.body.removeChild(statusDiv);
            }
        }, 10000);
    }
}); 