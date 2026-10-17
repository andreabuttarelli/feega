const http = require('http');
const fs = require('fs');

const PORT = 5198;

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    console.log(req.method, req.url, req.headers.origin ?? '');
    if (req.method === 'GET' && req.url === '/flow.js') {
      res.setHeader('Content-Type', 'text/javascript');
      return res.end(fs.readFileSync(`${__dirname}/flow.js`));
    }
    if (req.method === 'GET' && req.url === '/credentials') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ email: process.env.E2E_TEST_EMAIL, password: process.env.E2E_TEST_PASSWORD }));
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (body) {
        console.log(body);
      }
      res.end('ok');
    });
  })
  .listen(PORT);
