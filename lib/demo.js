import {seedAreas} from '../public/workspace.js';
// Invented learning data. Never describe these numbers as real arrivals.
export function demoNearby(id){
 const area=seedAreas().find(s=>s.id===id);if(!area)throw Error('DEMO_SCHOOL');
 return {...area,source:'demo',fetchedAt:Date.now()};
}
export function demoArrivals(id,now=Date.now()){
 const stop=seedAreas().flatMap(s=>s.stops).find(s=>s.id===id);
 if(!stop)throw Error('DEMO_SCHOOL');
 const seconds=240-Math.floor(now/1000)%180;
 return {source:'demo',fetchedAt:now,serverNow:now,routes:[{
  id:'900000001',name:'연습01',type:'예제',direction:'학교 실습',generatedAt:now,timeBasis:'received',
  arrivals:[{status:'running',seconds,stops:2,congestion:'',lowFloor:false},{status:'waiting',seconds:null,message:'출발 대기',stops:null,congestion:'',lowFloor:false}]
 }]};
}
