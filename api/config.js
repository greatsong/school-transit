import {isDemo,jsonHeaders} from '../lib/runtime.js';
export default function handler(req,res){
 jsonHeaders(res);
 if(req.method!=='GET'){res.statusCode=405;return res.end(JSON.stringify({error:'GET 요청만 지원합니다.'}));}
 res.end(JSON.stringify({mode:isDemo()?'demo':'live',subwayMode:process.env.SEOUL_SUBWAY_API_KEY&&process.env.DEMO_MODE!=='true'?'live':'demo',naverClientId:process.env.NAVER_MAP_CLIENT_ID?.trim()||''}));
}
