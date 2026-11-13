const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const f=a.get('Scripts\\war3map.j');
const txt=Buffer.from(f.bytes()).toString('latin1');
console.log('len',txt.length);
const re=/Otch/g;let m;let n=0;
while((m=re.exec(txt))&&n<20){n++;const s=Math.max(0,m.index-200),e=Math.min(txt.length,m.index+300);console.log('---',m.index);console.log(txt.slice(s,e));}
console.log('total',(txt.match(/Otch/g)||[]).length);
