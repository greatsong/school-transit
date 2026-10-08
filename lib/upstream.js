export function buildUrl(ars, rawKey) {
  if (!rawKey?.trim()) throw new Error('MISSING_KEY');
  // Accept the portal's encoded or decoded key without encoding it twice.
  let key=rawKey.trim();
  if(key.includes('%')) {try {key=decodeURIComponent(key);}catch{throw new Error('INVALID_KEY');}}
  const url=new URL('http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid');
  url.search=new URLSearchParams({serviceKey:key,arsId:ars,resultType:'json'}).toString();
  return url;
}
