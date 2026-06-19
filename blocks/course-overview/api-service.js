// API Service for Course Overview
// Handles all API calls and data fetching

import { getAlmAccessToken, almApiCall } from '../../scripts/alm-token.js';

// Cache access token to avoid repeated sessionStorage calls
let cachedAccessToken = null;

// Get access token (cached)
function getAccessToken() {
  if (!cachedAccessToken) {
    cachedAccessToken = getAlmAccessToken();
  }
  return cachedAccessToken;
}

// API Configuration
const API_CONFIG = {
  baseUrl: 'https://learningmanager.adobe.com/primeapi/v2',
  getHeaders: () => ({
    'Accept': 'application/vnd.api+json',
    'Authorization': `oauth ${getAccessToken()}`
  })
};

// Fetch learner-specific course data
async function fetchLearnerCourseData(courseId) {
  try {
    const params = new URLSearchParams({
      'include': 'instances.enrollment.loResourceGrades,enrollment.loInstance.loResources.resources,prerequisiteLOs,subLOs.prerequisiteLOs,subLOs.subLOs.prerequisiteLOs,authors,subLOs.enrollment.loResourceGrades, subLOs.subLOs.enrollment.loResourceGrades, subLOs.subLOs.instances.loResources.resources, subLOs.instances.loResources.resources,instances.loResources.resources,supplementaryLOs.instances.loResources.resources,supplementaryResources,subLOs.supplementaryResources,subLOs.enrollment,instances.badge,skills.skillLevel.badge,skills.skillLevel.skill,instances.loResources.resources.room,subLOs.enrollment.loInstance.loResources.resources,prerequisiteLOs.enrollment',
      'useCache': 'true',
      'filter.ignoreEnhancedLP': 'false'
    });

    const url = `${API_CONFIG.baseUrl}/learningObjects/${courseId}?${params.toString()}`;
    
    const response = await almApiCall(url, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching learner course data:', error);
    return null;
  }
}

// Enroll user in course or learning program
async function enrollUser(courseId, instanceId) {
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      console.error('No access token found');
      return null;
    }

    // Determine if this is a Learning Program or Course
    const isLP = courseId.startsWith('learningProgram:');
    
    // For Learning Programs, get the first instance from the LP
    let loInstanceId = instanceId;
    
    if (!loInstanceId) {
      if (isLP) {
        // For LP without instanceId, extract numeric ID and construct default instance
        const lpNumericId = courseId.replace('learningProgram:', '');
        loInstanceId = `learningProgram:${lpNumericId}_default`;
      } else {
        // For courses without instanceId
        loInstanceId = `${courseId}_default`;
      }
    }
    
    // Use query parameters as per API specification
    const url = `${API_CONFIG.baseUrl}/enrollments?loId=${courseId}&loInstanceId=${loInstanceId}&omitDeprecated=true&access_token=${accessToken}`;
    
    
    const response = await almApiCall(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Enroll API error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error enrolling user:', error);
    return null;
  }
}

// Unenroll user from course
async function unenrollUser(enrollmentId) {
  try {
    // URL encode the enrollment ID to handle special characters like colons
    const encodedEnrollmentId = encodeURIComponent(enrollmentId);
    const url = `${API_CONFIG.baseUrl}/enrollments/${encodedEnrollmentId}`;
    
    
    const response = await almApiCall(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unenroll API error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
    }

    return true;
  } catch (error) {
    console.error('Error unenrolling user:', error);
    return false;
  }
}

// Bookmark/Save course
async function bookmarkCourse(courseId) {
  try {
    const url = `${API_CONFIG.baseUrl}/learningObjects/${courseId}/bookmark`;
    
    const response = await almApiCall(url, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error bookmarking course:', error);
    return false;
  }
}

// Rate course
async function rateCourse(enrollmentId, rating) {
  try {
    // URL encode the enrollment ID to handle special characters like colons
    const encodedEnrollmentId = encodeURIComponent(enrollmentId);
    const url = `${API_CONFIG.baseUrl}/enrollments/${encodedEnrollmentId}/rate`;
    
    
    // Simple payload format as expected by the API
    const payload = {
      rating: parseInt(rating)
    };
    
    
    const response = await almApiCall(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Rating API error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
    }

    return true;
  } catch (error) {
    console.error('Error rating course:', error);
    return false;
  }
}

// Fetch course notes
async function fetchCourseNotes(courseId, instanceId) {
  try {
    const url = `${API_CONFIG.baseUrl}/learningObjects/${courseId}/instances/${instanceId}/note`;
    
    
    const response = await almApiCall(url, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching course notes:', error);
    return null;
  }
}

// Export functions
export {
  getAccessToken,
  API_CONFIG,
  fetchLearnerCourseData,
  enrollUser,
  unenrollUser,
  bookmarkCourse,
  rateCourse,
  fetchCourseNotes
};
