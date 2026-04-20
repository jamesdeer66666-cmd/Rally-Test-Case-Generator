const axios = require("axios");
const OpenAI = require("openai").default;

class TestCaseGenerator {
  constructor(apiKey, provider = "openai") {
    this.apiKey = apiKey;
    this.provider = provider.toLowerCase();

    console.log("🔧 TestCaseGenerator initialized with provider:", this.provider);

    if (this.provider === "openai") {
      this.client = new OpenAI({ apiKey });
    } else if (this.provider === "groq") {
      this.groqBaseUrl = "https://api.groq.com/openai/v1";
    } else if (this.provider === "gemini") {
      this.geminiApiKey = apiKey;
    } else if (this.provider === "claude") {
      this.claudeApiKey = apiKey;
    }
  }

  // =====================================================================
  // TEST CASE GENERATION
  // =====================================================================
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

      if (this.provider === "groq") {
        rawResponse = await this.generateWithGroq(prompt, "API test cases");
      } else if (this.provider === "gemini") {
        rawResponse = await this.generateWithGemini(prompt);
      } else if (this.provider === "claude") {
        rawResponse = await this.generateWithClaude(prompt);
      } else {
        rawResponse = await this.generateWithOpenAI(prompt, "gpt-4", 2500);
      }

      console.log("🧠 RAW AI RESPONSE:", rawResponse);

      // ✅ HARD GUARD — PREVENTS `.replace()` CRASH
      if (typeof rawResponse !== "string" || !rawResponse.trim()) {
        throw new Error("AI provider failed to return a valid response");
      }

      const cleanedResponse = rawResponse
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleanedResponse);

      return {
        testCases: parsed.testCases || []
      };

    } catch (error) {
      console.error("❌ TEST CASE ERROR:", error.message);
      return { testCases: [] };
    }
  }

  // =====================================================================
  // POSTMAN REQUEST GENERATION
  // =====================================================================
  async generatePostmanRequests(acceptanceCriteria, storyName, endpoint) {
    try {
      const safeEndpoint = endpoint || "";

      const prompt = `
Return ONLY valid JSON.

Story: ${storyName}
Acceptance Criteria:
${acceptanceCriteria}
Endpoint: ${safeEndpoint}
`;

      let rawResponse;

      if (this.provider === "groq") {
        rawResponse = await this.generateWithGroq(prompt, "Postman requests");
      } else if (this.provider === "gemini") {
        rawResponse = await this.generateWithGemini(prompt);
      } else if (this.provider === "claude") {
        rawResponse = await this.generateWithClaude(prompt);
      } else {
        rawResponse = await this.generateWithOpenAI(prompt, "gpt-4", 2500);
      }

      console.log("🧠 RAW POSTMAN RESPONSE:", rawResponse);

      if (typeof rawResponse !== "string" || !rawResponse.trim()) {
        throw new Error("AI provider failed to return Postman data");
      }

      const cleanedResponse = rawResponse
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleanedResponse);
      return JSON.stringify(parsed, null, 2);

    } catch (error) {
      console.error("❌ POSTMAN ERROR:", error.message);
      throw error;
    }
  }

  // =====================================================================
  // AI PROVIDERS
  // =====================================================================

  async generateWithOpenAI(prompt, model, maxTokens) {
    const response = await this.client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a QA expert." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: maxTokens
    });

    return response.choices[0].message.content || "";
  }

  async generateWithGroq(prompt, context) {
    const response = await axios.post(
      `${this.groqBaseUrl}/chat/completions`,
      {
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a QA expert creating structured ${context}. Return ONLY valid JSON.`
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
  }

  // ✅ CORRECT GEMINI IMPLEMENTATION
  async generateWithGemini(prompt) {
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

      const text =
        response?.data?.candidates?.[0]?.content?.parts
          ?.map(p => p.text || "")
          .join("")
          .trim();

      return text || "";

    } catch (err) {
      console.error("❌ GEMINI ERROR:", err.message);
      return "";
    }
  }

  async generateWithClaude(prompt) {
    console.warn("⚠️ Claude provider not implemented yet");
    return "";
  }
}

module.exports = TestCaseGenerator;