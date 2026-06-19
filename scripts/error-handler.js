/**
 * Global Error Handler
 * Provides centralized error handling and logging for the application
 */

// Error tracking service configuration (e.g., Sentry, DataDog, etc.)
const ERROR_TRACKING_ENABLED = false; // Set to true when error tracking service is configured

/**
 * Log error to tracking service
 * @param {Error} error - The error object
 * @param {Object} context - Additional context about the error
 */
function logToTrackingService(error, context = {}) {
  if (!ERROR_TRACKING_ENABLED) {
    return;
  }

  // TODO: Integrate with your error tracking service (Sentry, DataDog, etc.)
  // Example:
  // Sentry.captureException(error, { extra: context });
}

/**
 * Show user-friendly error message
 * @param {string} message - Error message to display
 */
function showUserErrorMessage(message) {
  // Create error notification
  const errorDiv = document.createElement('div');
  errorDiv.className = 'global-error-notification';
  errorDiv.setAttribute('role', 'alert');
  errorDiv.innerHTML = `
    <div class="error-content">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>${message}</span>
      <button class="close-btn" aria-label="Close">&times;</button>
    </div>
  `;

  // Add styles if not already present
  if (!document.getElementById('error-handler-styles')) {
    const style = document.createElement('style');
    style.id = 'error-handler-styles';
    style.textContent = `
      .global-error-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 400px;
        background: #f44336;
        color: white;
        padding: 16px;
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
      }
      
      .global-error-notification .error-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .global-error-notification svg {
        flex-shrink: 0;
      }
      
      .global-error-notification .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
        line-height: 1;
      }
      
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(errorDiv);

  // Auto-dismiss after 5 seconds
  const dismissTimer = setTimeout(() => {
    errorDiv.remove();
  }, 5000);

  // Close button handler
  errorDiv.querySelector('.close-btn').addEventListener('click', () => {
    clearTimeout(dismissTimer);
    errorDiv.remove();
  });
}

/**
 * Handle uncaught errors
 * @param {ErrorEvent} event - The error event
 */
function handleUncaughtError(event) {
  const { error, message, filename, lineno, colno } = event;

  // Log to console for debugging (in production, this could be disabled)
  console.error('Uncaught error:', {
    message,
    filename,
    lineno,
    colno,
    error
  });

  // Log to error tracking service
  logToTrackingService(error || new Error(message), {
    type: 'uncaught_error',
    filename,
    lineno,
    colno
  });

  // Show user-friendly message
  showUserErrorMessage('An unexpected error occurred. Please try again or refresh the page.');

  // Prevent default browser error handling
  event.preventDefault();
}

/**
 * Handle unhandled promise rejections
 * @param {PromiseRejectionEvent} event - The promise rejection event
 */
function handleUnhandledRejection(event) {
  const { reason, promise } = event;

  // Log to console for debugging
  console.error('Unhandled promise rejection:', reason);

  // Log to error tracking service
  logToTrackingService(
    reason instanceof Error ? reason : new Error(String(reason)),
    {
      type: 'unhandled_rejection',
      promise
    }
  );

  // Show user-friendly message for non-network errors
  if (!(reason instanceof Error) || !reason.message.includes('HTTP error')) {
    showUserErrorMessage('An error occurred while processing your request. Please try again.');
  }

  // Prevent default browser handling
  event.preventDefault();
}

/**
 * Initialize global error handlers
 */
export function initErrorHandlers() {
  // Handle uncaught errors
  window.addEventListener('error', handleUncaughtError);

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // Handle errors in async functions
  window.addEventListener('rejectionhandled', (event) => {
    console.info('Promise rejection was handled:', event.promise);
  });
}

/**
 * Manually report an error
 * @param {Error} error - The error to report
 * @param {Object} context - Additional context
 */
export function reportError(error, context = {}) {
  console.error('Reported error:', error, context);
  logToTrackingService(error, context);
}

/**
 * Create a safe async function wrapper that catches errors
 * @param {Function} fn - The async function to wrap
 * @param {string} errorMessage - User-friendly error message
 */
export function safeAsync(fn, errorMessage = 'An error occurred') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('Error in safe async:', error);
      logToTrackingService(error, { function: fn.name });
      showUserErrorMessage(errorMessage);
      throw error;
    }
  };
}

// Auto-initialize if not already initialized
if (typeof window !== 'undefined' && !window.__errorHandlersInitialized) {
  initErrorHandlers();
  window.__errorHandlersInitialized = true;
}
