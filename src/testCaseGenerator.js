const axios = require('axios');
const OpenAI = require('openai').default;

class TestCaseGenerator {
  constructor(apiKey, provider = 'openai') {
    this.apiKey = apiKey;
    this.provider = provider.toLowerCase();
    
    // Initialize provider-specific clients
    if (this.provider === 'openai') {
      this.client = new OpenAI({ apiKey: apiKey });
    } else if (this.provider === 'groq') {
      this.groqBaseUrl = 'https://api.groq.com/openai/v1';
    } else if (this.provider === 'gemini') {
      this.geminiApiKey = apiKey;
    }
  }

  async generateTestCases(acceptanceCriteria, storyName) {
    try {
      const prompt = `
Based on the following acceptance criteria, generate comprehensive API test cases that QA analysts can execute using Postman or API reference tools.

NOTE: Ignore any UI or portal references in the acceptance criteria. Whenever you encounter words like "navigate", "click", "select", "screen", "page", "UI", "form", or "portal" convert that sentence into an API action.  Always rewrite such language into equivalent API calls phrased as "Send [METHOD] request to [endpoint]...". For example, if the AC says "Navigate to New Policy and select Hanover", rewrite that as "Build POST request to /api/policies with carrier=\"Hanover\"". All interactions are via HTTP REST API calls only; do not retain any UI language.  If your generated test case text accidentally includes words like "click", "navigate", "screen", "form", "select" or similar, immediately rewrite that sentence in API request format before returning the final output.  The final output MUST NOT contain any UI-related words or instructions whatsoever.

Story: ${storyName}

Acceptance Criteria:
${acceptanceCriteria}

Generate test cases specifically for API testing and return them as a valid JSON array. Each test case should be an object with the following structure:

{
  "testCases": [
    {
      "id": "TC_POS_API_001",
      "title": "API-focused test case title",
      "type": "positive|negative|edge",
      "method": "GET|POST|PUT|DELETE|PATCH",
      "endpoint": "/api/endpoint",
      "headers": {"Content-Type": "application/json", "Authorization": "Bearer token"},
      "requestBody": {"key": "value"},
      "expectedStatusCode": 200,
      "expectedResponse": {"key": "expected value"},
      "testSteps": ["Step 1: description", "Step 2: description"],
      "expectedResult": "Expected outcome description",
      "priority": "High|Medium|Low"
    }
  ]
}

Include positive, negative, and edge test cases. Focus on API-specific testing: status codes, response validation, error handling, data validation, authentication, rate limiting, etc.
Return ONLY valid JSON - no markdown, no explanations, just the JSON array.
`;

      let rawResponse;
      if (this.provider === 'groq') {
        rawResponse = await this.generateWithGROQ(prompt, 'API test cases');
      } else if (this.provider === 'gemini') {
        rawResponse = await this.generateWithGemini(prompt);
      } else {
        rawResponse = await this.generateWithOpenAI(prompt, 'gpt-4', 2500);
      }

      // Clean the response to ensure it's valid JSON
      const cleanedResponse = rawResponse.replace(/```json\s*|\s*```/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanedResponse);
        return JSON.stringify(parsed, null, 2); // Return formatted JSON
      } catch (parseError) {
        // Fallback to original text parsing if JSON fails
        console.warn('Failed to parse AI response as JSON, falling back to text parsing:', parseError.message);
        return rawResponse;
      }
    } catch (error) {
      throw new Error(`Failed to generate test cases: ${error.message}`);
    }
  }

  async generatePostmanRequests(acceptanceCriteria, storyName, endpoint) {
    try {
      const endpointInfo = endpoint ? `API Endpoint: ${endpoint}` : 'API Endpoint: (not specified - use generic placeholders)';

      const prompt = `
Based on the acceptance criteria provided, generate relevant Postman API test requests.

Story: ${storyName}
${endpointInfo}

Acceptance Criteria:
${acceptanceCriteria}

Generate Postman JSON requests and return them as a valid JSON array. Each request should be an object with the following structure:

[
  {
    "name": "Request name matching the test case",
    "method": "GET|POST|PUT|DELETE|PATCH",
    "url": "${endpoint ? endpoint : '{{baseUrl}}/api/endpoint'}",
    "headers": [
      {"key": "Content-Type", "value": "application/json"},
      {"key": "Authorization", "value": "Bearer {{token}}"}
    ],
    "body": {
      "mode": "raw",
      "raw": "{\\"key\\": \\"value\\"}"
    },
    "tests": "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });"
  }
]

${endpoint ? '' : 'Since no specific endpoint was provided, use generic placeholders like {{baseUrl}}/api/endpoint in the URLs.'}

Return ONLY valid JSON array - no markdown, no explanations, just the JSON array.
`;

      let rawResponse;
      if (this.provider === 'groq') {
        rawResponse = await this.generateWithGROQ(prompt, 'Postman requests');
      } else if (this.provider === 'gemini') {
        rawResponse = await this.generateWithGemini(prompt);
      } else {
        rawResponse = await this.generateWithOpenAI(prompt, 'gpt-4', 2500);
      }

      // Clean the response to ensure it's valid JSON
      const cleanedResponse = rawResponse.replace(/```json\s*|\s*```/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanedResponse);
        return JSON.stringify(parsed, null, 2); // Return formatted JSON
      } catch (parseError) {
        // Fallback to original text parsing if JSON fails
        console.warn('Failed to parse AI response as JSON, falling back to text parsing:', parseError.message);
        return rawResponse;
      }
    } catch (error) {
      throw new Error(`Failed to generate Postman requests: ${error.message}`);
    }
  }

  async generateWithOpenAI(prompt, model, maxTokens) {
    const response = await this.client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a QA expert who creates detailed test cases and API requests from acceptance criteria.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: maxTokens
    });
    return response.choices[0].message.content;
  }

  async generateWithGROQ(prompt, context) {
    try {
      const response = await axios.post(
        `${this.groqBaseUrl}/chat/completions`,
        {
          model: 'openai/gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content: `You are a QA expert who creates detailed ${context} from acceptance criteria.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      return response.data.choices[0].message.content;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      throw new Error(`GROQ API Error: ${errorMessage}`);
    }
  }

  async generateWithGemini(prompt) {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.candidates[0].content.parts[0].text;
  }

  async generateWithClaude(prompt) {
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: [
        { role: "user", content: prompt }
      ]
    },
    {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.claudeApiKey,
        "anthropic-version": "2023-06-01"
      }
    }
  );

  return response.data.content[0].text;
}

  parseTestCases(testCaseText) {
    // Parse the AI-generated test cases into structured data
    const testCases = [];
    const sections = testCaseText.split(/TC\d+|Test Case \d+/i);

    for (let section of sections) {
      if (section.trim().length === 0) continue;

      const testCase = {
        title: '',
        description: '',
        preconditions: [],
        steps: [],
        expectedResult: '',
        priority: 'Medium'
      };

      // Extract title
      const titleMatch = section.match(/Title[:\s]*(.+?)(?:\n|$)/i);
      if (titleMatch) testCase.title = titleMatch[1].trim();

      // Extract description
      const descMatch = section.match(/Description[:\s]*(.+?)(?:\n|$)/i);
      if (descMatch) testCase.description = descMatch[1].trim();

      // Extract preconditions
      const precondMatch = section.match(/Preconditions[:\s]*(.+?)(?=Steps|$)/is);
      if (precondMatch) {
        testCase.preconditions = precondMatch[1].split('\n').filter(s => s.trim());
      }

      // Extract steps
      const stepsMatch = section.match(/Steps[:\s]*(.+?)(?=Expected|$)/is);
      if (stepsMatch) {
        testCase.steps = stepsMatch[1].split('\n').filter(s => s.trim());
      }

      // Extract expected result
      const expectedMatch = section.match(/Expected Result[:\s]*(.+?)(?=Priority|$)/is);
      if (expectedMatch) testCase.expectedResult = expectedMatch[1].trim();

      // Extract priority
      const priorityMatch = section.match(/Priority[:\s]*(\w+)/i);
      if (priorityMatch) testCase.priority = priorityMatch[1].trim();

      if (testCase.title) testCases.push(testCase);
    }

    return testCases;
  }
}

module.exports = TestCaseGenerator;
