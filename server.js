const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0].split('#')[0];
  const f = urlPath === '/' ? '/index.html' : urlPath;
  const fp = path.join(__dirname, path.normalize(f).replace(/^(\.\.[\/\\])+/, ''));
  const ext = path.extname(fp);
  const ct = { 'html': 'text/html', 'js': 'text/javascript', 'css': 'text/css', 'xml': 'application/xml', 'txt': 'text/plain' }[ext.slice(1)] || 'text/plain';
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); }
    else { res.writeHead(200, { 'Content-Type': ct }); res.end(data); }
  });
});

server.listen(8082, () => console.log('OK'));
