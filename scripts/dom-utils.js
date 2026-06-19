/**
 * DOM Utilities
 * Helper functions for DOM manipulation, cleanup, and accessibility
 */

/**
 * Create an AbortController for cleanup
 * Store it on the element for later cleanup
 * @param {HTMLElement} element - Element to attach controller to
 * @returns {AbortController} - New AbortController
 */
export function createAbortController(element) {
  if (!element._abortControllers) {
    element._abortControllers = [];
  }
  
  const controller = new AbortController();
  element._abortControllers.push(controller);
  return controller;
}

/**
 * Add event listener with automatic cleanup
 * @param {HTMLElement} element - Element to attach listener to
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {Object} options - Event listener options
 */
export function addManagedListener(element, event, handler, options = {}) {
  const controller = createAbortController(element);
  
  element.addEventListener(event, handler, {
    ...options,
    signal: controller.signal,
  });
}

/**
 * Cleanup all event listeners on an element
 * @param {HTMLElement} element - Element to cleanup
 */
export function cleanupElement(element) {
  if (element._abortControllers) {
    element._abortControllers.forEach(controller => controller.abort());
    element._abortControllers = [];
  }
}

/**
 * Cleanup all children of an element
 * @param {HTMLElement} container - Container element
 */
export function cleanupChildren(container) {
  if (!container) return;
  
  const elements = container.querySelectorAll('*');
  elements.forEach(element => cleanupElement(element));
  cleanupElement(container);
}

/**
 * Create element with proper accessibility attributes
 * @param {string} tag - HTML tag name
 * @param {Object} options - Element options
 * @returns {HTMLElement} - Created element
 */
export function createAccessibleElement(tag, options = {}) {
  const element = document.createElement(tag);
  
  if (options.className) {
    element.className = options.className;
  }
  
  if (options.text) {
    element.textContent = options.text;
  }
  
  if (options.html) {
    element.innerHTML = options.html;
  }
  
  if (options.ariaLabel) {
    element.setAttribute('aria-label', options.ariaLabel);
  }
  
  if (options.role) {
    element.setAttribute('role', options.role);
  }
  
  if (options.tabIndex !== undefined) {
    element.tabIndex = options.tabIndex;
  }
  
  if (options.id) {
    element.id = options.id;
  }
  
  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      element.dataset[key] = value;
    });
  }
  
  return element;
}

/**
 * Create button with loading state management
 * @param {Object} options - Button options
 * @returns {Object} - Button element and control methods
 */
export function createLoadingButton(options = {}) {
  const button = createAccessibleElement('button', {
    className: options.className || 'button',
    text: options.text || 'Submit',
    ariaLabel: options.ariaLabel,
  });
  
  if (options.type) {
    button.type = options.type;
  }
  
  let originalContent = button.innerHTML;
  
  return {
    element: button,
    
    setLoading(isLoading) {
      if (isLoading) {
        originalContent = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;">
            <circle cx="12" cy="12" r="10" stroke="#E0E0E0" stroke-width="2" fill="none"/>
            <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </path>
          </svg>
          <span style="margin-left: 8px;">${options.loadingText || 'Loading...'}</span>
        `;
      } else {
        button.disabled = false;
        button.innerHTML = originalContent;
      }
    },
    
    setText(text) {
      originalContent = text;
      if (!button.disabled) {
        button.textContent = text;
      }
    },
    
    setDisabled(disabled) {
      button.disabled = disabled;
    },
  };
}

/**
 * Show loading overlay on container
 * @param {HTMLElement} container - Container element
 * @param {string} message - Loading message
 * @returns {Function} - Function to hide loading
 */
export function showLoading(container, message = 'Loading...') {
  const overlay = createAccessibleElement('div', {
    className: 'loading-overlay',
    role: 'status',
    ariaLabel: message,
  });
  
  overlay.innerHTML = `
    <div class="loading-spinner">
      <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#E0E0E0" stroke-width="2" fill="none"/>
        <path d="M12 2 A10 10 0 0 1 22 12" stroke="#0D66D0" stroke-width="2" fill="none" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
        </path>
      </svg>
      <p>${message}</p>
    </div>
  `;
  
  // Add styles if not already present
  if (!document.getElementById('loading-overlay-styles')) {
    const style = document.createElement('style');
    style.id = 'loading-overlay-styles';
    style.textContent = `
      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      
      .loading-spinner {
        text-align: center;
      }
      
      .loading-spinner p {
        margin-top: 16px;
        color: #333;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }
  
  container.style.position = 'relative';
  container.appendChild(overlay);
  
  return () => overlay.remove();
}

/**
 * Show error message in container
 * @param {HTMLElement} container - Container element
 * @param {string} message - Error message
 * @param {Function} onRetry - Retry callback
 */
export function showError(container, message, onRetry = null) {
  const errorDiv = createAccessibleElement('div', {
    className: 'error-message',
    role: 'alert',
  });
  
  errorDiv.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <p>${message}</p>
  `;
  
  if (onRetry) {
    const retryBtn = createAccessibleElement('button', {
      className: 'retry-button',
      text: 'Retry',
      ariaLabel: 'Retry loading',
    });
    
    addManagedListener(retryBtn, 'click', onRetry);
    errorDiv.appendChild(retryBtn);
  }
  
  // Add styles if not already present
  if (!document.getElementById('error-message-styles')) {
    const style = document.createElement('style');
    style.id = 'error-message-styles';
    style.textContent = `
      .error-message {
        padding: 20px;
        text-align: center;
        color: #d32f2f;
      }
      
      .error-message svg {
        display: block;
        margin: 0 auto 12px;
        color: #d32f2f;
      }
      
      .error-message p {
        margin: 0 0 16px;
      }
      
      .error-message .retry-button {
        background: #0D66D0;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .error-message .retry-button:hover {
        background: #0952a5;
      }
    `;
    document.head.appendChild(style);
  }
  
  container.innerHTML = '';
  container.appendChild(errorDiv);
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Trap focus within an element (for modals)
 * @param {HTMLElement} element - Element to trap focus in
 * @returns {Function} - Function to remove focus trap
 */
export function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  
  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  }
  
  element.addEventListener('keydown', handleKeyDown);
  
  // Focus first element
  if (firstFocusable) {
    firstFocusable.focus();
  }
  
  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}
