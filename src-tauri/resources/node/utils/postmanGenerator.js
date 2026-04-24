class PostmanGenerator {
  // =============================================================
  // COLLECTION
  // =============================================================

  static generateCollection(input = {}, collectionName = "Sample Service API Tests") {
    const resolvedCollectionName =
      input?.collectionName || collectionName || "Sample Service API Tests";

    const testCases = this.resolveTestCases(input);
    const grouped = this.groupByCategory(testCases);

    return {
      info: {
        name: resolvedCollectionName,
        description: "Postman collection generated from generic API test definitions",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: this.buildFolders(grouped),
      variable: [
        { key: "baseUrl", value: "https://api.example.com" },
        { key: "tenantId", value: "demo-tenant" },
        { key: "authToken", value: "" },
        { key: "correlationId", value: "" }
      ]
    };
  }

  // =============================================================
  // INPUT RESOLUTION
  // =============================================================

  static resolveTestCases(input) {
    // 1. Preferred: explicit testCases array
    if (Array.isArray(input?.testCases)) {
      return input.testCases
        .map((tc, index) => this.normalizeTestCase(tc, index))
        .filter(tc => this.isValidTestCase(tc));
    }

    // 2. Next: operations array
    if (Array.isArray(input?.operations)) {
      return this.operationsToTestCases(input.operations);
    }

    // 3. Fallback: recursive extraction for demo/flexible input
    const extracted = this.extractTestCases(input);
    if (extracted.length) {
      return extracted.map((tc, index) => this.normalizeTestCase(tc, index));
    }

    return [];
  }

  static normalizeTestCase(tc, index = 0) {
    if (!tc || typeof tc !== "object") return {};

    return {
      id: tc.id || `TC_${index + 1}`,
      name: tc.name || tc.title || `Test Case ${index + 1}`,
      category: tc.category || tc.type || "positive",
      method: (tc.method || "GET").toUpperCase(),
      path: tc.path || tc.endpoint || "/",
      description: tc.description || "",
      headers: tc.headers || {},
      query: tc.query || {},
      auth: tc.auth || { type: "bearer", tokenVar: "authToken" },
      expectedStatus: tc.expectedStatus ?? tc.expectedStatusCode ?? 200,
      requestBody: tc.requestBody ?? tc.body,
      bodyType: tc.bodyType || (tc.formData ? "form-data" : "json"),
      formData: tc.formData || []
    };
  }

  static extractTestCases(input) {
    if (Array.isArray(input)) {
      return input.filter(item => item && typeof item === "object");
    }

    if (!input || typeof input !== "object") {
      return [];
    }

    for (const value of Object.values(input)) {
      const found = this.extractTestCases(value);
      if (found.length) return found;
    }

    return [];
  }

  static isValidTestCase(tc) {
    return (
      tc &&
      typeof tc === "object" &&
      typeof tc.id === "string" &&
      typeof tc.name === "string" &&
      typeof tc.method === "string" &&
      typeof tc.path === "string"
    );
  }

  // =============================================================
  // OPERATIONS -> TEST CASES
  // =============================================================

  static operationsToTestCases(operations = []) {
    return operations
      .map((operation, index) => {
        const method = (operation.method || "GET").toUpperCase();
        const contentType = operation.request?.contentType;
        const isMultipart = contentType === "multipart/form-data";

        return {
          id: operation.id || `OP_${index + 1}`,
          name: operation.name || `Operation ${index + 1}`,
          category: operation.category || "positive",
          method,
          path: operation.path || "/",
          description: operation.description || "",
          headers: operation.headers || {},
          query: operation.query || {},
          auth: operation.auth || { type: "bearer", tokenVar: "authToken" },
          expectedStatus: operation.expectedStatus ?? 200,
          requestBody: isMultipart ? undefined : operation.request?.body,
          bodyType: isMultipart ? "form-data" : "json",
          formData: isMultipart ? (operation.request?.formData || []) : []
        };
      })
      .filter(tc => this.isValidTestCase(tc));
  }

  // =============================================================
  // GROUPING
  // =============================================================

  static groupByCategory(testCases) {
    return testCases.reduce((acc, tc) => {
      const key = (tc.category || "positive").toLowerCase();
      acc[key] = acc[key] || [];
      acc[key].push(tc);
      return acc;
    }, {});
  }

  static categoryLabel(category) {
    return {
      positive: "Positive Scenarios",
      negative: "Negative Scenarios",
      edge: "Edge Scenarios",
      regression: "Regression Scenarios"
    }[category] || category;
  }

  // =============================================================
  // FOLDERS
  // =============================================================

  static buildFolders(grouped) {
    return Object.entries(grouped)
      .filter(([, cases]) => Array.isArray(cases) && cases.length > 0)
      .map(([category, cases]) => ({
        name: this.categoryLabel(category),
        item: cases.map(tc => this.createRequestItem(tc))
      }));
  }

  // =============================================================
  // REQUEST ITEM
  // =============================================================

  static createRequestItem(tc) {
    const body = this.buildBody(tc);

    return {
      name: `${tc.id} - ${tc.name}`,
      request: {
        method: tc.method || "GET",
        description: tc.description || "",
        header: this.buildHeaders(tc),
        url: this.buildUrl(tc),
        ...(body ? { body } : {})
      },
      event: [
        this.buildPreRequestEvent(),
        this.buildTestEvent(tc)
      ]
    };
  }

  // =============================================================
  // URL
  // =============================================================

  static buildUrl(tc) {
    const normalizedPath = this.normalizePath(tc.path);
    const query = this.buildQueryParams(tc.query);

    return {
      raw: this.buildRawUrl(normalizedPath, query),
      host: ["{{baseUrl}}"],
      path: normalizedPath.split("/").filter(Boolean),
      query
    };
  }

  static buildRawUrl(path, query = []) {
    const base = `{{baseUrl}}${path}`;
    if (!query.length) return base;

    const queryString = query
      .map(param => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`)
      .join("&");

    return `${base}?${queryString}`;
  }

  static normalizePath(path = "") {
    const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
    return withLeadingSlash.replace(/\{(\w+)\}/g, "{{$1}}");
  }

  static buildQueryParams(query = {}) {
    return Object.entries(query).map(([key, value]) => ({
      key,
      value: String(value)
    }));
  }

  // =============================================================
  // HEADERS
  // =============================================================

  static buildHeaders(tc) {
    const headers = new Map();

    headers.set("Accept", "application/json");
    headers.set("x-tenant-id", "{{tenantId}}");
    headers.set("x-correlation-id", "{{correlationId}}");

    if (tc.bodyType === "json" && tc.requestBody !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (tc.auth?.type === "bearer") {
      headers.set(
        "Authorization",
        `Bearer {{${tc.auth.tokenVar || "authToken"}}}`
      );
    }

    if (tc.headers && typeof tc.headers === "object") {
      Object.entries(tc.headers).forEach(([key, value]) => {
        headers.set(key, String(value));
      });
    }

    return Array.from(headers.entries()).map(([key, value]) => ({
      key,
      value
    }));
  }

  // =============================================================
  // BODY
  // =============================================================

  static buildBody(tc) {
    if (tc.bodyType === "form-data") {
      return {
        mode: "formdata",
        formdata: (tc.formData || []).map(field => ({
          key: field.key,
          value: field.value,
          type: field.type || "text",
          ...(field.src ? { src: field.src } : {})
        }))
      };
    }

    if (tc.requestBody !== undefined) {
      return {
        mode: "raw",
        raw: JSON.stringify(tc.requestBody, null, 2),
        options: {
          raw: {
            language: "json"
          }
        }
      };
    }

    return undefined;
  }

  // =============================================================
  // EVENTS
  // =============================================================

  static buildPreRequestEvent() {
    return {
      listen: "prerequest",
      script: {
        type: "text/javascript",
        exec: [
          "pm.environment.set('correlationId', pm.variables.replaceIn('{{$guid}}'));"
        ]
      }
    };
  }

  static buildTestEvent(tc) {
    return {
      listen: "test",
      script: {
        type: "text/javascript",
        exec: this.buildTests(tc)
      }
    };
  }

  static buildTests(tc) {
    const expectedStatus = tc.expectedStatus ?? 200;
    const tests = [
      `pm.test("Status code is ${expectedStatus}", function () {`,
      `  pm.response.to.have.status(${expectedStatus});`,
      `});`,
      `pm.test("Response is present", function () {`,
      `  pm.expect(pm.response).to.exist;`,
      `});`
    ];

    if ((tc.method || "GET").toUpperCase() !== "GET") {
      tests.push(
        `pm.test("Response body is not empty", function () {`,
        `  pm.expect(pm.response.text()).to.not.be.empty;`,
        `});`
      );
    }

    return tests;
  }

  // =============================================================
  // ENVIRONMENT
  // =============================================================

  static generateEnvironment(name = "Sample Service Local") {
    return {
      name,
      values: [
        { key: "baseUrl", value: "https://api.example.com", enabled: true },
        { key: "tenantId", value: "demo-tenant", enabled: true },
        { key: "authToken", value: "", enabled: true },
        { key: "correlationId", value: "", enabled: true }
      ]
    };
  }
}

module.exports = PostmanGenerator;