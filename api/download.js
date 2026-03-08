export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const igRegex = /https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|stories|tv)\/[^/?#]+/;
  if (!igRegex.test(url)) {
    return res.status(400).json({ error: 'URL Instagram tidak valid.' });
  }

  try {
    const result = await fetchInstagramAPI(url);
    return res.status(200).json(result);
  } catch (e) {
    console.error('Error:', e.message);
    return res.status(500).json({ error: 'Gagal mengambil media. Coba lagi.' });
  }
}

async function fetchInstagramAPI(url) {
  // Bersihkan URL dari query params
  const cleanUrl = url.split('?')[0].replace(/\/$/, '');

  const apiUrl = `https://www.tikwm.com/api/instagram?url=${encodeURIComponent(cleanUrl)}`;

  const r = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.tikwm.com/',
    }
  });

  if (!r.ok) throw new Error('API request failed');
  const data = await r.json();
  if (data.code !== 0 || !data.data) throw new Error('No data returned');

  const v = data.data;

  // Tentukan tipe konten
  let type = 'Post';
  if (cleanUrl.includes('/reel')) type = 'Reel';
  else if (cleanUrl.includes('/stories')) type = 'Story';
  else if (v.images && v.images.length > 1) type = 'Carousel';
  else if (v.play) type = 'Video';
  else if (v.images?.length === 1) type = 'Foto';

  return {
    success: true,
    media: {
      title: v.title || '',
      author: v.author?.nickname || '',
      authorUsername: v.author?.unique_id || '',
      avatar: v.author?.avatar || '',
      cover: v.origin_cover || v.cover || v.images?.[0] || '',
      type,
      likes: v.digg_count || 0,
      comments: v.comment_count || 0,
      downloadUrl: v.play || '',
      music: v.music_info?.play || null,
      images: v.images || [],
    }
  };
}