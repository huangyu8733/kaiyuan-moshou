const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const txt=Buffer.from(a.get('Scripts\\war3map.j').bytes()).toString('latin1');
const ids={A0DH:1093685832,A0DL:1093685836,A0SK:1093686091,A0DJ:1093685834};
function i2s(n){return String.fromCharCode((n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255);}
for(const [k,v] of Object.entries(ids)){
  const re=new RegExp(String(v),'g');let m,n=0;
  console.log('#####',k,v,i2s(v),(txt.match(re)||[]).length);
  while((m=re.exec(txt))&&n<8){n++;console.log('---',m.index);console.log(txt.slice(Math.max(0,m.index-350),m.index+450).replace(/\r/g,''));}
}
