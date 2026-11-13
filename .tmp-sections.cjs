const fs=require('fs');
const mpq=require('mdx-m3-viewer/dist/cjs/parsers/mpq');const Archive=(mpq.default??mpq).Archive;
const a=new Archive();a.load(fs.readFileSync(process.argv[2]).buffer);
const files=['Units\\NightElfAbilityFunc.txt','Units\\NightElfAbilityStrings.txt'];
const ids=['A0DH','A0DL','A0SK','A0DJ','Aamk','AEfk','Aroa','ANcl','AEev'];
for(const fn of files){const f=a.get(fn);if(!f)continue;const txt=Buffer.from(f.bytes()).toString('latin1');
 console.log('#####',fn);
 for(const id of ids){const re=new RegExp('^\\['+id+'\\][^\\[]*','mi');const m=txt.match(re);console.log('==',id);console.log(m?m[0].trim():'NO SECTION');}
}
