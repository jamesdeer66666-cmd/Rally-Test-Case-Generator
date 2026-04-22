class PostmanGenerator {

  // =============================================================
  // COLLECTION
  // =============================================================

  static generateCollection(input = [], collectionName = "Rally API Tests") {
    const testCases =
  this.extractTestCases(input).length
    ? this.extractTestCases(input)
    : this.intentToTestCases(input);

    console.log("DEBUG input:", input);

    if (!testCases.length) {
      console.warn("PostmanGenerator: No valid test cases found");
    }

    const grouped = this.groupByType(testCases);

    return {
      info: {
        name: collectionName,
        description:
          "Enterprise-ready Postman collection generated from test cases",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: this.buildFolders(grouped),
      variable: [
        { key: "baseUrl", value: "https://api.example.com" },
        { key: "authToken", value: "" },
        { key: "uuid", value: "" }
      ]
    };
  }
// =============================================================
// Intent to Test Cases
// =============================================================

static intentToTestCases(input) {
  if (!input?.intents || !Array.isArray(input.intents)) return [];

  return input.intents.map((intent, index) => {
    const isUpload = intent.endpoint?.includes("uploadImage");

    return {
      id: `INTENT_${index + 1}`,
      title: intent.name || "Untitled Intent",
      type: "positive",
      method: isUpload ? "POST" : intent.method || "GET",
      endpoint: intent.endpoint,
      bodyType: isUpload ? "form-data" : undefined,
      formData: isUpload
        ? [
            { key: "file", type: "file", src: "pet.jpg" },
            { key: "additionalMetadata", value: "test upload" }
          ]
        : undefined,
      expectedStatusCode: 200
    };
  });
}
  // =============================================================
  // EXTRACT VALID TEST CASES (CRITICAL)
  // =============================================================

  static extractTestCases(input) {
  // ✅ if we hit an array, validate its contents
  if (Array.isArray(input)) {
    const valid = input.filter(tc => this.isValidTestCase(tc));
    return valid.length ? valid : [];
  }

  // ❌ nothing to scan
  if (!input || typeof input !== "object") {
    return [];
  }

  // ✅ recursively walk objects
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
    typeof tc.method === "string" &&
    typeof tc.endpoint === "string"
  );
}

// =============================================================
// Expand Intents into Test Cases (for backward compatibility) 
// =============================================================
static expandIntentIntoTestCases(intent, index) {
  const base = {
    endpoint: intent.endpoint,
    method: intent.method
  };

  const positives = [{
    ...base,
    id: `INTENT_${index}_POS`,
    title: `${intent.name} – valid`,
    type: "positive",
    expectedStatusCode: 200
  }];

  const negatives = (intent.validations || []).map((v, i) => ({
    ...base,
    id: `INTENT_${index}_NEG_${i + 1}`,
    title: `${intent.name} – ${v}`,
    type: "negative",
    expectedStatusCode: 400
  }));

  return [...positives, ...negatives];
}
  // =============================================================
  // GROUPING
  // =============================================================

  static groupByType(cases) {
    if (!Array.isArray(cases)) {
      throw new TypeError(
        `PostmanGenerator expected testCases array, got ${typeof cases}`
      );
    }

    return cases.reduce((acc, tc) => {
      const type = (tc.type || "positive").toLowerCase();
      acc[type] = acc[type] || [];
      acc[type].push(tc);
      return acc;
    }, {});
  }

  // =============================================================
  // FOLDERS
  // =============================================================

  static buildFolders(grouped) {
    return Object.entries(grouped)
      .filter(([, cases]) => cases.length)
      .map(([type, cases]) => ({
        name: this.typeLabel(type),
        item: cases.map(tc => this.createRequest(tc))
      }));
  }

  static typeLabel(type) {
    return {
      positive: "✅ Positive Tests",
      negative: "❌ Negative Tests",
      edge: "⚠️ Edge Tests"
    }[type] || type;
  }

  // =============================================================
  // REQUEST
  // =============================================================

  static createRequest(tc) {
    const id = tc.id;
    const title = tc.title || "Untitled Test";
    const endpoint = tc.endpoint;
    const method = tc.method || "GET";

    return {
      name: `${id} – ${title}`,
      request: {
        method,
        header: this.buildHeaders(tc),
        body: this.buildBody(tc),
        url: this.buildUrl({ ...tc, endpoint })
      },
      event: [
        this.preRequestEvent(),
        this.testEvent(tc)
      ]
    };
  }

  // =============================================================
  // URL + QUERY
  // =============================================================

  static buildUrl(tc) {
    const endpoint = this.normalizeEndpoint(tc.endpoint);
    const path = endpoint.split("/").filter(Boolean);

    const query = tc.query
      ? Object.entries(tc.query).map(([k, v]) => ({
          key: k,
          value: String(v)
        }))
      : [];

    return {
      raw: `{{baseUrl}}${endpoint}`,
      host: ["{{baseUrl}}"],
      path,
      query
    };
  }

  static normalizeEndpoint(endpoint = "") {
    // OpenAPI {id} → Postman {{id}}
    return endpoint.replace(/\{(\w+)\}/g, "{{$1}}");
  }

  // =============================================================
  // HEADERS + AUTH (DEDUPLICATED)
  // =============================================================

  static buildHeaders(tc) {
    const headers = new Map([
      ["Accept", "application/json"],
      ["Content-Type", "application/json"]
    ]);

    if (tc.auth?.type === "bearer") {
      headers.set(
        "Authorization",
        `Bearer {{${tc.auth.tokenVar || "authToken"}}}`
      );
    }

    if (tc.headers) {
      Object.entries(tc.headers).forEach(([k, v]) => {
        headers.set(k, v);
      });
    }

    return Array.from(headers, ([key, value]) => ({ key, value }));
  }

  // =============================================================
  // BODY (JSON + MULTIPART)
  // =============================================================

  static buildBody(tc) {
    if (tc.bodyType === "form-data") {
      return {
        mode: "formdata",
        formdata: tc.formData || []
      };
    }

    if (tc.body) {
      return {
        mode: "raw",
        raw: JSON.stringify(tc.body, null, 2),
        options: { raw: { language: "json" } }
      };
    }
  }

  // =============================================================
  // PRE-REQUEST SCRIPT
  // =============================================================

  static preRequestEvent() {
    return {
      listen: "prerequest",
      script: {
        type: "text/javascript",
        exec: [
          `pm.environment.set("uuid", pm.variables.replaceIn("{{$guid}}"));`
        ]
      }
    };
  }

  // =============================================================
  // TEST SCRIPT
  // =============================================================

  static testEvent(tc) {
    return {
      listen: "test",
      script: {
        type: "text/javascript",
        exec: this.generateTests(tc)
      }
    };
  }

  static generateTests(tc) {
    const expectedStatus = tc.expectedStatusCode ?? 200;
    const method = tc.method ?? "GET";

    const tests = [
      `pm.test("Status ${expectedStatus}", () => {`,
      `  pm.response.to.have.status(${expectedStatus});`,
      `});`,
      `pm.test("Valid JSON", () => pm.response.to.be.json);`
    ];

    if (method !== "GET") {
      tests.push(
        `pm.test("Response has body", () => {`,
        `  pm.expect(pm.response.text()).to.not.be.empty;`,
        `});`
      );
    }

    return tests;
  }

  // =============================================================
  // ENVIRONMENT
  // =============================================================

  static generateEnvironment(name = "Rally API Env") {
    return {
      name,
      values: [
        { key: "baseUrl", value: "https://api.example.com", enabled: true },
        { key: "authToken", value: "", enabled: true }
      ]
    };
  }
}

module.exports = PostmanGenerator;