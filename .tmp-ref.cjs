const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const txt=Buffer.from(a.get('Scripts\\war3map.j').bytes()).toString('latin1');
const k=process.argv[3];
const re=new RegExp('\\b'+k+'\\b','g');let m,n=0;
while((m=re.exec(txt))&&n<10){n++;console.log('---',m.index);console.log(txt.slice(Math.max(0,m.index-600),m.index+200));}
