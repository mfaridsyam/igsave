const RAPIDAPI_KEY = '01d499e5bcmsh744e16d8d9765cep1dacfajsn4f64fff0f946';
const RAPIDAPI_HOST = 'instagram120.p.rapidapi.com';
const BASE_URL = 'https://instagram120.p.rapidapi.com/api/instagram';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { shortcode, username, sessionid, endpoint } = req.body || {};

  try {
    let body = {};
    if (endpoint === 'mediaByShortcode') body = { shortcode };
    else if (endpoint === 'userInfo') body = { username };
    else if (endpoint === 'stories') body = { username, sessionid };
    else if (endpoint === 'profile') body = { username };

    const r = await fetch(`${BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }

    return res.status(200).json({
      status: r.status,
      ok: r.ok,
      rawResponse: json,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}