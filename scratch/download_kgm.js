const https = require('https');
https.get('https://commons.wikimedia.org/wiki/File:Ssangyong_logo_simple.svg', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const match = data.match(/href=\"(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[^"]+\.svg)\"/);
    if (match) {
        console.log('FOUND URL:', match[1]);
        const file = require('fs').createWriteStream('public/images/logos/kgm.svg');
        https.get(match[1], { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
            res2.pipe(file);
            file.on('finish', () => console.log('Downloaded OK'));
        });
    } else {
        console.log('Not found');
    }
  });
});
