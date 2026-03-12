# Rally AI Test Case Generator - Copilot Instructions

## Project Overview
A Node.js web application that integrates with Rally (test and requirements management platform) to automatically generate AI-powered test cases and Postman API requests from acceptance criteria.

## Technology Stack
- **Backend**: Express.js (Node.js)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **APIs**: Rally API, OpenAI GPT-4
- **Libraries**: axios, dotenv, cors, body-parser

## Key Features
1. Rally integration for fetching user stories and acceptance criteria
2. OpenAI GPT-4 integration for intelligent test case generation
3. Automatic Postman collection generation from acceptance criteria
4. Web UI for manual input and Rally story selection
5. JSON export capabilities for test cases and Postman requests

## Project Structure
```
Rally Integration/
├── src/
│   ├── server.js              # Express server entry point
│   ├── rally.js               # Rally API client
│   ├── testCaseGenerator.js   # OpenAI test case generation
│   └── postmanGenerator.js    # Postman collection generation
├── public/
│   └── index.html             # Web UI
├── package.json               # Dependencies
├── .env.example               # Configuration template
└── .gitignore                 # Git ignore rules
```

## Setup Instructions

### Prerequisites
- Node.js 14+
- Rally API key (from your Rally workspace)
- OpenAI API key
- npm

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Replace placeholder values with your actual credentials:
     - `RALLY_API_KEY`: Your Rally API key
     - `RALLY_WORKSPACE_URL`: Your Rally workspace URL
     - `OPENAI_API_KEY`: Your OpenAI API key
     - `PORT`: Server port (default: 3000)

3. **Start Server**
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Access Web UI**
   - Open browser: `http://localhost:3000`

## Usage

### Method 1: Manual Input
1. Go to Configuration tab and validate API credentials
2. Enter story name and acceptance criteria
3. Click "Generate Test Cases" or "Generate Postman Requests"
4. View results and download JSON

### Method 2: From Rally
1. Click "Fetch Stories from Rally"
2. Select a story from the list
3. Provide API endpoint
4. Click "Generate Both" for test cases + Postman requests
5. Download results

## API Endpoints

### Configuration
- `POST /api/config/validate` - Validate API credentials

### Rally Integration
- `GET /api/rally/stories` - Fetch user stories
- `GET /api/rally/story/:formattedId` - Get story acceptance criteria

### Generation
- `POST /api/generate/testcases` - Generate test cases from AC
- `POST /api/generate/postman` - Generate Postman requests from AC
- `POST /api/export/postman` - Export Postman collection

## Environment Variables
```
RALLY_API_KEY=<your_api_key>
RALLY_WORKSPACE_URL=https://rally1.rallydev.com
OPENAI_API_KEY=<your_openai_key>
PORT=3000
NODE_ENV=development
```

## Development Notes

### Adding Features
- Test case generators in `src/testCaseGenerator.js`
- Postman generation logic in `src/postmanGenerator.js`
- UI components in `public/index.html`

### Error Handling
- Check browser console for client-side errors
- Server logs show API integration errors
- Status messages display API response errors

## Troubleshooting

**"Configuration not validated" error**
- Ensure all API keys are correct
- Check .env file has proper formatting

**Rally connection fails**
- Verify Rally API key and workspace URL
- Check network connectivity
- Ensure Rally workspace is active

**OpenAI requests timeout**
- Verify OpenAI API key is valid
- Check account has sufficient credits
- Long acceptance criteria may need API timeout adjustment

## Future Enhancements
- Database persistence for generated test cases
- Integration with JIRA and Azure DevOps
- Custom test case templates
- CI/CD pipeline integration
- Batch processing support
- Advanced filtering and search

## Support & Contributions
For issues or feature requests, refer to project documentation.
