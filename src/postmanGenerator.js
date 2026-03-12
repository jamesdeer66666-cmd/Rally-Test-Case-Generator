class PostmanGenerator {
  static generateCollection(requestsData, collectionName = 'Rally API Tests') {
    return {
      info: {
        name: collectionName,
        description: 'Generated from Rally acceptance criteria using AI',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: requestsData.map(req => this.createRequest(req)),
      variable: []
    };
  }

  static createRequest(requestData) {
    return {
      name: requestData.name || 'API Request',
      request: {
        method: requestData.method || 'GET',
        header: requestData.headers || [
          {
            key: 'Content-Type',
            value: 'application/json',
            type: 'text'
          }
        ],
        body: requestData.body ? {
          mode: 'raw',
          raw: typeof requestData.body === 'string' ? requestData.body : JSON.stringify(requestData.body),
          options: {
            raw: {
              language: 'json'
            }
          }
        } : undefined,
        url: {
          raw: requestData.url || '{{baseUrl}}/api/endpoint',
          protocol: 'https',
          host: requestData.host ? requestData.host.split('.') : ['{{baseUrl}}', 'com'],
          path: requestData.path || ['api', 'endpoint']
        }
      },
      response: [],
      event: [
        {
          listen: 'test',
          script: {
            exec: [
              `pm.test("Status code is ${requestData.expectedStatus || 200}", function () {`,
              `    pm.response.to.have.status(${requestData.expectedStatus || 200});`,
              `});`,
              requestData.assertions && requestData.assertions.length > 0
                ? requestData.assertions.join('\n')
                : ''
            ].filter(s => s).join('\n')
          }
        }
      ]
    };
  }

  static parseRequestsFromText(text) {
    // Parse AI-generated Postman request text into structured objects
    const requests = [];
    
    // Try to extract JSON if it's formatted as JSON
    try {
      const jsonMatches = text.match(/\[[\s\S]*\]/);
      if (jsonMatches) {
        return JSON.parse(jsonMatches[0]);
      }
    } catch (e) {
      // Continue with text parsing
    }

    // Parse text format
    const requestBlocks = text.split(/Request \d+|POST|GET|PUT|DELETE|PATCH/i);
    
    for (let block of requestBlocks) {
      if (block.trim().length === 0) continue;

      const request = {
        name: '',
        method: 'GET',
        url: '',
        headers: [],
        body: null,
        expectedStatus: 200,
        assertions: []
      };

      // Extract name
      const nameMatch = block.match(/name[:\s]*['"]*(.+?)['"]*/i);
      if (nameMatch) request.name = nameMatch[1].trim();

      // Extract method
      const methodMatch = block.match(/method[:\s]*(GET|POST|PUT|DELETE|PATCH)/i);
      if (methodMatch) request.method = methodMatch[1].trim();

      // Extract URL
      const urlMatch = block.match(/url[:\s]*['"]*(.+?)['"]*/i);
      if (urlMatch) request.url = urlMatch[1].trim();

      // Extract expected status
      const statusMatch = block.match(/status[:\s]*(\d{3})/i);
      if (statusMatch) request.expectedStatus = parseInt(statusMatch[1]);

      if (request.name || request.url) {
        requests.push(request);
      }
    }

    return requests;
  }
}

module.exports = PostmanGenerator;
