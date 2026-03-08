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
  if (!sessionid) return res.status(400).json({ error: 'Session ID diperlukan untuk mengakses story.' });

  try {
    const result = await fetchStories(username, sessionid);
    return res.status(200).json(result);
  } catch (e) {
    console.error('Story error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function fetchStories(username, sessionid) {
  // Fetch stories using instagram120 with sessionid as cookie
  const r = await fetch(`${BASE_URL}/stories`, {
    method: 'POST',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
      'Content-Type': 'application/json',
      // Pass sessionid so API can access private/story content
      'x-ig-sessionid': sessionid,
    },
    body: JSON.stringify({ username, sessionid }),
  });

  if (!r.ok) {
    const errText = await r.text();
    console.error('Stories API response:', errText);
    throw new Error(`Gagal mengambil story. Pastikan Session ID valid dan akun tidak privat.`);
  }

  const data = await r.json();

  // Handle various response shapes from instagram120
  const items =
    data?.data?.items ||
    data?.items ||
    data?.reels_media?.[0]?.items ||
    data?.data ||
    [];

  if (!items || items.length === 0) {
    throw new Error('Tidak ada story aktif dari akun ini, atau Session ID tidak valid.');
  }

  const stories = items.map((item, i) => {
    const isVideo = item.media_type === 2 || !!item.video_versions;
    const videoUrl = item.video_versions?.[0]?.url || item.video_url || '';
    const imageUrl =
      item.image_versions2?.candidates?.[0]?.url ||
      item.display_url ||
      item.thumbnail_url ||
      '';
    const timestamp = item.taken_at
      ? new Date(item.taken_at * 1000).toLocaleString('id-ID')
      : `Story ${i + 1}`;

    return {
      id: item.id || i,
      isVideo,
      url: isVideo ? videoUrl : imageUrl,
      thumb: imageUrl,
      timestamp,
    };
  });

  // Fetch user info for avatar
  let userInfo = { author: username, avatar: '' };
  try {
    const uRes = await fetch(`${BASE_URL}/userInfo`, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username }),
    });
    if (uRes.ok) {
      const uData = await uRes.json();
      const u = uData?.data || uData?.user || uData;
      userInfo = {
        author: u?.full_name || username,
        avatar: u?.profile_pic_url || u?.hd_profile_pic_url_info?.url || '',
      };
    }
  } catch (e) {
    console.log('userInfo failed:', e.message);
  }

  return {
    success: true,
    username,
    author: userInfo.author,
    avatar: userInfo.avatar,
    stories,
  };
}