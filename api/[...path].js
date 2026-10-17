export default async function handler(request, response) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return response.status(503).json({ error: 'The analysis backend has not been configured.' });
  }

  // Resolve the actual route from the URL; query.path is not populated consistently.
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

  let body = request.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    body = JSON.stringify(body);
  }

  // Render Free services may return an edge 502 while their sleeping instance boots.
  // Retry transient gateway statuses instead of immediately relaying that page to the browser.
  const retryableStatuses = new Set([502, 503, 504]);
  const retryDelays = [2000, 4000, 6000, 8000, 10000];
  const deadline = Date.now() + 90_000;
  let attempt = 0;
  let lastIssue = 'The backend did not return a usable response.';

  while (Date.now() < deadline) {
    attempt += 1;
    const remaining = deadline - Date.now();

    try {
      const upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers,
        body,
        signal: AbortSignal.timeout(Math.min(15_000, remaining))
      });

      const responseBody = await upstream.text();
      if (!retryableStatuses.has(upstream.status)) {
        response.status(upstream.status);
        const contentType = upstream.headers.get('content-type');
        if (contentType) response.setHeader('content-type', contentType);
        return response.send(responseBody);
      }

      lastIssue = `The backend returned HTTP ${upstream.status}.`;
      console.warn(`Backend temporarily unavailable (attempt ${attempt}, status ${upstream.status}).`);
    } catch (error) {
      lastIssue = error?.name === 'TimeoutError'
        ? 'The backend connection timed out.'
        : 'The backend could not be reached.';
      console.warn(`Backend request failed on attempt ${attempt}: ${error.message}`);
    }

    const timeLeft = deadline - Date.now();
    if (timeLeft <= 0) break;

    const wait = Math.min(retryDelays[Math.min(attempt - 1, retryDelays.length - 1)], timeLeft);
    await new Promise(resolve => setTimeout(resolve, wait));
  }

  response.setHeader('retry-after', '10');
  return response.status(503).json({
    error: 'The analysis service is still waking up or temporarily unavailable. Please wait a little and retry.',
    detail: lastIssue
  });
}
