
class PostmanGenerator {

  static generateCollection(requestsData, collectionName = 'Rally API Tests') {
    // ✅ Normalize AI output into an array
    const requestsArray =
      Array.isArray(requestsData)
        ? requestsData
        : Array.isArray(requestsData?.requests)
          ? requestsData.requests
          : Array.isArray(requestsData?.items)
            ? requestsData.items
            : [];

    return {
      info: {
        name: collectionName,
        description: 'Generated from acceptance criteria using AI',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: requestsArray.map(req => this.createRequest(req)),
      variable: []
    };
  }

  static createRequest(requestData) {
    return {
      name: requestData.name || 'API Request',
      request: {
        method: requestData.method || 'GET',
        header: [],
        url: {
          raw: requestData.endpoint || '/api/example',
          path: (requestData.endpoint || '/api/example')
            .split('/')
            .filter(Boolean)
        }
      },
      event: requestData.validations
        ? [{
            listen: 'test',
            script: {
              exec: requestData.validations.map(v =>
                v.type === 'status'
                  ? `pm.test("Status ${v.value}", () => pm.response.to.have.status(${v.value}));`
                  : ''
              )
            }
          }]
        : []
    };
  }
}

module.exports = PostmanGenerator;
