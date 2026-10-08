import test from 'node:test';
import assert from 'node:assert/strict';
import {arrivalView,MAX_AGE} from '../public/model.js';
import {normalize,fetchStop,buildUrl,default as handler} from '../api/arrivals.js';
const now=Date.now();
test('counts from source timestamp and never claims actual arrival at zero',()=>{
 const a={status:'running',seconds:18};
 assert.equal(arrivalView(a,now,now+1000).text,'17초');
 assert.equal(arrivalView(a,now,now+2000).text,'16초');
 assert.equal(arrivalView(a,now,now+18000).kind,'stale');
});
test('invalid, future and stale timestamps do not show live predictions',()=>{
 const a={status:'running',seconds:600};
 for(const stamp of [undefined,null,now-1000*(MAX_AGE+1),now+60000]) assert.equal(arrivalView(a,stamp,now).kind,'stale');
});
test('waiting and missing ETA are not zero-second arrivals',()=>{
 assert.equal(arrivalView({status:'waiting'},now,now).text,'출발 대기');
 assert.equal(arrivalView({status:'running',seconds:null},now,now).kind,'waiting');
});
test('normalizes official schema and uses received time without trusting historical repTm',()=>{
 const result=normalize({msgHeader:{headerCd:'0'},msgBody:{itemList:[{busRouteId:'114900004',rtNm:'관악11',routeType:'2',repTm1:'2021-12-26 19:59:20.0',traTime1:'337',vehId1:'123',staOrd:'7',sectOrd1:'2',arrmsg1:'5분후[5번째 전]',traTime2:'0',vehId2:'0',arrmsg2:'출발대기',plainNo1:'vehicle'}]}},now);
 assert.equal(result.routes[0].arrivals[0].seconds,337);
 assert.equal(result.routes[0].arrivals[0].stops,5);
 assert.equal(result.routes[0].arrivals[1].status,'waiting');
 assert.equal(result.routes[0].generatedAt,now);
 assert.equal(result.routes[0].timeBasis,'received');
 assert.equal(JSON.stringify(result).includes('vehicle'),false);
 assert.throws(()=>normalize({msgHeader:{headerCd:'30'}}));
});
test('keys encoded once, plus preserved and mapped to official ARS query',()=>{
 assert.equal(buildUrl('17483','test%2Bkey%2F%3D').searchParams.get('serviceKey'),'test+key/=');
 assert.equal(buildUrl('17483','test+key/=').searchParams.get('serviceKey'),'test+key/=');
 assert.equal(buildUrl('17483','test').searchParams.get('arsId'),'17483');
 assert.throws(()=>buildUrl('17483',''),/MISSING_KEY/);
});
test('empty rows, single rows and unknown arrival states stay distinct',()=>{
 const envelope=itemList=>({msgHeader:{headerCd:'0'},msgBody:{itemList}});
 assert.equal(normalize(envelope(null)).routes.length,0);
 const r=normalize(envelope({busRouteId:'1',vehId1:'0',traTime1:'0',arrmsg1:'운행종료',vehId2:'9',traTime2:null})).routes[0];
 assert.equal(r.arrivals[0].status,'ended');assert.equal(r.arrivals[1].status,'unknown');
 assert.equal(r.arrivals[1].seconds,null);
});
test('whitelist rejects arbitrary proxy targets',async()=>{
 await assert.rejects(fetchStop('https://example.org'),/INVALID_STOP/);
});
test('concurrent and repeated requests share a 10-second cache',async()=>{
 let calls=0;
 const fake=async url=>{calls++;assert.equal(url.searchParams.get('arsId'),'21344');await new Promise(r=>setTimeout(r,15));return {ok:true,json:async()=>({msgHeader:{headerCd:'0'},msgBody:{itemList:[]}})};};
 const [a,b]=await Promise.all([fetchStop('120000417',fake,now,'test-key'),fetchStop('120000417',fake,now,'test-key')]);
 assert.deepEqual(a,b);await fetchStop('120000417',fake,now,'test-key');assert.equal(calls,1);
});
test('missing server key returns clearly identified demo without contacting upstream',async()=>{
 const saved=process.env.SEOUL_BUS_API_KEY;delete process.env.SEOUL_BUS_API_KEY;
 let body;const res={setHeader(){},end(x){body=JSON.parse(x)}};
 try {await handler({method:'GET',url:'/api/arrivals?stopId=116900091'},res);assert.equal(res.statusCode,200);assert.equal(body.source,'demo');}
 finally {if(saved!==undefined)process.env.SEOUL_BUS_API_KEY=saved;}
});
