/**
 * ALM OAuth Authentication Module
 * Handles Adobe Learning Manager OAuth authentication flow
 */

// ALM OAuth Configuration
const ALM_CONFIG = {
  clientId: 'your-client-id', // Replace with your ALM OAuth client ID
  redirectUri: window.location.origin + '/auth/callback',
  scope: 'learner:read learner:write',
  authUrl: 'https://learningmanager.adobe.com/oauth/o/authorize',
  tokenUrl: 'https://learningmanager.adobe.com/oauth/token',
  apiBaseUrl: 'https://learningmanager.adobe.com/primeapi/v2'
};

/**
 * Storage keys for authentication data
 */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'alm_access_token',
  REFRESH_TOKEN: 'alm_refresh_token',
  TOKEN_EXPIRY: 'alm_token_expiry',
  USER_INFO: 'alm_user_info'
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if user has valid access token
 */
function isAuthenticated() {
  const token = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const expiry = sessionStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
  
  if (!token || !expiry) {
    return false;
  }
  
  // Check if token is expired (with 5 minute buffer)
  const expiryTime = parseInt(expiry);
  const currentTime = Date.now();
  const bufferTime = 5 * 60 * 1000; // 5 minutes
  
  return currentTime < (expiryTime - bufferTime);
}

/**
 * Get stored access token
 * @returns {string|null} Access token or null if not available
 */
function getAccessToken() {
  if (!isAuthenticated()) {
    return null;
  }
  return sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Store authentication tokens
 * @param {Object} tokenData - Token data from OAuth response
 */
function storeTokens(tokenData) {
  const expiryTime = Date.now() + (tokenData.expires_in * 1000);
  
  sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokenData.access_token);
  sessionStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
  
  if (tokenData.refresh_token) {
    sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokenData.refresh_token);
  }
}

/**
 * Clear stored authentication data
 */
function clearTokens() {
  sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  sessionStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  sessionStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
  sessionStorage.removeItem(STORAGE_KEYS.USER_INFO);
}

/**
 * Generate OAuth authorization URL
 * @returns {string} Authorization URL
 */
function getAuthorizationUrl() {
  const params = new URLSearchParams({
    client_id: ALM_CONFIG.clientId,
    redirect_uri: ALM_CONFIG.redirectUri,
    scope: ALM_CONFIG.scope,
    response_type: 'code',
    state: generateState()
  });
  
  return `${ALM_CONFIG.authUrl}?${params.toString()}`;
}

/**
 * Generate random state for OAuth security
 * @returns {string} Random state string
 */
function generateState() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from OAuth callback
 * @returns {Promise<Object>} Token response
 */
async function exchangeCodeForToken(code) {
  const response = await fetch(ALM_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: ALM_CONFIG.clientId,
      code: code,
      redirect_uri: ALM_CONFIG.redirectUri
    })
  });
  
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Refresh access token using refresh token
 * @returns {Promise<Object>} New token response
 */
async function refreshAccessToken() {
  const refreshToken = sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  const response = await fetch(ALM_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ALM_CONFIG.clientId,
      refresh_token: refreshToken
    })
  });
  
  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Initiate OAuth login flow
 */
function login() {
  const authUrl = getAuthorizationUrl();
  window.location.href = authUrl;
}

/**
 * Handle OAuth callback
 * @param {string} code - Authorization code from URL
 * @param {string} state - State parameter from URL
 */
async function handleCallback(code, state) {
  try {
    const tokenData = await exchangeCodeForToken(code);
    storeTokens(tokenData);
    
    // Fetch user info after successful authentication
    await fetchUserInfo();
    
    // Redirect to original page or dashboard
    const returnUrl = sessionStorage.getItem('auth_return_url') || '/';
    sessionStorage.removeItem('auth_return_url');
    window.location.href = returnUrl;
    
  } catch (error) {
    console.error('Authentication failed:', error);
    // Redirect to login page with error
    window.location.href = '/login?error=auth_failed';
  }
}

/**
 * Fetch user information from ALM API
 * @returns {Promise<Object>} User information
 */
async function fetchUserInfo() {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('No access token available');
  }
  
  const response = await fetch(`${ALM_CONFIG.apiBaseUrl}/user`, {
    headers: {
      'Authorization': `oauth ${token}`,
      'Accept': 'application/vnd.api+json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.status}`);
  }
  
  const userData = await response.json();
  sessionStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(userData));
  
  return userData;
}

/**
 * Get stored user information
 * @returns {Object|null} User information or null if not available
 */
function getUserInfo() {
  const userInfo = sessionStorage.getItem(STORAGE_KEYS.USER_INFO);
  return userInfo ? JSON.parse(userInfo) : null;
}

/**
 * Logout user and clear tokens
 */
function logout() {
  clearTokens();
  // Redirect to ALM logout URL or login page
  window.location.href = '/login';
}

/**
 * Make authenticated API request to ALM
 * @param {string} endpoint - API endpoint (relative to base URL)
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function makeAuthenticatedRequest(endpoint, options = {}) {
  let token = getAccessToken();
  
  // Try to refresh token if expired
  if (!token) {
    try {
      const tokenData = await refreshAccessToken();
      storeTokens(tokenData);
      token = tokenData.access_token;
    } catch (error) {
      // Refresh failed, redirect to login
      sessionStorage.setItem('auth_return_url', window.location.pathname);
      login();
      return;
    }
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${ALM_CONFIG.apiBaseUrl}${endpoint}`;
  
  const requestOptions = {
    ...options,
    headers: {
      'Authorization': `oauth ${token}`,
      'Accept': 'application/vnd.api+json',
      ...options.headers
    }
  };
  
  const response = await fetch(url, requestOptions);
  
  // If unauthorized, try to refresh token once
  if (response.status === 401) {
    try {
      const tokenData = await refreshAccessToken();
      storeTokens(tokenData);
      
      // Retry request with new token
      requestOptions.headers.Authorization = `oauth ${tokenData.access_token}`;
      return fetch(url, requestOptions);
    } catch (error) {
      // Refresh failed, redirect to login
      sessionStorage.setItem('auth_return_url', window.location.pathname);
      login();
      return;
    }
  }
  
  return response;
}

/**
 * Initialize authentication on page load
 */
function initAuth() {
  // Check if this is an OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  
  if (code && state) {
    handleCallback(code, state);
    return;
  }
  
  // Check if user is authenticated
  if (!isAuthenticated()) {
    // Store current page for redirect after login
    sessionStorage.setItem('auth_return_url', window.location.pathname);
    
    // Show login prompt or redirect to login
    showLoginPrompt();
  }
}

/**
 * Show login prompt to user
 */
function showLoginPrompt() {
  // Create login overlay
  const overlay = document.createElement('div');
  overlay.className = 'auth-overlay';
  overlay.innerHTML = `
    <div class="auth-modal">
      <h2>Authentication Required</h2>
      <p>Please log in to access Adobe Learning Manager content.</p>
      <button class="auth-login-btn" onclick="ALMAuth.login()">Log In</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
}

// Export the authentication module
window.ALMAuth = {
  isAuthenticated,
  getAccessToken,
  login,
  logout,
  getUserInfo,
  makeAuthenticatedRequest,
  initAuth,
  config: ALM_CONFIG
};

// Auto-initialize on script load
document.addEventListener('DOMContentLoaded', initAuth);
