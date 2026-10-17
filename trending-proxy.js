// Cloudflare Worker: bridges X's official API to the chat widget (adds CORS, caches 60s).
// Setup: wrangler secret put X_BEARER_TOKEN   (token from developer.x.com, needs access to the Trends endpoint)
// Deploy, then use:  trending-chat.html?feed=https://YOUR-WORKER.workers.dev/?woeid=1
// woeid: 1 = Worldwide, 23424950 = Spain, 23424977 = United States

export default {
  async fetch(req, env, ctx) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    const woeid = new URL(req.url).searchParams.get('woeid') || '1';
    const cache = caches.default;
    const key = new Request('https://cache.local/trends/' + woeid);
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, { headers: cors });

    const r = await fetch(`https://api.x.com/2/trends/by/woeid/${woeid}?max_trends=30`, {
      headers: { Authorization: 'Bearer ' + env.X_BEARER_TOKEN },
    });
    if (!r.ok) return new Response(JSON.stringify({ error: r.status }), { status: 502, headers: cors });

    const j = await r.json();
    const items = (j.data || []).map(t => ({
      id: t.trend_name,
      name: t.trend_name,
      count: t.tweet_count || 0,
      url: 'https://x.com/search?q=' + encodeURIComponent(t.trend_name),
    }));
    const body = JSON.stringify({ items });
    ctx.waitUntil(cache.put(key, new Response(body, { headers: { 'Cache-Control': 'max-age=60' } })));
    return new Response(body, { headers: cors });
  },
};
