import {createJourneyUI} from './journey-ui.js';
import {JOURNEY_KEY} from './journeys.js';
import {createMetroUI} from './metro-ui.js';
import {SITE} from './site.js';
import {createMapView} from './map-view.js';
import {arrivalView} from './model.js';
import {SCHOOL_CATALOG} from './school-catalog.js';
import {STORAGE_KEY,restoreFavorites,favoriteKey,favoriteStopIds,favoriteRoutes} from './favorites.js';
import {SCHEDULE_KEY,noonPreset,validateSchedule,restoreSchedule,activeDefault} from './schedule.js';
import {WORKSPACE_KEY,seedAreas,cleanAreas,parseWorkspace,encodeShare,decodeShare,walkingUrl,walkingAppUrl,shouldRefresh,publicShare} from './workspace.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
let areas=parseWorkspace(read(WORKSPACE_KEY));
if(!areas.length&&!location.hash.startsWith('#share=')){location.replace('/setup.html');}
else {
if(!areas.length)areas=seedAreas();
const runtime=await fetch('/api/config').then(r=>r.json()).catch(()=>({mode:'unknown'}));
if(runtime.mode==='demo'){$('modeNotice').hidden=false;$('modeNotice').textContent='수업용 예제 · 실제 버스 도착시간이 아닙니다.';}
$('brandTitle').textContent=SITE.title;document.title=SITE.title;

let stopIndex,sharedMode=false;
function indexStops(){stopIndex=new Map();for(const s of areas)for(const x of s.stops)if(!stopIndex.has(x.id))stopIndex.set(x.id,{...x,school:s});}
indexStops();
let favorites=restoreFavorites(read(STORAGE_KEY),stopIndex);
let schedule=restoreSchedule(read(SCHEDULE_KEY),stopIndex);
let shareStart=null,shareSchool=null,sharedMetro=[];
try{
 const shared=decodeShare(location.hash);
 if(shared){
  const imported=cleanAreas(shared.areas);
  if(!imported.length||imported.length!==shared.schoolIds.length||imported.some(s=>!shared.schoolIds.includes(s.id)))throw Error('공유 학교 정보가 올바르지 않습니다.');
  const valid=new Set(imported.flatMap(s=>s.stops.map(x=>x.id)));
  if(validateSchedule(shared.schedule,valid))throw Error('공유 시간대 설정이 올바르지 않습니다.');
  areas=imported;indexStops();favorites=restoreFavorites(JSON.stringify(shared.favorites),stopIndex);schedule=shared.schedule;
  sharedMetro=shared.metro||[];sharedMode=true;shareStart=shared.selectedStop;shareSchool=shared.activeSchool;
  $('sharedNotice').textContent='공유받은 지도입니다. 이 화면의 변경은 기존 개인 설정에 저장되지 않아요. 변경한 지도는 새 링크로 공유할 수 있습니다.';
 }
}catch(e){$('sharedNotice').textContent=e.message+' 저장된 개인 지도를 표시합니다.';}
let school=areas[0],selected=null,map,refreshingFavorites=false;
let lastRefresh=Date.now(),lastScheduleKey='',searchBusy=false;
const snapshots=new Map(),pending=new Map(),failures=new Map();
let journey=null;
function persist(){
 favorites=restoreFavorites(JSON.stringify(favorites),stopIndex);
 if(sharedMode)return;
 try{localStorage.setItem(WORKSPACE_KEY,JSON.stringify(areas));localStorage.setItem(STORAGE_KEY,JSON.stringify(favorites));localStorage.setItem(SCHEDULE_KEY,JSON.stringify(schedule));$('saveStatus').textContent='';}
 catch{$('saveStatus').textContent='저장 공간을 사용할 수 없어 이번 방문 동안만 유지됩니다.';}
}
function isFavorite(stopId,route=null){const f={stopId,routeId:route?.id||null,direction:route?.direction||''};return favorites.items.some(x=>favoriteKey(x)===favoriteKey(f));}
function toggleFavorite(stopId,route=null){
 const item={stopId,routeId:route?.id||null,direction:route?.direction||'',name:route?.name||''};
 const key=favoriteKey(item),exists=favorites.items.some(x=>favoriteKey(x)===key);
 favorites.items=exists?favorites.items.filter(x=>favoriteKey(x)!==key):[...favorites.items,item];
 persist();updateMarkers();render();loadFavoritesOnce();
}
function openFavorite(id){const entry=stopIndex.get(id);if(!entry)return;if(entry.school.id===school.id)selectStop(id);else selectSchool(entry.school,id);}
function renderFavorites(){
 const ids=favoriteStopIds(favorites.items);
 $('favoriteCount').textContent=ids.length?`${ids.length}개 정류장`:'';
 $('refreshFavorites').disabled=(!ids.length&&!metro.favoriteIds.length) || refreshingFavorites || ids.some(id=>pending.has(id));
 $('refreshFavorites').textContent=refreshingFavorites?'조회 중…':'↻ 즐겨찾기 새로고침';
 if(!ids.length){$('favorites').innerHTML='<div class="favorite-empty"><strong>자주 타는 버스를 등록해보세요.</strong><br>정류장 전체를 저장하거나, 버스 번호 옆 ☆로 필요한 노선만 모아볼 수 있어요.</div>';return;}
 $('favorites').innerHTML=ids.map(id=>{
  const stop=stopIndex.get(id),snap=snapshots.get(id),failure=failures.get(id),all=isFavorite(id),primary=favorites.defaultStop===id;
  const routes=snap?favoriteRoutes(favorites.items,id,snap.routes):[];
  const choices=favorites.items.filter(x=>x.stopId===id && x.routeId);
  const missing=snap && !failure?choices.filter(x=>!snap.routes.some(r=>r.id===x.routeId && r.direction===x.direction)):[];
  let body=failure?`<p class="error">${esc(failure)}</p>`:!snap?'<p class="empty">도착정보를 조회하고 있어요…</p>':routes.map(r=>routeMarkup(r,snap.routes.indexOf(r),id,'favorite')).join('');
  if(snap && !failure && !routes.length && !missing.length)body='<p class="empty">현재 제공되는 도착정보가 없습니다.</p>';
  body+=missing.map(x=>`<div class="missing-route">${esc(x.name)} · 현재 도착정보 없음 <button class="route-remove" data-remove-key="${esc(favoriteKey(x))}">즐겨찾기 해제</button></div>`).join('');
  return `<article class="favorite-group ${primary?'default':''}"><div class="favorite-group-head"><div><small>${esc(stop.school.name)} · ${stop.ars}</small><h3><button class="favorite-link" data-open-stop="${id}">${esc(stop.name)} ↗</button></h3><small>${all?'정류장 전체 노선':'선택한 버스 노선'}</small></div><div class="favorite-actions"><button data-default-stop="${id}" aria-pressed="${primary}">${primary?'✓ 기본':'기본으로'}</button><button data-remove-stop="${id}" aria-label="${esc(stop.name)} ${stop.ars} 즐겨찾기 전체 해제">×</button></div></div><p class="favorite-meta">${pending.has(id)?'새 도착정보 조회 중…':snap?'조회 '+new Date(snap.fetchedAt).toLocaleTimeString('ko-KR'):'최초 조회'} · <button class="favorite-link" data-refresh-stop="${id}">새로고침</button></p>${body}</article>`;
 }).join('');
}
async function refreshFavorites(){await Promise.all([refreshBatch(favoriteStopIds(favorites.items)),metro.refreshAll()]);}
function routeMarkup(r,i,id,scope){
 const saved=isFavorite(id,r);
 return `<article class="route"><div class="route-top"><span class="route-number">${esc(r.name)}</span><span class="badge">${esc(r.type)}</span><button class="star-button" data-route-stop="${id}" data-route-index="${i}" aria-pressed="${saved}" aria-label="${esc(r.name)} ${esc(r.direction)} 방면 노선 즐겨찾기 ${saved?'해제':'등록'}">${saved?'★':'☆'}</button><span class="direction">${esc(r.direction)} 방면 →</span></div><div class="times">${r.arrivals.map((a,n)=>`<div class="arrival"><small>${n===0?'첫 번째 버스':'다음 버스'}</small><div class="time" data-time="${id}:${i}:${n}"></div><div class="details">${a.stops!==null?`${a.stops}정류장 전`:''}${a.congestion?' · '+esc(a.congestion):''}</div></div>`).join('')}</div></article>`;
}
const metro=createMetroUI({areas,shared:sharedMode,sharedItems:sharedMetro,onChange:()=>{updateMarkers();renderFavorites();},onFocus:point=>map?.focus(point),onSchool:s=>selectSchool(s)});
$('metroMode').textContent=runtime.subwayMode==='demo'?'지하철은 예제 모드입니다. 실시간 연결에는 별도 서울시 인증키가 필요해요.':'';
map=await createMapView('map',runtime,id=>{if(id.startsWith('m')){metro.select(id);return;}if(school.stops.some(x=>x.id===id))selectStop(id);else openFavorite(id);});
$('mapProvider').textContent=map.provider==='google'?'Google 지도':map.provider==='osm'?'OpenStreetMap · Google 지도 키 연결 전':'지도 연결 실패 · 정류장 목록을 이용해주세요';
function renderSchools(){
 $('schools').innerHTML=areas.map(s=>`<button data-school="${s.id}" class="${s.id===school.id?'active':''}" aria-pressed="${s.id===school.id}">${esc(s.name)}</button>`).join('');
}
function center(){map.fit([[school.lat,school.lng],...school.stops.map(s=>[s.lat,s.lng]),...metro.markers().map(s=>[s.lat,s.lng])]);}
function timerMarkup(id){
 const stop=stopIndex.get(id),snap=snapshots.get(id);
 const routes=snap?favoriteRoutes(favorites.items,id,snap.routes):[];
 return `<div class="map-timer-head">★ ${esc(stop.name)} · ${stop.ars}</div>${failures.has(id)?'<div>연결 실패 · 재조회 대기</div>':!snap?'<div>조회 중…</div>':!routes.length?'<div>도착정보 없음</div>':routes.map(r=>`<div class="map-timer-route"><b>${esc(r.name)}</b><span class="map-time" data-time="${id}:${snap.routes.indexOf(r)}:0"></span><span class="map-timer-direction">${esc(r.direction)} 방면</span></div>`).join('')}<button class="map-timer-link" data-open-stop="${id}">정류장 보기</button>`;
}
function popupMarkup(stop){return `<div class="popup-title">${esc(stop.name)}</div><div>${stop.ars} · ${esc(stop.school.name)}</div><div class="popup-actions"><button data-toggle-stop="${stop.id}">${isFavorite(stop.id)?'★ 즐겨찾기 해제':'☆ 즐겨찾기'}</button><button data-schedule-stop="${stop.id}">◷ 시간대 추가</button></div><a class="walk-link" href="${walkingUrl(stop.school,stop)}" target="_blank" rel="noopener">Google 지도에서 정류장 보기 ↗</a>`;}
function updateMarkers(){
 if(!map)return;
 const ids=new Set([...school.stops.map(s=>s.id),...favoriteStopIds(favorites.items),...(journey?.points||[]).filter(p=>p.kind==='bus').map(p=>p.id)]);
 const stops=[...ids].map(id=>{const current=school.stops.find(s=>s.id===id);return current?{...current,school}:stopIndex.get(id);}).filter(Boolean);
 map.render([...stops,...metro.markers()],{selectedId:metro.selected||selected?.id,favoriteIds:[...favoriteStopIds(favorites.items),...metro.favoriteIds,...(journey?.boardIds||[])],timer:id=>journey?.boardIds.includes(id)?journey.timer(id):id.startsWith('m')?metro.timer(id):timerMarkup(id),popup:s=>s.id.startsWith('m')?metro.popup(s):popupMarkup(s)});tickTimes();journey?.render();
}
function selectSchool(s,startId){
 school=s;metro.setSchool(s);renderSchools();
 $('stopSelect').innerHTML=s.stops.map((x,i)=>`<option value="${x.id}">${i+1}. ${esc(x.name)} · ${x.ars}</option>`).join('');
 $('stopList').innerHTML=s.stops.map((x,i)=>`<button class="stop-button" data-stop="${x.id}"><span class="num">${i+1}</span><span><b>${esc(x.name)}</b><small>${x.ars} · 약 ${Math.round(x.distance)}m</small></span></button>`).join('');
 map.setSchool(s);
 selected=null;updateMarkers();
 const stop=s.stops.find(x=>x.id===startId)||s.stops.find(x=>x.ars===s.defaultStop)||s.stops[0];
 if(stop)selectStop(stop.id);else{
  map.focus([s.lat,s.lng]);$('stopName').textContent='주변 정류장 없음';$('stopMeta').textContent='학교 중심 500m 안에 조회 가능한 정류장이 없습니다.';$('arrivals').innerHTML='';$('walkInfo').innerHTML='';render();
 }
}
function selectStop(id){
 metro.hide();
 const changed=selected?.id!==id;selected=school.stops.find(s=>s.id===id);if(!selected)return;if(changed)map.focus([selected.lat,selected.lng]);
 $('stopSelect').value=id;$('stopName').textContent=selected.name;$('stopMeta').textContent=`정류소 ${selected.ars} · 학교에서 직선 약 ${Math.round(selected.distance)}m`;
 $('walkInfo').innerHTML=`<a class="walk-link" href="${esc(walkingAppUrl(school,selected,location.origin))}">학교에서 걸어가기 · Google 지도 ↗</a><br><small>학교 중심에서 출발합니다. 한국 도보 경로는 제공되지 않을 수 있어요.</small><br><a class="walk-link" href="${walkingUrl(school,selected)}" target="_blank" rel="noopener">Google 지도에서 정류장 보기 ↗</a>`;
 document.querySelectorAll('[data-stop]').forEach(b=>{b.classList.toggle('active',b.dataset.stop===id);b.setAttribute('aria-pressed',String(b.dataset.stop===id));});
 updateMarkers();
 if(!snapshots.has(id)&&!failures.has(id))load(id);else render();
}
function nowFor(snap){return snap.serverNow+Math.max(performance.now()-snap.mono,Date.now()-snap.wall)+snap.rtt;}
async function load(id){
 if(pending.has(id))return pending.get(id);
 const stop=stopIndex.get(id);if(!stop)return;failures.delete(id);
 const task=(async()=>{const started=performance.now();try{
  const r=await fetch(`/api/arrivals?stopId=${id}&schoolId=${stop.school.id}`,{signal:AbortSignal.timeout(16000)});
  const data=await r.json();if(!r.ok)throw Error(data.error||'도착정보를 불러오지 못했습니다.');
  snapshots.set(id,{...data,mono:performance.now(),wall:Date.now(),rtt:performance.now()-started});
 }catch(e){failures.set(id,e.name==='TimeoutError'?'조회 시간이 길어지고 있습니다. 다시 새로고침해주세요.':e.message);}
 finally{pending.delete(id);render();updateMarkers();}})();pending.set(id,task);render();await task;
}
async function refreshBatch(ids){
 if(refreshingFavorites)return;refreshingFavorites=true;render();
 try{for(const id of new Set(ids))await load(id);}finally{lastRefresh=Date.now();refreshingFavorites=false;render();tick();}
}
function render(){
 renderFavorites();
 for(const id of ['refresh','favoriteStop','scheduleStop'])$(id).disabled=!selected;
 if(!selected){$('status').textContent='다른 학교를 검색해보세요.';return;}
 const savedStop=isFavorite(selected.id);$('favoriteStop').textContent=savedStop?'★ 정류장 즐겨찾기됨':'☆ 정류장 즐겨찾기';$('favoriteStop').setAttribute('aria-pressed',String(savedStop));
 const snap=snapshots.get(selected.id),loading=pending.has(selected.id),failure=failures.get(selected.id);
 $('refresh').disabled=loading||refreshingFavorites;$('refresh').textContent=loading?'조회 중…':'↻ 새로고침';
 $('status').textContent=loading?'서울시 도착정보를 조회하고 있어요':failure?'연결 실패 · 다음 갱신 때 다시 조회합니다':snap?`${snap.source==='demo'?'예제 · ':''}${new Date(snap.fetchedAt).toLocaleTimeString('ko-KR')} 조회 · 1분마다 갱신`:'정류장을 선택해주세요';
 $('statusDot').style.background=failure?'#cc8b4b':'#3f8d65';
 $('arrivals').innerHTML=failure?`<div class="error">${esc(failure)}</div>`:!snap?'<div class="empty">버스 도착정보를 불러오고 있어요…</div>':!snap.routes.length?'<div class="empty">현재 제공되는 도착정보가 없습니다.</div>':snap.routes.map((r,i)=>routeMarkup(r,i,selected.id,'main')).join('');tickTimes();
}
function tickTimes(){document.querySelectorAll('[data-time]').forEach(el=>{
 const [id,idx,n]=el.dataset.time.split(':'),snap=snapshots.get(id),r=snap?.routes[Number(idx)];if(!r)return;
 const v=arrivalView(r.arrivals[Number(n)],r.generatedAt,nowFor(snap));el.textContent=v.text;el.className=(el.closest('.timer-label')?'map-time ':'time ')+v.kind;
 const details=el.parentElement.querySelector('.details');if(details)details.style.visibility=v.kind==='running'?'visible':'hidden';
});}
function applySchedule(force=false){
 if(journey?.active)return;
 const active=activeDefault(schedule,favorites.defaultStop),entry=stopIndex.get(active.stopId);
 $('scheduleStatus').textContent=entry?`${active.rule?active.rule.start+'–'+active.rule.end:'기본 정류장'} · ${entry.school.name} / ${entry.name} (${entry.ars})`:'기본으로 열 정류장을 즐겨찾기하거나 시간대를 설정해주세요.';
 $('showScheduled').disabled=!entry;
 if((force||active.key!==lastScheduleKey)&&entry)openFavorite(entry.id);
 lastScheduleKey=active.key;
}
function tick(){
 tickTimes();journey?.apply();journey?.render();applySchedule();
 const busy=refreshingFavorites||pending.size>0;
 $('autoStatus').textContent=document.hidden?'자동 갱신 일시정지 · 화면으로 돌아오면 재개':refreshingFavorites?'새 도착정보를 갱신하고 있어요…':`자동 갱신까지 ${Math.max(0,60-Math.floor((Date.now()-lastRefresh)/1000))}초 · 1분마다 조회`;
 if(shouldRefresh({visible:!document.hidden,busy,now:Date.now(),lastRefresh}))refreshBatch([selected?.id,...favoriteStopIds(favorites.items),...(journey?.boardIds||[]).filter(id=>!id.startsWith('m'))].filter(Boolean));
}
function draftSchedule(){return {enabled:$('scheduleEnabled').checked,rules:[...$('scheduleRows').children].map(row=>({start:row.querySelector('[data-start]').value,end:row.querySelector('[data-end]').value,stopId:row.querySelector('select').value}))};}
function editSchedule(config=schedule){
 $('scheduleEnabled').checked=config.enabled;$('scheduleError').textContent='';
 $('scheduleRows').innerHTML=config.rules.map((r,i)=>`<div class="schedule-row"><label>시작<input type="time" data-start value="${esc(r.start)}" aria-label="${i+1}번째 시작" required></label><label>종료<input type="time" data-end value="${esc(r.end)}" aria-label="${i+1}번째 종료" required></label><label class="schedule-destination">기본 정류장<select aria-label="${i+1}번째 기본 정류장">${areas.map(a=>`<optgroup label="${esc(a.name)}">${a.stops.map(s=>`<option value="${s.id}" ${s.id===r.stopId?'selected':''}>${esc(s.name)} · ${s.ars}</option>`).join('')}</optgroup>`).join('')}</select></label><button type="button" data-delete-rule="${i}" aria-label="${i+1}번째 시간대 삭제">삭제</button></div>`).join('');
}
function addSchedule(id=selected?.id){
 const draft=draftSchedule();if(draft.rules.length>=12){$('scheduleError').textContent='최대 12개까지 등록할 수 있어요.';return;}
 draft.enabled=true;draft.rules.push({start:'',end:'',stopId:id});editSchedule(draft);$('scheduleSettings').open=true;$('scheduleSettings').closest('.advanced').open=true;$('scheduleSettings').scrollIntoView({behavior:'smooth',block:'center'});$('scheduleRows').lastElementChild?.querySelector('input').focus();
}
$('favoriteStop').addEventListener('click',()=>selected&&toggleFavorite(selected.id));
$('refreshFavorites').addEventListener('click',refreshFavorites);
$('schools').addEventListener('click',e=>{const b=e.target.closest('[data-school]');if(b)selectSchool(areas.find(s=>s.id===b.dataset.school));});
document.addEventListener('click',e=>{
 const toggle=e.target.closest('[data-toggle-stop]');if(toggle){toggleFavorite(toggle.dataset.toggleStop);return;}
 const timed=e.target.closest('[data-schedule-stop]');if(timed){addSchedule(timed.dataset.scheduleStop);return;}
 const star=e.target.closest('[data-route-stop]');if(star){const route=snapshots.get(star.dataset.routeStop)?.routes[Number(star.dataset.routeIndex)];if(route)toggleFavorite(star.dataset.routeStop,route);return;}
 const open=e.target.closest('[data-open-stop]');if(open){openFavorite(open.dataset.openStop);return;}
 const primary=e.target.closest('[data-default-stop]');if(primary){favorites.defaultStop=primary.dataset.defaultStop;persist();render();applySchedule();return;}
 const remove=e.target.closest('[data-remove-stop]');if(remove){favorites.items=favorites.items.filter(x=>x.stopId!==remove.dataset.removeStop);persist();render();updateMarkers();return;}
 const removeRoute=e.target.closest('[data-remove-key]');if(removeRoute){favorites.items=favorites.items.filter(x=>favoriteKey(x)!==removeRoute.dataset.removeKey);persist();render();updateMarkers();return;}
 const refresh=e.target.closest('[data-refresh-stop]');if(refresh){refreshBatch([refresh.dataset.refreshStop]);return;}
 const del=e.target.closest('[data-delete-rule]');if(del){const draft=draftSchedule();draft.rules.splice(Number(del.dataset.deleteRule),1);editSchedule(draft);}
});
async function loadFavoritesOnce(){for(const id of favoriteStopIds(favorites.items))if(!snapshots.has(id)&&!failures.has(id))await load(id);}
$('stopSelect').addEventListener('change',e=>selectStop(e.target.value));
$('stopList').addEventListener('click',e=>{const b=e.target.closest('[data-stop]');if(b)selectStop(b.dataset.stop);});
$('refresh').addEventListener('click',()=>selected&&refreshBatch([selected.id]));$('recenter').addEventListener('click',center);
$('favoritesMap').addEventListener('click',()=>{const stops=[...favoriteStopIds(favorites.items).map(id=>stopIndex.get(id)),...metro.markers().filter(s=>metro.favoriteIds.includes(s.id))];if(stops.length)map.fit(stops.map(s=>[s.lat,s.lng]));});
$('showScheduled').addEventListener('click',()=>applySchedule(true));$('scheduleStop').addEventListener('click',()=>addSchedule());$('addSchedule').addEventListener('click',()=>addSchedule());
$('noonPreset').addEventListener('click',()=>{const draft=draftSchedule(),ids=draft.rules.map(r=>r.stopId).filter(id=>stopIndex.has(id));const first=ids[0]||selected?.id||stopIndex.keys().next().value;editSchedule({enabled:true,rules:[{start:'00:00',end:'12:00',stopId:first},{start:'12:00',end:'00:00',stopId:ids[1]||first}]});});
$('cancelSchedule').addEventListener('click',()=>{editSchedule();$('scheduleSettings').open=false;});
$('scheduleForm').addEventListener('submit',e=>{e.preventDefault();const draft=draftSchedule(),error=validateSchedule(draft,stopIndex);$('scheduleError').textContent=error;if(error)return;schedule=draft;persist();$('scheduleSaved').textContent=sharedMode?'이 공유 화면에 시간대를 적용했습니다.':'시간대를 저장했습니다.';$('scheduleSettings').open=false;applySchedule(true);});
$('shareButton').addEventListener('click',()=>{
 $('sharePanel').hidden=false;
 try{$('shareUrl').value=location.origin+location.pathname+'#share='+encodeShare({...publicShare(school,selected?.id,favorites),metro:metro.share()});$('shareNote').textContent=['localhost','127.0.0.1'].includes(location.hostname)?'현재는 이 컴퓨터에서만 열리는 주소입니다. 공개 배포 후 만든 링크부터 친구도 사용할 수 있어요. 현재 학교와 이 학교의 즐겨찾기만 공유합니다. 개인 시간대는 제외됩니다.':'현재 학교·정류장·노선만 공유합니다. 다른 학교와 개인 시간대는 포함되지 않습니다.';}
 catch(e){$('shareUrl').value='';$('shareNote').textContent=e.message;}
});
$('copyShare').addEventListener('click',async()=>{if(!$('shareUrl').value)return;try{await navigator.clipboard.writeText($('shareUrl').value);$('copyShare').textContent='복사 완료';}catch{$('shareUrl').select();$('shareNote').textContent='주소를 선택했습니다. 복사해서 공유해주세요.';}});
window.addEventListener('storage',e=>{if(!sharedMode&&[STORAGE_KEY,SCHEDULE_KEY,WORKSPACE_KEY,JOURNEY_KEY,'school-transit-metro-v1'].includes(e.key))location.reload();});
journey=createJourneyUI({areas,shared:sharedMode,snapshot:id=>id.startsWith('m')?metro.snapshot(id):failures.has(id)?null:snapshots.get(id),nowFor,load:id=>id.startsWith('m')?metro.load(id):load(id),onChange:()=>{metro.setJourneyPoints(journey?.points||[],journey?.boardIds||[]);updateMarkers();},onFocus:point=>{if(!point)return;if(point.kind==='metro')metro.select(point.id);else openFavorite(point.id);}});
const initial=stopIndex.get(shareStart)||stopIndex.get(activeDefault(schedule,favorites.defaultStop).stopId);
lastScheduleKey=activeDefault(schedule,favorites.defaultStop).key;
const fromSetup=new URLSearchParams(location.hash.slice(1)).get('school');
selectSchool(areas.find(s=>s.id===(shareSchool||fromSetup))||initial?.school||school,fromSetup?null:initial?.id);editSchedule();journey.apply(true,!fromSetup&&!sharedMode);applySchedule();loadFavoritesOnce();setInterval(tick,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){journey?.apply(true);applySchedule(true);}tick();});
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#share=')||location.hash.startsWith('#school='))location.reload();});

}
