const RAPIDAPI_KEY = '01d499e5bcmsh744e16d8d9765cep1dacfajsn4f64fff0f946';
const IG120_HOST = 'instagram120.p.rapidapi.com';
const IG120_BASE = 'https://instagram120.p.rapidapi.com/api/instagram';

const SCRAPER_HOST = 'instagram-downloader-scraper-reels-igtv-posts-stories.p.rapidapi.com';
const SCRAPER_BASE = 'https://instagram-downloader-scraper-reels-igtv-posts-stories.p.rapidapi.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { username, sessionid } = req.body || {};
  if (!username || !sessionid) {
    return res.status(400).json({ error: 'username dan sessionid diperlukan' });
  }

  const results = {};

  try {
    const r = await fetch(`${IG120_BASE}/stories`, {
      method: 'POST',
      headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': IG120_HOST, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sessionid }),
    });
    const text = await r.text();
    results['ig120_stories_body'] = { status: r.status, response: tryParse(text) };
  } catch (e) { results['ig120_stories_body'] = { error: e.message }; }

  try {
    const r = await fetch(`${IG120_BASE}/stories`, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': IG120_HOST,
        'Content-Type': 'application/json',
        'x-ig-sessionid': sessionid,
        'cookie': `sessionid=${sessionid}`,
      },
      body: JSON.stringify({ username }),
    });
    const text = await r.text();
    results['ig120_stories_cookie'] = { status: r.status, response: tryParse(text) };
  } catch (e) { results['ig120_stories_cookie'] = { error: e.message }; }

  try {
    const r = await fetch(`${IG120_BASE}/story`, {
      method: 'POST',
      headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': IG120_HOST, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sessionid }),
    });
    const text = await r.text();
    results['ig120_story_singular'] = { status: r.status, response: tryParse(text) };
  } catch (e) { results['ig120_story_singular'] = { error: e.message }; }

  try {
    const r = await fetch(`${IG120_BASE}/highlights`, {
      method: 'POST',
      headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': IG120_HOST, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const text = await r.text();
    results['ig120_highlights'] = { status: r.status, response: tryParse(text) };
  } catch (e) { results['ig120_highlights'] = { error: e.message }; }

  try {
    const storyUrl = `https://www.instagram.com/stories/${username}/`;
    const r = await fetch(`${SCRAPER_BASE}/scraper?url=${encodeURIComponent(storyUrl)}`, {
      method: 'GET',
      headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': SCRAPER_HOST },
    });
    const text = await r.text();
    results['scraper_stories'] = { status: r.status, response: tryParse(text) };
  } catch (e) { results['scraper_stories'] = { error: e.message }; }

  return res.status(200).json(results);
}

function tryParse(text) {
  try { return JSON.parse(text); } catch { return text; }
}