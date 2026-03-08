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
    return res.status(400).json({ error: 'URL Instagram tidak valid. Gunakan link postingan, reel, atau story.' });
  }

  try {
    const result = await fetchSnapInsta(url);
    return res.status(200).json(result);
  } catch (e1) {
    try {
      const result = await fetchInstagramAPI(url);
      return res.status(200).json(result);
    } catch (e2) {
      return res.status(500).json({ error: 'Gagal mengambil media. Pastikan akun tidak private.' });
    }
  }
}

// Primary: snapinsta.app API
async function fetchSnapInsta(url) {
  const formData = new URLSearchParams();
  formData.append('url', url);
  formData.append('lang', 'id');

  const r = await fetch('https://snapinsta.app/action.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://snapinsta.app/',
      'Origin': 'https://snapinsta.app',
    },
    body: formData.toString()
  });

  if (!r.ok) throw new Error('SnapInsta failed');
  const data = await r.json();
  if (!data || data.status === 'error') throw new Error('SnapInsta error');

  // Parse response - SnapInsta returns HTML in some versions
  const html = data.data || '';

  // Extract video URL
  const videoMatch = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
  const downloadUrl = videoMatch?.[1] || '';

  // Extract images for carousel
  const imageMatches = [...html.matchAll(/src="(https:\/\/[^"]+\.(jpg|jpeg|webp)[^"]*)"/g)];
  const images = imageMatches
    .map(m => m[1])
    .filter(u => u.includes('cdninstagram') || u.includes('fbcdn'))
    .slice(0, 10);

  // Extract thumbnail
  const thumbMatch = html.match(/src="(https:\/\/[^"]+\.(jpg|jpeg|webp)[^"]*)"/);
  const cover = thumbMatch?.[1] || '';

  // Determine type
  let type = 'Post';
  if (url.includes('/reel')) type = 'Reel';
  else if (url.includes('/stories')) type = 'Story';
  else if (images.length > 1) type = 'Carousel';
  else if (downloadUrl) type = 'Video';
  else if (images.length === 1) type = 'Foto';

  if (!downloadUrl && images.length === 0) throw new Error('No media found');

  return {
    success: true,
    media: {
      title: '',
      author: '',
      authorUsername: '',
      avatar: '',
      cover: cover || images[0] || '',
      type,
      likes: 0,
      comments: 0,
      downloadUrl,
      music: null,
      images: downloadUrl ? [] : images,
    }
  };
}

// Fallback: instagramsave via savefrom-style API
async function fetchInstagramAPI(url) {
  const apiUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&maxwidth=640&omitscript=true`;

  const r = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });

  if (!r.ok) throw new Error('Instagram oEmbed failed');
  const data = await r.json();

  // oEmbed only gives us thumbnail and author, not download URL
  // Try to get the actual media via a secondary service
  const mediaResult = await fetchSSSGram(url);

  return {
    success: true,
    media: {
      ...mediaResult.media,
      author: data.author_name || mediaResult.media.author,
      authorUsername: data.author_url?.split('/').filter(Boolean).pop() || mediaResult.media.authorUsername,
      cover: data.thumbnail_url || mediaResult.media.cover,
    }
  };
}

// Secondary fallback: sssgram
async function fetchSSSGram(url) {
  const formData = new URLSearchParams();
  formData.append('id', url);
  formData.append('locale', 'id');
  formData.append('tt', '');

  const r = await fetch('https://sssgram.com/abc?url=dl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://sssgram.com/',
      'Origin': 'https://sssgram.com',
    },
    body: formData.toString()
  });

  if (!r.ok) throw new Error('SSSGram failed');
  const html = await r.text();

  const videoMatch = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
  const downloadUrl = videoMatch?.[1] || '';

  const imageMatches = [...html.matchAll(/href="(https:\/\/[^"]+\.(jpg|jpeg|webp)[^"]*)"/g)];
  const images = imageMatches.map(m => m[1]).filter(u =>
    u.includes('cdninstagram') || u.includes('fbcdn')
  );

  const thumbMatch = html.match(/<img[^>]*src="(https:\/\/[^"]+)"[^>]*class="[^"]*result_thumbnail[^"]*"/);
  const authorMatch = html.match(/<h2[^>]*>(.*?)<\/h2>/s);

  let type = 'Post';
  if (url.includes('/reel')) type = 'Reel';
  else if (url.includes('/stories')) type = 'Story';
  else if (images.length > 1) type = 'Carousel';
  else if (downloadUrl) type = 'Video';
  else if (images.length === 1) type = 'Foto';

  if (!downloadUrl && images.length === 0) throw new Error('No media found');

  return {
    success: true,
    media: {
      title: '',
      author: authorMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '',
      authorUsername: '',
      avatar: '',
      cover: thumbMatch?.[1] || images[0] || '',
      type,
      likes: 0,
      comments: 0,
      downloadUrl,
      music: null,
      images: downloadUrl ? [] : images,
    }
  };
}