
  
  
  /*
* <license header>
*/

/**
 * Action: Course Viewer
 * Purpose: Generates HTML content for overlay paths under `/overview/trainingId/*` that the Helix Admin API consumes during
 *          preview. This action is invoked when users visit course URLs and provides course information from ALM API.
 *
 * How it works:
 * - Validates that the requested `__ow_path` is a course overlay path (`/overview/trainingId/*`). If not, returns 404.
 * - Extracts course ID and instance ID from the path structure
 * - Calls the ALM API to fetch course data using environment token
 * - Maps the API response to course data model and renders basic HTML with EDS block structure
 * - Returns `text/html` with course meta tags for EDS indexing and course-info block for decoration
 *
 * Inputs:
 * - params.__ow_path (string): Request path; must match `/overview/trainingId/{courseId}/trainingInstanceId/{instanceId}`
 *
 * Output:
 * - HTML page (Content-Type: text/html) with course meta tags and course-info block for EDS decoration.
 */
const fetch = require('node-fetch')
const { Core,State } = require('@adobe/aio-sdk')
const { errorResponse } = require('../../utils')
const { extractInstancesFromCourseData } = require('./helpers')

const ALM_API_BASE = "https://learningmanager.adobe.com/primeapi/v2"

async function main(params) {
  const logger = Core.Logger('course-view', { level: params.LOG_LEVEL || 'debug' })
  
  try {
    logger.info(`Invoked course-view action`)
    
    // Print the entire payload for debugging
    logger.info('Received params keys:', Object.keys(params))
    
    // Detect request source to prevent chain reaction
    const isEdsContentRequest = params.__ow_path && params.__ow_path.includes('/overview/trainingId/');
    const isWebhookRequest = params.events || params.message === "Test Connection" || 
                             (params.body && (typeof params.body === 'string' || params.body.events));
    
    logger.info(`Request type - EDS Content: ${isEdsContentRequest}, Webhook: ${isWebhookRequest}`);

    let courseId = null;
    let instanceId = null;

    // Check for webhook payload in different possible formats
    let webhookData = null;
    
    // Check if this is a test connection
    if (params.message === "Test Connection") {
      logger.info('Received test connection from webhook - returning success response');
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'success',
          message: 'Webhook endpoint is working correctly',
          timestamp: new Date().toISOString()
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      };
    }
    
    // Format 1: Direct events array
    if (params.events && Array.isArray(params.events) && params.events.length > 0) {
      webhookData = params;
      logger.info('Found webhook payload format 1: Direct events array')
    }
    // Format 2: Nested in body
    else if (params.body && typeof params.body === 'string') {
      try {
        const parsedBody = JSON.parse(params.body);
        if (parsedBody.events && Array.isArray(parsedBody.events)) {
          webhookData = parsedBody;
          logger.info('Found webhook payload format 2: JSON string in body')
        }
      } catch (e) {
        logger.warn('Failed to parse body as JSON:', e.message)
      }
    }
    // Format 3: Already parsed body object
    else if (params.body && typeof params.body === 'object' && params.body.events) {
      webhookData = params.body;
      logger.info('Found webhook payload format 3: Object in body')
    }
    // Format 4: Check for any property that looks like webhook data
    else {
      for (const [key, value] of Object.entries(params)) {
        if (value && typeof value === 'object' && value.events && Array.isArray(value.events)) {
          webhookData = value;
          logger.info(`Found webhook payload format 4: In property '${key}'`)
          break;
        }
      }
    }
    
    // Format 5: Check if the webhook data might be in a different structure
    // Some webhooks send data as individual parameters
    if (!webhookData && params.accountId) {
      // Try to reconstruct webhook data from individual parameters
      const reconstructedData = {
        accountId: params.accountId,
        events: []
      };
      
      // Look for event data in various parameter formats
      if (params.eventId && params.eventName && params.loId) {
        reconstructedData.events.push({
          eventId: params.eventId,
          eventName: params.eventName,
          timestamp: params.timestamp || new Date().toISOString(),
          eventInfo: params.eventInfo || '',
          data: {
            loId: params.loId,
            loType: params.loType || 'course'
          }
        });
        webhookData = reconstructedData;
        logger.info('Found webhook payload format 5: Reconstructed from individual parameters')
      }
    }

    if (webhookData && webhookData.events && webhookData.events.length > 0) {
      logger.info('Processing webhook payload from ALM')
      logger.info('Full ALM webhook payload:', JSON.stringify(webhookData, null, 2))
      
      const event = webhookData.events[0]; // Process first event
      logger.info('Processing ALM event:', JSON.stringify(event, null, 2))
      
      if (event.data && event.data.loId) {
        // Extract course ID from loId (e.g., "learningProgram:123836" -> "123836")
        const loIdParts = event.data.loId.split(':');
        if (loIdParts.length === 2) {
          courseId = loIdParts[1];
          logger.info(`Extracted course ID from ALM webhook: ${courseId}`)
          
          // Check if instanceId is provided in the event data
          if (event.data.instanceId) {
            instanceId = event.data.instanceId;
            logger.info(`Instance ID provided in ALM webhook: ${instanceId}`)
          } else {
            logger.info('No instance ID in ALM webhook - will fetch all instances for this course')
          }
        } else {
          return errorResponse(400, `Invalid loId format: ${event.data.loId}`, logger);
        }
      } else {
        return errorResponse(400, 'Missing loId in event data', logger);
      }
    }
    // Fallback to URL path parsing for backward compatibility
    else if (params.__ow_path) {
      logger.info('Processing URL path:', params.__ow_path)
      
      let path = params.__ow_path;
      if (!path.startsWith("/")) {
        path = "/" + path;
      }

      // Check if this is a course overlay path
      if (!path.includes('/overview/trainingId/')) {
        return errorResponse(404, `${path} is not a course overlay path`, logger);
      }

      // Extract course ID and instance ID from path
      const pathParts = path.split('/').filter(part => part.length > 0);

      if (pathParts.length >= 3 && pathParts[0] === 'overview' && pathParts[1] === 'trainingId') {
        const numericCourseId = pathParts[2];
        courseId = numericCourseId;
        
        if (pathParts.length >= 5 && pathParts[3] === 'trainingInstanceId') {
          const instancePart = pathParts[4];
          instanceId = instancePart;
        }
      }
    } else {
      logger.error('No valid webhook payload or URL path found')
      logger.error('Available params keys:', Object.keys(params))
      return errorResponse(400, 'Missing webhook payload or URL path', logger);
    }

    if (!courseId) {
      return errorResponse(400, 'Could not extract course ID from request', logger);
    }

    logger.info(`Processing course ID: ${courseId}, instance ID: ${instanceId}`);

    // Fetch course data from ALM API and generate HTML
    const courseData = await fetchCourseData(courseId, logger);
    
    if (!courseData) {
      return errorResponse(404, 'Course not found', logger);
    }

    // Process course data for template
    const processedData = processCourseData(courseData, courseId, instanceId);
    
    // Generate HTML with meta tags and EDS block structure
    const html = generateCourseHTML(processedData, logger);

    const response = {
      statusCode: 200,
      body: html,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }

    logger.info(`${response.statusCode}: Course HTML rendered successfully for ${courseId}`);

    // Only publish to EDS cache if this is a webhook request (not an EDS content request)
    // This prevents the chain reaction where EDS fetching content triggers more publishes
    if (isWebhookRequest && !isEdsContentRequest) {
      logger.info('Webhook request detected - publishing to EDS cache');
      // Publish to EDS cache after HTML response is prepared (fire and forget - no await)
      publishToEdsCache(courseId, instanceId, params, logger, courseData).catch(publishError => {
        logger.error('Error publishing to EDS cache:', publishError);
        // This is fire-and-forget, so we just log the error
      });
    } else if (isEdsContentRequest) {
      logger.info('EDS content request detected - skipping cache publishing to prevent chain reaction');
    }

    return response;

  } catch (error) {
    logger.error('Error in course-view action:', error);
    return errorResponse(500, 'server error', logger);
  }
}

/**
 * Fetches course data from ALM API
 */
async function fetchCourseData(courseId, logger) {
  const includeParams = 'instances.enrollment.loResourceGrades,enrollment.loInstance.loResources.resources,authors,supplementaryLOs.instances.loResources.resources,supplementaryResources,prerequisiteLOs.enrollment,instances.loResources.resources.room,subLOs.instances.loResources,skills.skillLevel.skill';
  
  // Hardcoded ALM access token
  let ALM_ACCESS_TOKEN = "c0806f12f2e49aad953eae277e281b84"; // Fallback token
  
  try {
    const state = await State.init();
    const storedToken = await state.get('alm_access_token');
    
    if (storedToken && storedToken.value) {
      ALM_ACCESS_TOKEN = storedToken.value;
      logger.info('Using refreshed token from state for course instances');
    } else {
      logger.warn('No token found in state for course instances, using fallback token');
    }
  } catch (stateError) {
    logger.warn('Failed to retrieve token from state for course instances, using fallback token:', stateError);
  }
  
  // courseId is now just the numeric ID (e.g., "7235188")
  const numericCourseId = courseId;
  
  try {
    // Fetch course data directly
    const courseUrl = `${ALM_API_BASE}/learningObjects/course:${numericCourseId}?include=${includeParams}&useCache=true&filter.ignoreEnhancedLP=false`;
    logger.info(`Fetching course data from: ${courseUrl}`);
    
    const response = await fetch(courseUrl, {
      headers: {
        'Authorization': `Bearer ${ALM_ACCESS_TOKEN}`,
        'Accept': 'application/vnd.api+json'
      }
    });

    logger.info(`Course API response status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const courseData = await response.json();
      logger.info('Course data fetched successfully');
      return courseData;
    } else {
      logger.error(`Failed to fetch course data: ${response.status} ${response.statusText}`);
      return null;
    }
  } catch (error) {
    logger.error('Error fetching course data:', error);
    return null;
  }
}

/**
 * Processes raw course data into template-ready format
 */
function processCourseData(courseResponse, courseId, instanceId) {
  const courseData = courseResponse.data;
  const includedData = courseResponse.included || [];
  const courseType = courseData.type === 'learningProgram' ? 'Learning Program' : 'Course';
  
  // Extract course information
  const courseTitle = safeGet(courseData, 'attributes.localizedMetadata.0.name', 'Untitled Course');
  const courseDescription = safeGet(courseData, 'attributes.localizedMetadata.0.description', 'No description available');
  const courseOverview = safeGet(courseData, 'attributes.localizedMetadata.0.overview', 'No overview available');
  const richTextOverview = safeGet(courseData, 'attributes.localizedMetadata.0.richTextOverview', courseOverview);
  
  // Format duration from seconds to readable format
  const durationSeconds = safeGet(courseData, 'attributes.duration', 0);
  const courseDuration = formatDuration(durationSeconds);
  
  // Extract comprehensive course details
  const bannerUrl = safeGet(courseData, 'attributes.bannerUrl', '');
  const imageUrl = safeGet(courseData, 'attributes.imageUrl', '');
  const loFormat = safeGet(courseData, 'attributes.loFormat', 'Self-paced');
  const enrollmentType = safeGet(courseData, 'attributes.enrollmentType', 'Self Enroll');
  const tags = safeGet(courseData, 'attributes.tags', []);
  const authorNames = safeGet(courseData, 'attributes.authorNames', []);
  const whoShouldTake = safeGet(courseData, 'attributes.whoShouldTake', []);
  const dateCreated = safeGet(courseData, 'attributes.dateCreated', '');
  const datePublished = safeGet(courseData, 'attributes.datePublished', '');
  const state = safeGet(courseData, 'attributes.state', 'Published');
  
  // Extract rating information
  const ratingAvg = safeGet(courseData, 'attributes.rating.averageRating', 0);
  const ratingCount = safeGet(courseData, 'attributes.rating.ratingsCount', 0);
  
  // Extract skills with detailed information
  const skillsDetailed = extractSkillsDetailed(courseResponse);
  
  // Extract instances with detailed information
  const instances = extractInstancesDetailed(courseResponse, instanceId);
  
  // Extract modules/resources from instances
  const coreModules = extractCoreModules(courseResponse, instanceId);
  
  // Extract prerequisites
  const prerequisites = extractPrerequisites(courseResponse);
  
  // Extract job aids
  const jobAids = extractJobAids(courseResponse);
  
  // Extract authors with detailed information
  const authorsDetailed = extractAuthorsDetailed(courseResponse);
  
  // Extract badges
  const badges = extractBadges(courseResponse);

  return {
    courseId,
    instanceId,
    courseTitle,
    courseDescription,
    courseOverview,
    richTextOverview,
    courseType,
    courseDuration,
    bannerUrl,
    imageUrl,
    loFormat,
    enrollmentType,
    tags,
    authorNames,
    whoShouldTake,
    dateCreated,
    datePublished,
    state,
    ratingAvg,
    ratingCount,
    skillsDetailed,
    instances,
    coreModules,
    prerequisites,
    jobAids,
    authorsDetailed,
    badges,
    // Legacy fields for backward compatibility
    courseLevel: skillsDetailed.length > 0 ? skillsDetailed[0].levelName : 'N/A',
    courseSkills: skillsDetailed.map(s => s.skillName).join(', ') || 'No skills specified',
    enrollmentCount: 0, // This would come from enrollment data if available
    timestamp: new Date().toISOString()
  };
}

/**
 * Safely gets nested object properties
 */
function safeGet(obj, path, defaultValue = '') {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : defaultValue;
  }, obj);
}

/**
 * Extracts skills from course response
 */
function extractSkills(courseResponse) {
  const skills = [];
  if (courseResponse.included) {
    courseResponse.included.forEach(item => {
      if (item.type === 'skill') {
        skills.push(item.attributes.name);
      }
    });
  }
  return skills;
}

/**
 * Extracts detailed skills information with levels and credits
 */
function extractSkillsDetailed(courseResponse) {
  const skills = [];
  const courseData = courseResponse.data;
  const includedData = courseResponse.included || [];
  
  if (courseData.relationships && courseData.relationships.skills && courseData.relationships.skills.data) {
    courseData.relationships.skills.data.forEach(skillRef => {
      const skillData = includedData.find(item => item.id === skillRef.id && item.type === 'learningObjectSkill');
      if (skillData) {
        const skillLevelRef = skillData.relationships?.skillLevel?.data;
        if (skillLevelRef) {
          const skillLevel = includedData.find(item => item.id === skillLevelRef.id && item.type === 'skillLevel');
          const skill = includedData.find(item => item.id === skillLevel?.relationships?.skill?.data?.id && item.type === 'skill');
          
          if (skill && skillLevel) {
            skills.push({
              skillId: skill.id,
              skillName: skill.attributes.name,
              skillDescription: skill.attributes.description || '',
              levelId: skillLevel.id,
              levelName: skillLevel.attributes.name,
              level: skillLevel.attributes.level,
              credits: skillData.attributes.credits || 0,
              maxCredits: skillLevel.attributes.maxCredits || 0
            });
          }
        }
      }
    });
  }
  
  return skills;
}

/**
 * Extracts detailed instances information
 */
function extractInstancesDetailed(courseResponse, requestedInstanceId = null) {
  const instances = [];
  const courseData = courseResponse.data;
  const includedData = courseResponse.included || [];
  
  if (courseData.relationships && courseData.relationships.instances && courseData.relationships.instances.data) {
    courseData.relationships.instances.data.forEach(instanceRef => {
      const instanceData = includedData.find(item => item.id === instanceRef.id && item.type === 'learningObjectInstance');
      if (instanceData) {
        const isDefault = instanceData.attributes.isDefault || false;
        const isRequested = requestedInstanceId && instanceRef.id.includes(requestedInstanceId);
        
        instances.push({
          id: instanceRef.id,
          name: instanceData.attributes.localizedMetadata?.[0]?.name || 'Default Instance',
          isDefault: isDefault,
          isRequested: isRequested,
          state: instanceData.attributes.state || 'Active',
          dateCreated: instanceData.attributes.dateCreated || '',
          isFlexible: instanceData.attributes.isFlexible || false,
          badgeId: instanceData.relationships?.badge?.data?.id || null
        });
      }
    });
  }
  
  return instances;
}

/**
 * Extracts detailed authors information
 */
function extractAuthorsDetailed(courseResponse) {
  const authors = [];
  const courseData = courseResponse.data;
  const includedData = courseResponse.included || [];
  
  if (courseData.relationships && courseData.relationships.authors && courseData.relationships.authors.data) {
    courseData.relationships.authors.data.forEach(authorRef => {
      const authorData = includedData.find(item => item.id === authorRef.id && item.type === 'user');
      if (authorData) {
        authors.push({
          id: authorData.id,
          name: authorData.attributes.name,
          avatarUrl: authorData.attributes.avatarUrl || '',
          binUserId: authorData.attributes.binUserId || '',
          state: authorData.attributes.state || 'ACTIVE'
        });
      }
    });
  }
  
  return authors;
}

/**
 * Extracts badges information
 */
function extractBadges(courseResponse) {
  const badges = [];
  const includedData = courseResponse.included || [];
  
  includedData.forEach(item => {
    if (item.type === 'badge') {
      badges.push({
        id: item.id,
        name: item.attributes.name,
        imageUrl: item.attributes.imageUrl || '',
        state: item.attributes.state || 'Active'
      });
    }
  });
  
  return badges;
}

/**
 * Extracts core modules from course instances
 */
function extractCoreModules(courseResponse, requestedInstanceId = null) {
  const modules = [];
  const courseData = courseResponse.data;
  const includedData = courseResponse.included || [];
  
  // Get course instances and modules
  if (courseData.relationships && courseData.relationships.instances && courseData.relationships.instances.data) {
    // If a specific instance is requested, try to find it; otherwise use the first instance
    let targetInstanceId;
    if (requestedInstanceId) {
      // Convert EDS format back to ALM format if needed
      const almInstanceId = courseData.relationships.instances.data.find(inst => {
        const almId = inst.id;
        if (almId.includes(':') && almId.includes('_')) {
          const parts = almId.split(':')[1];
          const edsId = parts.replace('_', '-');
          return edsId === requestedInstanceId;
        }
        return almId === requestedInstanceId;
      })?.id;
      targetInstanceId = almInstanceId || courseData.relationships.instances.data[0]?.id;
    } else {
      targetInstanceId = courseData.relationships.instances.data[0]?.id;
    }
    
    const instanceData = includedData.find(item => item.id === targetInstanceId && item.type === 'learningObjectInstance');
    
    if (instanceData && instanceData.relationships && instanceData.relationships.loResources) {
      const resources = instanceData.relationships.loResources.data;
      
      resources.forEach((resource, index) => {
        const loResourceData = includedData.find(item => item.id === resource.id && item.type === 'learningObjectResource');
        if (loResourceData && loResourceData.attributes) {
          // Get the actual resource details
          const actualResources = loResourceData.relationships?.resources?.data || [];
          const actualResource = actualResources.length > 0 ? 
            includedData.find(item => item.id === actualResources[0].id && item.type === 'resource') : null;
          
          // Use loResource metadata first, then fall back to actual resource
          const resourceMetadata = loResourceData.attributes.localizedMetadata && loResourceData.attributes.localizedMetadata[0] 
            ? loResourceData.attributes.localizedMetadata[0] 
            : (actualResource ? { name: actualResource.attributes.name || 'Module' } : { name: 'Module' });
          
          // Get content type and other details
          const contentType = actualResource ? actualResource.attributes.contentType : 
                             (loResourceData.attributes.resourceType || 'Content');
          
          // Get duration - prefer actual resource duration
          let durationSeconds = 0;
          if (actualResource) {
            durationSeconds = actualResource.attributes.desiredDuration || 
                             actualResource.attributes.authorDesiredDuration || 0;
          }
          
          // Determine module format and icon
          let moduleFormat = 'SELF PACED';
          let moduleIcon = '⏱️';
          
          if (contentType === 'QUIZ') {
            moduleIcon = '✓';
          } else if (contentType === 'VIDEO') {
            moduleIcon = '▶️';
          } else if (contentType === 'PDF') {
            moduleIcon = '📄';
          } else if (contentType === 'Activity') {
            moduleIcon = '🔧';
          }
          
          const moduleDuration = formatDuration(durationSeconds);
          
          // No completion status when not enrolled - all modules should show as not started
          const isCompleted = false;
          const status = 'not-started';
          
          modules.push({
            id: resource.id,
            courseId: courseData.id,
            name: resourceMetadata.name,
            description: resourceMetadata.description || '',
            format: moduleFormat,
            contentType: contentType,
            duration: moduleDuration,
            durationSeconds: durationSeconds,
            icon: moduleIcon,
            // Additional metadata
            resourceType: loResourceData.attributes.resourceType || 'Content',
            resourceSubType: loResourceData.attributes.resourceSubType || 'NONE',
            previewEnabled: loResourceData.attributes.previewEnabled || false,
            submissionEnabled: loResourceData.attributes.submissionEnabled || false
          });
        }
      });
    }
  }
  
  return modules;
}

/**
 * Extracts prerequisites from course response
 */
function extractPrerequisites(courseResponse) {
  const prerequisites = [];
  const courseData = courseResponse.data;
  const includedData = courseResponse.included || [];
  
  // Check if there are prerequisites
  if (courseData.relationships && courseData.relationships.prerequisiteLOs && courseData.relationships.prerequisiteLOs.data) {
    courseData.relationships.prerequisiteLOs.data.forEach(prereq => {
      // Find the prerequisite details in included data
      const prereqData = includedData.find(item => item.id === prereq.id);
      if (prereqData && prereqData.attributes) {
        const prereqMetadata = prereqData.attributes.localizedMetadata && prereqData.attributes.localizedMetadata[0] 
          ? prereqData.attributes.localizedMetadata[0] 
          : { name: prereqData.attributes.name || 'Prerequisite Course' };
        
        prerequisites.push({
          id: prereq.id,
          name: prereqMetadata.name,
          type: prereqData.attributes.loFormat || 'Self-paced'
        });
      }
    });
  }
  
  return prerequisites;
}

/**
 * Extracts job aids from supplementary resources
 */
function extractJobAids(courseResponse) {
  const jobAids = [];
  const courseData = courseResponse.data;
  const includedData = courseResponse.included || [];
  
  // Get job aids from supplementary resources
  if (courseData.relationships && courseData.relationships.supplementaryLOs && courseData.relationships.supplementaryLOs.data) {
    const jobAidItems = courseData.relationships.supplementaryLOs.data.filter(item => {
      const itemData = includedData.find(included => included.id === item.id);
      return itemData && itemData.attributes && itemData.attributes.loType === 'jobAid';
    });
    
    jobAidItems.forEach(jobAid => {
      const jobAidData = includedData.find(item => item.id === jobAid.id);
      if (jobAidData && jobAidData.attributes) {
        const jobAidMetadata = jobAidData.attributes.localizedMetadata && jobAidData.attributes.localizedMetadata[0] 
          ? jobAidData.attributes.localizedMetadata[0] 
          : { name: jobAidData.attributes.name || 'Job Aid', description: '' };
        
        jobAids.push({
          id: jobAid.id,
          name: jobAidMetadata.name,
          description: jobAidMetadata.description || 'Job aid description'
        });
      }
    });
  }
  
  return jobAids;
}

/**
 * Formats duration from seconds to readable format
 */
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return 'N/A';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Generates HTML with comprehensive course overview structure
 */
function generateCourseHTML(courseData, logger) {
  logger.info('Generating static course HTML with EDS structure')
  
  const imageUrl = courseData.imageUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80'
  
  // Generate course overview HTML
  const courseOverviewHTML = `
    <div class="course-overview-section">
      <p class="course-description">${escapeHtml(courseData.courseOverview)}</p>
    </div>
  `;
  
  // Generate modules HTML - static information only
  const modulesHTML = `
    <div class="course-section modules-section">
      <h3 class="content-title">
        Core Content 
        <span class="duration-badge">${escapeHtml(courseData.courseDuration)}</span>
      </h3>
      <div class="modules-list">
        ${courseData.coreModules.map(module => `
          <div class="module-item" data-resource-id="${escapeHtml(module.id)}">
            <div class="module-icon">${module.icon}</div>
            <div class="module-content">
              <div class="module-header">
                <span class="module-format">${escapeHtml(module.format)}</span>
              </div>
              <div class="module-title">
                <h4 class="module-name">${escapeHtml(module.name)}</h4>
              </div>
              <div class="module-meta">
                <span class="module-duration">${escapeHtml(module.duration)}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // Generate skills HTML
  const skillsHTML = courseData.skillsDetailed.length > 0 ? `
    <div class="sidebar-section skills-section">
      <h3 class="sidebar-title">Skills covered</h3>
      <div class="skills-list">
        ${courseData.skillsDetailed.map(skill => `
          <div class="skill-item">
            <span class="skill-name">${escapeHtml(skill.skillName)} - ${escapeHtml(skill.levelName)}</span>
            <span class="skill-credits">(${skill.credits} Credits)</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';
  
  // Generate authors HTML
  const authorsHTML = courseData.authorsDetailed.length > 0 ? `
    <div class="sidebar-section authors-section">
      <h3 class="sidebar-title">Author(s)</h3>
      <div class="authors-list">
        ${courseData.authorsDetailed.map(author => `
          <div class="author-item">
            <img src="${escapeHtml(author.avatarUrl)}" alt="${escapeHtml(author.name)}" class="author-avatar">
            <span class="author-name">${escapeHtml(author.name)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';
  
  return `<head>
  <meta charset="utf-8">
  <title>${escapeHtml(courseData.courseTitle)} - Course Information</title>
  <meta name="description" content="${escapeHtml(courseData.courseDescription)}">
  <meta name="author" content="ALM Course Information">
  <meta name="timestamp" content="${courseData.timestamp}">
  
  <!-- Course Meta Tags for EDS Indexing -->
  <meta name="course-id" content="${escapeHtml(courseData.courseId)}">
  <meta name="course-title" content="${escapeHtml(courseData.courseTitle)}">
  <meta name="course-duration" content="${escapeHtml(courseData.courseDuration)}">
  <meta name="course-skills" content="${escapeHtml(courseData.courseSkills)}">
  <meta name="course-type" content="${escapeHtml(courseData.courseType)}">
  <meta name="course-format" content="${escapeHtml(courseData.loFormat)}">
  <meta name="course-tags" content="${courseData.tags.join(', ')}">

  <!-- Open Graph Meta Tags -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(courseData.courseTitle)}">
  <meta property="og:description" content="${escapeHtml(courseData.courseDescription)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
</head>

<body>
  <header></header>
  <main>
    <div>
      <div class="course-overview">
        <!-- Course Header -->
        <div class="course-header">
          <h1 class="course-title">${escapeHtml(courseData.courseTitle)}</h1>
          <div class="course-format">${escapeHtml(courseData.loFormat)}</div>
        </div>
        
        <!-- Course Overview -->
        ${courseOverviewHTML}
        
        <!-- Main Content -->
        <div class="course-main-content">
          <!-- Left Content -->
          <div class="course-left-content">
            ${modulesHTML}
          </div>
          
          <!-- Sidebar -->
          <div class="course-sidebar">
            ${skillsHTML}
            ${authorsHTML}
          </div>
        </div>
      </div>
    </div>
  </main>
  <footer></footer>
</body>

</html>`
}

/**
 * Publishes course content to EDS cache
 */
async function publishToEdsCache(courseId, instanceId, params, logger, courseData) {
  logger.info(`Publishing to EDS cache for courseId: ${courseId}, instanceId: ${instanceId}`);
  
  try {
    // Get EDS_AUTH_TOKEN from environment variables
    const edsAuthToken = params.EDS_AUTH_TOKEN;
    if (!edsAuthToken) {
      logger.warn('EDS_AUTH_TOKEN not provided, skipping EDS cache publishing');
      return;
    }

    const myHeaders = new Headers();
    myHeaders.append("Authorization", `token ${edsAuthToken}`);
    myHeaders.append("Content-Type", "application/json");

    const baseUrl = "rohitnegi02/byomeds/main";
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      redirect: "follow",
      body: JSON.stringify({ refresh: true })
    };

    if (instanceId) {
      // Specific instance provided - update cache only for this instance
      const previewUrl = `https://admin.hlx.page/preview/${baseUrl}/overview/trainingId/${courseId}/trainingInstanceId/${instanceId}`;
      logger.info(`Publishing to EDS cache for specific instance: ${previewUrl}`);
      
      const previewResponse = await fetch(previewUrl, requestOptions);
      const previewResult = await previewResponse.text();
      
      if (previewResponse.ok) {
        logger.info(`Successfully published to EDS cache for instance ${instanceId}: ${previewResponse.status}`);
        logger.debug(`EDS preview response: ${previewResult}`);
        
        // If preview is successful, also publish to live
        const liveUrl = `https://admin.hlx.page/live/${baseUrl}/overview/trainingId/${courseId}/trainingInstanceId/${instanceId}`;
        logger.info(`Publishing to EDS live for instance ${instanceId}: ${liveUrl}`);
        
        try {
          const liveResponse = await fetch(liveUrl, requestOptions);
          const liveResult = await liveResponse.text();
          
          if (liveResponse.ok) {
            logger.info(`Successfully published to EDS live for instance ${instanceId}: ${liveResponse.status}`);
            logger.debug(`EDS live response: ${liveResult}`);
          } else {
            logger.warn(`EDS live publishing failed for instance ${instanceId}: ${liveResponse.status} - ${liveResult}`);
          }
        } catch (liveError) {
          logger.error(`Error publishing to EDS live for instance ${instanceId}:`, liveError);
        }
      } else {
        logger.warn(`EDS cache publishing failed for instance ${instanceId}: ${previewResponse.status} - ${previewResult}`);
      }
    } else {
      // No instance ID provided - extract instances from course data
      logger.info('No instance ID provided - extracting instances from course data');
      
      const instances = extractInstancesFromCourseData(courseData, logger);
      if (instances && instances.length > 0) {
        logger.info(`Found ${instances.length} instances for course ${courseId}`);
        
        // Update EDS cache for each instance
        const publishPromises = instances.map(async (instance) => {
          const previewUrl = `https://admin.hlx.page/preview/${baseUrl}/overview/trainingId/${courseId}/trainingInstanceId/${instance.id}`;
          logger.info(`Publishing to EDS cache for instance ${instance.id}: ${previewUrl}`);
          
          try {
            const previewResponse = await fetch(previewUrl, requestOptions);
            const previewResult = await previewResponse.text();
            
            if (previewResponse.ok) {
              logger.info(`Successfully published to EDS cache for instance ${instance.id}: ${previewResponse.status}`);
              
              // If preview is successful, also publish to live
              const liveUrl = `https://admin.hlx.page/live/${baseUrl}/overview/trainingId/${courseId}/trainingInstanceId/${instance.id}`;
              logger.info(`Publishing to EDS live for instance ${instance.id}: ${liveUrl}`);
              
              try {
                const liveResponse = await fetch(liveUrl, requestOptions);
                const liveResult = await liveResponse.text();
                
                if (liveResponse.ok) {
                  logger.info(`Successfully published to EDS live for instance ${instance.id}: ${liveResponse.status}`);
                  return { instanceId: instance.id, success: true, status: previewResponse.status, liveStatus: liveResponse.status };
                } else {
                  logger.warn(`EDS live publishing failed for instance ${instance.id}: ${liveResponse.status} - ${liveResult}`);
                  return { instanceId: instance.id, success: true, status: previewResponse.status, liveError: liveResult };
                }
              } catch (liveError) {
                logger.error(`Error publishing to EDS live for instance ${instance.id}:`, liveError);
                return { instanceId: instance.id, success: true, status: previewResponse.status, liveError: liveError.message };
              }
            } else {
              logger.warn(`EDS cache publishing failed for instance ${instance.id}: ${previewResponse.status} - ${previewResult}`);
              return { instanceId: instance.id, success: false, status: previewResponse.status, error: previewResult };
            }
          } catch (error) {
            logger.error(`Error publishing to EDS cache for instance ${instance.id}:`, error);
            return { instanceId: instance.id, success: false, error: error.message };
          }
        });
        
        // Wait for all publishing operations to complete
        const results = await Promise.allSettled(publishPromises);
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        logger.info(`EDS cache publishing completed: ${successCount}/${instances.length} instances updated successfully`);
        
      } else {
        logger.warn(`No instances found for course ${courseId} - publishing to course-level cache`);
        
        // Fallback: publish to course-level cache if no instances found
        const previewUrl = `https://admin.hlx.page/preview/${baseUrl}/overview/trainingId/${courseId}`;
        logger.info(`Publishing to EDS cache for course level: ${previewUrl}`);
        
        const previewResponse = await fetch(previewUrl, requestOptions);
        const previewResult = await previewResponse.text();
        
        if (previewResponse.ok) {
          logger.info(`Successfully published to EDS cache for course level: ${previewResponse.status}`);
          logger.debug(`EDS preview response: ${previewResult}`);
          
          // If preview is successful, also publish to live
          const liveUrl = `https://admin.hlx.page/live/${baseUrl}/overview/trainingId/${courseId}`;
          logger.info(`Publishing to EDS live for course level: ${liveUrl}`);
          
          try {
            const liveResponse = await fetch(liveUrl, requestOptions);
            const liveResult = await liveResponse.text();
            
            if (liveResponse.ok) {
              logger.info(`Successfully published to EDS live for course level: ${liveResponse.status}`);
              logger.debug(`EDS live response: ${liveResult}`);
            } else {
              logger.warn(`EDS live publishing failed for course level: ${liveResponse.status} - ${liveResult}`);
            }
          } catch (liveError) {
            logger.error(`Error publishing to EDS live for course level:`, liveError);
          }
        } else {
          logger.warn(`EDS cache publishing failed for course level: ${previewResponse.status} - ${previewResult}`);
        }
      }
    }
    
  } catch (error) {
    logger.error('Error publishing to EDS cache:', error);
    throw error;
  }
}



/**
 * Escapes HTML special characters
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    return text;
  }
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

module.exports = { main }
