const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const War3MapW3u=require('mdx-m3-viewer/dist/cjs/parsers/w3x/w3u/file').default;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
function get(n){const b=a.get(n);if(!b)return null;return Buffer.from(b);}
const w3u=get('war3map.w3u');
console.log('w3u bytes',w3u&&w3u.length);
if(w3u){const f=new War3MapW3u();f.load(w3u);
 for(const obj of [...f.customTable.objects,...f.originalTable.objects]){
   const rec={oldId:obj.oldId,newId:obj.newId,mods:{}};
   for(const m of obj.modifications){ if(['uhab','uabi','unam','upro','ubui','umdl','uico'].includes(m.id)) rec.mods[m.id]=JSON.stringify(m.value); }
   if(rec.oldId==='Otch'||rec.newId==='Otch'||/Otc/.test(rec.oldId)||/Otc/.test(rec.newId)) console.log(rec);
 }
}
