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
    console.error('Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function ig120Post(endpoint, body) {
  const r = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': RAPIDAPI_HOST,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Instagram120 error: ${r.status}`);
  return r.json();
}

async function fetchByShortcode(shortcode) {
  const data = await ig120Post('mediaByShortcode', { shortcode });

  const media = data?.data || data?.media || data;
  if (!media) throw new Error('Gagal mengambil media. Pastikan link benar dan akun tidak privat.');

  // Extract owner/user info
  const owner = media.owner || media.user || {};
  const username = owner.username || '';
  const author = owner.full_name || username || '';
  let avatar = owner.profile_pic_url || '';
  const likes = media.like_count || media.edge_liked_by?.count || 0;
  const comments = media.comment_count || media.edge_media_to_comment?.count || 0;
  const caption =
    media.caption?.text ||
    media.edge_media_to_caption?.edges?.[0]?.node?.text ||
    '';

  // Determine media type
  const mediaType = media.media_type || media.__typename || '';
  let type = 'Post';
  if (mediaType === 8 || mediaType === 'GraphSidecar') type = 'Carousel';
  else if (mediaType === 2 || mediaType === 'GraphVideo') type = 'Video';
  else if (mediaType === 1 || mediaType === 'GraphImage') type = 'Foto';

  let videoUrl = media.video_url || '';
  let cover =
    media.thumbnail_url ||
    media.display_url ||
    media.image_versions2?.candidates?.[0]?.url ||
    '';

  // Extract images for carousel
  let images = [];
  const sidecar =
    media.edge_media_to_carousel_media?.edges ||
    media.carousel_media ||
    [];

  if (sidecar.length > 0) {
    type = 'Carousel';
    sidecar.forEach(edge => {
      const node = edge.node || edge;
      if (node.video_url) {
        if (!videoUrl) videoUrl = node.video_url;
      } else {
        const imgUrl =
          node.display_url ||
          node.image_versions2?.candidates?.[0]?.url ||
          '';
        if (imgUrl) images.push(imgUrl);
      }
    });
    if (!cover)
      cover =
        sidecar[0]?.node?.display_url ||
        sidecar[0]?.display_url ||
        '';
  }

  // Single image fallback
  if (!videoUrl && images.length === 0 && cover) {
    images = [cover];
  }

  // Fetch avatar via userInfo if missing
  if (!avatar && username) {
    try {
      const userInfo = await ig120Post('userInfo', { username });
      const u = userInfo?.data || userInfo?.user || userInfo;
      avatar =
        u?.profile_pic_url ||
        u?.hd_profile_pic_url_info?.url ||
        '';
    } catch (e) {
      console.log('userInfo fetch failed:', e.message);
    }
  }

  return {
    success: true,
    media: {
      title: caption,
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