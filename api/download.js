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
    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
    const result = await fetchIG(cleanUrl);
    return res.status(200).json(result);
  } catch (e) {
    console.error('Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function fetchIG(url) {
  const r = await fetch(
    `https://instagram-downloader-scraper-reels-igtv-posts-stories.p.rapidapi.com/media?url=${encodeURIComponent(url)}`,
    {
      headers: {
        'x-rapidapi-host': 'instagram-downloader-scraper-reels-igtv-posts-stories.p.rapidapi.com',
        'x-rapidapi-key': '01d499e5bcmsh744e16d8d9765cep1dacfajsn4f64fff0f946',
      }
    }
  );

  if (!r.ok) throw new Error(`RapidAPI error: ${r.status}`);
  const data = await r.json();

  const items = data.data || [];
  if (!items.length) throw new Error('Gagal mengambil media. Coba lagi.');

  // Pisahkan video dan gambar
  const videos = items.filter(item => item.isVideo);
  const images = items.filter(item => !item.isVideo);

  const videoUrl = videos[0]?.media || '';
  const imageUrls = images.map(item => item.media).filter(Boolean);
  const cover = items[0]?.thumb || imageUrls[0] || '';

  // Tentukan tipe konten
  let type = 'Post';
  if (url.includes('/reel')) type = 'Reel';
  else if (url.includes('/stories')) type = 'Story';
  else if (items.length > 1) type = 'Carousel';
  else if (videoUrl) type = 'Video';
  else if (imageUrls.length === 1) type = 'Foto';

  return {
    success: true,
    media: {
      title: '',
      author: '',
      authorUsername: '',
      avatar: '',
      cover,
      type,
      likes: 0,
      comments: 0,
      downloadUrl: videoUrl,
      music: null,
      images: videoUrl ? [] : imageUrls,
    }
  };
}