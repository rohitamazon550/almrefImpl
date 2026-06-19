/*
* <license header>
*/

/**
 * Adobe Learning Manager (ALM) Authentication Module
 */

const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils');
const { Core } = require('@adobe/aio-sdk');
const { init: initState } = require('@adobe/aio-lib-state');

// Configuration constants
const ALM_API_BASE = 'https://learningmanager.adobe.com';
const AUTH_ENDPOINTS = {
  TOKEN: `${ALM_API_BASE}/oauth/token`,
  REFRESH: `${ALM_API_BASE}/oauth/token/refresh`
};

/**
 * Validates authentication parameters and credentials
 */
function validateAuthParams(params, logger) {
  const requiredParams = [];
  const requiredHeaders = [];
  const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders);
  if (errorMessage) {
    return errorResponse(400, errorMessage, logger);
  }

  const { code } = params;
  if (code) {
    const clientId = params.ALM_CLIENT_ID;
    const clientSecret = params.ALM_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error('Missing ALM_CLIENT_ID or ALM_CLIENT_SECRET environment variables');
      return errorResponse(
        400,
        'Missing required environment variables: ALM_CLIENT_ID, ALM_CLIENT_SECRET',
        logger
      );
    }
  }

  return null;
}

/**
 * Prepares authentication request parameters based on the flow type
 */
function prepareAuthRequest(params) {
  const { code } = params;
  const formData = new URLSearchParams();
  let clientId, clientSecret, endpoint;

  if (code) {
    clientId = params.ALM_CLIENT_ID;
    clientSecret = params.ALM_CLIENT_SECRET;
    endpoint = AUTH_ENDPOINTS.TOKEN;

    formData.append('redirect_uri', params.redirect_uri);
    formData.append('code', code);
    formData.append('grant_type', 'authorization_code');
  } else {
    clientId = params.ALM_ADMIN_CLIENT_ID;
    clientSecret = params.ALM_ADMIN_CLIENT_SECRET;
    endpoint = AUTH_ENDPOINTS.REFRESH;

    formData.append('refresh_token', params.ALM_ADMIN_REFRESH_TOKEN);
  }

  formData.append('client_id', clientId);
  formData.append('client_secret', clientSecret);

  return { endpoint, formData };
}

/**
 * Makes an OAuth token request to Adobe Learning Manager
 */
async function makeTokenRequest(endpoint, formData, logger) {
  logger.info(`Making POST request to ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`API request failed with status ${response.status}: ${errorText}`);
      return { error: errorResponse(response.status, `API request failed: ${errorText}`, logger) };
    }

    const responseData = await response.json();
    logger.info('Successfully retrieved OAuth token from Adobe Learning Manager');

    return { data: responseData };
  } catch (error) {
    logger.error(`Network or server error: ${error.message}`);
    return { error: errorResponse(500, 'server error', logger) };
  }
}

/**
 * Main function executed by Adobe I/O Runtime
 */
async function main(params) {
  const logger = Core.Logger('alm-authentication', { level: params.LOG_LEVEL || 'info' });

  try {
    logger.info('Calling the ALM login action');

    if (params) logger.info(stringParameters(params));

    const validationError = validateAuthParams(params, logger);
    if (validationError) return validationError;

    const state = await initState();

    const { endpoint, formData } = prepareAuthRequest(params);
    const isAdminFlow = !params.code;

    const { data, error } = await makeTokenRequest(endpoint, formData, logger);
    if (error) return error;

    // Store admin token here (if needed)
    // if (isAdminFlow && data.access_token) {
    //   await state.put('alm_admin_access_token', data.access_token);
    // }

    const responseObject = {
      statusCode: 200,
      body: data
    };

    logger.info(`${responseObject.statusCode}: successful request`);
    return responseObject;

  } catch (error) {
    logger.error(error);
    return errorResponse(500, 'server error', logger);
  }
}

exports.main = main;
