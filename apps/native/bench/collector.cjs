const http = require('http');
const fs = require('fs');
const OUT = process.env.BENCH_OUT || __dirname + '/results.jsonl';
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'GET' && req.url === '/bench.js') {
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(fs.readFileSync(__dirname + '/bench.js'));
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (body) { fs.appendFileSync(OUT, body + '\n'); console.log(body); }
    res.end('ok');
  });
}).listen(5199);
