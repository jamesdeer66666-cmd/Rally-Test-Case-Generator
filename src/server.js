require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const RallyClient = require('./rally');
const TestCaseGenerator = require('./testCaseGenerator');
const PostmanGenerator = require('./postmanGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

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

// Start server
app.listen(PORT, () => {
  console.log(`Rally AI Test Case Generator running on http://localhost:${PORT}`);
  console.log(`Open your browser and navigate to http://localhost:${PORT}`);
});
