import archiver from 'archiver';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { images, videos, files, username } = req.body;

  // Build unified file list: support images[], videos[], or files[{url,filename}]
  let fileList = [];

  if (files && Array.isArray(files)) {
    // files = [{ url, filename }]
    fileList = files;
  } else {
    // Legacy: images[] and optional videos[]
    const imgs = Array.isArray(images) ? images : [];
    const vids = Array.isArray(videos) ? videos : [];
    const safeUser = (username || 'igsave').replace(/[^a-zA-Z0-9_]/g, '');

    imgs.forEach((url, i) => {
      fileList.push({ url, filename: `${safeUser}_image${i + 1}.jpg` });
    });
    vids.forEach((url, i) => {
      fileList.push({ url, filename: `${safeUser}_video${i + 1}.mp4` });
    });
  }

  if (!fileList.length) {
    return res.status(400).json({ error: 'No files provided' });
  }

  const allowed = ['cdninstagram.com', 'fbcdn.net', 'instagram.com', 'scontent'];
  for (const f of fileList) {
    if (!allowed.some(d => f.url.includes(d))) {
      return res.status(403).json({ error: 'Domain not allowed' });
    }
  }

  const safeUsername = (username || 'igsave').replace(/[^a-zA-Z0-9_]/g, '');

  try {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeUsername}_files.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (const file of fileList) {
      try {
        const r = await fetch(file.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.instagram.com/',
          }
        });
        if (!r.ok) continue;
        archive.append(Buffer.from(await r.arrayBuffer()), { name: file.filename });
      } catch (e) {
        console.error(`Failed to fetch ${file.filename}:`, e.message);
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('Zip error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to create zip.' });
  }
}