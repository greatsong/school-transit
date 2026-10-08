import {buildUrl} from '../lib/upstream.js';
export {buildUrl} from '../lib/upstream.js';
import {nearby} from './nearby.js';
import {isDemo,consumeBudget,jsonHeaders} from '../lib/runtime.js';
import {demoArrivals} from '../lib/demo.js';
import { SCHOOLS } from '../public/stops.js';
const stops = new Map(SCHOOLS.flatMap(s=>s.stops.map(x=>[x.id,x])));
const cache = new Map(), pending = new Map();
const text = value => typeof value === 'string' ? value.trim().slice(0,120) : '';
const number = value => value === null || value === undefined || value === '' ? NaN : Number(value);
const types = {1:'공항',2:'마을',3:'간선',4:'지선',5:'순환',6:'광역',7:'인천',8:'경기',9:'폐지'};
export function normalize(payload, now = Date.now()) {
  const code=String(payload?.msgHeader?.headerCd ?? '');
  if (code!=='0') throw new Error(code==='22'?'QUOTA':'BAD_DATA');
  const items=payload?.msgBody?.itemList;
  if(items!==null && items!==undefined && !Array.isArray(items) && typeof items!=='object') throw new Error('BAD_DATA');
  const rows=Array.isArray(items)?items:items?[items]:[];
  return {fetchedAt:now,source:'seoul-openapi', routes:rows.map(r=>({
    id:String(r.busRouteId),name:text(r.busRouteAbrv)||text(r.rtNm),type:types[r.routeType]||'버스',direction:text(r.adirection),
    // getStationByUid has no dependable prediction-generation timestamp.
    // repTm describes vehicle reporting and was null / historical in real responses.
    // This is explicitly a countdown from the time this prediction was received.
    generatedAt:now,timeBasis:'received',
    arrivals:[1,2].map(n=>{
      const message=text(r['arrmsg'+n]) || text(r['arrmsgSec'+n]);
      const seconds=number(r['traTime'+n]);
      const waiting=/출발\s*대기/.test(message),ended=/운행\s*종료/.test(message);
      const hasVehicle=number(r['vehId'+n])>0;
      const status=waiting?'waiting':ended?'ended':hasVehicle && seconds>0?'running':'unknown';
      const ord=number(r.staOrd),sect=number(r['sectOrd'+n]);
      return {status,seconds:status==='running' && Number.isFinite(seconds)?seconds:null,message,
        stops:status==='running' && Number.isFinite(ord) && Number.isFinite(sect)?Math.abs(ord-sect):null,
        congestion:{3:'여유',4:'보통',5:'혼잡'}[r['congestion'+n]]||'',lowFloor:r['busType'+n]==='1'};
    })
  }))};
}
export async function fetchStop(id, fetcher=fetch, now=Date.now(), key=process.env.SEOUL_BUS_API_KEY, arsId=null) {
  if (!/^\d{9}$/.test(id) || (!stops.has(id) && !/^\d{5}$/.test(arsId||''))) throw new Error('INVALID_STOP');
  const ars=arsId||stops.get(id).ars;
  if(!/^\d{5}$/.test(ars)||ars==='00000')throw new Error('INVALID_STOP');
  const url=buildUrl(ars,key);
  id=ars;
  if (cache.has(id) && now-cache.get(id).fetchedAt<10000) return cache.get(id);
  if (pending.has(id)) return pending.get(id);
  const task=(async()=>{
    consumeBudget();
    const response=await fetcher(url,{signal:AbortSignal.timeout(12000),redirect:'error',headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error('UPSTREAM');
    const data=normalize(await response.json()); cache.set(id,data); return data;
  })();
  pending.set(id,task);
  try {return await task;} finally {pending.delete(id);}
}
export default async function handler(req,res) {
  jsonHeaders(res);
  const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
  if(req.method!=='GET') {res.setHeader('Allow','GET');return send(405,{error:'GET 요청만 지원합니다.'});}
  const query=new URL(req.url,'http://localhost').searchParams;
  const id=query.get('stopId');
  if(!/^\d{9}$/.test(id||''))return send(400,{error:'정류장을 선택해주세요.'});
  try {
    if(isDemo())return send(200,demoArrivals(id));
    // The browser cannot choose an arbitrary ARS number or proxy URL.
    let stop=stops.get(id);
    if(!stop){
      const schoolId=query.get('schoolId');
      if(!schoolId)return send(400,{error:'학교를 먼저 검색해주세요.'});
      stop=(await nearby(schoolId)).stops.find(s=>s.id===id);
      if(!stop)return send(400,{error:'학교 주변 정류장을 선택해주세요.'});
    }
    return send(200,{...await fetchStop(id,fetch,Date.now(),process.env.SEOUL_BUS_API_KEY,stop.ars),serverNow:Date.now()});
  }
  catch(e) {
    if(e.message==='DEMO_SCHOOL')return send(422,{error:'예제 모드에서는 신도림중·당곡고 예시 정류장을 이용해주세요.'});
    if(e.message==='INVALID_SCHOOL')return send(400,{error:'검색 목록에서 학교를 선택해주세요.'});
    if(e.message==='LOCAL_QUOTA'){res.setHeader('Retry-After','60');return send(429,{error:'조회 한도에 도달했습니다. 운영 설정을 확인하거나 나중에 이용해주세요.'});}
    if(e.message==='MISSING_KEY')return send(503,{error:'서버의 버스 API 인증키 설정이 필요합니다.'});
    if(e.message==='QUOTA')return send(429,{error:'버스 API 호출 한도에 도달했습니다. 잠시 후 다시 이용해주세요.'});
    // Never relay upstream errors or URLs: they may contain the service key.
    return send(502,{error:'서울시 버스정보에 연결하지 못했습니다. 잠시 후 새로고침해주세요.'});
  }
}
