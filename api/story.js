const RAPIDAPI_KEY = '01d499e5bcmsh744e16d8d9765cep1dacfajsn4f64fff0f946';
const RAPIDAPI_HOST = 'instagram120.p.rapidapi.com';
const BASE_URL = 'https://instagram120.p.rapidapi.com/api/instagram';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, sessionid } = req.body;
  if (!username) return res.status(400).json({ error: 'Username diperlukan.' });
  if (!sessionid) return res.status(400).json({ error: 'Session ID diperlukan.' });

  try {
    const result = await fetchStories(username, sessionid);
    return res.status(200).json(result);
  } catch (e) {
    console.error('Story error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function ig120(endpoint, body, sessionid) {
  const headers = {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
    'Content-Type': 'application/json',
  };
  if (sessionid) {
    headers['x-ig-sessionid'] = sessionid;
    headers['cookie'] = `sessionid=${sessionid}`;
  }
  const r = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

async function fetchStories(username, sessionid) {
  let raw = null;
  let items = [];

  try {
    raw = await ig120('stories', { username, sessionid }, sessionid);
    console.log('stories raw:', JSON.stringify(raw).slice(0, 300));

    items =
      raw?.result?.items ||
      raw?.result?.reels_media?.[0]?.items ||
      (Array.isArray(raw?.result) ? raw.result : []) ||
      raw?.items ||
      raw?.data?.items ||
      [];
  } catch (e) {
    console.log('stories endpoint failed:', e.message);
  }

  if (items.length === 0) {
    try {
      raw = await ig120('story', { username, sessionid }, sessionid);
      console.log('story raw:', JSON.stringify(raw).slice(0, 300));
      items =
        raw?.result?.items ||
        raw?.result?.reels_media?.[0]?.items ||
        (Array.isArray(raw?.result) ? raw.result : []) ||
        raw?.items ||
        raw?.data?.items ||
        [];
    } catch (e) {
      console.log('story endpoint failed:', e.message);
    }
  }

  if (!items || items.length === 0) {
    throw new Error(
      'Tidak ada story aktif, atau Session ID tidak memiliki akses. ' +
      'Pastikan Session ID masih valid dan kamu mengikuti akun tersebut jika privat.'
    );
  }

  const stories = items.map((item, i) => {
    const isVideo = item.media_type === 2 || !!item.video_versions?.length || !!item.video_url;
    const videoUrl = item.video_versions?.[0]?.url || item.video_url || '';
    const imageUrl =
      item.image_versions2?.candidates?.[0]?.url ||
      item.display_url ||
      item.thumbnail_url ||
      item.pictureUrl ||
      '';
    const timestamp = item.taken_at
      ? new Date(item.taken_at * 1000).toLocaleString('id-ID')
      : `Story ${i + 1}`;

    return {
      id: item.id || i,
      isVideo,
      url: isVideo ? videoUrl : imageUrl,
      thumb: imageUrl || (isVideo ? '' : imageUrl),
      timestamp,
    };
  }).filter(s => s.url);

  if (stories.length === 0) {
    throw new Error('Tidak ada story yang bisa diunduh dari akun ini.');
  }

  let author = username;
  let avatar = '';
  try {
    const uRaw = await ig120('userInfo', { username });
    const userResult = uRaw?.result?.[0]?.user || uRaw?.result?.user || {};
    author = userResult.full_name || username;
    avatar = userResult.profile_pic_url || '';
  } catch (e) {
    console.log('userInfo failed:', e.message);
  }

  return {
    success: true,
    username,
    author,
    avatar,
    stories,
  };
}