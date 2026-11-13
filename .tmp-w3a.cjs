const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const War3MapW3u=require('mdx-m3-viewer/dist/cjs/parsers/w3x/w3u/file').default;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const f=a.get('war3map.w3a');const buf=Buffer.from(f.bytes());
const w=new War3MapW3u();w.load(buf);
const all=[...w.customTable.objects.map(o=>({t:'custom',...o})),...w.originalTable.objects.map(o=>({t:'original',...o}))];
console.log('total',all.length);
const want=process.argv.slice(3);
for(const obj of all){
  const ids=[obj.oldId,obj.newId];
  if(want.length && !want.some(x=>ids.includes(x)||ids.some(i=>i&&i.startsWith(x)))) continue;
  console.log('===',obj.t,obj.oldId,'->',obj.newId);
  for(const m of obj.modifications){
    console.log('  ',m.id,'=',JSON.stringify(m.value));
  }
}
