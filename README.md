<<<<<<< HEAD
# Rally AI Test Case Generator

> **Transform Rally Acceptance Criteria into AI-Generated Test Cases and Postman Requests**

A powerful web application that bridges Rally project management with AI-driven test automation, automatically generating comprehensive test cases and API testing collections from acceptance criteria.

## 🚀 Quick Start

### Prerequisites
- Node.js 14 or higher
- Rally API credentials
- OpenAI API key

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your credentials
# RALLY_API_KEY=your_api_key
# OPENAI_API_KEY=your_api_key

# Start development server
npm run dev

# Or production
npm start
```

Open your browser to `http://localhost:3000`

## 📋 Features

### 🔗 Rally Integration
- Fetch user stories directly from Rally
- Extract acceptance criteria automatically
- View story details and metadata

### 🤖 AI-Powered Test Generation
- Generate detailed test cases using GPT-4
- Structured output with test steps, preconditions, and expected results
- Automatic priority classification (High/Medium/Low)

### 📮 Postman Integration
- Auto-generate API test requests
- Create complete collections for import into Postman
- Include headers, body templates, and test assertions

### 💾 Export & Download
- Download test cases as JSON
- Export Postman collections ready to import
- Support for batch operations

## 🎯 How It Works

1. **Configure APIs**: Enter Rally and OpenAI credentials
2. **Input AC**: Provide acceptance criteria (manual or from Rally)
3. **Generate**: Click to generate test cases and/or Postman requests
4. **Download**: Export as JSON for use in your testing workflow

## 📁 Project Structure

```
src/
  ├── server.js              # Express server & API routes
  ├── rally.js               # Rally API client
  ├── testCaseGenerator.js   # GPT-4 test case generation
  └── postmanGenerator.js    # Postman collection generation

public/
  └── index.html             # Web UI interface
```

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```env
# Rally Configuration
RALLY_API_KEY=your_rally_api_key
RALLY_WORKSPACE_URL=https://rally1.rallydev.com

# AI Provider Configuration  
# Choose: openai, groq, or gemini
AI_PROVIDER=groq
AI_API_KEY=your_ai_api_key

# Server Configuration
PORT=3000
NODE_ENV=development
```

### AI Provider Options

#### 🚀 GROQ (Recommended - Free)
- **Cost**: Completely free
- **Setup**: https://console.groq.com/keys
- **Models**: Mixtral 8x7B, Meta Llama 2
- **Speed**: Very fast inference
- **Best for**: Testing, development

#### 🤖 OpenAI
- **Cost**: Pay-as-you-go ($0.01-0.05 per test)
- **Setup**: https://platform.openai.com/api/keys
- **Models**: GPT-4 (most powerful)
- **Speed**: Standard
- **Best for**: Production, high quality

#### ✨ Google Gemini
- **Cost**: Free tier + paid
- **Setup**: https://ai.google.dev/
- **Models**: Gemini 1.5
- **Speed**: Good
- **Best for**: Multi-modal tasks

## 📚 API Endpoints

### Configuration
- `POST /api/config/validate` - Validate API credentials

### Rally
- `GET /api/rally/stories` - List all user stories
- `GET /api/rally/story/:formattedId` - Get story AC

### Generation
- `POST /api/generate/testcases` - Generate test cases
- `POST /api/generate/postman` - Generate Postman requests
- `POST /api/export/postman` - Export collection

## 🎮 Usage Examples

### Generate from Manual Input
```
1. Go to "Manual Input" tab
2. Enter story name: "User Login"
3. Paste acceptance criteria
4. Click "Generate Test Cases"
5. Download results as JSON or plain text using the buttons provided
```

### Generate from Rally Story
```
1. Click "Fetch Stories"
2. Select a story from list
3. Enter API endpoint
4. Click "Generate Both"
5. Review and download
```

## 🔐 Security Notes

- Never commit `.env` files with real API keys
- Use environment variables in production
- Rotate API keys regularly
- Restrict API key permissions in both Rally and OpenAI

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Configuration not validated" | Check all API keys are correct in .env |
| Rally connection fails | Verify API key and workspace URL |
| OpenAI timeout | Reduce AC size or increase timeout |
| Port already in use | Change PORT in .env file |

## 🚀 Development

```bash
# Install dev dependencies
npm install --save-dev nodemon

# Run with auto-reload
npm run dev

# Run tests (when added)
npm test
```

## 📝 Sample Output

### Generated Test Case
```
Test Case ID: TC001
Title: Valid Login with Correct Credentials
Description: Verify user can login with valid credentials
Preconditions:
  - User is on login page
  - Database has test user
Steps:
  1. Enter valid username
  2. Click password field
  3. Enter correct password
  4. Click Login button
Expected Result: User redirected to dashboard
Priority: High
```

### Generated Postman Request
```json
{
  "name": "Login with Valid Credentials",
  "request": {
    "method": "POST",
    "url": "https://api.example.com/auth/login",
    "header": [
      {"key": "Content-Type", "value": "application/json"}
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"username\": \"testuser\", \"password\": \"testpass\"}"
    }
  },
  "event": [
    {
      "listen": "test",
      "script": "pm.test(\"Status code is 200\", () => { pm.response.to.have.status(200); })"
    }
  ]
}
```

## 💡 Tips

- **Large AC**: Break into smaller pieces for better test case quality
- **API Endpoints**: Include full URLs for accurate Postman generation  
- **Batch Processing**: Generate both test cases and requests together
- **Iteration**: Refine generated output as needed

## 📦 Dependencies

- **express** - Web server framework
- **openai** - GPT-4 integration
- **axios** - HTTP client for Rally API
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment configuration
- **body-parser** - Request body parsing

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Additional test case templates
- More AI model options
- Database persistence
- CI/CD integration
- UI enhancements

## 📄 License

MIT License - See LICENSE file

## 🆘 Support

For issues:
1. Check troubleshooting section
2. Verify all credentials are correct
3. Check applicable API services status
4. Review error messages in console logs

---

**Built with ❤️ for QA Automation Engineers**
=======
# Rally-Test-Case-Generator
Test case genertor for rally
>>>>>>> 9d0fe769796660f02db431fc4b9342c6bfda71c4
