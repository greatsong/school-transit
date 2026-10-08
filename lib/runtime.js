// No IP addresses, cookies or visitor identifiers are read or stored.
export function isDemo(env=process.env){return env.DEMO_MODE==='true'||!env.SEOUL_BUS_API_KEY?.trim();}
export function createBudget({perMinute=30,perDay=900}={}){
 let minute=-1,day=-1,shortCount=0,longCount=0;
 return (now=Date.now())=>{
  const m=Math.floor(now/60000),d=Math.floor((now+9*3600000)/86400000);
  if(m!==minute){minute=m;shortCount=0;}if(d!==day){day=d;longCount=0;}
  if(shortCount>=perMinute||longCount>=perDay)throw Error('LOCAL_QUOTA');
  shortCount++;longCount++;
 };
}
const limit=Number(process.env.UPSTREAM_DAILY_LIMIT);
// Best-effort per-instance guard, not a distributed rate limiter.
export const consumeBudget=createBudget({perDay:Number.isInteger(limit)&&limit>0?limit:900});
export function jsonHeaders(res){
 res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
}
