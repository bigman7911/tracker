/**
 * Reseller Tracker — Amazon SP-API Proxy
 * Deploy to Cloudflare Workers
 * 
 * Handles:
 *   POST /token     — exchanges refresh token for access token
 *   GET  /finances  — proxies SP-API financial events
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Client-Id, X-Amz-Client-Secret, X-Amz-Refresh-Token, X-Amz-Marketplace-Id',
};

function corsResponse(body, status, extraHeaders) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extraHeaders },
  });
}

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Token exchange failed ' + res.status + ': ' + err);
  }
  const data = await res.json();
  return data.access_token;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── POST /token ────────────────────────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/token') {
      try {
        const body = await request.json();
        const { clientId, clientSecret, refreshToken } = body;
        if (!clientId || !clientSecret || !refreshToken) {
          return corsResponse(JSON.stringify({ error: 'Missing clientId, clientSecret, or refreshToken' }), 400);
        }
        const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
        return corsResponse(JSON.stringify({ access_token: accessToken }), 200);
      } catch (err) {
        return corsResponse(JSON.stringify({ error: err.message }), 500);
      }
    }

    // ── GET /finances ──────────────────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/finances') {
      try {
        const h = request.headers;
        const clientId      = h.get('X-Amz-Client-Id');
        const clientSecret  = h.get('X-Amz-Client-Secret');
        const refreshToken  = h.get('X-Amz-Refresh-Token');
        const marketplaceId = h.get('X-Amz-Marketplace-Id') || 'ATVPDKIKX0DER';

        if (!clientId || !clientSecret || !refreshToken) {
          return corsResponse(JSON.stringify({ error: 'Missing auth headers' }), 400);
        }

        const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

        const postedAfter  = url.searchParams.get('postedAfter')  || '';
        const postedBefore = url.searchParams.get('postedBefore') || '';

        const spUrl = `https://sellingpartnerapi-na.amazon.com/finances/v0/financialEvents` +
          `?PostedAfter=${encodeURIComponent(postedAfter)}` +
          `&PostedBefore=${encodeURIComponent(postedBefore)}` +
          `&MarketplaceId=${encodeURIComponent(marketplaceId)}`;

        const spRes = await fetch(spUrl, {
          headers: {
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json',
          },
        });

        const spData = await spRes.json();

        if (!spRes.ok) {
          return corsResponse(JSON.stringify({ error: 'SP-API error', detail: spData }), spRes.status);
        }

        return corsResponse(JSON.stringify(spData), 200);

      } catch (err) {
        return corsResponse(JSON.stringify({ error: err.message }), 500);
      }
    }

    // ── Health check ───────────────────────────────────────────────────────
    if (url.pathname === '/' || url.pathname === '/health') {
      return corsResponse(JSON.stringify({ status: 'ok', service: 'reseller-tracker-proxy' }), 200);
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404);
  },
};
