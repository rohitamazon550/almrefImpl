# ALM Course Viewer Demo - BYOM Style

A demonstration Adobe I/O Runtime action that fetches and displays Adobe Learning Manager (ALM) course data using a BYOM (Bring Your Own Model) architecture with embedded Handlebars-style templates.

## Architecture Overview

This demo follows best practices for serverless actions and template rendering:

- **Modular Design**: Separated concerns across multiple files
- **Security**: Input validation and HTML escaping
- **Error Handling**: Comprehensive error boundaries with proper logging
- **Performance**: Embedded templates for webpack compatibility
- **Maintainability**: Clean code structure with JSDoc documentation

## File Structure

```
actions/demo/course-viewer/
├── index.js          # Main action entry point
├── renderer.js       # Template rendering engine
├── helpers.js        # Utility functions and API calls
└── README.md         # This documentation
```

## Key Features

### Security Enhancements
- **Input Validation**: Course ID format validation with regex
- **HTML Escaping**: All user content is properly escaped to prevent XSS
- **Token Validation**: Comprehensive token extraction and validation
- **Error Boundaries**: Proper error handling with informative messages

### Performance Optimizations
- **Embedded Templates**: No external file dependencies for webpack compatibility
- **Efficient API Calls**: Smart fallback between course and learning program endpoints
- **Timeout Handling**: 30-second timeout for API requests
- **Structured Logging**: Efficient logging with structured data

### Code Quality
- **JSDoc Documentation**: Comprehensive function documentation
- **Separation of Concerns**: Clear separation between routing, rendering, and data fetching
- **Modular Functions**: Small, focused functions with single responsibilities
- **Error Propagation**: Proper error handling and propagation

## API Usage

### URL Parameters
```
GET /course-viewer/{courseId}?token=YOUR_ALM_ACCESS_TOKEN
```

### POST Body
```json
{
  "token": "YOUR_ALM_ACCESS_TOKEN"
}
```

### Response
Returns HTML content displaying:
- Course metadata (title, description, duration, etc.)
- Skills and tags
- Author information
- Instance details
- Raw API response for debugging

## Configuration

### Required Parameters
- `token` or `ALM_ACCESS_TOKEN`: Valid ALM access token

### Optional Parameters
- `LOG_LEVEL`: Logging level (default: 'info')

## Error Handling

The action handles various error scenarios:

1. **Missing Token**: Returns 400 with clear error message
2. **Invalid Course ID**: Returns 400 with validation error
3. **API Failures**: Attempts both course and learning program endpoints
4. **Network Timeouts**: 30-second timeout with proper error handling
5. **Data Processing Errors**: Safe defaults and graceful degradation

## Security Considerations

### Input Validation
- Course IDs are validated against regex pattern: `^[a-zA-Z0-9_-]+$`
- Maximum length limit of 50 characters
- All user content is HTML-escaped before rendering

### Token Handling
- Tokens are validated for presence and type
- Multiple token parameter sources supported
- Tokens are not logged for security

### Content Security
- HTML escaping prevents XSS attacks
- Safe property access prevents runtime errors
- Structured error responses avoid information leakage

## Development Best Practices

### Code Organization
- **Single Responsibility**: Each function has one clear purpose
- **Pure Functions**: Helper functions are stateless and predictable
- **Error First**: Consistent error handling patterns
- **Documentation**: Comprehensive JSDoc comments

### Performance Patterns
- **Early Returns**: Fail fast for invalid inputs
- **Efficient Loops**: Use native array methods for data processing
- **Memory Management**: Avoid large object creation in loops
- **Caching Ready**: Structure supports future caching implementation

### Maintainability
- **Consistent Naming**: Clear, descriptive function and variable names
- **Modular Structure**: Easy to test and modify individual components
- **Version Control Friendly**: Clean diffs and easy to review changes
- **Future Extensible**: Architecture supports additional templates and features

## Testing Recommendations

### Unit Tests
- Test input validation functions
- Test HTML escaping functionality
- Test data extraction helpers
- Mock API calls for consistent testing

### Integration Tests
- Test full request/response cycle
- Test error scenarios
- Test with real ALM API responses
- Test template rendering output

### Security Tests
- Test XSS prevention
- Test input validation edge cases
- Test error message information leakage
- Test token handling security

## Deployment Notes

### Dependencies
- `node-fetch`: For API calls
- `@adobe/aio-sdk`: For Adobe I/O Runtime integration

### Environment
- Compatible with Adobe I/O Runtime
- Webpack compatible (no external file dependencies)
- Node.js 14+ recommended

### Monitoring
- Structured logging for easy monitoring
- Error tracking with context
- Performance metrics in logs
- Request tracing support

## Future Enhancements

### Potential Improvements
1. **Caching**: Add response caching for better performance
2. **Templates**: Support for multiple template types
3. **Internationalization**: Multi-language support
4. **Analytics**: Usage tracking and metrics
5. **Rate Limiting**: API call rate limiting
6. **Batch Processing**: Support for multiple course IDs

### Architecture Evolution
- Consider moving to TypeScript for better type safety
- Add automated testing pipeline
- Implement response compression
- Add health check endpoints
- Consider GraphQL for more efficient data fetching

## Troubleshooting

### Common Issues
1. **Blank Page**: Check token validity and course ID format
2. **API Errors**: Verify ALM API endpoint accessibility
3. **Timeout Errors**: Check network connectivity and API response times
4. **Template Errors**: Verify all required data fields are present

### Debug Mode
Set `LOG_LEVEL=debug` for detailed logging output including:
- API request/response details
- Template rendering steps
- Data processing information
- Error stack traces
