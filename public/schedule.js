import {SCHOOLS} from './stops.js';
export const SCHEDULE_KEY='school-bus-schedule-v1';
const allowed=new Set(SCHOOLS.flatMap(s=>s.stops.map(x=>x.id)));
export function noonPreset(){return {enabled:true,rules:SCHOOLS.map((s,i)=>({start:i?'12:00':'00:00',end:i?'00:00':'12:00',stopId:s.stops.find(x=>x.ars===s.defaultStop).id}))};}
export function timeMinutes(value){
 if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return NaN;
 const [h,m]=value.split(':').map(Number);return h*60+m;
}
export function containsMinute(rule,minute){
 const start=timeMinutes(rule.start),end=timeMinutes(rule.end);
 if(start===end||!Number.isFinite(start+end))return false;
 return start<end?minute>=start&&minute<end:minute>=start||minute<end;
}
export function validateSchedule(config, validStops=allowed){
 if(!config||typeof config.enabled!=='boolean'||!Array.isArray(config.rules))return '시간대 설정을 확인해주세요.';
 if(config.rules.length>12)return '시간대는 최대 12개까지 등록할 수 있어요.';
 if(config.enabled&&!config.rules.length)return '시간대를 하나 이상 추가해주세요.';
 const covered=new Uint8Array(1440);
 for(const [i,r] of config.rules.entries()){
  if(!r||!Number.isFinite(timeMinutes(r.start)+timeMinutes(r.end)))return `${i+1}번째 구간의 시작·종료 시간을 입력해주세요.`;
  if(r.start===r.end)return `${i+1}번째 구간의 시작과 종료 시간이 같습니다.`;
  if(!validStops.has(r.stopId))return `${i+1}번째 구간의 정류장을 선택해주세요.`;
  for(let m=0;m<1440;m++)if(containsMinute(r,m)){
   if(covered[m])return '시간대가 겹칩니다. 종료 시각과 다음 시작 시각을 맞춰주세요.';
   covered[m]=1;
  }
 }
 return '';
}
export function restoreSchedule(raw,validStops=allowed){
 if(raw===null)return {enabled:false,rules:[]};
 try {const c=JSON.parse(raw);if(validateSchedule(c,validStops))return {enabled:false,rules:[]};
  return {enabled:c.enabled,rules:c.rules.map(({start,end,stopId})=>({start,end,stopId}))};
 }catch{return {enabled:false,rules:[]};}
}
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function seoulMinutes(date=new Date()){return timeMinutes(clock.format(date));}
export function activeDefault(config,fallback,minute=seoulMinutes()){
 const index=config.enabled?config.rules.findIndex(r=>containsMinute(r,minute)):-1;
 const rule=index>=0?config.rules[index]:null;
 return {stopId:rule?.stopId||fallback,rule,index,key:rule?`${rule.start}/${rule.end}/${rule.stopId}`:`fallback/${fallback}`};
}
