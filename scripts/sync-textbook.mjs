// Optional bridge for this project's parent DS Danggok textbook only.
import {access,cp,mkdir,readFile,writeFile} from 'node:fs/promises';
const target='../../web';
await access(target+'/project.html');
await mkdir(target+'/bus-project',{recursive:true});
await cp('public/learn',target+'/bus-project',{recursive:true});
for(const path of ['index.html','deploy.html','glossary.html']){
 const file=target+'/bus-project/'+path;
 let text=await readFile(file,'utf8');
 text=text.replaceAll('href="/learn/index.html"','href="index.html"').replaceAll('href="/"','href="../project.html"').replaceAll('href="/journeys.html"','href="https://school-transit.vercel.app/journeys.html"').replaceAll('앱으로 돌아가기','프로젝트 목차로');
 await writeFile(file,text);
}
console.log('Synced public/learn → parent web/bus-project');
