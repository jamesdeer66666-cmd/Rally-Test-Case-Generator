class PostmanGenerator {

  // =============================================================
  // PUBLIC API
  // =============================================================

  static generateCollection(testCases = [], collectionName = "Rally API Tests") {
    // ✅ Normalize input defensively
    const casesArray = Array.isArray(testCases)
      ? testCases
      : [];

    // ✅ Group by test case type
    const grouped = {
      positive: [],
      negative: [],
      edge: []
    };

    casesArray.forEach(tc => {
      const type = (tc.type || "positive").toLowerCase();
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(tc);
    });

    const folders = [];

    if (grouped.positive.length) {
      folders.push(
        this.createFolder("✅ Positive Tests", grouped.positive)
      );
    }

    if (grouped.negative.length) {
      folders.push(
        this.createFolder("❌ Negative Tests", grouped.negative)
      );
    }

    if (grouped.edge.length) {
      folders.push(
        this.createFolder("⚠️ Edge Tests", grouped.edge)
      );
    }

    return {
      info: {
        name: collectionName,
        description:
          "Generated API test cases with validation scripts and environment support",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },

      item: folders,

      variable: [
        {
          key: "baseUrl",
          value: "https://api.example.com",
          type: "string"
        }
      ]
    };
  }

  // =============================================================
  // FOLDER PER TEST TYPE
  // =============================================================

  static createFolder(name, testCases) {
    return {
      name,
      item: testCases.map(tc => this.createRequestFromTestCase(tc))
    };
  }

  // =============================================================
  // ONE REQUEST PER TEST CASE
  // =============================================================

  static createRequestFromTestCase(tc) {
    const endpoint = tc.endpoint || "/api/example";
    const pathParts = endpoint.split("/").filter(Boolean);
    const method = tc.method || "GET";
    const expectedStatus = tc.expectedStatusCode || 200;

    return {
      name: `${tc.id} – ${tc.title}`,
      description:
        `Story-driven test case\n\nSteps:\n- ${tc.testSteps.join("\n- ")}\n\nExpected:\n${tc.expectedResult}`,

      request: {
        method,
        header: [
          { key: "Accept", value: "application/json" },
          { key: "Content-Type", value: "application/json" }
        ],

        url: {
          raw: `{{baseUrl}}${endpoint}`,
          host: ["{{baseUrl}}"],
          path: pathParts
        }
      },

      event: [
        {
          listen: "test",
          script: {
            type: "text/javascript",
            exec: this.generateTests(expectedStatus)
          }
        }
      ]
    };
  }

  // =============================================================
  // POSTMAN TEST SCRIPT GENERATION
  // =============================================================

  static generateTests(expectedStatus) {
    return [
      `pm.test("Status code is ${expectedStatus}", function () {`,
      `  pm.response.to.have.status(${expectedStatus});`,
      `});`,
      ``,
      `pm.test("Response time is under 1000ms", function () {`,
      `  pm.expect(pm.response.responseTime).to.be.below(1000);`,
      `});`,
      ``,
      `pm.test("Response is valid JSON", function () {`,
      `  pm.response.to.be.json;`,
      `});`,
      ``,
      `pm.test("Response matches basic schema", function () {`,
      `  const json = pm.response.json();`,
      `  pm.expect(json).to.be.an("object").or.to.be.an("array");`,
      `});`
    ];
  }

  // =============================================================
  // OPTIONAL: EXPORT ENVIRONMENT
  // =============================================================

  static generateEnvironment(name = "Rally API Environment") {
    return {
      name,
      values: [
        {
          key: "baseUrl",
          value: "https://api.example.com",
          enabled: true
        }
      ]
    };
  }
}

module.exports = PostmanGenerator;