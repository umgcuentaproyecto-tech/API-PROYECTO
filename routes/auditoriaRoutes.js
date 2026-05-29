const express = require('express');
const http = require('http');
const https = require('https');
const { requireAuth, requireRole } = require('../middleware/middlewareAutenticacion');

const router = express.Router();

function getJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;

    const request = client.request({
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: timeoutMs
    }, response => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        let payload;

        try {
          payload = body ? JSON.parse(body) : null;
        } catch (error) {
          payload = { raw: body };
        }

        resolve({
          statusCode: response.statusCode,
          payload
        });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Tiempo de espera agotado consultando auditoria'));
    });
    request.on('error', reject);
    request.end();
  });
}

router.use(requireAuth, requireRole('ADMIN'));

router.get('*', async (req, res) => {
  try {
    const baseUrl = (process.env.WS_AUDITORIA_URL || 'http://localhost:3001/api/auditoria').replace(/\/$/, '');
    const queryIndex = req.originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
    const targetUrl = `${baseUrl}${req.path === '/' ? '' : req.path}${query}`;
    const response = await getJson(targetUrl);

    res.status(response.statusCode || 200).json(response.payload);
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'No se pudo consultar el web service de auditoria',
      error: error.message
    });
  }
});

module.exports = router;
