import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyMetro,metroIndex,metroView,cleanMetro} from '../public/metro.js';
import {seedAreas,publicShare} from '../public/workspace.js';
import {normalizeMetro,fetchMetro} from '../api/subway.js';
import {createBudget} from '../lib/runtime.js';
const schools=seedAreas(),station=nearbyMetro(schools[0]).find(s=>s.name==='신도림역');
test('official station coordinates find Sindorim and Danggok nearby',()=>{assert.ok(station);assert.ok(nearbyMetro(schools[1]).some(s=>s.name==='당곡역'));assert.equal(cleanMetro([{stationId:station.id,schoolId:schools[1].id}],schools).length,0);});
test('metro time uses source KST timestamp and hides expired or missing estimates',()=>{
 const now=Date.parse('2026-10-08T01:00:00Z');
 const body={realtimeArrivalList:[{subwayId:'1002',barvlDt:'90',recptnDt:'2026-10-08 10:00:00',arvlCd:'99'}]};
 const t=normalizeMetro(body,station,now).trains[0];assert.equal(t.generatedAt,now);assert.equal(metroView(t,now+10000),'1분 20초');assert.match(metroView(t,now+181000),/새로고침/);
 for(const value of [null,'',undefined,'0'])assert.equal(normalizeMetro({realtimeArrivalList:[{...body.realtimeArrivalList[0],barvlDt:value}]},station).trains[0].seconds,null);
 assert.equal(metroView({...t,generatedAt:null},now),'새로고침 필요');assert.equal(metroView({...t,code:'1'},now),'도착 · 조회 당시');
 assert.throws(()=>normalizeMetro({errorMessage:{code:'INFO-100'}},station));
});
test('metro demo is explicit and arbitrary proxy URLs are rejected',async()=>{assert.equal((await fetchMetro(station.id,()=>{throw Error('network');},{})).source,'demo');await assert.rejects(fetchMetro('https://example.com'),/INVALID/);});
test('public share excludes schedules and other school favorites',()=>{const f={items:schools.map(s=>({stopId:s.stops[0].id,routeId:null})),defaultStop:schools[1].stops[0].id};const share=publicShare(schools[0],null,f);assert.equal(share.areas.length,1);assert.equal(share.favorites.items.length,1);assert.equal(share.favorites.defaultStop,null);assert.deepEqual(share.schedule,{enabled:false,rules:[]});});
test('quota blocks excess calls and resets by window',()=>{const consume=createBudget({perMinute:2,perDay:3});consume(0);consume(1);assert.throws(()=>consume(2),/QUOTA/);consume(60000);assert.throws(()=>consume(120000),/QUOTA/);consume(86400000);});
