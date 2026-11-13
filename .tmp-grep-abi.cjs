const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const f=a.get('Scripts\\war3map.j');
const txt=Buffer.from(f.bytes()).toString('latin1');
for(const id of ['A0DH','A0DL','A0SK','A0DJ']){
  const re=new RegExp(id,'g');let m,n=0;
  console.log('###',id,(txt.match(re)||[]).length);
  while((m=re.exec(txt))&&n<6){n++;console.log('---',m.index);console.log(txt.slice(Math.max(0,m.index-300),m.index+500));}
}
