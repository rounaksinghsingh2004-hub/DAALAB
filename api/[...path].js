export default async function handler(request, response) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return response.status(503).json({ error: 'The analysis backend has not been configured.' });
  }

  // Vercel's catch-all query parameter is not consistently populated across
  // deployment configurations. Resolve the endpoint from the incoming URL,
  // which preserves the actual route (for example, /api/analyze).
  const incomingUrl = new URL(request.url, 'http://vercel.local');
  const apiPath = decodeURIComponent(
    incomingUrl.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '')
  ) || (Array.isArray(request.query?.path)
    ? request.query.path.join('/')
    : String(request.query?.path || ''));

  if (!['analyze', 'benchmark', 'fasta'].includes(apiPath)) {
    return response.status(404).json({ error: 'API route not found.' });
  }
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

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
      signal: AbortSignal.timeout(105_000)
    });
    const responseBody = await upstream.text();
    response.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) response.setHeader('content-type', contentType);
    return response.send(responseBody);
  } catch (error) {
    console.error('Backend proxy failed:', error.message);
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return response.status(timedOut ? 504 : 502).json({
      error: timedOut
        ? 'The analysis service is taking longer than expected to wake up. Please wait a minute and retry.'
        : 'The analysis backend could not be reached. Check your connection and retry.'
    });
  }
}
