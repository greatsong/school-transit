import {readdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await scan(p);else if(/\.(js|mjs|html|json|md|css)$/.test(p)){const s=await readFile(p,'utf8');assert.ok(!/serviceKey[=:]["']?[A-Za-z0-9%+/]{30}|sk-[A-Za-z0-9]{30}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(s),'Possible credential: '+p);}}}
await scan('public');await scan('dist');console.log('Public source/build credential-pattern scan passed. This is a guard, not proof against all secrets.');
