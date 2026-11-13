const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const f=a.get('Scripts\\war3map.j');
const txt=Buffer.from(f.bytes()).toString('latin1');
for(const k of ['Echo','echo','Fissure','fissure','Enchant','Totem','Aftershock','Shockwave','A0D','Otch','Oshd']){
  console.log(k,(txt.match(new RegExp(k,'g'))||[]).length);
}
console.log(txt.slice(0,600));
