const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
for(const fn of ['Units\\UnitStrings.txt','Units\\CampaignUnitStrings.txt','Units\\NeutralUnitStrings.txt','Units\\HumanUnitStrings.txt','Units\\OrcUnitStrings.txt','Units\\UndeadUnitStrings.txt','Units\\NightElfUnitStrings.txt','Units\\ItemStrings.txt','Units\\ItemData.slk','Units\\UnitData.slk','war3map.wts']){
 const f=a.get(fn); if(!f) continue; const t=Buffer.from(f.bytes()).toString('latin1'); const i=t.toLowerCase().indexOf('observertruesight'); if(i>=0) console.log(fn,i,t.slice(Math.max(0,i-300),i+200));
}
