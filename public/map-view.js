// Both providers use the same public school/stop coordinates; no geolocation.
async function naverSDK(clientId){
 if(window.naver?.maps)return window.naver.maps;
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('지도 연결 시간 초과')),10000);
  window.navermap_authFailure=()=>{clearTimeout(timer);reject(Error('네이버 지도 인증 실패'));};
  const script=document.createElement('script');
  script.src='https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId='+encodeURIComponent(clientId);
  script.onload=()=>{clearTimeout(timer);window.naver?.maps?resolve():reject(Error('지도 로드 실패'));};
  script.onerror=()=>{clearTimeout(timer);reject(Error('지도 연결 실패'));};document.head.append(script);
 });return window.naver.maps;
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function createMapView(id,runtime,onSelect){
 if(runtime.naverClientId){
  try {
   const n=await naverSDK(runtime.naverClientId),map=new n.Map(id,{center:new n.LatLng(37.5,126.93),zoom:16,scrollWheel:true,zoomControl:true});
   const markers=new Map();let schoolMarker;
   return {provider:'naver',
    setSchool(s){markers.forEach(m=>{n.Event.clearInstanceListeners(m);m.setMap(null);});markers.clear();schoolMarker?.setMap(null);schoolMarker=new n.Marker({map,position:new n.LatLng(s.lat,s.lng),icon:{content:`<div class="school-pin">${esc(s.name)}</div>`,anchor:new n.Point(45,20)}});},
    render(stops,{selectedId,favoriteIds,timer}){
     const ids=new Set(stops.map(s=>s.id));markers.forEach((m,key)=>{if(!ids.has(key)){n.Event.clearInstanceListeners(m);m.setMap(null);markers.delete(key);}});
     stops.forEach((s,i)=>{
      const saved=favoriteIds.includes(s.id),selected=selectedId===s.id;
      const content=`<div class="naver-marker"><button class="pin ${selected?'selected':''}" aria-label="${esc(s.name)} ${s.ars}" data-open-stop="${s.id}">${saved?'★':s.id.startsWith('m')?'철':i+1}</button>${saved?`<div class="timer-label naver-timer">${timer(s.id)}</div>`:''}</div>`;
      let m=markers.get(s.id);const icon={content,anchor:new n.Point(15,15)};
      if(!m){m=new n.Marker({map,position:new n.LatLng(s.lat,s.lng),title:s.name,icon});markers.set(s.id,m);n.Event.addListener(m,'click',()=>onSelect(s.id));}else m.setIcon(icon);
      m.setZIndex(selected?300:saved?200:100);
     });
    },
    focus(point){map.setCenter(new n.LatLng(point[0],point[1]));map.setZoom(18);},
    fit(points){if(!points.length)return;const bounds=new n.LatLngBounds();points.forEach(p=>bounds.extend(new n.LatLng(p[0],p[1])));map.fitBounds(bounds,{top:70,right:130,bottom:50,left:50});if(map.getZoom()>17)map.setZoom(17);}
   };
  }catch{document.getElementById(id).textContent='네이버 지도를 연결하지 못했습니다. 정류장 목록은 계속 이용할 수 있어요.';return {provider:'unavailable',setSchool(){},render(){},fit(){},focus(){}};}
 }
 try {
  const map=L.map(id,{zoomControl:true,scrollWheelZoom:true}),layer=L.layerGroup().addTo(map),markers=new Map();
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  return {provider:'osm',
   setSchool(s){markers.forEach(m=>{m.unbindTooltip();m.unbindPopup();});layer.clearLayers();markers.clear();L.marker([s.lat,s.lng],{icon:L.divIcon({className:'school-pin',html:esc(s.name),iconAnchor:[45,20]})}).addTo(layer);},
   render(stops,{selectedId,favoriteIds,timer,popup}){
    const ids=new Set(stops.map(s=>s.id));markers.forEach((m,key)=>{if(!ids.has(key)){m.unbindTooltip();layer.removeLayer(m);markers.delete(key);}});
    stops.forEach((s,i)=>{let m=markers.get(s.id);if(!m){m=L.marker([s.lat,s.lng],{title:`${s.name} ${s.ars}`,icon:L.divIcon({className:'bus-pin',html:'',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(layer).on('click',()=>onSelect(s.id));markers.set(s.id,m);}
     const saved=favoriteIds.includes(s.id),el=m.getElement();if(el)el.innerHTML=`<span class="pin ${selectedId===s.id?'selected':''}">${saved?'★':s.id.startsWith('m')?'철':i+1}</span>`;
     if(m.getPopup())m.setPopupContent(popup(s));else m.bindPopup(popup(s));
     const content=saved?timer(s.id):esc(s.name)+' · '+s.ars;
     if(m.getTooltip()?.options.permanent!==saved){m.unbindTooltip();m.bindTooltip(content,{permanent:saved,interactive:saved,direction:'right',offset:[16,0],className:saved?'timer-label':''});}else m.setTooltipContent(content);
    });
   },focus(point){map.setView(point,18);},fit(points){if(points.length)map.fitBounds(points,{padding:[65,65],maxZoom:17});}
  };
 }catch{document.getElementById(id).textContent='지도 연결 실패 · 정류장 목록을 이용해주세요.';return {provider:'unavailable',setSchool(){},render(){},fit(){},focus(){}};}
}
