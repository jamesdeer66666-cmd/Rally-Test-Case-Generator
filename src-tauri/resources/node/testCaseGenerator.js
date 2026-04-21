const axios = require("axios");
const OpenAI = require("openai").default;

class TestCaseGenerator {
  constructor(apiKey, provider = "openai") {
  this.apiKey = apiKey;
  this.provider = provider.toLowerCase();

  console.log("🔧 TestCaseGenerator initialized with provider:", this.provider);

  // ✅ Always available for fallback
  this.client = new OpenAI({ apiKey });

  if (this.provider === "groq") {
    this.groqBaseUrl = "https://api.groq.com/openai/v1";
  }

  if (this.provider === "gemini") {
    this.geminiApiKey = apiKey;
  }
}

  // =====================================================================
  // PUBLIC API
  // =====================================================================

  async generateTestCases(acceptanceCriteria, storyName) {
  try {
    const prompt = this.buildTestCasePrompt(
      acceptanceCriteria,
      storyName
    );

    const raw = await this.generate(prompt, "API test cases");
    const cleaned = this.sanitizeJsonResponse(raw);
    const parsed = this.safeJsonParse(cleaned);
    const validated = this.validateTestCases(parsed.testCases);

    return { testCases: validated };

  } catch (err) {
    if (err.code === "AI_QUOTA_EXCEEDED") {
      throw err; // ✅ let API/UI handle it
    }

    console.error("❌ TEST CASE ERROR:", err.message);
    return { testCases: [] };
  }
}

  async generatePostmanRequests(acceptanceCriteria, storyName, endpoint = "") {
    try {
      const prompt = this.buildPostmanPrompt(
        acceptanceCriteria,
        storyName,
        endpoint
      );

      const raw = await this.generate(prompt, "Postman collection");

      const cleaned = this.sanitizeJsonResponse(raw);
      const parsed = this.safeJsonParse(cleaned);

      return JSON.stringify(parsed, null, 2);

    } catch (err) {
      console.error("❌ POSTMAN ERROR:", err.message);
      throw err;
    }
  }

  // =====================================================================
  // PROVIDER ROUTING
  // =====================================================================

  async generate(prompt, context) {
  try {
    // ✅ Call ONLY the selected provider
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
    // ✅ If OpenAI fails, STOP. No fallback exists.
    if (this.provider === "openai") {
  if (err.code === "AI_QUOTA_EXCEEDED") {
    throw err; // ✅ UI needs this
  }

  console.error("❌ OpenAI failed:", err.message);
  throw err;
}

    // ✅ Only fallback to OpenAI if Gemini or Groq failed
    console.warn(
      `⚠️ Provider "${this.provider}" failed (${err.message}). Falling back to OpenAI.`
    );

    return await this.generateWithOpenAI(prompt);
  }
}


  // =====================================================================
  // PROMPT BUILDERS (OPTIMIZED PER PROVIDER)
  // =====================================================================

  buildTestCasePrompt(acceptanceCriteria, storyName) {
    if (this.provider === "groq") {
      return this.groqPrompt(acceptanceCriteria, storyName);
    }
    if (this.provider === "gemini") {
      return this.geminiPrompt(acceptanceCriteria, storyName);
    }
    return this.openAIPrompt(acceptanceCriteria, storyName);
  }

  buildPostmanPrompt(acceptanceCriteria, storyName, endpoint) {
    return `
Return ONLY valid JSON.
No markdown. No comments.

Create a Postman collection that satisfies the following:

Story:
${storyName}

Acceptance Criteria:
${acceptanceCriteria}

Endpoint:
${endpoint}

Include:
- request name
- method
- URL
- headers
- example body (if applicable)
- example tests
`;
  }

  // =====================================================================
  // OPENAI PROMPT (BEST FOR INSTRUCTION-FOLLOWING)
  // =====================================================================

  openAIPrompt(acceptanceCriteria, storyName) {
    return `
You are a senior QA automation engineer.

Return ONLY valid JSON.
Do not add explanations, markdown, or comments.

Rules:
- IDs must be sequential (TC_001, TC_002…)
- Include positive, negative, and edge cases
- Use realistic HTTP methods and status codes
- testSteps must be explicit and actionable
- expectedResult must be verifiable

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

Story:
${storyName}

Acceptance Criteria:
${acceptanceCriteria}
`;
  }

  // =====================================================================
  // GROQ PROMPT (LLAMA — NEEDS STRICT JSON GUARDRAILS)
  // =====================================================================

  groqPrompt(acceptanceCriteria, storyName) {
    return `
SYSTEM:
You are generating STRICT JSON for automated API testing.
Invalid JSON = failure.

USER:
Generate API test cases ONLY as JSON.

Requirements:
- Use realistic REST conventions
- Cover positive, negative, and edge cases
- No markdown, no text outside JSON

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

Story:
${storyName}

Acceptance Criteria:
${acceptanceCriteria}
`;
  }

  // =====================================================================
  // GEMINI PROMPT (NEEDS REDUNDANT CONSTRAINTS)
  // =====================================================================

  geminiPrompt(acceptanceCriteria, storyName) {
    return `
IMPORTANT:
Respond ONLY with valid JSON.
Do not include markdown, comments, or explanations.

Task:
Generate API test cases based on the following story.

The JSON must strictly follow this schema:

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

Story:
${storyName}

Acceptance Criteria:
${acceptanceCriteria}
`;
  }

  // =====================================================================
  // PROVIDER IMPLEMENTATIONS
  // =====================================================================

 
async generateWithOpenAI(prompt) {
  try {
    const response = await this.client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a senior QA automation engineer. Respond using ONLY valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 2500
    });

    return response.choices?.[0]?.message?.content || "";

  } catch (err) {
    const message =
      err?.error?.message ||
      err?.message ||
      "";

    if (message.toLowerCase().includes("quota")) {
      throw quotaError("openai");
    }

    throw err;
  }
}

  async generateWithGroq(prompt, context) {
  try {
    const response = await axios.post(
      `${this.groqBaseUrl}/chat/completions`,
      {
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You produce production-ready ${context}. JSON only.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    return response.data.choices?.[0]?.message?.content || "";

  } catch (err) {
    const message = err?.response?.data?.error?.message ||
                    err?.message ||
                    "";

    if (message.toLowerCase().includes("quota")) {
      throw quotaError("groq");
    }

    throw err;
  }
}


 async generateWithGemini(prompt, retries = 2) {
  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent",
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      },
      {
        params: { key: this.geminiApiKey },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    if (response.status === 503) {
      throw new Error("Gemini service unavailable (503)");
    }

    if (response.status < 200 || response.status >= 300) {
      const message = JSON.stringify(response.data);
      if (message.toLowerCase().includes("quota")) {
        throw quotaError("gemini");
      }
      throw new Error(`Gemini error ${response.status}`);
    }

    const text =
      response.data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "")
        .join("")
        .trim();

    if (!text) {
      throw new Error("Gemini returned empty content");
    }

    return text;

  } 
  
  catch (err) {
  if (err.code === "AI_QUOTA_EXCEEDED") {
    throw err; // ✅ fail immediately
  }

  if (retries > 0) {
    await new Promise(r => setTimeout(r, 800));
    return this.generateWithGemini(prompt, retries - 1);
  }

  throw err;
}
}

  // =====================================================================
  // JSON SAFETY & VALIDATION
  // =====================================================================

  sanitizeJsonResponse(raw) {
    if (typeof raw !== "string") {
      throw new Error("AI response is not a string");
    }

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
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error("Invalid JSON returned by AI");
    }
  }

  validateTestCases(testCases) {
    if (!Array.isArray(testCases)) return [];

    return testCases.filter(tc =>
      tc.id &&
      tc.title &&
      tc.method &&
      tc.endpoint &&
      typeof tc.expectedStatusCode === "number" &&
      Array.isArray(tc.testSteps)
    );
  }
}

function quotaError(provider) {
  const err = new Error(
    `AI quota exceeded for ${provider}`
  );
  err.code = "AI_QUOTA_EXCEEDED";
  err.provider = provider;
  err.userMessage =
    "You've reached your AI usage limit for today. Please try again later or upgrade your plan.";
  return err;
}

module.exports = TestCaseGenerator;