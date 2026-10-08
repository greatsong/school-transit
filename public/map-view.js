// The browser Maps key is restricted to this website and Maps JavaScript API.
async function googleSDK(key){
 if(window.google?.maps?.Map)return window.google.maps;
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('지도 연결 시간 초과')),12000);
  window.schoolTransitMapReady=()=>{clearTimeout(timer);resolve();};
  window.gm_authFailure=()=>{clearTimeout(timer);reject(Error('지도 인증 실패'));};
  const script=document.createElement('script');
  script.src='https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key,callback:'schoolTransitMapReady',loading:'async',v:'quarterly',language:'ko',region:'KR'});
  script.onerror=()=>{clearTimeout(timer);reject(Error('지도 로드 실패'));};document.head.append(script);
 });return window.google.maps;
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function createMapView(id,runtime,onSelect){
 document.getElementById(id).addEventListener('click',e=>{const b=e.target.closest('[data-google-point]');if(b)onSelect(b.dataset.googlePoint);});
 if(runtime.googleMapsKey){
  try {
   const g=await googleSDK(runtime.googleMapsKey),map=new g.Map(document.getElementById(id),{center:{lat:37.5,lng:126.93},zoom:18,zoomControl:true,streetViewControl:false,mapTypeControl:false,fullscreenControl:false});
   class Label extends g.OverlayView{
    constructor(point,html,order=100){super();this.point=point;this.html=html;this.order=order;this.setMap(map);}
    onAdd(){this.el=document.createElement('div');this.el.className='google-marker';this.el.innerHTML=this.html;this.el.style.zIndex=this.order;this.getPanes().overlayMouseTarget.append(this.el);g.OverlayView.preventMapHitsAndGesturesFrom(this.el);}
    draw(){const p=this.getProjection().fromLatLngToDivPixel(new g.LatLng(this.point.lat,this.point.lng));if(this.el){this.el.style.left=(p.x-15)+'px';this.el.style.top=(p.y-15)+'px';}}
    update(html,order){this.html=html;this.order=order;if(this.el){this.el.innerHTML=html;this.el.style.zIndex=order;}}
    onRemove(){this.el?.remove();}
   }
   const markers=new Map();let schoolMarker;
   return {provider:'google',
    setSchool(s){markers.forEach(m=>m.setMap(null));markers.clear();schoolMarker?.setMap(null);schoolMarker=new Label(s,`<div class="school-pin">${esc(s.name)}</div>`,50);},
    render(stops,{selectedId,favoriteIds,timer}){
     const ids=new Set(stops.map(s=>s.id));markers.forEach((m,key)=>{if(!ids.has(key)){m.setMap(null);markers.delete(key);}});
     stops.forEach((s,i)=>{
      const saved=favoriteIds.includes(s.id),selected=selectedId===s.id;
      const html=`<button class="pin ${selected?'selected':''}" aria-label="${esc(s.name)} ${esc(s.ars)}" data-google-point="${s.id}">${saved?'★':s.id.startsWith('m')?'철':i+1}</button>${saved?`<div class="timer-label">${timer(s.id)}</div>`:''}`;
      const order=selected?300:saved?200:100;let m=markers.get(s.id);if(!m){m=new Label(s,html,order);markers.set(s.id,m);}else m.update(html,order);
     });
    },
    focus(point){map.setCenter({lat:point[0],lng:point[1]});map.setZoom(18);},
    fit(points){if(!points.length)return;const bounds=new g.LatLngBounds();points.forEach(p=>bounds.extend({lat:p[0],lng:p[1]}));map.fitBounds(bounds,65);g.event.addListenerOnce(map,'idle',()=>{if(map.getZoom()>17)map.setZoom(17);});}
   };
  }catch{document.getElementById(id).textContent='Google 지도를 연결하지 못했습니다. 키의 사이트 제한과 결제 설정을 확인해주세요.';return {provider:'unavailable',setSchool(){},render(){},fit(){},focus(){}};}
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
