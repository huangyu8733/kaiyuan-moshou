const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const needle=process.argv[3].toLowerCase();
const names=['Units\\AbilityFunc.txt','Units\\CampaignAbilityFunc.txt','Units\\NeutralAbilityFunc.txt','Units\\OrcAbilityFunc.txt','Units\\CommonAbilityFunc.txt','Units\\HumanAbilityFunc.txt','Units\\NightElfAbilityFunc.txt','Units\\UndeadAbilityFunc.txt','Units\\ItemAbilityFunc.txt','Units\\CampaignAbilityStrings.txt','Units\\NeutralAbilityStrings.txt','Units\\OrcAbilityStrings.txt','Units\\CommonAbilityStrings.txt','Units\\HumanAbilityStrings.txt','Units\\NightElfAbilityStrings.txt','Units\\UndeadAbilityStrings.txt','Units\\ItemAbilityStrings.txt','Units\\AbilityStrings.txt'];
for(const n of names){const f=a.get(n);if(!f)continue;const t=Buffer.from(f.bytes()).toString('latin1');const i=t.toLowerCase().indexOf(needle);console.log(n, i>=0?('FOUND at '+i):'no');}
