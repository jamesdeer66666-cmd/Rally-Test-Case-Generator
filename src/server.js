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
app.use(express.static('public'));

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
  const { rallyApiKey, rallyWorkspaceUrl, openaiApiKey, aiProvider: provider } = req.body;

  if (!openaiApiKey) {
    return res.status(400).json({ 
      error: 'Missing required configuration',
      missingFields: {
        openaiApiKey: !openaiApiKey
      }
    });
  }

  try {
    // Initialize clients
    if (rallyApiKey && rallyWorkspaceUrl) {
      rallyClient = new RallyClient(rallyApiKey, rallyWorkspaceUrl);
    }
    
    aiProvider = provider || 'openai';
    testCaseGenerator = new TestCaseGenerator(openaiApiKey, aiProvider);

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

    let testCases = await testCaseGenerator.generateTestCases(acceptanceCriteria, storyName);
    // sanitize UI references (convert or remove them) before returning
    const sanitizeUI = text => {
      let out = text;
      // replace common UI phrases with generic API actions
      out = out.replace(/Log in.*(?:\n|$)/gi, 'Authenticate using API token\n');
      out = out.replace(/Navigate to.*(?:\n|$)/gi, 'Send appropriate API request\n');
      out = out.replace(/Click .*?(?:\.|\n)/gi, 'Send API request accordingly.\n');
      out = out.replace(/select \*\*([^*]+)\*\*/gi, 'set "$1" field via API');
      out = out.replace(/screen/gi, 'API endpoint');
      out = out.replace(/form/gi, 'JSON payload');
      out = out.replace(/UI/gi, 'API');
      return out;
    };
    const sanitized = sanitizeUI(testCases);
    const parsedTestCases = testCaseGenerator.parseTestCases(sanitized);

    res.json({ 
      rawOutput: sanitized,
      parsedTestCases: parsedTestCases
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Postman requests
app.post('/api/generate/postman', async (req, res) => {
  try {
    if (!testCaseGenerator) {
      return res.status(400).json({ error: 'OpenAI client not configured' });
    }

    const { acceptanceCriteria, storyName, endpoint } = req.body;

    if (!acceptanceCriteria || !storyName) {
      return res.status(400).json({ error: 'Missing acceptanceCriteria or storyName' });
    }

    const postmanRequests = await testCaseGenerator.generatePostmanRequests(
      acceptanceCriteria,
      storyName,
      endpoint
    );

    const parsedRequests = PostmanGenerator.parseRequestsFromText(postmanRequests);
    const collection = PostmanGenerator.generateCollection(parsedRequests, `${storyName} - API Tests`);

    res.json({ 
      rawOutput: postmanRequests,
      parsedRequests: parsedRequests,
      collection: collection
    });
  } catch (error) {
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
