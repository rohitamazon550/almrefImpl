// UI Components for Course Overview
// Handles HTML generation and UI component creation

// Format duration helper
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return 'Self-paced';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Extract course ID or learning program ID from URL
function getCourseIdFromUrl() {
  const pathParts = window.location.pathname.split('/');
  const trainingIdIndex = pathParts.indexOf('trainingId');
  if (trainingIdIndex !== -1 && pathParts[trainingIdIndex + 1]) {
    const trainingId = pathParts[trainingIdIndex + 1];
    
    // Check if it's a learning program with lp- prefix (format: lp-121645)
    if (trainingId.startsWith('lp-')) {
      const lpId = trainingId.substring(3); // Remove 'lp-' prefix
      return `learningProgram:${lpId}`;
    }
    
    // Check if it's already in learningProgram: format
    if (trainingId.startsWith('learningProgram:')) {
      return trainingId;
    }
    
    // Otherwise treat as course
    return `course:${trainingId}`;
  }
  return null;
}

// Extract data from CDN HTML
function extractDataFromCDN(block) {
  const courseTitle = document.querySelector('meta[name="course-title"]')?.content || 'Course Title';
  const courseFormat = block.querySelector('p')?.textContent || 'Blended';
  const courseDescription = document.querySelector('meta[name="richTextOverview"]')?.content || 
                           document.querySelector('meta[name="description"]')?.content || 
                           'Course description';
  
  // Check if this is a learning program by looking for "Learning Program Content" in H3
  const h3Elements = block.querySelectorAll('h3');
  let isLearningProgram = false;
  for (const h3 of h3Elements) {
    if (h3.textContent.includes('Learning Program Content')) {
      isLearningProgram = true;
      break;
    }
  }
  
  if (isLearningProgram) {
    return extractLearningProgramDataFromCDN(block, courseTitle, courseFormat, courseDescription);
  }
  
  // Extract modules from the basic HTML structure (for regular courses)
  const modules = [];
  const h4Elements = block.querySelectorAll('h4');
  
  h4Elements.forEach((h4, index) => {
    const moduleTitle = h4.textContent;
    const moduleId = h4.id;
    
    // Find the next elements after h4 to get duration and format
    let nextElement = h4.nextElementSibling;
    let duration = 'N/A';
    let format = 'SELF PACED';
    let icon = '📖';
    
    // Look for duration in the next few elements
    while (nextElement && nextElement.tagName === 'P') {
      const text = nextElement.textContent.trim();
      if (text.match(/^\d+m$/) || text === 'N/A') {
        duration = text;
        break;
      } else if (text === 'SELF PACED') {
        format = text;
      } else if (text.match(/^[📄▶️🔧✓]$/)) {
        icon = text;
      }
      nextElement = nextElement.nextElementSibling;
    }
    
    modules.push({
      id: `module-${index}`,
      resourceId: `course:14401139_15111973_${19943287 + index}_0`,
      title: moduleTitle,
      duration: duration,
      format: format,
      icon: icon
    });
  });
  
  // Extract skills
  const skillsSection = Array.from(block.querySelectorAll('h3')).find(h3 => h3.textContent.includes('Skills covered'));
  const skills = [];
  if (skillsSection) {
    let nextElement = skillsSection.nextElementSibling;
    while (nextElement && nextElement.tagName === 'P') {
      skills.push(nextElement.textContent);
      nextElement = nextElement.nextElementSibling;
    }
  }
  
  return {
    isLearningProgram: false,
    courseTitle,
    courseFormat,
    courseDescription,
    modules,
    skills
  };
}

// Extract learning program data from CDN HTML
function extractLearningProgramDataFromCDN(block, lpTitle, lpFormat, lpDescription) {
  // Look for h3 with "Learning Program Content"
  const h3Elements = block.querySelectorAll('h3');
  let lpH3 = null;
  
  for (const h3 of h3Elements) {
    if (h3.textContent.includes('Learning Program Content')) {
      lpH3 = h3;
      break;
    }
  }
  
  if (!lpH3) {
    return {
      isLearningProgram: false,
      courseTitle: lpTitle,
      courseFormat: lpFormat,
      courseDescription: lpDescription,
      modules: [],
      skills: []
    };
  }
  
  // Extract duration from h3 text (e.g., "Learning Program Content 1h 41m")
  const lpDuration = lpH3.textContent.replace('Learning Program Content', '').trim();
  
  // Get the info paragraph (This learning program contains X course(s))
  let lpInfoText = '';
  let currentElement = lpH3.nextElementSibling;
  if (currentElement && currentElement.tagName === 'P') {
    lpInfoText = currentElement.textContent;
    currentElement = currentElement.nextElementSibling;
  }
  
  // Parse courses from the flat structure
  const courses = [];
  let currentCourse = null;
  let currentModule = null;
  let courseIndex = 0;
  let courseImageUrl = '';
  let courseMetadata = '';
  
  while (currentElement) {
    const tagName = currentElement.tagName;
    const text = currentElement.textContent.trim();
    
    // Check for image (picture element with img)
    if (tagName === 'P') {
      const picture = currentElement.querySelector('picture');
      if (picture) {
        const img = picture.querySelector('img');
        if (img) {
          // Get the full image URL - try src, then alt as fallback
          courseImageUrl = img.src || img.getAttribute('src') || '';
          // Make sure it's a full URL
          if (courseImageUrl && !courseImageUrl.startsWith('http')) {
            // Convert relative URL to absolute
            const baseUrl = window.location.origin;
            courseImageUrl = new URL(courseImageUrl, baseUrl).href;
          }
          currentElement = currentElement.nextElementSibling;
          continue;
        }
      }
      
      // Check if this is course metadata (contains ● separators)
      if (text.includes('●')) {
        courseMetadata = text;
        
        // Extract REQUIRED/OPTIONAL flag from metadata
        // Format: "Self Paced REQUIRED ● 47m" or "Self Paced OPTIONAL ● Author ● 1h ● ★★★☆☆ 3"
        const isRequired = text.includes('REQUIRED');
        const isOptional = text.includes('OPTIONAL');
        
        // Store the requirement status
        if (isRequired || isOptional) {
          // Store for the next course
          window.tempCourseRequirement = isRequired ? 'REQUIRED' : 'OPTIONAL';
        }
        
        currentElement = currentElement.nextElementSibling;
        continue;
      }
    }
    
    // Check if this is H4 (course title) - this indicates start of a new course
    if (tagName === 'H4') {
      // Save previous course if exists
      if (currentCourse) {
        // Save any pending module
        if (currentModule && currentModule.title) {
          currentCourse.modules.push(currentModule);
        }
        courses.push(currentCourse);
      }
      
      // Start new course
      courseIndex++;
      
      // Get requirement status from temp storage (set when metadata was parsed)
      const requirementStatus = window.tempCourseRequirement || '';
      
      currentCourse = {
        id: `course-${courseIndex}`, // Placeholder, will be updated when we find Course ID
        number: `Course ${courseIndex}`,
        title: text,  // H4 text is the title
        duration: '',
        overview: '',
        imageUrl: courseImageUrl,  // Store the image we found earlier
        metadata: courseMetadata,   // Store the metadata we found earlier
        isRequired: requirementStatus === 'REQUIRED',  // Store required flag
        courseId: null,  // Will be extracted from "Course ID: X" paragraph
        instanceId: null,  // Will be extracted from "Instance ID: Y" paragraph
        modules: []
      };
      currentModule = null;
      // Reset for next course
      courseImageUrl = '';
      courseMetadata = '';
      window.tempCourseRequirement = ''; // Reset temp storage
      
      currentElement = currentElement.nextElementSibling;
      continue;
    }
    
    // If we have a current course, parse its data
    if (currentCourse) {
      if (tagName === 'H5') {
        // This is a module - save previous module if exists
        if (currentModule && currentModule.title) {
          currentCourse.modules.push(currentModule);
        }
        // Start new module
        currentModule = {
          title: text,
          duration: '',
          icon: '📖',
          format: 'SELF PACED'
        };
      } else if (tagName === 'P') {
        // If we have a current module, try to assign data to it
        if (currentModule && currentModule.title) {
          // Duration pattern
          if (!currentModule.duration && (text.match(/^\d+[hm]$/) || text === 'N/A')) {
            currentModule.duration = text;
          }
          // Icon pattern
          else if (text.match(/^[📄▶️🔧✓⏱️]$/)) {
            currentModule.icon = text;
          }
          // Format pattern
          else if (text.match(/^(SELF PACED|BLENDED)$/i)) {
            currentModule.format = text;
          }
        }
        // Check if this is the Course ID/Instance ID line
        else if (text.startsWith('Course ID:')) {
          // Parse "Course ID: 12495374 | Instance ID: 12495374-13216648" or "Course ID: 12495374 | Instance ID:"
          const courseIdMatch = text.match(/Course ID:\s*(\d+)/);
          const instanceIdMatch = text.match(/Instance ID:\s*([\d-]+)/); // Capture digits and hyphens
          
          if (courseIdMatch) {
            currentCourse.courseId = courseIdMatch[1];
            currentCourse.id = `course:${courseIdMatch[1]}`; // Update the id format
          }
          if (instanceIdMatch) {
            currentCourse.instanceId = instanceIdMatch[1]; // This will be like "12495374-13216648"
          }
        }
        // If no current module, this is course-level data
        else if (currentCourse.title && !currentCourse.duration) {
          // First P after title is duration
          if (text.match(/\d+[hm]/)) {
            currentCourse.duration = text;
          } else if (text !== '✓' && !text.match(/^(SELF PACED|BLENDED)$/i)) {
            // If not a duration pattern and not a status icon, it's likely the overview
            currentCourse.overview = text;
          }
        } else if (currentCourse.duration && !currentCourse.overview) {
          // Second P after duration might be overview (if not a checkmark or format)
          if (text !== '✓' && !text.match(/^(SELF PACED|BLENDED)$/i) && !text.match(/^[📄▶️🔧]$/)) {
            currentCourse.overview = text;
          }
        }
      }
    }
    
    currentElement = currentElement.nextElementSibling;
  }
  
  // Add the last module to the last course
  if (currentCourse) {
    if (currentModule && currentModule.title) {
      currentCourse.modules.push(currentModule);
    }
    courses.push(currentCourse);
  }
  
  return {
    isLearningProgram: true,
    courseTitle: lpTitle,
    courseFormat: lpFormat,
    courseDescription: lpDescription,
    lpDuration: lpDuration,
    lpInfoText: lpInfoText,
    lpOrderInfo: '', // Not present in this CDN format
    courses: courses,
    skills: []
  };
}

// Create and show fluidic player modal
function createFluidicPlayerModal(playerUrl, onCloseCallback) {
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'fluidic-modal-overlay';
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.className = 'fluidic-modal-content';
  modalContent.style.cssText = `
    width: 100%;
    height: 100%;
    background-color: white;
    position: relative;
    overflow: hidden;
  `;

  // Create iframe for fluidic player
  const iframe = document.createElement('iframe');
  iframe.src = playerUrl;
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;

  // Helper function to close modal and trigger callback
  const closeModal = () => {
    if (document.body.contains(modalOverlay)) {
      document.body.removeChild(modalOverlay);
      // Call the callback function if provided
      if (onCloseCallback && typeof onCloseCallback === 'function') {
        onCloseCallback();
      }
    }
  };

  // Add event listeners
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Listen for messages from the iframe to close modal
  window.addEventListener('message', function closePlayer(event) {
    if (event.data === 'status:close') {
      // Handle closing event from Adobe Learning Manager player
      closeModal();
    }
  });

  // Assemble modal
  modalContent.appendChild(iframe);
  modalOverlay.appendChild(modalContent);

  // Add to document
  document.body.appendChild(modalOverlay);
}

// Export functions
export {
  formatDuration,
  getCourseIdFromUrl,
  extractDataFromCDN,
  createFluidicPlayerModal
};
