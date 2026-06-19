// Track if we're already redirecting to prevent loops
let isRedirecting = false;
const REDIRECT_COOLDOWN_KEY = 'alm_redirect_cooldown';
const REDIRECT_COOLDOWN_MS = 5000; // 5 seconds cooldown

/**
 * Common utility function to get ALM access token from session storage
 * @returns {string|null} The access token from session storage, or null if not found
 */
export function getAlmAccessToken() {
  const token = sessionStorage.getItem('alm_access_token');
  
  // If we have a valid token, clear the redirect cooldown
  if (token) {
    sessionStorage.removeItem(REDIRECT_COOLDOWN_KEY);
  }
  
  return token;
}

/**
 * Handle 401 Unauthorized responses by redirecting to OAuth login
 */
function handleUnauthorized() {
  // Check if we're already in an OAuth callback flow (has 'code' parameter)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('code')) {
    return;
  }

  // Check if we're already in the process of redirecting
  if (isRedirecting) {
    return;
  }

  // Check if we recently redirected (cooldown period)
  const lastRedirect = sessionStorage.getItem(REDIRECT_COOLDOWN_KEY);
  if (lastRedirect) {
    const timeSinceRedirect = Date.now() - parseInt(lastRedirect);
    if (timeSinceRedirect < REDIRECT_COOLDOWN_MS) {
      return;
    }
  }

  // Set redirect flag
  isRedirecting = true;
  sessionStorage.setItem(REDIRECT_COOLDOWN_KEY, Date.now().toString());
  
  // Clear existing tokens
  sessionStorage.removeItem('alm_access_token');
  sessionStorage.removeItem('alm_refresh_token');
  sessionStorage.removeItem('alm_user_id');
  sessionStorage.removeItem('alm_user_role');
  sessionStorage.removeItem('alm_account_id');
  
  // Trigger OAuth flow
  const redirectUri = window.location.origin + window.location.pathname;
  const scope = 'learner:read learner:write';
  const envConfig = window.envConfig;

  if (!envConfig || !envConfig.almClientId) {
    console.error('OAuth configuration missing');
    alert('Authentication configuration is missing. Please contact support.');
    isRedirecting = false;
    return;
  }

  const authUrl = new URL(envConfig.almAuthEndpoint);
  authUrl.searchParams.set('client_id', envConfig.almClientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('account', envConfig.almAccount);

  // Redirect to Adobe Learning Manager OAuth
  window.location.href = authUrl.toString();
}

/**
 * Wrapper function for fetch that handles 401 errors globally
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} The fetch response
 */
export async function almFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    // Check for 401 Unauthorized
    if (response.status === 401) {
      console.error('API returned 401 Unauthorized for:', url);
      handleUnauthorized();
      // Throw error to prevent further processing
      throw new Error('Unauthorized - Redirecting to login');
    }
    
    return response;
  } catch (error) {
    // If it's a network error or our unauthorized error, rethrow
    throw error;
  }
}

/**
 * Helper function to make authenticated ALM API calls with automatic 401 handling
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} The fetch response
 */
export async function almApiCall(url, options = {}) {
  const token = getAlmAccessToken();
  
  if (!token) {
    console.error('No access token available');
    handleUnauthorized();
    throw new Error('No access token - Redirecting to login');
  }
  
  // Merge default headers with provided headers
  const headers = {
    'Accept': 'application/vnd.api+json',
    'Authorization': `oauth ${token}`,
    ...options.headers
  };
  
  const fetchOptions = {
    ...options,
    headers
  };
  
  return almFetch(url, fetchOptions);
}
