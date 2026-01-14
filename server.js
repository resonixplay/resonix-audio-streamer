const express = require('express');
const cors = require('cors');
const { Readable } = require('stream');

const app = express();

/**
 * CORS configuration
 */
app.use(
  cors({
    origin: ['http://localhost:3000'],
    methods: ['GET'],
    credentials: true
  })
);

app.use(express.json());

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Audio streaming proxy
 */
app.get('/api/stream', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).send('Missing url');
    }

    // Forward Range header for seek support
    const headers = {};
    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    const response = await fetch(url, { headers });

    if (!response.ok && response.status !== 206) {
      return res
        .status(response.status)
        .send(`Upstream error: ${response.statusText}`);
    }

    // Forward only required headers
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        lower === 'content-type' ||
        lower === 'content-length' ||
        lower === 'accept-ranges' ||
        lower === 'content-range'
      ) {
        res.setHeader(key, value);
      }
    });

    res.status(response.status);

    // ✅ Convert Web Stream → Node Stream
    const nodeStream = Readable.fromWeb(response.body);

    // Pipe to client
    nodeStream.pipe(res);

    // Cleanup on disconnect
    req.on('close', () => {
      nodeStream.destroy();
    });

  } catch (err) {
    console.error('Streaming error:', err);
    res.status(500).send('Internal streaming error');
  }
});

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎵 Streaming server running on port ${PORT}`);
});
