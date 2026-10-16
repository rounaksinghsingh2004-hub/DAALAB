export default async function handler(request, response) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return response.status(503).json({ error: 'The analysis backend has not been configured.' });
  }

  const path = request.query.path;
  const apiPath = Array.isArray(path) ? path.join('/') : String(path || '');
  if (!['analyze', 'benchmark', 'fasta'].includes(apiPath)) {
    return response.status(404).json({ error: 'API route not found.' });
  }
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const incomingUrl = new URL(request.url, 'http://vercel.local');
  const upstreamUrl = `${backendUrl.replace(/\/$/, '')}/api/${apiPath}${incomingUrl.search}`;
  const headers = { accept: request.headers.accept || 'application/json' };
  if (request.headers['content-type']) headers['content-type'] = request.headers['content-type'];

  let body;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = request.body;
    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) body = JSON.stringify(body);
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(25_000)
    });
    const responseBody = await upstream.text();
    response.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) response.setHeader('content-type', contentType);
    return response.send(responseBody);
  } catch (error) {
    console.error('Backend proxy failed:', error.message);
    return response.status(502).json({ error: 'The analysis backend could not be reached.' });
  }
}
