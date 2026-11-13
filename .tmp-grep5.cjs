const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const txt=Buffer.from(a.get('Scripts\\war3map.j').bytes()).toString('latin1');
const ids={A0DH:1093682248,A0DL:1093682252,A0DJ:1093682250,A0SK:1093686091};
for(const [k,v] of Object.entries(ids)){
  const re=new RegExp('\\b'+v+'\\b','g');let m,n=0;const cnt=(txt.match(re)||[]).length;
  console.log('#####',k,v,'count',cnt);
  while((m=re.exec(txt))&&n<12){n++;const s=txt.slice(Math.max(0,m.index-200),m.index+260).replace(/\r/g,'');console.log('---',m.index,JSON.stringify(s.slice(0,80)));console.log(s);}
}
