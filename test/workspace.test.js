import test from 'node:test';
import assert from 'node:assert/strict';
import {noonPreset,activeDefault,validateSchedule,containsMinute,seoulMinutes} from '../public/schedule.js';
import {seedAreas,cleanAreas,encodeShare,decodeShare,walkingUrl,walkingAppUrl,shouldRefresh} from '../public/workspace.js';
import {restoreFavorites} from '../public/favorites.js';
import {normalizeStops} from '../api/nearby.js';
import {fetchStop} from '../api/arrivals.js';
const areas=seedAreas(),valid=new Set(areas.flatMap(a=>a.stops.map(s=>s.id)));
const a=areas[0].stops[0].id,b=areas[1].stops[0].id;
test('noon switches at the exact boundary in Seoul and midnight wraps',()=>{
 const c=noonPreset();assert.equal(validateSchedule(c),'');
 assert.equal(activeDefault(c,null,719).index,0);assert.equal(activeDefault(c,null,720).index,1);
 assert.equal(activeDefault(c,null,1439).index,1);assert.equal(activeDefault(c,null,0).index,0);
 assert.equal(seoulMinutes(new Date('2026-10-08T03:00:00Z')),720);
 assert.equal(containsMinute({start:'22:00',end:'06:00'},120),true);
 assert.equal(containsMinute({start:'22:00',end:'06:00'},360),false);
});
test('overlap, zero length and invalid stops are rejected while gaps fall back',()=>{
 const rules=[{start:'08:00',end:'09:00',stopId:a},{start:'08:59',end:'12:00',stopId:b}];
 assert.match(validateSchedule({enabled:true,rules},valid),/겹/);
 assert.match(validateSchedule({enabled:true,rules:[{start:'08:00',end:'08:00',stopId:a}]},valid),/같/);
 assert.match(validateSchedule({enabled:true,rules:[{start:'08:00',end:'09:00',stopId:'bad'}]},valid),/정류장/);
 assert.equal(activeDefault({enabled:true,rules:rules.slice(0,1)},b,720).stopId,b);
});
test('shared config round trips Korean names, favorites and schools without credentials',()=>{
 const config={schoolIds:areas.map(s=>s.id),areas,selectedStop:a,favorites:{items:[{stopId:a,routeId:null}],defaultStop:a},schedule:noonPreset()};
 const result=decodeShare('#share='+encodeShare(config));assert.deepEqual(result,{version:1,...config});
 assert.equal(cleanAreas(result.areas).length,2);assert.equal(JSON.stringify(result).includes('apikey'),false);
 assert.throws(()=>decodeShare('#share=bad'),/올바르/);assert.throws(()=>decodeShare('#share='+encodeShare({...config,schoolIds:['bad']})));
});
test('school identity is canonical, distant and malformed stops cannot be imported',()=>{
 const good=areas[0],fake={...good,name:'Injected',lat:0,stops:[...good.stops,{id:'123456789',ars:'12345',lat:0,lng:0}]};
 const clean=cleanAreas([fake])[0];assert.equal(clean.name,'신도림중학교');assert.equal(clean.lat,good.lat);assert.equal(clean.stops.length,good.stops.length);
});
test('searched stops can be favorites and walking links explicitly request walk mode',()=>{
 const raw=JSON.stringify({items:[{stopId:'123456789',routeId:null}],defaultStop:'123456789'});
 assert.equal(restoreFavorites(raw,new Set(['123456789'])).items.length,1);
 assert.equal(restoreFavorites(raw).items.length,0);
 const url=new URL(walkingAppUrl(areas[0],areas[0].stops[0],'https://school.example'));assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('travelmode'),'walking');assert.equal(url.searchParams.get('origin'),`${areas[0].lat},${areas[0].lng}`);assert.equal(url.searchParams.get('destination'),`${areas[0].stops[0].lat},${areas[0].stops[0].lng}`);
});
test('auto refresh runs after sixty seconds only when visible and idle',()=>{
 const c={visible:true,busy:false,now:60000,lastRefresh:0};assert.equal(shouldRefresh(c),true);
 for(const patch of [{now:59999},{busy:true},{visible:false},{lastRefresh:1000}])assert.equal(shouldRefresh({...c,...patch}),false);
});
test('nearby station schema, deduplication and missing ARS validation',()=>{
 const one={stationId:'123456789',arsId:'12345',stationNm:'정류장',gpsX:'126.93',gpsY:'37.49',dist:'105'};
 const envelope=itemList=>({msgHeader:{headerCd:'0'},msgBody:{itemList}});
 assert.equal(normalizeStops(envelope(one))[0].distance,105);
 assert.equal(normalizeStops(envelope([one,one,{...one,stationId:'123456788',arsId:'0'}])).length,1);
 assert.deepEqual(normalizeStops(envelope(null)),[]);assert.throws(()=>normalizeStops({msgHeader:{headerCd:'30'}}));
});
test('newly searched stop uses fixed official upstream and its ARS number',async()=>{
 let calls=0;const fake=async url=>{calls++;assert.equal(url.origin,'http://ws.bus.go.kr');assert.equal(url.searchParams.get('arsId'),'21111');return {ok:true,json:async()=>({msgHeader:{headerCd:'0'},msgBody:{itemList:[]}})};};
 await fetchStop('123456789',fake,Date.now(),'test','21111');assert.equal(calls,1);
 await assert.rejects(fetchStop('123456789',fake,Date.now(),'test','https://x'),/INVALID_STOP/);
});
