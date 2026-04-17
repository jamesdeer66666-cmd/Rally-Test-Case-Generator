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

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
// Initialize clients
let rallyClient;
let testCaseGenerator;
let aiProvider = 'openai'; // Default to OpenAI

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Rally AI Test Case Generator is running', aiProvider });
});

// Configuration check and setup
app.post('/api/config/validate', (req, res) => {
  const { rallyApiKey, rallyWorkspaceUrl, openaiApiKey, groqApiKey, geminiApiKey, claudeApiKey, aiProvider: provider } = req.body;

  // Determine which API key to use based on provider
  let apiKey;
  if (provider === 'groq') {
    apiKey = groqApiKey;
  } else if (provider === 'gemini') {
    apiKey = geminiApiKey;
  } else if (provider === 'claude') {
    apiKey = claudeApiKey;
  } else {
    apiKey = openaiApiKey; // Default to OpenAI
  }

  if (!apiKey) {
    return res.status(400).json({ 
      error: 'Missing required configuration',
      missingFields: {
        apiKey: !apiKey,
        provider: provider
      }
    });
  }

  try {
    // Initialize clients
    if (rallyApiKey && rallyWorkspaceUrl) {
      rallyClient = new RallyClient(rallyApiKey, rallyWorkspaceUrl);
    }
    
    aiProvider = provider || 'openai';
    testCaseGenerator = new TestCaseGenerator(apiKey, aiProvider);

    res.json({ 
      status: 'configured',
      message: 'Configuration validated successfully',
      aiProvider: aiProvider
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user stories from Rally
app.get('/api/rally/stories', async (req, res) => {
  try {
    if (!rallyClient) {
      return res.status(400).json({ error: 'Rally client not configured. Please configure first.' });
    }

    const stories = await rallyClient.getUserStories();
    res.json({ stories: stories || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get acceptance criteria for a story
app.get('/api/rally/story/:formattedId', async (req, res) => {
  try {
    if (!rallyClient) {
      return res.status(400).json({ error: 'Rally client not configured' });
    }

    const { formattedId } = req.params;
    const criteria = await rallyClient.getAcceptanceCriteria(formattedId);
    res.json({ acceptanceCriteria: criteria });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate test cases from acceptance criteria
app.post('/api/generate/testcases', async (req, res) => {
  try {
    if (!testCaseGenerator) {
      return res.status(400).json({ error: 'OpenAI client not configured' });
    }

    const { acceptanceCriteria, storyName } = req.body;

    if (!acceptanceCriteria || !storyName) {
      return res.status(400).json({ error: 'Missing acceptanceCriteria or storyName' });
    }

    const aiResult = await testCaseGenerator.generateTestCases(
acceptanceCriteria,
storyName
);

res.json({
rawOutput: JSON.stringify(aiResult, null, 2),
parsedTestCases: aiResult.testCases || []
});

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Postman requests
app.post('/api/generate/postman', async (req, res) => {
console.log("🔥 HIT /api/generate/postman route");

try {
if (!testCaseGenerator) {
return res.status(400).json({ error: 'AI client not configured' });
}

const { acceptanceCriteria, storyName, endpoint } = req.body;

console.log("📥 Request:", { acceptanceCriteria, storyName, endpoint });

if (!acceptanceCriteria || !storyName) {
return res.status(400).json({ error: 'Missing acceptanceCriteria or storyName' });
}

const aiResult = await testCaseGenerator.generatePostmanIntent(
acceptanceCriteria,
storyName,
endpoint
);

console.log("✅ FINAL aiResult:", aiResult);

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

} catch (error) {
console.error("❌ ROUTE ERROR:", error);
res.status(500).json({ error: error.message });
}
});


// Export Postman collection
app.post('/api/export/postman', (req, res) => {
  try {
    const { requests, collectionName } = req.body;

    const collection = PostmanGenerator.generateCollection(requests, collectionName || 'Rally API Tests');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="postman_collection.json"');
    res.send(JSON.stringify(collection, null, 2));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch and parse Swagger endpoints
app.post('/api/generate/swagger-endpoints', async (req, res) => {
  try {
    let { swaggerUrl } = req.body;

    if (!swaggerUrl) {
      return res.status(400).json({ error: 'Swagger URL is required' });
    }

    // Helpful hint for common mistakes
    if (swaggerUrl === 'https://petstore.swagger.io/' || swaggerUrl === 'https://petstore.swagger.io') {
      swaggerUrl = 'https://petstore.swagger.io/v2/swagger.json';
      console.log('📝 Detected Petstore UI URL, redirecting to actual spec:', swaggerUrl);
    }

    // Fetch the Swagger spec from the provided URL
    console.log('🌐 Fetching from:', swaggerUrl);
    const response = await axios.get(swaggerUrl, { timeout: 10000 });
    let swaggerSpec = response.data;

    console.log('📋 Swagger spec fetched successfully');
    console.log('Response type:', typeof swaggerSpec);
    console.log('Response keys:', Object.keys(swaggerSpec || {}).slice(0, 10));
    
    // Handle case where spec might be nested (e.g., inside a 'data' property)
    if (swaggerSpec && typeof swaggerSpec === 'object' && !swaggerSpec.swagger && !swaggerSpec.openapi) {
      // Check if it's nested in a property like 'data' or other wrapper
      const possibleKeys = Object.keys(swaggerSpec);
      const nestedSpec = possibleKeys.find(key => {
        const val = swaggerSpec[key];
        return val && typeof val === 'object' && (val.swagger || val.openapi);
      });
      
      if (nestedSpec) {
        console.log(`📍 Found Swagger spec nested in '${nestedSpec}' property`);
        swaggerSpec = swaggerSpec[nestedSpec];
      }
    }

    // Parse the Swagger spec
    const parser = new SwaggerParser(swaggerSpec);
    console.log('✅ Parser instantiated:', typeof parser, typeof parser.validate);
    
    // Validate the spec
    try {
      parser.validate();
      console.log('✅ Swagger spec validated successfully');
    } catch (validationError) {
      console.error('❌ Validation error:', validationError.message);
      return res.status(400).json({ error: `Invalid Swagger spec: ${validationError.message}` });
    }

    // Extract endpoints
    const endpoints = parser.getEndpoints();
    console.log(`📍 Found ${endpoints.length} endpoints`);

    // Enrich endpoints with additional details
    const enrichedEndpoints = endpoints.map(endpoint => {
      const details = parser.getEndpointDetails(endpoint.path, endpoint.methods[0]);
      return {
        path: endpoint.path,
        methods: endpoint.methods,
        summary: details?.summary || '',
        description: details?.description || '',
        parameters: details?.parameters || [],
        parameterCount: (details?.parameters || []).length
      };
    });

    res.json({ 
      endpoints: enrichedEndpoints,
      swaggerVersion: swaggerSpec.swagger || swaggerSpec.openapi
    });
  } catch (error) {
    console.error('❌ Swagger endpoint error:', error.message);
    if (error.response) {
      res.status(error.response.status).json({ error: `Failed to fetch Swagger: ${error.message}` });
    } else if (error.code === 'ENOTFOUND') {
      res.status(400).json({ error: 'Invalid URL: host not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Rally AI Test Case Generator running on http://localhost:${PORT}`);
  console.log(`Open your browser and navigate to http://localhost:${PORT}`);
});
