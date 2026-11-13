const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const slkMod=require('mdx-m3-viewer/dist/cjs/parsers/slk');const SlkFile=(slkMod.default??slkMod).File;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const f=a.get('Units\\AbilityData.slk');const ab=new SlkFile();ab.load(Buffer.from(f.bytes()).toString('latin1'));
const head=ab.rows[0];const rows=ab.rows.slice(1);
for(const id of process.argv.slice(3)){
  const r=rows.find(x=>x[0]===id);
  if(!r){console.log(id,'NOT IN MAP AbilityData');continue;}
  const o={};head.forEach((h,i)=>{if(r[i]!==undefined&&r[i]!=='')o[h]=r[i];});
  console.log('==',id,JSON.stringify(o,null,1));
  for(const fn of ['Units\\AbilityFunc.txt','Units\\HumanAbilityFunc.txt','Units\\OrcAbilityFunc.txt','Units\\UndeadAbilityFunc.txt','Units\\NightElfAbilityFunc.txt','Units\\NeutralAbilityFunc.txt','Units\\CampaignAbilityFunc.txt','Units\\CommonAbilityFunc.txt','Units\\ItemAbilityFunc.txt']){
    const ff=a.get(fn);if(!ff)continue;const t=Buffer.from(ff.bytes()).toString('latin1');const m=t.match(new RegExp('^\\['+id+'\\][^\\[]*','mi'));if(m)console.log('  --',fn,'\n'+m[0].trim().replace(/\n/g,'\n  '));
  }
}
