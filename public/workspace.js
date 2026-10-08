import {SCHOOL_CATALOG} from './school-catalog.js';
import {SCHOOLS} from './stops.js';
export const WORKSPACE_KEY='school-bus-workspace-v2';
const catalog=new Map(SCHOOL_CATALOG.map(s=>[s.id,s]));
function meters(a,b){const rad=Math.PI/180,dlat=(a.lat-b.lat)*rad,dlng=(a.lng-b.lng)*rad;const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2;return Math.round(6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)));}
export const seedAreas=()=>SCHOOLS.map(s=>{const base={...s,...SCHOOL_CATALOG.find(x=>x.name===s.name)};return {...base,stops:s.stops.map(x=>({...x,distance:meters(base,x)}))};});
export function cleanAreas(raw){
 if(!Array.isArray(raw))return [];
 const seen=new Set();
 return raw.slice(0,8).flatMap(s=>{
  const base=catalog.get(s?.id);if(!base||seen.has(base.id))return [];seen.add(base.id);
  const ids=new Set();
  const stops=(Array.isArray(s.stops)?s.stops:[]).slice(0,50).filter(x=>x&&/^\d{9}$/.test(x.id)&&/^\d{5}$/.test(x.ars)&&x.ars!=='00000'&&Number.isFinite(x.lat)&&Number.isFinite(x.lng)&&Math.abs(x.lat-base.lat)<.02&&Math.abs(x.lng-base.lng)<.03&&!ids.has(x.id)&&ids.add(x.id)).map(x=>({id:x.id,ars:x.ars,name:String(x.name||'정류장').slice(0,100),lat:x.lat,lng:x.lng,distance:meters(base,x)}));
  return [{...base,stops,defaultStop:stops.find(x=>x.ars===s.defaultStop)?.ars||stops[0]?.ars||null}];
 });
}
export function parseWorkspace(raw){try{return cleanAreas(JSON.parse(raw));}catch{return [];}}
export function encodeShare(config){
 const text=JSON.stringify({version:1,...config});
 if(text.length>20000)throw Error('공유할 설정이 너무 많습니다. 학교나 즐겨찾기를 줄여주세요.');
 return btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeShare(hash){
 if(!hash.startsWith('#share='))return null;
 const encoded=hash.slice(7);if(encoded.length>32000)throw Error('공유 링크가 너무 깁니다.');
 try{
  const json=new TextDecoder().decode(Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));
  const obj=JSON.parse(json);
  if(obj.version!==1||!Array.isArray(obj.schoolIds)||!obj.schoolIds.length||obj.schoolIds.length>8||obj.schoolIds.some(id=>!catalog.has(id)))throw Error();
  return obj;
 }catch{throw Error('올바르지 않은 공유 링크입니다.');}
}
export function walkingUrl(area,stop){return `https://map.naver.com/p/search/${encodeURIComponent(stop.name+' 버스정류장 '+stop.ars)}`;}
export function shouldRefresh({visible,busy,now,lastRefresh}){return visible&&!busy&&now-lastRefresh>=60000;}

// Share only this school's public choices. Never export the user's daily schedule.
export function publicShare(area,selectedStop,favorites){
 const clean=cleanAreas([area])[0];if(!clean)throw Error('공유할 학교를 등록해주세요.');
 const ids=new Set(clean.stops.map(s=>s.id));
 const items=favorites.items.filter(f=>ids.has(f.stopId)).map(({stopId,routeId,direction,name})=>({stopId,routeId,direction,name}));
 return {schoolIds:[clean.id],areas:[clean],activeSchool:clean.id,selectedStop:ids.has(selectedStop)?selectedStop:clean.stops[0]?.id,favorites:{items,defaultStop:null},schedule:{enabled:false,rules:[]}};
}
export function removeArea(areas,favorites,schedule,id){
 const next=areas.filter(s=>s.id!==id),valid=new Set(next.flatMap(s=>s.stops.map(x=>x.id)));
 return {areas:next,favorites:{items:favorites.items.filter(f=>valid.has(f.stopId)),defaultStop:valid.has(favorites.defaultStop)?favorites.defaultStop:null},schedule:{enabled:schedule.enabled&&schedule.rules.some(r=>valid.has(r.stopId)),rules:schedule.rules.filter(r=>valid.has(r.stopId))}};
}
export function walkingAppUrl(area,stop,origin){
 const query=new URLSearchParams({slat:area.lat,slng:area.lng,sname:area.name,dlat:stop.lat,dlng:stop.lng,dname:stop.name,appname:origin});
 return 'nmap://route/walk?'+query;
}
