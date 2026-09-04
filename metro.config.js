// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

const config = getDefaultConfig(__dirname);

// DEV-ONLY reverse proxy so the browser can reach the Meg V2 backend.
//
// Why: in the sandbox preview the browser is only authorised to talk to the
// port it is viewing (Metro, 8081). A cross-origin fetch to the backend's own
// public proxy (3001-*.e2b.app) is blocked by the platform with a 403 because
// the browser has no traffic-access token for that other host. So instead the
// frontend calls SAME-ORIGIN relative paths (/api/meg/*, /health) and Metro
// forwards them here to the in-sandbox Meg server on 127.0.0.1:3001.
const MEG_BACKEND_HOST = process.env.MEG_SERVER_PROXY_HOST || '127.0.0.1';
const MEG_BACKEND_PORT = Number(process.env.MEG_SERVER_PORT || process.env.PORT) || 3001;
const PROXY_PREFIXES = ['/api/meg', '/health'];

function shouldProxy(url = '') {
  return PROXY_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`));
}

const previousEnhanceMiddleware = config.server && config.server.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware, server) => {
    const base = previousEnhanceMiddleware
      ? previousEnhanceMiddleware(metroMiddleware, server)
      : metroMiddleware;

    return (req, res, next) => {
      if (!shouldProxy(req.url)) return base(req, res, next);

      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const headers = { ...req.headers, host: `${MEG_BACKEND_HOST}:${MEG_BACKEND_PORT}` };
        const proxyReq = http.request(
          {
            host: MEG_BACKEND_HOST,
            port: MEG_BACKEND_PORT,
            method: req.method,
            path: req.url,
            headers,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );
        proxyReq.on('error', (error) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Meg backend unreachable: ${error.message}` }));
        });
        if (body.length) proxyReq.write(body);
        proxyReq.end();
      });
    };
  },
};

module.exports = config;
