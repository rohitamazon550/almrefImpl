const fetch = require('node-fetch');

/**
 * Helper function to safely get nested properties
 */
const safeGet = (obj, path, defaultValue = '') => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : defaultValue;
  }, obj);
};

/**
 * Extract skills from API response
 */
function extractSkills(apiResponse) {
  if (!apiResponse.included) return [];

  return apiResponse.included
    .filter(item => item.type === 'skill')
    .map(skill => skill.attributes.name);
}

/**
 * Extract authors from API response
 */
function extractAuthors(apiResponse) {
  if (!apiResponse.included) return [];

  return apiResponse.included
    .filter(item => item.type === 'user' && item.attributes)
    .map(author => ({
      name: author.attributes.name || 'Unknown Author',
      email: author.attributes.email || ''
    }));
}

/**
 * Extract instances from API response
 */
function extractInstances(apiResponse) {
  if (!apiResponse.included) return [];

  return apiResponse.included
    .filter(item => item.type === 'learningObjectInstance')
    .map(instance => ({
      id: instance.id,
      name: safeGet(instance, 'attributes.localizedMetadata.0.name', 'Unnamed Instance'),
      state: safeGet(instance, 'attributes.state', 'Unknown'),
      enrollmentDeadline: safeGet(instance, 'attributes.enrollmentDeadline', 'No deadline'),
      completionDeadline: safeGet(instance, 'attributes.completionDeadline', 'No deadline')
    }));
}

/**
 * Format duration from seconds to human readable format
 */
function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Fetches data from ALM API using provided token
 * @param {string} apiUrl - The API endpoint URL
 * @param {string} token - ALM access token
 * @param {object} logger - Logger instance
 * @returns {Promise<object>} API response data
 * @throws {Error} When API call fails or token is invalid
 */
async function getData(apiUrl, token, logger) {
  if (!token || typeof token !== 'string') {
    throw new Error('Valid ALM access token is required');
  }
  
  if (!apiUrl || typeof apiUrl !== 'string') {
    throw new Error('Valid API URL is required');
  }

  try {
    logger.info('Making API request', { url: apiUrl.substring(0, 100) + '...' });
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ALM-Course-Viewer/1.0'
      },
      timeout: 30000 // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.error('API request failed', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText.substring(0, 200)
      });
      throw new Error(`API call failed with status: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    logger.info('API request successful', { 
      hasData: !!data.data,
      includedCount: data.included ? data.included.length : 0
    });
    
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('API request timeout');
    }
    logger.error('API request error', { error: error.message });
    throw error;
  }
}

/**
 * Simple template function that replaces placeholders with values
 */
function renderTemplate(templateString, data) {
  return templateString.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

/**
 * Checks if a template exists (simplified for embedded templates)
 */
function templateExists(templateName) {
  return templateName === 'demo-course';
}

module.exports = {
  safeGet,
  extractSkills,
  extractAuthors,
  extractInstances,
  formatDuration,
  getData,
  renderTemplate,
  templateExists
};
