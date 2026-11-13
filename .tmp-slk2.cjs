const fs=require('fs');
const slkMod=require('mdx-m3-viewer/dist/cjs/parsers/slk');const SlkFile=(slkMod.default??slkMod).File;
function load(p){const f=new SlkFile();f.load(fs.readFileSync(p).toString('latin1'));return f;}
const dir=process.argv[2];
for(const file of ['UnitData.slk','UnitAbilities.slk','unitUI.slk','UnitBalance.slk']){
  const f=load(dir+'/'+file);
  console.log('==',file,'rows',f.rows.length);
  const row=f.rows.find(r=>Object.values(r).some(v=>v==='Otch'));
  console.log(row?JSON.stringify(row,null,1):'no Otch');
}
const ab=load(dir+'/AbilityData.slk');
console.log('abilityID col?',Object.keys(ab.rows[0]).slice(0,6));
for(const id of ['AOsh','AOws','AOae','AOre']){
  const row=ab.rows.find(r=>r.abilityID===id||r.AbilityID===id||r.ID===id);
  console.log('==',id,row?JSON.stringify(row,null,1):'none');
}
