class PostmanGenerator {

static generateCollection(requestsData, collectionName = 'Rally API Tests') {
return {
info: {
name: collectionName,
description: 'Generated from Rally acceptance criteria using AI',
schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
},
item: requestsData.map(req => this.createRequest(req)),
variable: []
};
}

// ✅ FIXED URL BUILDER
static buildUrl(endpoint) {
const url = new URL(`https://example.com${endpoint}`);

return {
raw: `{{baseUrl}}${endpoint}`,
host: ["{{baseUrl}}"],
path: url.pathname.split('/').filter(Boolean),
query: [...url.searchParams.entries()].map(([key, value]) => ({
key,
value
}))
};
}

// ✅ SCRIPT BUILDER (already good)
static buildScripts(validations) {
const scripts = [];

validations.forEach(v => {

if (v.type === 'status') {
scripts.push(
`pm.test('Status ${v.value}', function () {`,
` pm.response.to.have.status(${v.value});`,
`});`,
``
);
}

if (v.type === 'exists') {
scripts.push(
`pm.test('${v.field} exists', function () {`,
` const jsonData = pm.response.json();`,
` pm.expect(jsonData.${v.field}).to.exist;`,
`});`,
``
);
}

if (v.type === 'notEmpty') {
scripts.push(
`pm.test('${v.field} not empty', function () {`,
` const jsonData = pm.response.json();`,
` pm.expect(jsonData.${v.field}.length).to.be.above(0);`,
`});`,
``
);
}

});

return scripts;
}

// ✅ MAIN BUILDER (THIS is what you use)
static createRequest(requestData) {
const endpoint = requestData.endpoint || "/api/test";
const method = requestData.method || "GET";

const request = {
method,
header: [
{ key: "Authorization", value: "Bearer {{token}}" }
],
url: this.buildUrl(endpoint)
};

// ✅ Only include body if NOT GET
if (method !== "GET" && requestData.body) {
request.body = {
mode: "raw",
raw: typeof requestData.body === "string"
? requestData.body
: JSON.stringify(requestData.body, null, 2),
options: {
raw: { language: "json" }
}
};
}

return {
name: requestData.name || "API Request",
request,
response: [],
event: [
{
listen: "test",
script: {
exec: this.buildScripts(requestData.validations || [])
}
}
]
};
}

// (unchanged)
static parseRequestsFromText(text) {
const requests = [];

try {
const jsonMatches = text.match(/\[[\s\S]*\]/);
if (jsonMatches) {
return JSON.parse(jsonMatches[0]);
}
} catch (e) {}

const requestBlocks = text.split(/Request \d+|POST|GET|PUT|DELETE|PATCH/i);

for (let block of requestBlocks) {
if (block.trim().length === 0) continue;

const request = {
name: '',
method: 'GET',
url: '',
headers: [],
body: null,
expectedStatus: 200,
assertions: []
};

const nameMatch = block.match(/name[:\s]*['"]*(.+?)['"]*/i);
if (nameMatch) request.name = nameMatch[1].trim();

const methodMatch = block.match(/method[:\s]*(GET|POST|PUT|DELETE|PATCH)/i);
if (methodMatch) request.method = methodMatch[1].trim();

const urlMatch = block.match(/url[:\s]*['"]*(.+?)['"]*/i);
if (urlMatch) request.url = urlMatch[1].trim();

const statusMatch = block.match(/status[:\s]*(\d{3})/i);
if (statusMatch) request.expectedStatus = parseInt(statusMatch[1]);

if (request.name || request.url) {
requests.push(request);
}
}

return requests;
}
}

module.exports = PostmanGenerator;
