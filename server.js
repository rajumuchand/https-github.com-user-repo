import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const model = process.env.OPENAI_MODEL || 'gpt-6-astra';
const files = new Map([
  ['/', 'atlas.html'],
  ['/index.html', 'index.html'],
  ['/atlas.html', 'atlas.html'],
  ['/developer.html', 'developer.html']
]);
const languages = new Map([
  ['en-US', 'English'],
  ['hi-IN', 'Hindi'],
  ['kn-IN', 'Kannada']
]);

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 20000) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

function extractAnswer(payload) {
  return (payload.output || [])
    .filter((item) => item.type === 'message' && item.role === 'assistant')
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/api/status') {
    sendJson(response, 200, { available: Boolean(process.env.OPENAI_API_KEY), model });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/chat') {
    if (!process.env.OPENAI_API_KEY) {
      sendJson(response, 503, { error: 'Hosted AI is not configured on this server.' });
      return;
    }

    try {
      const body = await readJson(request);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      const language = languages.get(body.language);
      if (!message || message.length > 3000 || !language) {
        sendJson(response, 400, { error: 'Provide a message under 3000 characters and a supported language.' });
        return;
      }

      const history = Array.isArray(body.history) ? body.history.slice(-10).flatMap((item) => {
        if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') return [];
        const content = item.content.trim().slice(-1200);
        return content ? [{ role: item.role, content }] : [];
      }) : [];
      const upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          instructions: `You are a friendly cyber-safety assistant. Answer naturally in ${language}, even if the user mixes languages. Help with general conversation as well as online safety. Keep replies clear and concise, ask a brief follow-up when needed, and do not claim a message or link is safe based only on its text. You are an educational assistant, not a security scanner. Never ask for passwords, sign-in codes, or full payment details.`,
          input: [...history, { role: 'user', content: message }],
          max_output_tokens: 500,
          store: false
        })
      });
      const payload = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        console.error(`OpenAI Responses API returned HTTP ${upstream.status}.`);
        const error = upstream.status === 401
          ? 'OpenAI rejected the configured API key. Update OPENAI_API_KEY and restart the server.'
          : upstream.status === 429
            ? 'OpenAI is rate-limited or the project has no available API quota.'
            : 'The hosted AI request failed.';
        sendJson(response, 502, { error });
        return;
      }

      const answer = extractAnswer(payload);
      if (!answer) {
        sendJson(response, 502, { error: 'The hosted AI returned no text reply.' });
        return;
      }
      sendJson(response, 200, { answer, model });
    } catch (error) {
      sendJson(response, error.status || 502, { error: error.status ? error.message : 'The hosted AI request could not be completed.' });
    }
    return;
  }

  if (request.method === 'GET' && files.has(url.pathname)) {
    try {
      const filename = files.get(url.pathname);
      const content = await readFile(join(root, filename));
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(content);
    } catch {
      sendJson(response, 404, { error: 'Page not found.' });
    }
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
server.on('error', (error) => {
  console.error('Server failed to start:', error.message);
  process.exit(1);
});
server.listen(port, host, () => {
  console.log(`Cyber Security App running at http://127.0.0.1:${port} (listening on ${host})`);
  if (!process.env.OPENAI_API_KEY) console.log('Hosted AI is off. Configure OPENAI_API_KEY to enable it.');
});