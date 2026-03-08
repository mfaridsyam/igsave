import archiver from 'archiver';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { images, username } = req.body;
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No images provided' });
  }

  const allowed = ['cdninstagram.com', 'fbcdn.net', 'instagram.com', 'scontent'];
  for (const url of images) {
    if (!allowed.some(d => url.includes(d))) {
      return res.status(403).json({ error: 'Domain not allowed' });
    }
  }

  try {
    const safeUsername = (username || 'igsave').replace(/[^a-zA-Z0-9_]/g, '');
    const zipFilename = `${safeUsername}_images.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (let i = 0; i < images.length; i++) {
      try {
        const imgRes = await fetch(images[i], {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.instagram.com/',
          }
        });
        if (!imgRes.ok) continue;
        const buffer = await imgRes.arrayBuffer();
        archive.append(Buffer.from(buffer), { name: `${safeUsername}_image${i + 1}.jpg` });
      } catch (e) {
        console.error(`Failed to fetch image ${i}:`, e);
      }
    }

    await archive.finalize();

  } catch (err) {
    console.error('Zip error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Gagal membuat zip. Coba lagi.' });
    }
  }
}