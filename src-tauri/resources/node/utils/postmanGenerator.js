class PostmanGenerator {

  static generateCollection(requestsData, collectionName = 'Rally API Tests') {
    return {
      info: {
        name: collectionName,
        description: 'Generated from Rally acceptance criteria using AI',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: requestsData.map(req => this.createRequest(req)),
      variable: [
        { key: "baseUrl", value: "https://example.com" },
        { key: "token", value: "" }
      ]
    };
  }

  static buildUrl(endpoint) {
    const url = new URL(`https://example.com${endpoint}`);

    return {
      raw: `{{baseUrl}}${endpoint}`,
      host: ["{{baseUrl}}"],
      path: url.pathname.split('/').filter(Boolean),
      query: [...url.searchParams.entries()].map(([key, value]) => ({
        key,
        value
      }))
    };
  }

  static buildScripts(validations) {
    const scripts = [];

    validations.forEach(v => {

      if (v.type === 'status') {
        scripts.push(
          `pm.test('Status ${v.value}', function () {`,
          `  pm.response.to.have.status(${v.value});`,
          `});`,
          ``
        );
      }

      if (v.type === 'exists') {
        scripts.push(
          `pm.test('${v.field} exists', function () {`,
          `  const jsonData = pm.response.json();`,
          `  pm.expect(_.get(jsonData, '${v.field}')).to.exist;`,
          `});`,
          ``
        );
      }

      if (v.type === 'notEmpty') {
        scripts.push(
          `pm.test('${v.field} not empty', function () {`,
          `  const jsonData = pm.response.json();`,
          `  const val = _.get(jsonData, '${v.field}');`,
          `  pm.expect(val).to.be.an('array').that.is.not.empty;`,
          `});`,
          ``
        );
      }
    });

    return scripts;
  }

  static createRequest(requestData) {
    const endpoint = requestData.endpoint || "/api/test";
    const method = requestData.method || "GET";

    const headers = [
      { key: "Authorization", value: "Bearer {{token}}" }
    ];

    if (method !== "GET") {
      headers.push({ key: "Content-Type", value: "application/json" });
    }

    const request = {
      method,
      header: headers,
      url: this.buildUrl(endpoint)
    };

    if (method !== "GET" && requestData.body) {
      request.body = {
        mode: "raw",
        raw: typeof requestData.body === "string"
          ? requestData.body
          : JSON.stringify(requestData.body, null, 2),
        options: {
          raw: { language: "json" }
        }
      };
    }

    return {
      name: requestData.name || "API Request",
      request,
      response: [],
      event: [
        {
          listen: "test",
          script: {
            exec: this.buildScripts(requestData.validations || [])
          }
        }
      ]
    };
  }

  // Legacy fallback parser for unstructured AI output
  static parseRequestsFromText(text) {
    try {
      const jsonMatches = text.match(/\[[\s\S]*\]/);
      if (jsonMatches) {
        return JSON.parse(jsonMatches[0]);
      }
    } catch {}

    return [];
  }
}

module.exports = PostmanGenerator;