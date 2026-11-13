const fs=require('fs');
const slkMod=require('mdx-m3-viewer/dist/cjs/parsers/slk');const SlkFile=(slkMod.default??slkMod).File;
function load(p){const f=new SlkFile();f.load(fs.readFileSync(p).toString('latin1'));return f;}
const dir=process.argv[2];
const ab=load(dir+'/AbilityData.slk');
console.log('AbilityData rows',ab.rows.length);
for(const id of ['AOsh','AOws','AOae','AOre','ACsh','ACst','AOac','AUcs','ANbf']){
  const row=ab.rows.find(r=>r.abilityID===id) || ab.rows.find(r=>String(r.abilityID).toLowerCase()===id.toLowerCase());
  if(row) console.log('== '+id, JSON.stringify(row,null,1));
}
const ua=load(dir+'/UnitAbilities.slk');
for(const id of ['Otch','Oshd']){const row=ua.rows.find(r=>r.unitAbilID===id);console.log('UA',id,JSON.stringify(row));}
const ui=load(dir+'/unitUI.slk');
const urow=ui.rows.find(r=>r.unitUIID==='Otch');console.log('UI Otch',JSON.stringify(urow));
