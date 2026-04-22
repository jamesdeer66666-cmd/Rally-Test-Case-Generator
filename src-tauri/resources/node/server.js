require('dotenv').config({
  path: require('path').join(__dirname, '.env')
});

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const RallyClient = require('./rally');
const TestCaseGenerator = require('./testCaseGenerator');
const PostmanGenerator = require('./utils/postmanGenerator');
const SwaggerParser = require('./utils/swaggerParser');

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------------------------------------------
// Middleware
// -------------------------------------------------------------------
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// -------------------------------------------------------------------
// Runtime State (intentionally minimal)
// -------------------------------------------------------------------
let rallyClient = null;
let testCaseGenerator = null;

// -------------------------------------------------------------------
// Health
// -------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Rally AI Test Case Generator is running'
  });
});

// -------------------------------------------------------------------
// CONFIG VALIDATION
// -------------------------------------------------------------------
app.post('/api/config/validate', async (req, res) => {
  try {
    const {
      rallyApiKey,
      rallyWorkspaceUrl,
      aiProvider,
      openaiApiKey,
      groqApiKey,
      geminiApiKey
    } = req.body;

    // Resolve AI key
    let apiKey;
    switch ((aiProvider || 'openai').toLowerCase()) {
      case 'groq':
        apiKey = groqApiKey;
        break;
      case 'gemini':
        apiKey = geminiApiKey;
        break;
      case 'openai':
      default:
        apiKey = openaiApiKey;
        break;
    }

    if (!apiKey) {
      return res.status(400).json({
        error: 'Missing API key for selected provider'
      });
    }

    // Initialize AI generator
    testCaseGenerator = new TestCaseGenerator(apiKey, aiProvider);

    // Initialize Rally ONLY if creds provided
    if (rallyApiKey && rallyWorkspaceUrl) {
      rallyClient = new RallyClient(rallyApiKey, rallyWorkspaceUrl);
    }

    res.json({
      status: 'configured',
      message: 'Configuration validated successfully',
      aiProvider
    });

  } catch (err) {
    console.error('CONFIG ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------
// RALLY: GET STORIES
// -------------------------------------------------------------------
app.get('/api/rally/stories', async (_req, res) => {
  try {
    if (!rallyClient) {
      return res.status(400).json({ error: 'Rally not configured' });
    }

    const stories = await rallyClient.getUserStories();

    res.json({
      stories: stories.map(s => ({
        id: s.FormattedID,
        name: s.Name
      }))
    });

  } catch (err) {
    console.error('RALLY STORIES ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------
// RALLY: GET STORY DETAILS
// -------------------------------------------------------------------
app.get('/api/rally/story/:storyId', async (req, res) => {
  try {
    if (!rallyClient) {
      return res.status(400).json({ error: 'Rally not configured' });
    }

    const story = await rallyClient.getStory(req.params.storyId);

    res.json({
      id: story.FormattedID,
      name: story.Name,
      acceptanceCriteria: story.AcceptanceCriteria || story.Description || ''
    });

  } catch (err) {
    console.error('RALLY STORY ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------
// SWAGGER ENDPOINT PARSING
// -------------------------------------------------------------------
app.post('/api/generate/swagger-endpoints', async (req, res) => {
  try {
    let { swaggerUrl } = req.body;

    if (!swaggerUrl) {
      return res.status(400).json({ error: 'Swagger URL is required' });
    }

    // Normalize Petstore UI URLs
    if (
      swaggerUrl === 'https://petstore.swagger.io' ||
      swaggerUrl === 'https://petstore.swagger.io/'
    ) {
      swaggerUrl = 'https://petstore.swagger.io/v2/swagger.json';
    }

    const response = await axios.get(swaggerUrl, { timeout: 10000 });
    let swaggerSpec = response.data;

    // Handle nested specs
    if (
      swaggerSpec &&
      typeof swaggerSpec === 'object' &&
      !swaggerSpec.swagger &&
      !swaggerSpec.openapi
    ) {
      const nestedKey = Object.keys(swaggerSpec).find(
        k =>
          swaggerSpec[k] &&
          typeof swaggerSpec[k] === 'object' &&
          (swaggerSpec[k].swagger || swaggerSpec[k].openapi)
      );
      if (nestedKey) swaggerSpec = swaggerSpec[nestedKey];
    }

    const parser = new SwaggerParser(swaggerSpec);
    parser.validate();

    const endpoints = parser.getEndpoints();
    const enriched = endpoints.map(e => {
      const details = parser.getEndpointDetails(e.path, e.methods[0]);
      return {
        path: e.path,
        methods: e.methods,
        summary: details?.summary || '',
        description: details?.description || ''
      };
    });

    res.json({
      swaggerVersion: swaggerSpec.swagger || swaggerSpec.openapi,
      endpoints: enriched
    });

  } catch (err) {
    console.error('SWAGGER ERROR:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------------
// ✅ COMBINED GENERATION (PRIMARY PATH)
// -------------------------------------------------------------------
app.post('/api/generate/combined', async (req, res) => {
  try {
    const {
      storyName,
      acceptanceCriteria,
      endpoint,
      aiProvider,
      apiKey
    } = req.body;

    if (!storyName || !acceptanceCriteria) {
      return res.status(400).json({
        error: 'Missing storyName or acceptanceCriteria'
      });
    }

    // ✅ Self-heal AI generator
    if (!testCaseGenerator && aiProvider && apiKey) {
      testCaseGenerator = new TestCaseGenerator(apiKey, aiProvider);
    }

    if (!testCaseGenerator) {
      return res.status(400).json({ error: 'AI not configured' });
    }

    const { testCases, postman } =
      await testCaseGenerator.generateTestCasesAndPostman({
        storyName,
        acceptanceCriteria,
        endpoint
      });

    res.json({ testCases, postman });

  } catch (err) {
    console.error('GENERATE ERROR:', err);

    if (err.code === 'AI_QUOTA_EXCEEDED') {
      return res.status(429).json({
        error: err.userMessage || 'AI quota exceeded'
      });
    }

    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------------
// SERVER START
// -------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
