// Profile Block - Displays user profile and skill interests
import {
  fetchUserProfile,
  fetchUserSkillInterests,
  fetchAllSkills,
  addSkillInterests,
  deleteSkillInterest,
  updateUserProfile
} from '../../scripts/api-service.js';
import { addManagedListener, cleanupChildren, showError } from '../../scripts/dom-utils.js';

// Generate profile HTML using createElement
function generateProfileHTML(userProfile, skillInterests) {
  const user = userProfile?.attributes;
  const userName = user?.name || 'User Name';
  const userEmail = user?.email || 'user@example.com';
  const userAvatar = user?.avatarUrl || '';

  const container = document.createElement('div');
  container.className = 'profile-container';

  const profileHeader = document.createElement('div');
  profileHeader.className = 'profile-header';
  
  const profileTitle = document.createElement('h1');
  profileTitle.className = 'profile-title';
  profileTitle.textContent = 'Your Profile';
  profileHeader.appendChild(profileTitle);

  const userInfoSection = document.createElement('div');
  userInfoSection.className = 'user-info-section';

  const userAvatarDiv = document.createElement('div');
  userAvatarDiv.className = 'user-avatar';

  if (userAvatar) {
    const avatarImg = document.createElement('img');
    avatarImg.src = userAvatar;
    avatarImg.alt = 'Profile Picture';
    avatarImg.className = 'avatar-image';
    userAvatarDiv.appendChild(avatarImg);
  } else {
    const avatarPlaceholder = document.createElement('div');
    avatarPlaceholder.className = 'avatar-placeholder';
    avatarPlaceholder.innerHTML = `
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="40" fill="#e0e0e0"/>
        <circle cx="40" cy="30" r="12" fill="#999"/>
        <path d="M20 65c0-11 9-20 20-20s20 9 20 20" fill="#999"/>
      </svg>
    `;
    userAvatarDiv.appendChild(avatarPlaceholder);
  }

  const changeImageBtn = document.createElement('button');
  changeImageBtn.className = 'change-image-btn';
  changeImageBtn.textContent = 'Change image';
  userAvatarDiv.appendChild(changeImageBtn);

  const userDetails = document.createElement('div');
  userDetails.className = 'user-details';

  const userNameElem = document.createElement('h2');
  userNameElem.className = 'user-name';
  userNameElem.textContent = userName;

  const userEmailElem = document.createElement('p');
  userEmailElem.className = 'user-email';
  userEmailElem.textContent = userEmail;

  userDetails.appendChild(userNameElem);
  userDetails.appendChild(userEmailElem);

  userInfoSection.appendChild(userAvatarDiv);
  userInfoSection.appendChild(userDetails);

  const skillsSection = document.createElement('div');
  skillsSection.className = 'skills-section';

  const sectionTitle = document.createElement('h2');
  sectionTitle.className = 'section-title';
  sectionTitle.textContent = 'Your Areas of Interest';

  const sectionDescription = document.createElement('p');
  sectionDescription.className = 'section-description';
  sectionDescription.textContent = 'Select areas of interest. You will see recommendations based on your interest.';

  const skillsGrid = document.createElement('div');
  skillsGrid.className = 'skills-grid';

  if (skillInterests && skillInterests.data && skillInterests.data.length > 0) {
    const skills = skillInterests.data.map(interest => {
      const skillId = interest.relationships?.skill?.data?.id;
      const skill = skillInterests.included?.find(item => 
        item.type === 'skill' && item.id === skillId
      );
      
      return {
        id: interest.id,
        skillId: skillId,
        name: skill?.attributes?.name || 'Unknown Skill'
      };
    });

    skills.forEach(skill => {
      const skillItem = document.createElement('div');
      skillItem.className = 'skill-interest-item';
      skillItem.dataset.skillId = skill.id;

      const skillName = document.createElement('span');
      skillName.className = 'skill-name';
      skillName.textContent = skill.name;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-skill-btn';
      deleteBtn.title = 'Remove from My interests';
      deleteBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;

      const skillTooltip = document.createElement('div');
      skillTooltip.className = 'skill-tooltip';
      
      const tooltipContent = document.createElement('div');
      tooltipContent.className = 'tooltip-content';
      
      const tooltipTitle = document.createElement('h4');
      tooltipTitle.textContent = skill.name;
      
      const tooltipText = document.createElement('p');
      tooltipText.textContent = 'Added based on your learnings';
      
      tooltipContent.appendChild(tooltipTitle);
      tooltipContent.appendChild(tooltipText);
      
      const tooltipArrow = document.createElement('div');
      tooltipArrow.className = 'tooltip-arrow';
      
      skillTooltip.appendChild(tooltipContent);
      skillTooltip.appendChild(tooltipArrow);

      skillItem.appendChild(skillName);
      skillItem.appendChild(deleteBtn);
      skillItem.appendChild(skillTooltip);
      
      skillsGrid.appendChild(skillItem);
    });
  } else {
    const noSkills = document.createElement('div');
    noSkills.className = 'no-skills';
    
    const noSkillsText = document.createElement('p');
    noSkillsText.textContent = 'No skill interests found. Add some interests to see personalized recommendations.';
    noSkills.appendChild(noSkillsText);
    
    skillsGrid.appendChild(noSkills);
  }

  const profileActions = document.createElement('div');
  profileActions.className = 'profile-actions';

  const modifyBtn = document.createElement('button');
  modifyBtn.className = 'modify-interest-btn';
  modifyBtn.textContent = 'Modify Interest';
  profileActions.appendChild(modifyBtn);

  skillsSection.appendChild(sectionTitle);
  skillsSection.appendChild(sectionDescription);
  skillsSection.appendChild(skillsGrid);
  skillsSection.appendChild(profileActions);

  const profileFooter = document.createElement('div');
  profileFooter.className = 'profile-footer';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-changes-btn';
  saveBtn.textContent = 'Save Changes';
  profileFooter.appendChild(saveBtn);

  container.appendChild(profileHeader);
  container.appendChild(userInfoSection);
  container.appendChild(skillsSection);
  container.appendChild(profileFooter);

  return container;
}

// Generate skill selection HTML using createElement
function generateSkillSelectionHTML(availableSkills) {
  const container = document.createElement('div');
  container.className = 'skill-selection-container';

  const sectionTitle = document.createElement('h2');
  sectionTitle.className = 'section-title';
  sectionTitle.textContent = 'Your Areas of Interest';

  const sectionDescription = document.createElement('p');
  sectionDescription.className = 'section-description';
  sectionDescription.textContent = 'Select areas of interest. You will see recommendations based on your interest.';

  const skillsGrid = document.createElement('div');
  skillsGrid.className = 'skills-grid';

  availableSkills.forEach(skill => {
    const skillItem = document.createElement('div');
    skillItem.className = 'skill-selection-item';
    skillItem.dataset.skillId = skill.id;

    const skillName = document.createElement('span');
    skillName.className = 'skill-name';
    skillName.textContent = skill.name;

    skillItem.appendChild(skillName);
    skillsGrid.appendChild(skillItem);
  });

  const skillSelectionActions = document.createElement('div');
  skillSelectionActions.className = 'skill-selection-actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'add-interest-btn';
  addBtn.textContent = 'Add Interest';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-selection-btn';
  cancelBtn.textContent = 'Cancel';

  skillSelectionActions.appendChild(addBtn);
  skillSelectionActions.appendChild(cancelBtn);

  container.appendChild(sectionTitle);
  container.appendChild(sectionDescription);
  container.appendChild(skillsGrid);
  container.appendChild(skillSelectionActions);

  return container;
}

// Handle modify interest button click
async function handleModifyInterest(block) {
  try {
    const skillsSection = block.querySelector('.skills-section');
    skillsSection.innerHTML = '<div class="loading">Loading available skills...</div>';

    const userId = block.dataset.userId;
    const currentSkillInterests = await fetchUserSkillInterests(userId);
    const allSkills = await fetchAllSkills();
    
    if (!allSkills || allSkills.length === 0) {
      skillsSection.innerHTML = '<div class="error">Failed to load available skills.</div>';
      return;
    }

    const currentSkillIds = new Set();
    if (currentSkillInterests && currentSkillInterests.data) {
      currentSkillInterests.data.forEach(interest => {
        const skillId = interest.relationships?.skill?.data?.id;
        if (skillId) {
          currentSkillIds.add(skillId);
        }
      });
    }

    const availableSkills = allSkills
      .filter(skill => !currentSkillIds.has(skill.id))
      .map(skill => ({
        id: skill.id,
        name: skill.attributes?.name || 'Unknown Skill'
      }));

    const selectionHTML = generateSkillSelectionHTML(availableSkills);
    skillsSection.innerHTML = '';
    skillsSection.appendChild(selectionHTML);

    setupSkillSelectionListeners(skillsSection, block);

  } catch (error) {
    console.error('Error in modify interest:', error);
    const skillsSection = block.querySelector('.skills-section');
    skillsSection.innerHTML = '<div class="error">Failed to load skills for modification.</div>';
  }
}

// Handle save changes button click
async function handleSaveChanges(block) {
  try {
    const userId = block.dataset.userId;
    const saveBtn = block.querySelector('.save-changes-btn');
    
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    const profileData = {};
    await updateUserProfile(userId, profileData);
    
    saveBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Error saving profile changes:', error);
    const saveBtn = block.querySelector('.save-changes-btn');
    saveBtn.textContent = 'Save Changes';
    saveBtn.disabled = false;
  }
}

// Handle change image button click
function handleChangeImage() {
  // Placeholder for image upload functionality
  alert('Image upload functionality would go here');
}

// Handle delete skill button click
async function handleDeleteSkill(skillInterestId, skillElement, userId) {
  try {
    const confirmDelete = confirm('Are you sure you want to remove this skill from your interests?');
    if (!confirmDelete) {
      return;
    }

    skillElement.classList.add('deleting');
    const success = await deleteSkillInterest(userId, skillInterestId);
    
    if (success) {
      skillElement.remove();
    } else {
      skillElement.classList.remove('deleting');
      alert('Failed to remove skill. Please try again.');
    }

  } catch (error) {
    console.error('Error deleting skill:', error);
    skillElement.classList.remove('deleting');
    alert('Failed to remove skill. Please try again.');
  }
}

// Setup skill selection event listeners
function setupSkillSelectionListeners(skillsSection, block) {
  const addInterestBtn = skillsSection.querySelector('.add-interest-btn');
  const cancelBtn = skillsSection.querySelector('.cancel-selection-btn');
  const skillItems = skillsSection.querySelectorAll('.skill-selection-item');

  skillItems.forEach(item => {
    addManagedListener(item, 'click', () => {
      item.classList.toggle('selected');
      
      const selectedSkills = skillsSection.querySelectorAll('.skill-selection-item.selected');
      if (addInterestBtn) {
        addInterestBtn.disabled = selectedSkills.length === 0;
        addInterestBtn.textContent = selectedSkills.length > 0 
          ? `Add Interest (${selectedSkills.length})` 
          : 'Add Interest';
      }
    });
  });

  if (addInterestBtn) {
    addManagedListener(addInterestBtn, 'click', async () => {
      const selectedSkills = skillsSection.querySelectorAll('.skill-selection-item.selected');
      const selectedSkillIds = Array.from(selectedSkills).map(item => item.dataset.skillId);
      
      if (selectedSkillIds.length > 0) {
        await handleAddSkillInterests(selectedSkillIds, block);
      }
    });
  }

  if (cancelBtn) {
    addManagedListener(cancelBtn, 'click', async () => {
      await reloadProfileView(block);
    });
  }
}

// Handle adding skill interests
async function handleAddSkillInterests(skillIds, block) {
  try {
    const userId = block.dataset.userId;
    const skillsSection = block.querySelector('.skills-section');
    
    skillsSection.innerHTML = '<div class="loading">Adding skill interests...</div>';
    await addSkillInterests(userId, skillIds);
    await reloadProfileView(block);
    
  } catch (error) {
    console.error('Error adding skill interests:', error);
    await reloadProfileView(block);
  }
}

// Reload the profile view
async function reloadProfileView(block) {
  try {
    const userId = block.dataset.userId;
    const skillInterests = await fetchUserSkillInterests(userId);
    const userProfile = await fetchUserProfile();
    
    const profileHTML = generateProfileHTML(userProfile, skillInterests);
    block.innerHTML = '';
    block.appendChild(profileHTML);
    
    setupProfileEventListeners(block);
    
  } catch (error) {
    console.error('Error reloading profile view:', error);
    const skillsSection = block.querySelector('.skills-section');
    if (skillsSection) {
      skillsSection.innerHTML = '<div class="error">Failed to reload profile. Please refresh the page.</div>';
    }
  }
}

// Setup event listeners
function setupProfileEventListeners(block) {
  const modifyBtn = block.querySelector('.modify-interest-btn');
  const saveBtn = block.querySelector('.save-changes-btn');
  const changeImageBtn = block.querySelector('.change-image-btn');

  if (modifyBtn) {
    addManagedListener(modifyBtn, 'click', () => handleModifyInterest(block));
  }

  if (saveBtn) {
    addManagedListener(saveBtn, 'click', () => handleSaveChanges(block));
  }

  if (changeImageBtn) {
    addManagedListener(changeImageBtn, 'click', handleChangeImage);
  }

  const deleteButtons = block.querySelectorAll('.delete-skill-btn');
  deleteButtons.forEach(button => {
    addManagedListener(button, 'click', async (e) => {
      e.stopPropagation();
      const skillElement = button.closest('.skill-interest-item');
      const skillInterestId = skillElement.dataset.skillId;
      const userId = block.dataset.userId;
      
      await handleDeleteSkill(skillInterestId, skillElement, userId);
    });
  });

  const skillItems = block.querySelectorAll('.skill-interest-item');
  skillItems.forEach(item => {
    addManagedListener(item, 'mouseenter', () => {
      const tooltip = item.querySelector('.skill-tooltip');
      if (tooltip) {
        tooltip.classList.add('visible');
      }
    });

    addManagedListener(item, 'mouseleave', () => {
      const tooltip = item.querySelector('.skill-tooltip');
      if (tooltip) {
        tooltip.classList.remove('visible');
      }
    });
  });
}

// Main decorate function
export default async function decorate(block) {
  try {
    block.innerHTML = '<div class="loading">Loading profile...</div>';

    const userProfile = await fetchUserProfile();
    if (!userProfile) {
      showError(block, 'Failed to load profile. Please try again.', () => {
        decorate(block);
      });
      return;
    }

    const userId = userProfile.id;
    if (!userId) {
      block.innerHTML = '<div class="error">User ID not found.</div>';
      return;
    }

    const skillInterests = await fetchUserSkillInterests(userId);
    const profileHTML = generateProfileHTML(userProfile, skillInterests);
    block.innerHTML = '';
    block.appendChild(profileHTML);

    block.dataset.userId = userId;
    setupProfileEventListeners(block);

  } catch (error) {
    console.error('Error initializing profile block:', error);
    showError(block, 'An error occurred while loading the profile.', () => {
      decorate(block);
    });
  }
  
  // Return cleanup function
  return () => cleanupChildren(block);
}
