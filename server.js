// Custom Next.js server with gzip compression for API/text responses.
// Handles Accept-Encoding negotiation, skips already-compressed payloads,
// and only compresses responses above the configured threshold.
//
// Usage:
//   NODE_ENV=production node server.js        (serve built app)
//   NODE_ENV=development node server.js       (dev mode with compression)
//   node server.js                            (defaults to dev)

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const compression = require('compression')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Compression middleware options ---------------------------------------------

// Skip compression for responses that are already compressed or for
// requests that explicitly opt out (x-no-compression header).
const filter = (req, res) => {
  if (req.headers['x-no-compression']) return false
  return compression.filter(req, res)
}

// ── Start server ─────────────────────────────────────────────────────────
app.prepare().then(() => {
  createServer((req, res) => {
    compression({
      // Minimum response size in bytes — skip tiny payloads
      threshold: 1024,
      // zlib gzip level (0-9, 6 = default balance of speed vs ratio)
      level: 6,
      // Skip responses that already carry a Content-Encoding header
      filter,
    })(req, res, () => {
      const parsedUrl = parse(req.url, true)
      handle(req, res, parsedUrl)
    })
  }).listen(port, () => {
    console.log(`> Server ready on http://${hostname}:${port}`)
    if (dev) console.log('> Development mode — compression enabled for API responses')
  })
})
