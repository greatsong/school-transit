import {SCHOOL_CATALOG} from '../public/school-catalog.js';
import {buildUrl} from '../lib/upstream.js';
import {isDemo,consumeBudget,jsonHeaders} from '../lib/runtime.js';
import {demoNearby} from '../lib/demo.js';
const schools=new Map(SCHOOL_CATALOG.map(s=>[s.id,s]));
const cache=new Map(),pending=new Map();
export function normalizeStops(payload,school){
 if(String(payload?.msgHeader?.headerCd)!=='0')throw Error('UPSTREAM');
 const raw=payload.msgBody?.itemList;const rows=Array.isArray(raw)?raw:raw?[raw]:[];
 const seen=new Set();
 return rows.map(r=>({id:String(r.stationId||r.stId||''),ars:String(r.arsId||'').padStart(5,'0'),name:String(r.stationNm||r.stNm||'').slice(0,100),lat:Number(r.gpsY),lng:Number(r.gpsX),distance:Number(r.dist)}))
 .filter(s=>/^\d{9}$/.test(s.id)&&/^\d{5}$/.test(s.ars)&&s.ars!=='00000'&&s.lat>37&&s.lat<38&&s.lng>126&&s.lng<128&&Number.isFinite(s.distance)&&!seen.has(s.id)&&seen.add(s.id))
 .map(s=>{if(!school)return s;const rad=Math.PI/180,h=Math.sin((s.lat-school.lat)*rad/2)**2+Math.cos(s.lat*rad)*Math.cos(school.lat*rad)*Math.sin((s.lng-school.lng)*rad/2)**2;return {...s,distance:Math.round(12742000*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)))};})
 .filter(s=>s.distance>=0&&(!school||s.distance<=500)).sort((a,b)=>a.distance-b.distance).slice(0,50);
}
export async function nearby(schoolId,fetcher=fetch){
 if(!schools.has(schoolId))throw Error('INVALID_SCHOOL');
 if(isDemo())return demoNearby(schoolId);
 if(cache.has(schoolId)&&Date.now()-cache.get(schoolId).fetchedAt<86400000)return cache.get(schoolId);
 if(pending.has(schoolId))return pending.get(schoolId);
 const task=(async()=>{
  const school=schools.get(schoolId),url=buildUrl('00000',process.env.SEOUL_BUS_API_KEY);
  url.pathname='/api/rest/stationinfo/getStationByPos';url.searchParams.delete('arsId');
  url.searchParams.set('tmX',school.lng);url.searchParams.set('tmY',school.lat);url.searchParams.set('radius','500');
  consumeBudget();
  const r=await fetcher(url,{signal:AbortSignal.timeout(12000),redirect:'error'});
  if(!r.ok)throw Error('UPSTREAM');
  const data={...school,stops:normalizeStops(await r.json(),school),fetchedAt:Date.now()};cache.set(schoolId,data);return data;
 })();pending.set(schoolId,task);try{return await task;}finally{pending.delete(schoolId);}
}
export default async function handler(req,res){
 jsonHeaders(res);
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'GET 요청만 지원합니다.'}));}
 const id=new URL(req.url,'http://localhost').searchParams.get('schoolId');
 if(!schools.has(id)){res.statusCode=400;return res.end(JSON.stringify({error:'검색 목록에서 학교를 선택해주세요.'}));}
 try{res.end(JSON.stringify(await nearby(id)));}catch(e){res.statusCode=e.message==='DEMO_SCHOOL'?422:e.message==='LOCAL_QUOTA'?429:502;res.end(JSON.stringify({error:e.message==='DEMO_SCHOOL'?'예제 모드에서는 신도림중학교 또는 당곡고등학교를 검색해주세요. 실제 연결은 만들기 교재를 참고하세요.':e.message==='LOCAL_QUOTA'?'조회 한도에 도달했습니다. 나중에 다시 이용해주세요.':'주변 정류장을 불러오지 못했습니다. 다시 시도해주세요.'}));}
}
