import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyPoints,validateJourneys,restoreJourneys,activeJourney,forecastLeg,planJourney} from '../public/journeys.js';
import {seedAreas} from '../public/workspace.js';
const points=journeyPoints(seedAreas()),bus=[...points.values()].filter(p=>p.kind==='bus'),rail=[...points.values()].filter(p=>p.kind==='metro');
const leg={boardId:bus[0].id,exitId:bus[1].id,service:'123',direction:'학교',name:'123번',walk:2,ride:10};
const route={id:'morning',name:'등교',start:'00:00',end:'12:00',enabled:true,buffer:1,finalWalk:3,legs:[leg]};
const now=Date.parse('2026-10-08T01:00:00Z');
test('journey schedule selects noon boundary, gaps and overnight without overlap',()=>{
 const evening={...route,id:'evening',name:'하교',start:'12:00',end:'00:00'};
 assert.equal(validateJourneys([route,evening],points),'');assert.equal(activeJourney([route,evening],719).id,'morning');assert.equal(activeJourney([route,evening],720).id,'evening');assert.equal(activeJourney([route],720),null);
 assert.match(validateJourneys([route,{...evening,start:'11:59'}],points),/겹/);
 assert.equal(activeJourney([{...route,start:'22:00',end:'06:00'}],60).id,route.id);
});
test('restoration strips unknown personal fields and rejects corrupt legs',()=>{
 const parsed=restoreJourneys(JSON.stringify([{...route,home:'private',legs:[{...leg,secret:'private'}]}]),points);assert.equal(JSON.stringify(parsed).includes('private'),false);
 for(const patch of [{boardId:'bad'},{exitId:leg.boardId},{ride:NaN},{walk:-1},{service:''}])assert.notEqual(validateJourneys([{...route,legs:[{...leg,...patch}]}],points),'');
 assert.deepEqual(restoreJourneys('bad',points),[]);
});
test('walking and boarding buffer skip an earlier bus and choose the next eligible one',()=>{
 const plan=planJourney(route,()=>({arrivals:[60,240]}),now);assert.equal(plan.steps[0].skipped,1);assert.equal(plan.steps[0].departure,now+240000);assert.equal(plan.arrival,now+17*60000);
 const exact=planJourney(route,()=>({arrivals:[180]}),now);assert.equal(exact.steps[0].state,'estimated');
});
test('transfer uses a common clock, ride time, transfer walk, buffer and final walk',()=>{
 const r={...route,legs:[{...leg,walk:0,ride:3},{...leg,boardId:rail[0].id,exitId:rail[1].id,walk:2,ride:4}]};
 const plan=planJourney(r,(_,i)=>({arrivals:i?[300,480]:[60]}),now);
 assert.equal(plan.steps[1].reach,now+360000);assert.equal(plan.steps[1].departure,now+480000);assert.equal(plan.arrival,now+15*60000);
});
test('missing downstream arrivals do not fabricate a service or total duration',()=>{
 const r={...route,legs:[leg,leg,leg]};const plan=planJourney(r,(_,i)=>({arrivals:i?[100]:[240]}),now);
 assert.equal(plan.steps[0].state,'estimated');assert.equal(plan.steps[1].state,'unknown');assert.equal(plan.steps[2].state,'blocked');assert.equal(plan.arrival,null);
});
test('bus predictions filter direction and stale or null timestamps; demo propagates',()=>{
 const snap={source:'demo',routes:[{id:'123',direction:'학교',generatedAt:now,arrivals:[{status:'running',seconds:300},{status:'ended',seconds:900}]},{id:'123',direction:'반대',generatedAt:now,arrivals:[{status:'running',seconds:10}]}]};
 assert.deepEqual(forecastLeg(leg,bus[0],snap,now+10000).arrivals,[290]);assert.deepEqual(forecastLeg(leg,bus[0],snap,now+181000).arrivals,[]);
 snap.routes[0].generatedAt=null;assert.deepEqual(forecastLeg(leg,bus[0],snap,now).arrivals,[]);
 assert.equal(planJourney(route,()=>({arrivals:[300],demo:true}),now).demo,true);
});
test('metro filters line and direction and excludes departed, arrived, missing ETAs',()=>{
 const l={...leg,service:'2호선',direction:'내선'};
 const trains=[{line:'2호선',direction:'내선',seconds:100,generatedAt:now,code:'99'}, {line:'2호선',direction:'외선',seconds:40,generatedAt:now,code:'99'}, {line:'2호선',direction:'내선',seconds:200,generatedAt:now,code:'2'}, {line:'2호선',direction:'내선',seconds:null,generatedAt:now,code:'99'}];
 assert.deepEqual(forecastLeg(l,rail[0],{trains},now).arrivals,[100]);
});
