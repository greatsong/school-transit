import {containsMinute,seoulMinutes,timeMinutes} from './schedule.js';
import {nearbyMetro} from './metro.js';
export const JOURNEY_KEY='school-transit-journeys-v1';
export function journeyPoints(areas){
 const points=new Map();
 for(const school of areas){
  for(const stop of school.stops)if(!points.has(stop.id))points.set(stop.id,{...stop,kind:'bus',schoolId:school.id,label:`${stop.name} · ${stop.ars} (${school.name})`});
  for(const station of nearbyMetro(school))if(!points.has(station.id))points.set(station.id,{...station,kind:'metro',schoolId:school.id,label:`${station.name} · ${station.lines.map(l=>l.name).join('·')} (${school.name})`});
 }
 return points;
}
const minutes=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=180;
export function validateJourneys(routes,points){
 if(!Array.isArray(routes)||routes.length>8)return '경로는 최대 8개까지 저장할 수 있어요.';
 const ids=new Set(),covered=new Uint8Array(1440);
 for(const r of routes){
  if(!r||typeof r.id!=='string'||!/^[\w-]{1,60}$/.test(r.id)||ids.has(r.id))return '경로 식별자가 올바르지 않습니다.';
  ids.add(r.id);
  if(typeof r.name!=='string'||!r.name.trim()||r.name.length>40)return '경로 이름을 40자 이내로 입력해주세요.';
  if(typeof r.enabled!=='boolean')return '자동 선택 여부를 확인해주세요.';
  if(!Number.isFinite(timeMinutes(r.start)+timeMinutes(r.end))||r.start===r.end)return '서로 다른 시작·종료 시각을 입력해주세요.';
  if(r.enabled)for(let m=0;m<1440;m++)if(containsMinute(r,m)){if(covered[m])return '자동 선택 시간대가 겹칩니다. 종료와 다음 시작 시각을 맞춰주세요.';covered[m]=1;}
  if(!minutes(r.finalWalk)||!minutes(r.buffer))return '마지막 도보·탑승 여유시간을 0~180분으로 입력해주세요.';
  if(!Array.isArray(r.legs)||!r.legs.length||r.legs.length>6)return '이동 구간을 1~6개 등록해주세요.';
  for(const [i,l] of r.legs.entries()){
   const board=points.get(l?.boardId),exit=points.get(l?.exitId);
   if(!board||!exit||board.kind!==exit.kind||board.id===exit.id)return `${i+1}구간의 서로 다른 승차·하차 지점을 선택해주세요.`;
   if(!minutes(l.walk)||!minutes(l.ride)||l.ride<=0)return `${i+1}구간의 도보(0~180분)·탑승(1~180분) 시간을 입력해주세요.`;
   if(board.kind==='metro'&&(!board.lines.some(x=>x.name===l.service)||!exit.lines.some(x=>x.name===l.service)))return `${i+1}구간의 같은 호선 하차역을 선택해주세요.`;
   if(typeof l.direction!=='string'||!l.direction.trim()||l.direction.length>120||typeof l.service!=='string'||!l.service||l.service.length>80||typeof l.name!=='string'||!l.name||l.name.length>100)return `${i+1}구간의 노선과 방면을 선택해주세요.`;
  }
 }
 return '';
}
export function restoreJourneys(raw,points){
 try{const rows=JSON.parse(raw);if(validateJourneys(rows,points))return [];
  return rows.map(r=>({id:r.id,name:r.name,enabled:r.enabled,start:r.start,end:r.end,buffer:r.buffer,finalWalk:r.finalWalk,legs:r.legs.map(l=>({boardId:l.boardId,exitId:l.exitId,service:l.service,direction:l.direction,name:l.name,walk:l.walk,ride:l.ride}))}));
 }catch{return [];}
}
export function activeJourney(routes,minute=seoulMinutes()){return routes.find(r=>r.enabled&&containsMinute(r,minute))||null;}
// Keep one common clock for every leg. Never extrapolate a later service from headways.
export function forecastLeg(leg,point,snapshot,now){
 if(!snapshot)return {arrivals:[],reason:'도착정보 조회 중'};
 const rows=point.kind==='bus'?(snapshot.routes||[]).filter(r=>r.id===leg.service&&r.direction===leg.direction).flatMap(r=>r.arrivals.map(a=>({...a,generatedAt:r.generatedAt,valid:a.status==='running'}))):(snapshot.trains||[]).filter(t=>t.line===leg.service&&t.direction===leg.direction).map(t=>({...t,valid:!['0','1','2'].includes(t.code)}));
 const fresh=rows.filter(r=>Number.isFinite(r.generatedAt)&&now-r.generatedAt>=-30000&&now-r.generatedAt<=180000);
 const arrivals=fresh.filter(r=>r.valid&&Number.isFinite(r.seconds)&&r.seconds>0).map(r=>r.seconds-Math.max(0,(now-r.generatedAt)/1000)).filter(s=>s>0).sort((a,b)=>a-b);
 return {arrivals,demo:snapshot.source==='demo',reason:!rows.length?'해당 노선·방면 도착정보 없음':!fresh.length?'오래된 정보 · 새로고침 필요':'확인 가능한 다음 차편 없음'};
}
export function planJourney(route,forecast,now=Date.now()){
 let ready=now,blocked=false,demo=false;
 const steps=route.legs.map((leg,i)=>{
  if(blocked)return {leg,state:'blocked',reason:'앞 구간의 차편 확인 후 계산'};
  const reach=ready+leg.walk*60000,threshold=reach+route.buffer*60000;
  const prediction=forecast(leg,i);demo||=!!prediction.demo;
  const arrivals=prediction.arrivals.filter(s=>Number.isFinite(s)&&s>0).map(s=>now+s*1000).sort((a,b)=>a-b);
  const departure=arrivals.find(t=>t>=threshold);
  if(departure===undefined){blocked=true;return {leg,state:'unknown',reach,reason:arrivals.length?'도보·여유시간 이후 차편이 아직 조회되지 않습니다.':prediction.reason||'도착정보 없음'};}
  ready=departure+leg.ride*60000;
  return {leg,state:'estimated',reach,departure,exit:ready,wait:(departure-reach)/1000,skipped:arrivals.filter(t=>t<threshold).length};
 });
 return {steps,demo,arrival:blocked?null:ready+route.finalWalk*60000};
}
