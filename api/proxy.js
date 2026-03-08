export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, filename } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const allowed = [
    'cdninstagram.com',
    'fbcdn.net',
    'instagram.com',
    'scontent',
    'scontent-ber1-1',
    'scontent-arn2-1',
  ];
  const isAllowed = allowed.some(domain => url.includes(domain));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.instagram.com/',
      }
    });

    if (!response.ok) throw new Error('Failed to fetch file');

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    const safeFilename = (filename || 'igsave_media.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    if (contentLength) res.setHeader('Content-Length', contentLength);

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Failed to proxy file' });
  }
}