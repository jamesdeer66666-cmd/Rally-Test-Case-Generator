
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
    // your existing implementation
  }
}

module.exports = PostmanGenerator;
