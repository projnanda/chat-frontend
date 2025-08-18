/**
 * Authentication utilities for NANDA Chat
 */

/**
 * Check if the user is authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
export function isAuthenticated() {
    const userProfile = localStorage.getItem('userProfile');
    return !!userProfile;
}

/**
 * Get the current user profile
 * @returns {object|null} User profile object or null if not authenticated
 */
export function getUserProfile() {
    const userProfile = localStorage.getItem('userProfile');
    if (!userProfile) return null;
    
    try {
        return JSON.parse(userProfile);
    } catch (error) {
        console.error('Failed to parse user profile:', error);
        return null;
    }
}

/**
 * Redirect to login page if not authenticated
 * @param {string} loginPage - Path to the login page
 * @returns {boolean} True if authenticated, false if redirect happened
 */
export function requireAuth(loginPage = 'landing.html') {
    if (!isAuthenticated() && !window.location.pathname.endsWith(loginPage)) {
        window.location.href = loginPage;
        return false;
    }
    return true;
}

/**
 * Log the user out
 * @param {string} redirectPage - Page to redirect to after logout
 */
export function logout(redirectPage = 'landing.html') {
    localStorage.removeItem('userProfile');
    window.location.href = redirectPage;
} 