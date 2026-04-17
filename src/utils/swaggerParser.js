class SwaggerParser {
  constructor(swagger) {
    if (!swagger) {
      throw new Error('Swagger specification is required');
    }
    this.swagger = swagger;
    this.paths = swagger.paths || {};
    this.definitions = swagger.definitions || swagger.components?.schemas || {};
  }

  // Validate Swagger structure (supports both Swagger 2.0 and OpenAPI 3.0)
  validate() {
    // Check for either Swagger 2.0 or OpenAPI 3.0 version field
    if (!this.swagger.swagger && !this.swagger.openapi) {
      throw new Error('Invalid Swagger/OpenAPI: missing swagger or openapi version field');
    }
    
    // Check for required fields
    if (!this.swagger.info) {
      throw new Error('Invalid Swagger/OpenAPI: missing info field');
    }
    
    if (!this.swagger.paths) {
      throw new Error('Invalid Swagger/OpenAPI: missing paths field');
    }
    
    return true;
  }

  // Extract all endpoints
  getEndpoints() {
    return Object.entries(this.paths).map(([path, methods]) => ({
      path,
      methods: Object.keys(methods).filter(m => 
        ['get', 'post', 'put', 'delete', 'patch'].includes(m)
      )
    }));
  }

  // Get specific endpoint details
  getEndpointDetails(path, method) {
    const endpoint = this.paths[path]?.[method.toLowerCase()];
    if (!endpoint) return null;
    
    return {
      summary: endpoint.summary,
      description: endpoint.description,
      parameters: endpoint.parameters || [],
      requestBody: endpoint.requestBody,
      responses: endpoint.responses || {}
    };
  }

  // Get model schema for request/response validation
  getSchema(schemaName) {
    return this.definitions[schemaName];
  }

  parse() {
    this.validate();
    return this.swagger;
  }
}

module.exports = SwaggerParser;