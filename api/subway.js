import {metroIndex} from '../public/metro.js';
import {createBudget,jsonHeaders} from '../lib/runtime.js';
const cache=new Map(),pending=new Map(),budget=createBudget();
export function normalizeMetro(payload,station,now=Date.now()){
 const code=payload?.errorMessage?.code||payload?.RESULT?.CODE;
 if(code&&code!=='INFO-000'&&code!=='INFO-200')throw Error('UPSTREAM');
 if(!Array.isArray(payload?.realtimeArrivalList)&&code!=='INFO-200')throw Error('UPSTREAM');
 const trains=(payload.realtimeArrivalList||[]).filter(r=>station.lines.some(l=>l.id===String(r.subwayId))).slice(0,40).map(r=>{
  const raw=String(r.recptnDt||'').trim();
  const stamp=/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(raw)?Date.parse(raw.replace(' ','T')+'+09:00'):NaN;
  const seconds=r.barvlDt!==null&&String(r.barvlDt??'').trim()!==''?Number(r.barvlDt):NaN;
  return {line:station.lines.find(l=>l.id===String(r.subwayId)).name,direction:String(r.trainLineNm||r.updnLine||'방면 정보 없음').slice(0,120),type:String(r.btrainSttus||'일반').slice(0,20),seconds:Number.isFinite(seconds)&&seconds>0?seconds:null,generatedAt:Number.isFinite(stamp)?stamp:null,code:String(r.arvlCd||''),message:String(r.arvlMsg2||'예정시간 없음').slice(0,100)};
 });
 return {source:'live',stationId:station.id,trains,fetchedAt:now,serverNow:now};
}
export async function fetchMetro(id,fetcher=fetch,env=process.env){
 const station=metroIndex.get(id);if(!station)throw Error('INVALID_STATION');
 const now=Date.now();
 if(env.DEMO_MODE==='true'||!env.SEOUL_SUBWAY_API_KEY?.trim())return {source:'demo',stationId:id,fetchedAt:now,serverNow:now,trains:[{line:station.lines[0].name,direction:'수업용 예제 방면',type:'예제',seconds:180,generatedAt:now,code:'99',message:''}]};
 const hit=cache.get(id);if(hit&&now-hit.fetchedAt<55000)return {...hit,serverNow:now};
 if(pending.has(id))return pending.get(id);
 const task=(async()=>{
  budget();
  const url=new URL('http://swopenapi.seoul.go.kr/api/subway/'+encodeURIComponent(env.SEOUL_SUBWAY_API_KEY.trim())+'/json/realtimeStationArrival/0/40/'+encodeURIComponent(station.query));
  const r=await fetcher(url,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok)throw Error('UPSTREAM');
  const data=normalizeMetro(await r.json(),station,Date.now());cache.set(id,data);return data;
 })();pending.set(id,task);try{return await task;}finally{pending.delete(id);}
}
export default async function handler(req,res){
 jsonHeaders(res);if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'GET 요청만 지원합니다.'}));}
 const id=new URL(req.url,'http://localhost').searchParams.get('stationId');
 if(!metroIndex.has(id)){res.statusCode=400;return res.end(JSON.stringify({error:'지도에서 지하철역을 선택해주세요.'}));}
 try{res.end(JSON.stringify(await fetchMetro(id)));}catch(e){res.statusCode=e.message==='LOCAL_QUOTA'?429:502;res.end(JSON.stringify({error:e.message==='LOCAL_QUOTA'?'지하철 조회 한도에 도달했습니다.':'지하철 도착정보를 불러오지 못했습니다. 잠시 후 새로고침해주세요.'}));}
}
