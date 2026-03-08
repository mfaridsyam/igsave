const RAPIDAPI_KEY = '01d499e5bcmsh744e16d8d9765cep1dacfajsn4f64fff0f946';
const RAPIDAPI_HOST = 'instagram120.p.rapidapi.com';
const BASE_URL = 'https://instagram120.p.rapidapi.com/api/instagram';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const igRegex = /https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|stories|tv)\/([^/?#]+)/;
  const match = url.match(igRegex);
  if (!match) return res.status(400).json({ error: 'URL Instagram tidak valid.' });

  const shortcode = match[3];

  try {
    const result = await fetchByShortcode(shortcode);
    return res.status(200).json(result);
  } catch (e) {
    console.error('Download error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function ig120(endpoint, body) {
  const r = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

async function fetchByShortcode(shortcode) {
  // Response is an array: rawResponse[0]
  const raw = await ig120('mediaByShortcode', { shortcode });
  const item = Array.isArray(raw) ? raw[0] : raw;

  if (!item) throw new Error('Gagal mengambil media. Pastikan link benar dan akun tidak privat.');

  const meta = item.meta || {};
  const urls = item.urls || [];

  // Video URL - first mp4 in urls[]
  const videoEntry = urls.find(u => u.extension === 'mp4' || u.name === 'MP4');
  const videoUrl = videoEntry?.url || '';

  // Cover/thumbnail
  const cover = item.pictureUrl || '';

  // Caption & stats from meta
  const title = meta.title || '';
  const username = meta.username || '';
  const likes = meta.likeCount || 0;
  const comments = meta.commentCount || 0;

  // Determine type
  let type = 'Post';
  if (videoUrl) type = 'Video';
  if (meta.sourceUrl?.includes('/reel')) type = 'Reel';

  // For carousel: check if urls has multiple image entries
  const imageEntries = urls.filter(u =>
    u.extension === 'jpg' || u.extension === 'jpeg' ||
    u.extension === 'png' || u.name === 'JPG' || u.name === 'PNG'
  );
  let images = imageEntries.map(u => u.url).filter(Boolean);

  // If no separate images but we have a cover and no video = single photo
  if (!videoUrl && images.length === 0 && cover) {
    images = [cover];
    type = 'Foto';
  }

  if (images.length > 1) type = 'Carousel';

  // Fetch user avatar via userInfo
  let avatar = '';
  let author = '';
  if (username) {
    try {
      const uRaw = await ig120('userInfo', { username });
      // Response: { result: [ { user: { profile_pic_url, full_name, ... } } ] }
      const userResult = uRaw?.result?.[0]?.user || uRaw?.result?.user || {};
      avatar = userResult.profile_pic_url || userResult.hd_profile_pic_url_info?.url || '';
      author = userResult.full_name || username;
    } catch (e) {
      console.log('userInfo failed:', e.message);
      author = username;
    }
  }

  return {
    success: true,
    media: {
      title,
      author,
      authorUsername: username,
      avatar,
      cover,
      type,
      likes,
      comments,
      downloadUrl: videoUrl,
      music: null,
      images: videoUrl ? [] : images,
    },
  };
}