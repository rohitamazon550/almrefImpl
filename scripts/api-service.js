/**
 * Centralized API Service
 * Handles all ALM API calls with proper error handling, validation, and retry logic
 */

import { getAlmAccessToken, almFetch } from './alm-token.js';
import { reportError } from './error-handler.js';

// API Configuration
const API_CONFIG = {
  baseUrl: 'https://learningmanager.adobe.com/primeapi/v2',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};

/**
 * Validate API response structure
 * @param {any} data - Response data to validate
 * @returns {boolean} - Whether data is valid
 */
function validateApiResponse(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  // ALM API always returns data or errors
  return 'data' in data || 'errors' in data;
}

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make API request with retry logic and error handling
 * @param {string} endpoint - API endpoint (relative to baseUrl)
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - API response data
 */
async function apiRequest(endpoint, options = {}) {
  const accessToken = getAlmAccessToken();
  
  if (!accessToken) {
    throw new Error('No access token available. Please log in.');
  }

  const url = endpoint.includes('access_token')
    ? `${API_CONFIG.baseUrl}${endpoint}`
    : `${API_CONFIG.baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}access_token=${accessToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

  const fetchOptions = {
    ...options,
    signal: controller.signal,
    headers: {
      'Accept': 'application/vnd.api+json',
      ...options.headers,
    },
  };

  let lastError;
  
  for (let attempt = 0; attempt < API_CONFIG.retryAttempts; attempt++) {
    try {
      // Use almFetch which handles 401 and redirects to OAuth login
      const response = await almFetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Handle other HTTP errors (401 is handled by almFetch)
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!validateApiResponse(data)) {
        throw new Error('Invalid API response format');
      }

      return data;
      
    } catch (error) {
      lastError = error;
      clearTimeout(timeoutId);

      // Don't retry on:
      // - Abort (timeout)
      // - 4xx client errors (bad request, unauthorized, forbidden, not found, rate limit, etc.)
      // - Only retry on 5xx server errors or network failures
      if (error.name === 'AbortError' || error.message.includes('API error 4')) {
        throw error;
      }

      // Retry with exponential backoff
      if (attempt < API_CONFIG.retryAttempts - 1) {
        await sleep(API_CONFIG.retryDelay * Math.pow(2, attempt));
        continue;
      }

      // Last attempt failed
      throw error;
    }
  }

  throw lastError;
}

/**
 * Fetch with loading state management
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @param {Function} onLoading - Loading state callback
 * @returns {Promise<Object>} - API response
 */
export async function fetchWithLoading(endpoint, options = {}, onLoading = null) {
  try {
    if (onLoading) onLoading(true);
    const data = await apiRequest(endpoint, options);
    return data;
  } catch (error) {
    reportError(error, { endpoint, context: 'API fetch' });
    throw error;
  } finally {
    if (onLoading) onLoading(false);
  }
}

/**
 * Fetch learning object details
 * @param {string} learningObjectId - Learning object ID
 * @returns {Promise<Object>} - Learning object data
 */
export async function fetchLearningObject(learningObjectId) {
  const endpoint = `/learningObjects/${learningObjectId}?include=instances&omitDeprecated=true`;
  const data = await apiRequest(endpoint);
  return data.data;
}

/**
 * Fetch enrollment state
 * @param {string} learningObjectId - Learning object ID (with or without prefix, may include instance ID)
 * @param {string} instanceId - Instance ID (numeric part only)
 * @returns {Promise<Object>} - Enrollment state
 */
export async function fetchEnrollmentState(learningObjectId, instanceId) {
  const userId = sessionStorage.getItem('alm_user_id');
  if (!userId) {
    return { state: 'NOT_ENROLLED', progressPercent: 0 };
  }

  // Remove 'course:' or 'learningProgram:' prefix if present
  let cleanLoId = learningObjectId.replace(/^(course:|learningProgram:)/, '');
  
  // If the learningObjectId includes an underscore, it has both loId and instanceId
  // We only want the first part (the actual learning object ID)
  if (cleanLoId.includes('_')) {
    cleanLoId = cleanLoId.split('_')[0];
  }
  
  // The enrollment ID format is: loId_instanceId_userId (all numeric, no prefixes)
  const enrollmentId = `${cleanLoId}_${instanceId}_${userId}`;
  const endpoint = `/enrollments/${enrollmentId}`;
  
  try {
    const data = await apiRequest(endpoint);
    return {
      state: data.data.attributes.state,
      progressPercent: data.data.attributes.progressPercent || 0,
      dateCompleted: data.data.attributes.dateCompleted,
      hasPassed: data.data.attributes.hasPassed,
    };
  } catch (error) {
    // 404 means not enrolled
    if (error.message.includes('404')) {
      return { state: 'NOT_ENROLLED', progressPercent: 0 };
    }
    throw error;
  }
}

/**
 * Enroll user in learning object
 * @param {string} learningObjectId - Learning object ID
 * @param {string} instanceId - Instance ID
 * @returns {Promise<boolean>} - Success status
 */
export async function enrollUser(learningObjectId, instanceId) {
  const loInstanceId = `${learningObjectId}_${instanceId}`;
  const endpoint = `/enrollments?loId=${learningObjectId}&loInstanceId=${loInstanceId}&omitDeprecated=true`;
  
  try {
    await apiRequest(endpoint, { method: 'POST' });
    return true;
  } catch (error) {
    reportError(error, { context: 'User enrollment', learningObjectId });
    return false;
  }
}

/**
 * Unenroll user from learning object
 * @param {string} enrollmentId - Enrollment ID
 * @returns {Promise<boolean>} - Success status
 */
export async function unenrollUser(enrollmentId) {
  const endpoint = `/enrollments/${enrollmentId}?omitDeprecated=true`;
  
  try {
    await apiRequest(endpoint, { method: 'DELETE' });
    return true;
  } catch (error) {
    reportError(error, { context: 'User unenrollment', enrollmentId });
    return false;
  }
}

/**
 * Bookmark learning object
 * @param {string} learningObjectId - Learning object ID
 * @param {boolean} save - True to save, false to unsave
 * @returns {Promise<boolean>} - Success status
 */
export async function bookmarkLearningObject(learningObjectId, save = true) {
  const endpoint = `/learningObjects/${learningObjectId}/bookmark?omitDeprecated=true`;
  
  try {
    await apiRequest(endpoint, { method: save ? 'POST' : 'DELETE' });
    return true;
  } catch (error) {
    reportError(error, { context: `Bookmark ${save ? 'save' : 'unsave'}`, learningObjectId });
    return false;
  }
}

/**
 * Rate a course
 * @param {string} enrollmentId - Enrollment ID
 * @param {number} rating - Rating value (1-5)
 * @returns {Promise<boolean>} - Success status
 */
export async function rateCourse(enrollmentId, rating) {
  const endpoint = `/enrollments/${enrollmentId}?omitDeprecated=true`;
  
  const payload = {
    data: {
      type: 'learningObjectInstanceEnrollment',
      id: enrollmentId,
      attributes: {
        rating: rating,
      },
    },
  };

  try {
    await apiRequest(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/vnd.api+json' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (error) {
    reportError(error, { context: 'Course rating', enrollmentId, rating });
    return false;
  }
}

/**
 * Fetch recommendations
 * @param {number} stripNumber - Strip number (1-based)
 * @param {number} limit - Number of items to fetch
 * @returns {Promise<Object>} - Recommendations data
 */
export async function fetchRecommendations(stripNumber = 1, limit = 10) {
  const endpoint = `/recommendations?filter.loTypes=course,learningProgram,certification,jobAid&include=learningObject.instances,learningObject.skills.skillLevel.skill&useCache=true&filter.ignoreEnhancedLP=false&enforcedFields[learningObject]=extensionOverrides&filter.recType=multi_skill_interest&strip=${stripNumber}&page[limit]=${limit}&omitDeprecated=true`;
  
  return await apiRequest(endpoint);
}

/**
 * Fetch user profile
 * @returns {Promise<Object>} - User profile data
 */
export async function fetchUserProfile() {
  const endpoint = `/user`;
  const data = await apiRequest(endpoint);
  return data.data;
}

/**
 * Search learning objects
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Search results
 */
export async function searchLearningObjects(params = {}) {
  const queryParams = new URLSearchParams({
    'page[limit]': params.limit || 10,
    'page[offset]': params.offset || 0,
    'sort': params.sort || '-datePublished',
    'filter.loTypes': params.loTypes || 'course',
    'filter.catalogIds': params.catalogIds || '',
    'filter.skillName': params.skillName || '',
    ...params.additional,
  });

  const endpoint = `/search?${queryParams.toString()}&omitDeprecated=true`;
  return await apiRequest(endpoint);
}

/**
 * Fetch user skill interests
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Skill interests data
 */
export async function fetchUserSkillInterests(userId) {
  const endpoint = `/users/${userId}/skillInterests?filter.skillInterestTypes=ADMIN_DEFINED&page[offset]=0&page[limit]=10&include=skill,userSkills.skillLevel`;
  return await apiRequest(endpoint);
}

/**
 * Fetch all available skills
 * @returns {Promise<Array>} - Array of skill names
 */
export async function fetchAllSkills() {
  const endpoint = `/skills?page[offset]=0&page[limit]=50`;
  const data = await apiRequest(endpoint);
  return data.data || [];
}

/**
 * Add skill interests for user
 * @param {string} userId - User ID
 * @param {Array} skillIds - Array of skill IDs to add
 * @returns {Promise<Object>} - Response data
 */
export async function addSkillInterests(userId, skillIds) {
  const endpoint = `/users/${userId}/userSkillInterest`;
  return await apiRequest(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(skillIds)
  });
}

/**
 * Delete skill interest
 * @param {string} userId - User ID
 * @param {string} skillInterestId - Skill interest ID to delete
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteSkillInterest(userId, skillInterestId) {
  const endpoint = `/users/${userId}/userSkillInterest/${skillInterestId}`;
  try {
    await apiRequest(endpoint, { method: 'DELETE' });
    return true;
  } catch (error) {
    reportError(error, { context: 'Delete skill interest', userId, skillInterestId });
    return false;
  }
}

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<Object>} - Updated profile data
 */
export async function updateUserProfile(userId, profileData) {
  const endpoint = `/users/${userId}`;
  const requestBody = {
    data: {
      type: "user",
      id: userId,
      attributes: profileData
    }
  };
  
  return await apiRequest(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/vnd.api+json' },
    body: JSON.stringify(requestBody)
  });
}

/**
 * Fetch enrolled learning objects (for My Learning)
 * @param {number} limit - Number of items to fetch
 * @returns {Promise<Object>} - Learning objects data
 */
export async function fetchEnrolledLearningObjects(limit = 5) {
  const endpoint = `/learningObjects?filter.loTypes=course,learningProgram,certification,jobAid&include=enrollment.loInstance,skills.skillLevel.skill,instances.enrollment&useCache=true&filter.ignoreEnhancedLP=false&enforcedFields[learningObject]=extensionOverrides&filter.learnerState=enrolled,started&sort=-dateEnrolled&page[limit]=${limit}&omitDeprecated=true`;
  
  return await apiRequest(endpoint);
}

// Export API config for customization if needed
export { API_CONFIG };
