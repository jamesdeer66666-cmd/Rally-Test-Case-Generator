require("dotenv").config({
  path: require("path").join(__dirname, ".env")
});

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");

const RallyClient = require("./rally");
const TestCaseGenerator = require("./testCaseGenerator");
const PostmanGenerator = require("./utils/postmanGenerator");
const SwaggerParser = require("./utils/swaggerParser");

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------------------------------
// Middleware
// -----------------------------------------------------
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// ✅ Rally client can be global (API‑scoped)
let rallyClient;

// -----------------------------------------------------
// Helper: create AI generator (request‑scoped)
// -----------------------------------------------------
function createTestCaseGenerator(body) {
  const { provider, apiKey } = body;

  if (!provider || !apiKey) {
    throw new Error("Missing AI provider or API key");
  }

  return new TestCaseGenerator(apiKey, provider);
}

// =====================================================
// HEALTH
// =====================================================
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Rally AI Test Case Generator is running"
  });
});

// =====================================================
// CONFIG VALIDATION (NO AI STATE CREATED)
// =====================================================
app.post("/api/config/validate", (req, res) => {
  console.log("📥 /api/config/validate payload:", JSON.stringify(req.body, null, 2));

  const {
    provider,
    apiKey,
    rallyApiKey,
    rallyWorkspaceUrl
  } = req.body;

  if (!provider || !apiKey) {
    return res.status(400).json({
      error: "Missing required AI configuration",
      provider,
      apiKeyPresent: !!apiKey
    });
  }

  // ✅ Rally setup (safe to keep global)
  if (rallyApiKey && rallyWorkspaceUrl) {
    rallyClient = new RallyClient(rallyApiKey, rallyWorkspaceUrl);
  }

  res.json({
    status: "configured",
    message: "Configuration validated successfully",
    aiProvider: provider
  });
});

// =====================================================
// RALLY ROUTES
// =====================================================
app.get("/api/rally/stories", async (req, res) => {
  try {
    if (!rallyClient) {
      return res.status(400).json({
        error: "Rally client not configured"
      });
    }

    const stories = await rallyClient.getUserStories();
    res.json({ stories: stories || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/rally/story/:formattedId", async (req, res) => {
  try {
    if (!rallyClient) {
      return res.status(400).json({
        error: "Rally client not configured"
      });
    }

    const criteria = await rallyClient.getAcceptanceCriteria(
      req.params.formattedId
    );

    res.json({ acceptanceCriteria: criteria });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// GENERATE TEST CASES (REQUEST‑SCOPED AI)
// =====================================================
app.post("/api/generate/testcases", async (req, res) => {
  try {
    const { acceptanceCriteria, storyName } = req.body;

    if (!acceptanceCriteria || !storyName) {
      return res.status(400).json({
        error: "Missing acceptanceCriteria or storyName"
      });
    }

    const generator = createTestCaseGenerator(req.body);

    const result = await generator.generateTestCases(
      acceptanceCriteria,
      storyName
    );

    res.json({
      rawOutput: JSON.stringify(result, null, 2),
      parsedTestCases: result.testCases || []
    });
  } catch (err) {
    console.error("❌ TEST CASE ROUTE ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// GENERATE POSTMAN REQUESTS
// =====================================================
app.post("/api/generate/postman", async (req, res) => {
  try {
    const { acceptanceCriteria, storyName, endpoint } = req.body;

    if (!acceptanceCriteria || !storyName) {
      return res.status(400).json({
        error: "Missing acceptanceCriteria or storyName"
      });
    }

    const generator = createTestCaseGenerator(req.body);

    const aiResult = await generator.generatePostmanIntent(
      acceptanceCriteria,
      storyName,
      endpoint
    );

    const tests = aiResult?.tests || [];

    const collection = PostmanGenerator.generateCollection(
      tests,
      `${storyName} API Tests`
    );

    res.json({
      rawOutput: JSON.stringify(aiResult || {}, null, 2),
      parsedRequests: tests,
      collection
    });
  } catch (err) {
    console.error("❌ POSTMAN ROUTE ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// SWAGGER PARSING (PURE / STATELESS)
// =====================================================
app.post("/api/generate/swagger-endpoints", async (req, res) => {
  try {
    let { swaggerUrl } = req.body;

    if (!swaggerUrl) {
      return res.status(400).json({
        error: "Swagger URL is required"
      });
    }

    if (
      swaggerUrl === "https://petstore.swagger.io" ||
      swaggerUrl === "https://petstore.swagger.io/"
    ) {
      swaggerUrl = "https://petstore.swagger.io/v2/swagger.json";
    }

    const response = await axios.get(swaggerUrl, { timeout: 10000 });
    let swaggerSpec = response.data;

    if (
      swaggerSpec &&
      typeof swaggerSpec === "object" &&
      !swaggerSpec.swagger &&
      !swaggerSpec.openapi
    ) {
      const nestedKey = Object.keys(swaggerSpec).find(k => {
        const v = swaggerSpec[k];
        return v && typeof v === "object" && (v.swagger || v.openapi);
      });

      if (nestedKey) {
        swaggerSpec = swaggerSpec[nestedKey];
      }
    }

    const parser = new SwaggerParser(swaggerSpec);
    parser.validate();

    const endpoints = parser.getEndpoints().map(endpoint => {
      const details = parser.getEndpointDetails(
        endpoint.path,
        endpoint.methods[0]
      );

      return {
        path: endpoint.path,
        methods: endpoint.methods,
        summary: details?.summary || "",
        description: details?.description || "",
        parameters: details?.parameters || [],
        parameterCount: details?.parameters?.length || 0
      };
    });

    res.json({
      endpoints,
      swaggerVersion: swaggerSpec.swagger || swaggerSpec.openapi
    });
  } catch (err) {
    console.error("❌ SWAGGER ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
app.listen(PORT, () => {
  console.log(
    `Rally AI Test Case Generator running on http://localhost:${PORT}`
  );
});