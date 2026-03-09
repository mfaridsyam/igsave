const API_KEYS = [
  '01d499e5bcmsh744e16d8d9765cep1dacfajsn4f64fff0f946',
  '5ca6a28e1amsh4e72af35cbb82bfp1aa9b9jsnf0d6c201c649',
];
const IG120_HOST = 'instagram120.p.rapidapi.com';
const IG120_BASE = 'https://instagram120.p.rapidapi.com/api/instagram';

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
    const result = await fetchMedia(shortcode, url);
    return res.status(200).json(result);
  } catch (e) {
    console.error('Download error:', e.message);
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

async function fetchMedia(shortcode, originalUrl) {
  const raw = await ig120('mediaByShortcode', { shortcode });
  const item = Array.isArray(raw) ? raw[0] : raw;

  if (!item) throw new Error('Gagal mengambil media. Pastikan link benar dan akun tidak privat.');

  const meta = item.meta || {};
  const urls = item.urls || [];

  const username = meta.username || '';
  const title = meta.title || '';
  const likes = meta.likeCount || 0;
  const comments = meta.commentCount || 0;
  const cover = item.pictureUrl || '';

  const videoEntry = urls.find(u =>
    u.extension === 'mp4' || u.name === 'MP4' ||
    (u.url && u.url.includes('.mp4'))
  );
  const videoUrl = videoEntry?.url || '';

  let images = [];
  let type = 'Post';

  if (!videoUrl) {
    const imageEntries = urls.filter(u =>
      u.extension === 'jpg' || u.extension === 'jpeg' || u.extension === 'png' ||
      u.name === 'JPG' || u.name === 'PNG' || u.name === 'JPEG' ||
      (u.url && (u.url.includes('.jpg') || u.url.includes('.jpeg') || u.url.includes('cdninstagram')))
    );

    if (imageEntries.length > 0) {
      images = imageEntries.map(u => u.url).filter(Boolean);
    } else if (cover) {
      images = [cover];
    }

    type = images.length > 1 ? 'Carousel' : 'Foto';
  } else {
    type = originalUrl.includes('/reel') ? 'Reel' : 'Video';
  }

  let avatar = '';
  let author = username;
  if (username) {
    try {
      const uRaw = await ig120('userInfo', { username });
      const userResult = uRaw?.result?.[0]?.user || uRaw?.result?.user || {};
      avatar = userResult.profile_pic_url || userResult.hd_profile_pic_url_info?.url || '';
      author = userResult.full_name || username;
    } catch (e) {
      console.log('userInfo failed:', e.message);
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