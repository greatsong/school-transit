import {METRO_CATALOG} from './metro-catalog.js';
export const METRO_KEY='school-transit-metro-v1';
export const metroIndex=new Map(METRO_CATALOG.map(s=>[s.id,s]));
export function distance(a,b){const r=Math.PI/180,h=Math.sin((a.lat-b.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((a.lng-b.lng)*r/2)**2;return Math.round(12742000*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)));}
export function nearbyMetro(school){return METRO_CATALOG.map(s=>({...s,distance:distance(school,s)})).filter(s=>s.distance<=1200).sort((a,b)=>a.distance-b.distance).slice(0,8);}
export function cleanMetro(raw,schools){
 const seen=new Set();return (Array.isArray(raw)?raw:[]).slice(0,24).filter(x=>{
  const s=metroIndex.get(x?.stationId),a=schools.find(a=>a.id===x?.schoolId),key=x?.stationId+'|'+x?.schoolId;
  return s&&a&&distance(s,a)<=1200&&!seen.has(key)&&seen.add(key);
 }).map(x=>({stationId:x.stationId,schoolId:x.schoolId}));
}
export function metroView(train,now=Date.now()){
 const age=(now-train.generatedAt)/1000;
 if(!Number.isFinite(train.generatedAt)||age < -30||age>180)return '새로고침 필요';
 if(['0','1','2'].includes(train.code))return ({0:'진입',1:'도착',2:'출발'})[train.code]+' · 조회 당시';
 if(!Number.isFinite(train.seconds)||train.seconds<=0)return train.message||'예정시간 없음';
 const left=Math.ceil(train.seconds-Math.max(0,age));
 return left>0?`${Math.floor(left/60)}분 ${left%60}초`:'예정시간 경과 · 새로고침';
}
