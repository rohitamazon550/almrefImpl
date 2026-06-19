/**
 * Course Info Block
 * Reads course data from meta tags and displays course information
 * Can be authored into any EDS page using the course-info block
 */

/**
 * Gets course data from meta tags
 * @returns {object} Course data object
 */
function getCourseDataFromMeta() {
  const courseData = {
    courseId: document.querySelector('meta[name="course-id"]')?.content || '',
    courseTitle: document.querySelector('meta[name="course-title"]')?.content || '',
    courseDuration: document.querySelector('meta[name="course-duration"]')?.content || '',
    courseSkillLevel: document.querySelector('meta[name="course-skill-level"]')?.content || '',
    courseSkills: document.querySelector('meta[name="course-skills"]')?.content || '',
    courseDescription: document.querySelector('meta[name="description"]')?.content || '',
  };
  
  return courseData;
}

/**
 * Creates course info content
 * @param {object} courseData - Course data from meta tags
 * @returns {string} HTML content for the course info
 */
function createCourseInfoContent(courseData) {
  return `
    <div class="course-header">
      <h2 class="course-title">${courseData.courseTitle || 'Course Title Not Available'}</h2>
      <div class="course-id">Course ID: ${courseData.courseId || 'Not Available'}</div>
    </div>
    
    <div class="course-meta">
      <div class="course-meta-item">
        <span class="meta-label">Duration</span>
        <span class="meta-value">${courseData.courseDuration || 'N/A'}</span>
      </div>
      <div class="course-meta-item">
        <span class="meta-label">Skill Level</span>
        <span class="meta-value">${courseData.courseSkillLevel || 'N/A'}</span>
      </div>
      <div class="course-meta-item">
        <span class="meta-label">Skills</span>
        <span class="meta-value">${courseData.courseSkills || 'N/A'}</span>
      </div>
    </div>
    
    <div class="course-description">
      <h3>Description</h3>
      <p>${courseData.courseDescription || 'No description available'}</p>
    </div>
    
    <div class="course-actions">
      <button class="course-action-btn primary" onclick="handleEnrollClick('${courseData.courseId}')">
        Enroll Now
      </button>
      <button class="course-action-btn secondary" onclick="handleViewDetailsClick('${courseData.courseId}')">
        View Details
      </button>
    </div>
  `;
}

/**
 * Handle enroll button click
 * @param {string} courseId - Course ID
 */
function handleEnrollClick(courseId) {
  // You can customize this to integrate with your enrollment system
  
  // Example: Redirect to enrollment page
  // window.location.href = `/enroll?courseId=${encodeURIComponent(courseId)}`;
  
  // Example: Open enrollment modal
  // openEnrollmentModal(courseId);
  
  // For demo purposes, show an alert
  alert(`Enrollment functionality for course ${courseId} would be implemented here.`);
}

/**
 * Handle view details button click
 * @param {string} courseId - Course ID
 */
function handleViewDetailsClick(courseId) {
  // You can customize this to show course details
  
  // Example: Redirect to course details page
  // window.location.href = `/course-details?courseId=${encodeURIComponent(courseId)}`;
  
  // Example: Open details modal
  // openCourseDetailsModal(courseId);
  
  // For demo purposes, show an alert
  alert(`Course details for ${courseId} would be displayed here.`);
}

/**
 * Decorates the course info block
 * @param {Element} block - The course info block element
 */
export default function decorate(block) {
  // Get course data from meta tags
  const courseData = getCourseDataFromMeta();
  
  // Check if course data is available
  if (!courseData.courseId) {
    // Check if we're on a course page URL pattern
    const isCoursePage = window.location.pathname.includes('/overview/trainingId/') || 
                        window.location.pathname.includes('/course/');
    
    if (isCoursePage) {
      // On a course page but no meta tags - show loading state
      block.innerHTML = `
        <div class="course-info-loading">
          <h3>🔄 Loading Course Information...</h3>
          <p>Waiting for course data to be loaded by the overlay action.</p>
          <div class="loading-spinner"></div>
        </div>
      `;
      
      // Try to reload course data after a delay
      setTimeout(() => {
        const retryData = getCourseDataFromMeta();
        if (retryData.courseId) {
          decorate(block); // Retry decoration
        }
      }, 2000);
    } else {
      // Not on a course page - show helpful message
      block.innerHTML = `
        <div class="course-info-placeholder">
          <h3>📚 Course Information Block</h3>
          <p>This block displays course information when viewing a course page.</p>
          <p>Navigate to a course URL like:</p>
          <code>/overview/trainingId/7235188/trainingInstanceId/7235188-7875849</code>
          <p><small>Course data is provided by the App Builder overlay action.</small></p>
        </div>
      `;
    }
    return;
  }
  
  // Log course data for debugging
  
  // Create and insert course info content
  block.innerHTML = createCourseInfoContent(courseData);
  
  // Add success class for styling
  block.classList.add('course-info-loaded');
  
  // Make functions available globally for button clicks
  window.handleEnrollClick = handleEnrollClick;
  window.handleViewDetailsClick = handleViewDetailsClick;
  
}
