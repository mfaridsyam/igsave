// Set RAPIDAPI_KEYS di Vercel (dipisah koma) untuk menimpa key di bawah.
const FALLBACK_KEYS = [
  '01d499e5bcmsh744e16d8d9765cep1dacfajsn4f64fff0f946',
  '5ca6a28e1amsh4e72af35cbb82bfp1aa9b9jsnf0d6c201c649',
  '91ececc24amsh5ead0d390bafa1ep165af9jsnfe3488b4b13d',
];
const API_KEYS = (process.env.RAPIDAPI_KEYS || '')
  .split(',').map(k => k.trim()).filter(Boolean);
if (!API_KEYS.length) API_KEYS.push(...FALLBACK_KEYS);
const RAPID_HOST = 'ig-downloader-api.p.rapidapi.com';
const RAPID_BASE = 'https://ig-downloader-api.p.rapidapi.com/api/instagram';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required.' });

  try {
    const result = await fetchStories(username.trim().replace('@', ''));
    return res.status(200).json(result);
  } catch (e) {
    console.error('Story error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function rapidApi(endpoint, body) {
  let lastError;
  for (const key of API_KEYS) {
    try {
      const r = await fetch(`${RAPID_BASE}/${endpoint}`, {
        method: 'POST',
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': RAPID_HOST,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (r.status === 429 || r.status === 403) { lastError = new Error(`Key ...${key.slice(-6)} unavailable (${r.status})`); continue; }
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    } catch (e) {
      if (e.message.includes('429') || e.message.includes('unavailable')) { lastError = e; continue; }
      throw e;
    }
  }
  console.error('All API keys failed:', lastError?.message);
  throw new Error('Service is busy or the API quota has run out. Please try again later.');
}

async function fetchStories(username) {
  const raw = await rapidApi('stories', { username });

  if (raw?.response_type === 'private page' || raw?.success === false) {
    throw new Error('This account is private. Only public accounts are supported.');
  }

  let items =
    raw?.result?.items ||
    raw?.result?.reels_media?.[0]?.items ||
    raw?.data?.items ||
    raw?.items ||
    (Array.isArray(raw?.result) && raw.result.length > 0 ? raw.result : null) ||
    [];

  if (!items.length && raw?.result?.tray) {
    items = raw.result.tray?.[0]?.items || [];
  }

  if (!items || items.length === 0) {
    throw new Error('No active stories found for this account, or the account is private.');
  }

  const stories = items.map((item, i) => {
    const isVideo = item.media_type === 2 || !!item.video_versions?.length;
    const videoUrl = item.video_versions?.[0]?.url || item.video_url || '';
    const imageUrl =
      item.image_versions2?.candidates?.[0]?.url ||
      item.display_url || item.thumbnail_url || '';
    const takenAt = item.taken_at || null;
    return {
      id: item.id || i,
      isVideo,
      url: isVideo ? videoUrl : imageUrl,
      thumb: imageUrl,
      takenAt,
    };
  }).filter(s => s.url);

  if (!stories.length) throw new Error('No downloadable stories found.');

  let author = username, avatar = '';
  try {
    const uRaw = await rapidApi('userInfo', { username });
    const u = uRaw?.result?.[0]?.user || uRaw?.result?.user || {};
    author = u.full_name || username;
    avatar = u.profile_pic_url || '';
  } catch (e) { console.log('userInfo failed:', e.message); }

  return { success: true, username, author, avatar, stories };
}