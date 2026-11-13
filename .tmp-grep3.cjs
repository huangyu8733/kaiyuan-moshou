const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const txt=Buffer.from(a.get('Scripts\\war3map.j').bytes()).toString('latin1');
for(const k of ['Echo','Fissure','Enchant','Totem','Shockwave']){
  const re=new RegExp(k,'g');let m,n=0;
  console.log('#####',k);
  while((m=re.exec(txt))&&n<10){n++;console.log('---',m.index);console.log(txt.slice(Math.max(0,m.index-400),m.index+400).replace(/\r/g,''));}
}
