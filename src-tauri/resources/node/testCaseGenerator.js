const axios = require("axios");
const OpenAI = require("openai").default;
const PostmanGenerator = require("./utils/postmanGenerator");

class TestCaseGenerator {
  constructor(apiKey, provider = "openai") {
    this.apiKey = apiKey;
    this.provider = provider.toLowerCase();

    console.log("🔧 TestCaseGenerator initialized with provider:", this.provider);

    // OpenAI client always available (fallback or primary)
    this.client = new OpenAI({ apiKey });

    if (this.provider === "groq") {
      this.groqBaseUrl = "https://api.groq.com/openai/v1";
    }

    if (this.provider === "gemini") {
      this.geminiApiKey = apiKey;
    }
  }

  // =============================================================
  // PUBLIC API
  // =============================================================

  async validateApiKey() {
    try {
      switch (this.provider) {
        case "gemini":
          // Test Gemini API with a minimal request
          return await this.validateGeminiKey();
        case "groq":
          // Test Groq API with a models list call
          return await this.validateGroqKey();
        case "openai":
        default:
          // Test OpenAI with models list
          return await this.validateOpenAIKey();
      }
    } catch (err) {
      throw new Error(`API key validation failed: ${err.message}`);
    }
  }

  async validateOpenAIKey() {
    try {
      const response = await this.client.models.list();
      if (!response.data || response.data.length === 0) {
        throw new Error("Unable to retrieve models list from OpenAI");
      }
      return true;
    } catch (err) {
      throw new Error(`OpenAI validation failed: ${err.message}`);
    }
  }

  async validateGroqKey() {
    try {
      const response = await axios.get(
        `${this.groqBaseUrl}/models`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      if (!response.data || !response.data.data || response.data.data.length === 0) {
        throw new Error("Unable to retrieve models list from Groq");
      }
      return true;
    } catch (err) {
      if (err.response?.status === 401) {
        throw new Error("Invalid Groq API key (401 Unauthorized)");
      }
      throw new Error(`Groq validation failed: ${err.message}`);
    }
  }

  async validateGeminiKey() {
    try {
      // Make a minimal request to Gemini API to validate the key
      const response = await axios.post(
        "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
        { 
          contents: [{ role: "user", parts: [{ text: "test" }] }] 
        },
        {
          params: { key: this.geminiApiKey }
        }
      );
      if (!response.data) {
        throw new Error("No response from Gemini API");
      }
      return true;
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        throw new Error("Invalid Gemini API key (Authentication failed)");
      }
      throw new Error(`Gemini validation failed: ${err.message}`);
    }
  }

  async generateTestCases(acceptanceCriteria, storyName) {
    try {
      const prompt = this.buildTestCasePrompt(acceptanceCriteria, storyName);

      const raw = await this.generate(prompt, "API test cases");
      const cleaned = this.sanitizeJsonResponse(raw);
      const parsed = this.safeJsonParse(cleaned);
      const validated = this.validateTestCases(parsed.testCases);

      return { testCases: validated };

    } catch (err) {
      if (err.code === "AI_QUOTA_EXCEEDED") throw err;
      console.error("❌ TEST CASE ERROR:", err.message);
      return { testCases: [] };
    }
  }

  // =============================================================
  // PROVIDER ROUTING
  // =============================================================

  async generate(prompt, context) {
    try {
      switch (this.provider) {
        case "gemini":
          return await this.generateWithGemini(prompt);
        case "groq":
          return await this.generateWithGroq(prompt, context);
        case "openai":
        default:
          return await this.generateWithOpenAI(prompt);
      }
    } catch (err) {
      if (this.provider === "openai") throw err;

      console.warn(
        `⚠️ ${this.provider} failed (${err.message}). Falling back to OpenAI.`
      );

      return await this.generateWithOpenAI(prompt);
    }
  }

  // =============================================================
  // PROMPTS
  // =============================================================

  buildTestCasePrompt(acceptanceCriteria, storyName) {
    if (this.provider === "groq") return this.groqPrompt(acceptanceCriteria, storyName);
    if (this.provider === "gemini") return this.geminiPrompt(acceptanceCriteria, storyName);
    return this.openAIPrompt(acceptanceCriteria, storyName);
  }

  openAIPrompt(acceptanceCriteria, storyName) {
    return `
You are a senior QA automation engineer.
Return ONLY valid JSON.

Schema:
{
  "testCases": [{
    "id": "TC_001",
    "title": "string",
    "type": "positive|negative|edge",
    "method": "GET|POST|PUT|DELETE",
    "endpoint": "/api/example",
    "expectedStatusCode": 200,
    "testSteps": ["step1"],
    "expectedResult": "string"
  }]
}

Story:
${storyName}

Acceptance Criteria:
${acceptanceCriteria}
`;
  }

  groqPrompt(acceptanceCriteria, storyName) {
    return this.openAIPrompt(acceptanceCriteria, storyName);
  }

  geminiPrompt(acceptanceCriteria, storyName) {
    return this.openAIPrompt(acceptanceCriteria, storyName);
  }

  // =============================================================
  // PROVIDERS
  // =============================================================

  async generateWithOpenAI(prompt) {
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a QA automation expert." },
          { role: "user", content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 2500
      });
      return response.choices?.[0]?.message?.content || "";
    } catch (err) {
      if ((err?.message || "").toLowerCase().includes("quota")) {
        throw quotaError("openai");
      }
      throw err;
    }
  }

  async generateWithGroq(prompt, context) {
    const response = await axios.post(
      `${this.groqBaseUrl}/chat/completions`,
      {
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Generate ${context} as JSON.` },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2000
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices?.[0]?.message?.content || "";
  }

  async generateWithGemini(prompt) {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
      { contents: [{ role: "user", parts: [{ text: prompt }] }] },
      {
        params: { key: this.geminiApiKey }
      }
    );

    return response.data?.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "")
      .join("")
      .trim();
  }

  // =============================================================
  // POSTMAN INTENT
  // =============================================================

  async generatePostmanIntent(acceptanceCriteria, storyName, endpoint = "") {
    const prompt = `
Return ONLY JSON.
[
  {
    "name": "string",
    "method": "GET",
    "endpoint": "${endpoint || "/api/example"}",
    "validations": [{ "type": "status", "value": 200 }]
  }
]
`;

    const raw = await this.generate(prompt, "Postman intents");
    const cleaned = this.sanitizeJsonResponse(raw);
    return this.safeJsonParse(cleaned);
  }

  // =============================================================
  // OPTION C ORCHESTRATOR
  // =============================================================

  async generateTestCasesAndPostman({ acceptanceCriteria, storyName, endpoint }) {
    const { testCases } = await this.generateTestCases(acceptanceCriteria, storyName);
    const intents = await this.generatePostmanIntent(
      acceptanceCriteria,
      storyName,
      endpoint
    );

    const collection =
      PostmanGenerator.generateCollection(intents, `${storyName} API Tests`);

    return { testCases, postman: collection };
  }

  // =============================================================
  // JSON SAFETY
  // =============================================================

  sanitizeJsonResponse(raw) {
    if (typeof raw !== "string") throw new Error("AI response not string");

    const cleaned = raw
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .trim();

    if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
      throw new Error("AI response does not look like JSON");
    }

    return cleaned;
  }

  safeJsonParse(text) {
    return JSON.parse(text);
  }

  validateTestCases(testCases) {
    if (!Array.isArray(testCases)) return [];
    return testCases.filter(tc =>
      tc.id &&
      tc.title &&
      tc.method &&
      tc.endpoint &&
      Array.isArray(tc.testSteps)
    );
  }
}

// =============================================================
// QUOTA ERROR
// =============================================================

function quotaError(provider) {
  const err = new Error(`AI quota exceeded for ${provider}`);
  err.code = "AI_QUOTA_EXCEEDED";
  return err;
}

module.exports = TestCaseGenerator;