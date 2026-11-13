const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const txt=Buffer.from(a.get('Scripts\\war3map.j').bytes()).toString('latin1');
const name=process.argv[3];
const re=new RegExp('function '+name+' takes[\\s\\S]*?\\nendfunction','m');
const m=txt.match(re);
console.log(m?m[0]:'NOT FOUND');
