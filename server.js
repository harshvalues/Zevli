const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  const f = req.url === '/' ? '/index.html' : req.url;
  const fp = path.join(__dirname, f);
  const ext = path.extname(fp);
  const ct = { 'html': 'text/html', 'js': 'text/javascript', 'css': 'text/css' }[ext.slice(1)] || 'text/plain';
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); }
    else { res.writeHead(200, { 'Content-Type': ct }); res.end(data); }
  });
});

server.listen(8082, () => console.log('OK'));
