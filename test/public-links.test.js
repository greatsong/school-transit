import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
async function files(dir){const out=[];for(const x of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+x.name;if(x.isDirectory())out.push(...await files(p));else out.push(p);}return out;}
test('all static pages link to existing local files',async()=>{
 const root=resolve('public');
 for(const path of (await files(root)).filter(p=>p.endsWith('.html'))){const html=await readFile(path,'utf8');for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){const link=m[1];if(/^(https?:|data:|#|nmap:)/.test(link)||link.startsWith('/vendor/'))continue;const file=link.split(/[?#]/)[0];const full=file.startsWith('/')?resolve(root,'.'+file):resolve(dirname(path),file);await assert.doesNotReject(access(full.endsWith('/')?full+'index.html':full),path+' links to '+link);}}
});
