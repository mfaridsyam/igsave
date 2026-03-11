const API_KEYS = [
  '01d499e5bcmsh744e16d8d9765cep1dacfajsn4f64fff0f946',
  '5ca6a28e1amsh4e72af35cbb82bfp1aa9b9jsnf0d6c201c649',
  '91ececc24amsh5ead0d390bafa1ep165af9jsnfe3488b4b13d',
];
const IG120_HOST = 'instagram120.p.rapidapi.com';
const IG120_BASE = 'https://instagram120.p.rapidapi.com/api/instagram';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, highlightId, sessionid } = req.body;

  try {
    if (highlightId) {
      const items = await fetchHighlightItems(highlightId);
      return res.status(200).json(items);
    }
    if (!username) return res.status(400).json({ error: 'Username is required.' });
    const result = await fetchHighlights(username.trim().replace('@', ''), sessionid || null);
    return res.status(200).json(result);
  } catch (e) {
    console.error('Highlight error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function ig120(endpoint, body) {
  let lastError;
  for (const key of API_KEYS) {
    try {
      const r = await fetch(`${IG120_BASE}/${endpoint}`, {
        method: 'POST',
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': IG120_HOST,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (r.status === 429) { lastError = new Error(`Rate limit on key ...${key.slice(-6)}`); continue; }
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    } catch (e) {
      if (e.message.includes('429') || e.message.includes('Rate limit')) { lastError = e; continue; }
      throw e;
    }
  }
  throw lastError || new Error('All API keys exhausted');
}

async function fetchHighlights(username, sessionid) {
  const body = sessionid ? { username, sessionid } : { username };
  const raw = await ig120('highlights', body);

  if (raw?.response_type === 'private page' || raw?.success === false) {
    if (!sessionid) {
      throw new Error('This account is private. Set your Session ID via the "Private Account Access" button first.');
    }
    throw new Error('Cannot access this private account. Make sure the Session ID belongs to an account that follows this user.');
  }

  let tray =
    raw?.result?.tray ||
    raw?.tray ||
    raw?.data?.tray ||
    (Array.isArray(raw?.result) ? raw.result : null) ||
    [];

  if (!tray || tray.length === 0) {
    throw new Error('No highlights found for this account.');
  }

  const highlights = tray.map(item => ({
    id: item.id || item.pk || '',
    title: item.title || '',
    cover:
      item.cover_media?.thumbnail_src ||
      item.cover_media_cropped_thumbnail?.url ||
      item.cover?.cropped_image_version?.url ||
      '',
    mediaCount: item.media_count || 0,
  })).filter(h => h.id);

  if (!highlights.length) {
    throw new Error('No highlights found for this account.');
  }

  let author = username, avatar = '';
  try {
    const uRaw = await ig120('userInfo', { username });
    const u = uRaw?.result?.[0]?.user || uRaw?.result?.user || {};
    author = u.full_name || username;
    avatar = u.profile_pic_url || '';
  } catch (e) { console.log('userInfo failed:', e.message); }

  return { success: true, username, author, avatar, highlights };
}

async function fetchHighlightItems(highlightId) {
  const raw = await ig120('highlightStories', { highlightId });

  let items =
    raw?.result?.items ||
    raw?.items ||
    raw?.data?.items ||
    (Array.isArray(raw?.result) ? raw.result : null) ||
    [];

  if (!items.length) {
    const raw2 = await ig120('highlight stories', { highlightId });
    items =
      raw2?.result?.items ||
      raw2?.items ||
      (Array.isArray(raw2?.result) ? raw2.result : null) ||
      [];
  }

  if (!items.length) {
    throw new Error('No items found in this highlight.');
  }

  const parsed = items.map((item, i) => {
    const isVideo = item.media_type === 2 || !!item.video_versions?.length;
    const videoUrl = item.video_versions?.[0]?.url || item.video_url || '';
    const imageUrl =
      item.image_versions2?.candidates?.[0]?.url ||
      item.display_url ||
      item.thumbnail_url ||
      '';
    return {
      id: item.id || i,
      isVideo,
      url: isVideo ? videoUrl : imageUrl,
      thumb: imageUrl,
    };
  }).filter(i => i.url);

  return { success: true, items: parsed };
}