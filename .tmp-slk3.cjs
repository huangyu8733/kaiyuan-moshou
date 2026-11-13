const fs=require('fs');
const slkMod=require('mdx-m3-viewer/dist/cjs/parsers/slk');const SlkFile=(slkMod.default??slkMod).File;
const f=new SlkFile();f.load(fs.readFileSync('/tmp/dota-units-683/AbilityData.slk').toString('latin1'));
console.log('rows',f.rows.length);
console.log('row0',JSON.stringify(f.rows[0]).slice(0,500));
console.log('row1',JSON.stringify(f.rows[1]).slice(0,500));
console.log('row2',JSON.stringify(f.rows[2]).slice(0,800));
// find A0DH
for(const id of ['A0DH','A0DL','A0SK','A0DJ','Aamk']){
  const row=f.rows.find(r=>Object.values(r).includes(id));
  console.log('==',id,row?JSON.stringify(row,null,1):'none');
}
