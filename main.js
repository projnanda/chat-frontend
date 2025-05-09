/**
 * NANDA Chat - Main Entry Point
 * This is the entry point for the application that loads when the page is ready.
 */
import { initApp } from './app.js';
import { requireAuth } from './auth-utils.js';

// Function to initialize and persist client_id
function initializeClientId() {
  let clientId = localStorage.getItem('client_id');
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem('client_id', clientId);
    console.log('New client_id generated:', clientId);
  } else {
    console.log('Existing client_id found:', clientId);
  }
  return clientId;
}

// Initialize the application when the DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('NANDA Chat application loading...');
    
    // Ensure client_id is initialized and available
    const clientId = initializeClientId();
    // clientId is now available in localStorage and in the clientId const
    
    // Check if user is authenticated, redirect to landing if not
    if (requireAuth()) {
        // Only initialize app if authenticated
        initApp();
    }
}); 