const axios = require('axios');

async function fetchSwaggerSpec(swaggerUrl, auth) {
  const config = {
    headers: {},
    timeout: 15000
  };

  if (auth?.type === 'basic') {
    config.auth = {
      username: auth.username,
      password: auth.password
    };
  }

  if (auth?.type === 'bearer') {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }

  const response = await axios.get(swaggerUrl, config);
  return response.data;
}

module.exports = { fetchSwaggerSpec };
