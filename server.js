const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const rootDirectory = __dirname;
loadEnvironmentFile(path.join(rootDirectory, '.env'));

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

const server = http.createServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/api/chat') {
    await handleChatRequest(request, response);
    return;
  }

  if (request.method === 'GET') {
    serveStaticFile(request, response);
    return;
  }

  sendJson(response, 405, { error: 'Method not allowed.' });
});

async function handleChatRequest(request, response) {
  if (!process.env.GEMINI_API_KEY) {
    sendJson(response, 500, { error: 'Missing GEMINI_API_KEY. Add it to your .env file, then restart the server.' });
    return;
  }

  try {
    const { messages } = await readJsonBody(request);
    const sanitizedMessages = Array.isArray(messages)
      ? messages
          .filter((message) => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
          .slice(-12)
          .map((message) => ({ role: message.role, content: message.content.slice(0, 8000) }))
      : [];

    if (!sanitizedMessages.some((message) => message.role === 'user')) {
      sendJson(response, 400, { error: 'Please send a message first.' });
      return;
    }

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-3.5-flash'}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You are Luma, a helpful all-purpose assistant. Give accurate, practical, and well-structured answers. Match the user\'s language. Be concise by default, but explain important steps clearly. If a request is ambiguous, ask one focused follow-up question.' }]
        },
        contents: sanitizedMessages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        }))
      })
    });

    const payload = await geminiResponse.json();
    if (!geminiResponse.ok) {
      sendJson(response, geminiResponse.status, { error: payload.error?.message || 'The AI service returned an error.' });
      return;
    }

    const answer = extractTextOutput(payload);
    sendJson(response, 200, { answer: answer || 'I could not generate a response. Please try again.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    sendJson(response, 500, { error: message });
  }
}

function extractTextOutput(payload) {
  return (payload.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || '')
    .join('\n');
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error('Request is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON request.')); }
    });
    request.on('error', reject);
  });
}

function serveStaticFile(request, response) {
  const requestPath = request.url === '/' ? '/index.html' : request.url;
  const safePath = path.normalize(requestPath).replace(/^([.][.][\\/])+/, '');
  const filePath = path.join(rootDirectory, safePath);
  if (!filePath.startsWith(rootDirectory)) {
    sendJson(response, 403, { error: 'Forbidden.' });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) { sendJson(response, 404, { error: 'Not found.' }); return; }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function loadEnvironmentFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`Luma is running at http://localhost:${port}`));
