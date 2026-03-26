const axios = require('axios');
const OpenAI = require('openai').default;

class TestCaseGenerator {
constructor(apiKey, provider = 'openai') {
this.apiKey = apiKey;
this.provider = provider.toLowerCase();

if (this.provider === 'openai') {
this.client = new OpenAI({ apiKey: apiKey });
} else if (this.provider === 'groq') {
this.groqBaseUrl = 'https://api.groq.com/openai/v1';
} else if (this.provider === 'gemini') {
this.geminiApiKey = apiKey;
} else if (this.provider === 'claude') {
this.claudeApiKey = apiKey;
}
}

// ---------------- EXISTING ----------------
async generateTestCases(acceptanceCriteria, storyName) {
try {
console.log("📍 Building test case prompt...");

const prompt = `
Return ONLY valid JSON.

Schema:
{
"testCases": [
{
"id": "TC_001",
"title": "string",
"type": "positive|negative|edge",
"method": "GET|POST|PUT|DELETE",
"endpoint": "/api/example",
"expectedStatusCode": 200,
"testSteps": ["step1", "step2"],
"expectedResult": "string"
}
]
}

Story: ${storyName}

Acceptance Criteria:
${acceptanceCriteria}
`;

console.log("📍 Prompt built");

let rawResponse;

if (this.provider === 'groq') {
rawResponse = await this.generateWithGROQ(prompt, 'API test cases');
} else if (this.provider === 'gemini') {
rawResponse = await this.generateWithGemini(prompt);
} else if (this.provider === 'claude') {
rawResponse = await this.generateWithClaude(prompt);
} else {
rawResponse = await this.generateWithOpenAI(prompt, 'gpt-4', 2500);
}

console.log("🧠 RAW AI RESPONSE:", rawResponse);

const cleanedResponse = rawResponse
.replace(/```json\s*/g, '')
.replace(/```/g, '')
.trim();

try {
const parsed = JSON.parse(cleanedResponse);

// ✅ RETURN STRUCTURED OBJECT (THIS IS THE FIX)
return {
testCases: parsed.testCases || []
};

} catch (err) {
console.error("❌ JSON PARSE FAILED:", cleanedResponse);

return {
testCases: []
};
}

} catch (error) {
console.error("❌ TEST CASE ERROR:", error);
throw new Error(`Failed to generate test cases: ${error.message}`);
}
}


// ---------------- EXISTING ----------------
async generatePostmanRequests(acceptanceCriteria, storyName, endpoint) {
try {
const endpointInfo = endpoint ? `API Endpoint: ${safeEndpoint}` : '';

const prompt = `...`; // (keep your existing prompt)

let rawResponse;
if (this.provider === 'groq') {
  console.log("About to call GROQ...");
rawResponse = await this.generateWithGROQ(prompt, 'Postman requests');
console.log("GROQ Call Finished");
console.log("RAW API RESPONSE:");
console.log(rawResponse);
} else if (this.provider === 'gemini') {
rawResponse = await this.generateWithGemini(prompt);
} else if (this.provider === 'claude') {
rawResponse = await this.generateWithClaude(prompt);
} else {
rawResponse = await this.generateWithOpenAI(prompt, 'gpt-4', 2500);
}

const cleanedResponse = rawResponse.replace(/```json\s*|\s*```/g, '').trim();

try {
const parsed = JSON.parse(cleanedResponse);
return JSON.stringify(parsed, null, 2);
} catch {
return rawResponse;
}
} catch (error) {
throw new Error(`Failed to generate Postman requests: ${error.message}`);
}
}

// New method for structured intent generation
async generatePostmanIntent(acceptanceCriteria, storyName, endpoint) {
const safeEndpoint = endpoint && endpoint.trim() !== ""
? endpoint
: "{{baseUrl}}/api/endpoint";

console.log("🚀 Starting generatePostmanIntent");

try {
console.log("Generating Postman intent...");

const prompt = `
Return ONLY valid JSON.

Schema:
{
"tests": [
{
"name": "string",
"method": "GET|POST|PUT|DELETE",
"endpoint": "string",
"validations": [
{ "type": "status", "value": number },
{ "type": "exists", "field": "string" },
{ "type": "notEmpty", "field": "string" }
]
}
]
}

Story: ${storyName}

Acceptance Criteria:
${acceptanceCriteria}

Endpoint: ${safeEndpoint}
`;

let rawResponse;

if (this.provider === 'groq') {
rawResponse = await this.generateWithGROQ(prompt, 'structured API tests');
} else if (this.provider === 'gemini') {
rawResponse = await this.generateWithGemini(prompt);
} else if (this.provider === 'claude') {
rawResponse = await this.generateWithClaude(prompt);
} else {
rawResponse = await this.generateWithOpenAI(prompt, 'gpt-4', 1500);
}

console.log("🧠 RAW AI RESPONSE:", rawResponse);

return this.safeParseJSON(rawResponse);

} catch (error) {
console.error("❌ ERROR:", error);
throw new Error(`Failed to generate structured intent: ${error.message}`);
}
}


// 🔥 IMPROVED SAFE PARSER (REUSABLE)
safeParseJSON(content) {
const cleaned = content
.replace(/```json\s*|\s*```/g, '')
.replace(/^.*?\{/, '{')
.trim();

try {
return JSON.parse(cleaned);
} catch (e) {
console.error("❌ FAILED TO PARSE JSON");
console.error("RAW:", content);
throw new Error("AI returned invalid JSON");
}
}


// ---------------- AI PROVIDERS ----------------
async generateWithOpenAI(prompt, model, maxTokens) {
const response = await this.client.chat.completions.create({
model,
messages: [
{ role: 'system', content: 'You are a QA expert.' },
{ role: 'user', content: prompt }
],
temperature: 0.7,
max_tokens: maxTokens
});

return response.choices[0].message.content;
}

async generateWithGROQ(prompt, context) {
try {
console.log("📡 Calling GROQ API...");

const response = await axios.post(
`${this.groqBaseUrl}/chat/completions`,
{
model: 'llama-3.3-70b-versatile', // ✅ High-quality model
response_format: { type: "json_object" }, // ✅ Forces clean JSON
messages: [
{
role: 'system',
content: `You are a QA expert creating structured ${context}. 
Return ONLY valid JSON. Do not include explanations or markdown.`
},
{
role: 'user',
content: prompt
}
],
temperature: 0.2, // ✅ Lower = more consistent structured output
max_tokens: 2000
},
{
headers: {
'Authorization': `Bearer ${this.apiKey}`,
'Content-Type': 'application/json'
},
timeout: 30000
}
);

const content = response.data.choices[0].message.content;

console.log("🧠 RAW AI RESPONSE:");
console.log(content);

return content;

} catch (error) {
console.error("❌ GROQ ERROR FULL RESPONSE:");
console.error(error.response?.data || error.message);

throw new Error(
`GROQ API Error: ${error.response?.data?.error?.message || error.message}`
);
}
}


async generateWithGemini(prompt) { /* unchanged */ }
async generateWithClaude(prompt) { /* unchanged */ }

// ---------------- EXISTING PARSER ----------------
parseTestCases(testCaseText) {
// (unchanged)
}
}

module.exports = TestCaseGenerator;
