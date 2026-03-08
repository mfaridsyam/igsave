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
  const r = await fetch(`${IG120_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': IG120_HOST,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`IG120 error ${r.status}`);
  return r.json();
}

async function scraperFetch(url) {
  const r = await fetch(
    `${SCRAPER_BASE}/scraper?url=${encodeURIComponent(url)}`,
    {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': SCRAPER_HOST,
      },
    }
  );
  if (!r.ok) throw new Error(`Scraper error ${r.status}`);
  return r.json();
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
    try {
      const scraperData = await scraperFetch(originalUrl);
      const scraperItems = scraperData?.data || [];

      const imgItems = scraperItems.filter(i => !i.isVideo);
      images = imgItems.map(i => i.media).filter(Boolean);

      if (scraperItems.length > 1) {
        type = 'Carousel';
      } else if (images.length === 1) {
        type = 'Foto';
      }
    } catch (e) {
      console.log('Scraper fallback failed:', e.message);
      if (cover) images = [cover];
      type = 'Foto';
    }
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