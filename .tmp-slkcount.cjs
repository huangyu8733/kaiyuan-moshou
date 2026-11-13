const fs=require('fs');
const slkMod=require('mdx-m3-viewer/dist/cjs/parsers/slk');const SlkFile=(slkMod.default??slkMod).File;
for(const f of ['UnitData.slk','UnitAbilities.slk','unitUI.slk','UnitBalance.slk','AbilityData.slk']){const s=new SlkFile();s.load(fs.readFileSync('/tmp/dota-units-683/'+f).toString('latin1'));console.log(f,'rows',s.rows.length,'first',s.rows[1]?.[0],'last',s.rows[s.rows.length-1]?.[0]);}
