const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const want=process.argv[3];
const names=['Units\\AbilityFunc.txt','Units\\HumanAbilityFunc.txt','Units\\OrcAbilityFunc.txt','Units\\UndeadAbilityFunc.txt','Units\\NightElfAbilityFunc.txt','Units\\NeutralAbilityFunc.txt','Units\\CampaignAbilityFunc.txt','Units\\CommonAbilityFunc.txt','Units\\ItemAbilityFunc.txt','Units\\AbilityStrings.txt','Units\\HumanAbilityStrings.txt','Units\\OrcAbilityStrings.txt','Units\\UndeadAbilityStrings.txt','Units\\NightElfAbilityStrings.txt','Units\\NeutralAbilityStrings.txt','Units\\CampaignAbilityStrings.txt','Units\\CommonAbilityStrings.txt','Units\\ItemAbilityStrings.txt'];
for(const fn of names){const f=a.get(fn);if(!f)continue;const t=Buffer.from(f.bytes()).toString('latin1');const re=new RegExp('^\\['+want+'\\][^\\[]*','mi');const m=t.match(re);if(m){console.log('####',fn);console.log(m[0].trim());}}
