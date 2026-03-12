const axios = require('axios');

class RallyClient {
  constructor(apiKey, workspaceUrl) {
    this.apiKey = apiKey;
    this.workspaceUrl = workspaceUrl || 'https://rally1.rallydev.com';
    this.client = axios.create({
      baseURL: this.workspaceUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-RallyIntegrationName': 'AI-TestCase-Generator'
      }
    });
  }

  async getUserStories() {
    try {
      const response = await this.client.get('/slm/v2/userstory', {
        params: {
          fetch: 'FormattedID,Name,AcceptanceCriteria,Description,Owner,Project',
          pagesize: 200
        }
      });
      return response.data.QueryResult.Results;
    } catch (error) {
      throw new Error(`Failed to fetch user stories: ${error.message}`);
    }
  }

  async getAcceptanceCriteria(storyFormattedId) {
    try {
      const response = await this.client.get('/slm/v2/userstory', {
        params: {
          query: `FormattedID eq "${storyFormattedId}"`,
          fetch: 'AcceptanceCriteria,Name,Description',
          pagesize: 100
        }
      });
      const stories = response.data.QueryResult.Results;
      if (stories.length === 0) {
        throw new Error(`Story ${storyFormattedId} not found`);
      }
      return stories[0].AcceptanceCriteria;
    } catch (error) {
      throw new Error(`Failed to fetch acceptance criteria: ${error.message}`);
    }
  }

  async getDefects() {
    try {
      const response = await this.client.get('/slm/v2/defect', {
        params: {
          fetch: 'FormattedID,Name,Description,Severity',
          pagesize: 200
        }
      });
      return response.data.QueryResult.Results;
    } catch (error) {
      throw new Error(`Failed to fetch defects: ${error.message}`);
    }
  }
}

module.exports = RallyClient;
