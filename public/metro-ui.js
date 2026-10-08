import {METRO_KEY,metroIndex,nearbyMetro,cleanMetro,metroView} from './metro.js';
import {walkingAppUrl} from './workspace.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createMetroUI({areas,shared,sharedItems,onChange,onFocus,onSchool}){
 let saved=[];try{saved=JSON.parse(localStorage.getItem(METRO_KEY)||'[]');}catch{}
 let items=cleanMetro(shared?sharedItems:saved,areas),school=areas[0],selected=null,last=0;
 const snapshots=new Map(),failures=new Map(),pending=new Set();
 let journeyPoints=[],journeyBoards=[];
 const el=id=>document.getElementById(id);
 const near=()=>nearbyMetro(school);
 const entry=id=>{const s=metroIndex.get(id),a=near().some(x=>x.id===id)?school:areas.find(a=>items.some(x=>x.stationId===id&&x.schoolId===a.id)||journeyPoints.some(x=>x.id===id&&x.schoolId===a.id))||school;return s?{...s,ars:s.lines.map(l=>l.name).join('·'),school:a}:null;};
 const isSaved=id=>items.some(x=>x.stationId===id&&x.schoolId===school.id);
 function save(){if(shared)return;try{localStorage.setItem(METRO_KEY,JSON.stringify(items));el('metroSaveStatus').textContent='';}catch{el('metroSaveStatus').textContent='이번 방문 동안만 유지됩니다.';}}
 function timeMarkup(id,small=false){
  const snap=snapshots.get(id);if(failures.has(id))return `<p class="error">${esc(failures.get(id))}</p>`;
  if(!snap)return '<p>도착정보 조회 중…</p>';
  return `${snap.source==='demo'?'<p class="demo-label">예제 · 실제 도착정보 아님</p>':''}${!snap.trains.length?'<p>현재 제공되는 도착정보가 없습니다.</p>':snap.trains.slice(0,small?4:40).map((t,i)=>`<div class="metro-train"><small>${esc(t.line)} · ${esc(t.direction)} · ${esc(t.type)}</small><b data-metro-time="${id}|${i}"></b></div>`).join('')}${small&&snap.trains.length>4?'<small>역을 눌러 전체 열차 보기</small>':''}`;
 }
 function render(){
  el('metroNearby').innerHTML=near().map(s=>`<button data-metro-open="${s.id}" class="refresh">${isSaved(s.id)?'★':'지하철'} ${esc(s.name)} · ${s.distance}m</button>`).join('')||'<p>학교 중심 1.2km 안에 등록된 지하철역이 없습니다.</p>';
  el('metroFavorites').innerHTML=items.map(x=>{const s=metroIndex.get(x.stationId),a=areas.find(a=>a.id===x.schoolId);return `<article class="favorite-group"><h3><button class="favorite-link" data-metro-open="${s.id}" data-metro-school="${a.id}">★ ${esc(s.name)} ↗</button></h3><small>${esc(a.name)}</small>${timeMarkup(s.id)}</article>`;}).join('');
  if(selected){const s=entry(selected);el('metroDetails').innerHTML=`<p class="eyebrow">MY SUBWAY STATION</p><h2>${esc(s.name)}</h2><p>${esc(s.ars)}</p><button class="favorite-stop" data-metro-toggle="${s.id}" aria-pressed="${isSaved(s.id)}">${isSaved(s.id)?'★ 즐겨찾기 해제':'☆ 지하철역 즐겨찾기'}</button> <button class="refresh" data-metro-refresh="${s.id}">↻ 새로고침</button><p><a href="${esc(walkingAppUrl(school,s,location.origin))}">학교에서 걸어가기 · Google 지도 ↗</a></p><p class="countdown-note">학교 중심에서 역 좌표까지 연결합니다. 출입구와 승강장 이동시간은 별도로 확인하세요.</p><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name)}" target="_blank" rel="noopener">Google 지도에서 역 보기 ↗</a>${timeMarkup(s.id)}<p class="countdown-note">조회한 예상값을 매초 줄여 표시합니다. 3분이 지난 정보는 시간을 숨깁니다.</p>`;}
  tickTimes();
 }
 function tickTimes(){document.querySelectorAll('[data-metro-time]').forEach(node=>{const [id,i]=node.dataset.metroTime.split('|'),snap=snapshots.get(id);if(snap)node.textContent=metroView(snap.trains[i],snap.serverNow+Math.max(Date.now()-snap.wall,performance.now()-snap.mono)+snap.rtt);});}
 async function load(id){
  if(pending.has(id))return;pending.add(id);failures.delete(id);const start=performance.now();
  try{const r=await fetch('/api/subway?stationId='+encodeURIComponent(id),{signal:AbortSignal.timeout(16000)}),data=await r.json();if(!r.ok)throw Error(data.error||'연결 실패');snapshots.set(id,{...data,wall:Date.now(),mono:performance.now(),rtt:performance.now()-start});}
  catch(e){failures.set(id,e.name==='TimeoutError'?'조회 시간이 길어지고 있습니다.':e.message);}
  finally{pending.delete(id);render();onChange();}
 }
 function select(id){if(!metroIndex.has(id))return;const origin=entry(id).school;if(origin.id!==school.id){school=origin;onSchool(origin);}selected=id;el('busDetails').hidden=true;el('metroDetails').hidden=false;render();const s=entry(id);onFocus([s.lat,s.lng]);onChange();if(!snapshots.has(id))load(id);}
 document.addEventListener('click',e=>{
  const open=e.target.closest('[data-metro-open]');if(open){if(open.dataset.metroSchool){const a=areas.find(a=>a.id===open.dataset.metroSchool);if(a){school=a;onSchool(a);}}select(open.dataset.metroOpen);}
  const toggle=e.target.closest('[data-metro-toggle]');if(toggle){const id=toggle.dataset.metroToggle;items=isSaved(id)?items.filter(x=>x.stationId!==id||x.schoolId!==school.id):cleanMetro([...items,{stationId:id,schoolId:school.id}],areas);save();render();onChange();}
  const refresh=e.target.closest('[data-metro-refresh]');if(refresh)load(refresh.dataset.metroRefresh);
 });
 function refresh(){if(document.hidden||pending.size||Date.now()-last<60000)return;last=Date.now();for(const id of new Set([selected,...items.map(x=>x.stationId),...journeyBoards].filter(Boolean)))load(id);}
 setInterval(()=>{tickTimes();refresh();},1000);document.addEventListener('visibilitychange',refresh);
 render();
 return {
  load,snapshot(id){return failures.has(id)?null:snapshots.get(id);},
  setJourneyPoints(points,boards){journeyPoints=points.filter(p=>p.kind==='metro');journeyBoards=boards.filter(id=>id.startsWith('m'));},
  refreshAll(){last=Date.now();return Promise.all([...new Set([selected,...items.map(x=>x.stationId),...journeyBoards].filter(Boolean))].map(load));},
  setSchool(s){school=s;selected=null;render();},select,
  hide(){selected=null;el('metroDetails').hidden=true;el('busDetails').hidden=false;},
  get selected(){return selected;},
  get favoriteIds(){return [...new Set(items.map(x=>x.stationId))];},
  markers(){const ids=new Set([...near().map(s=>s.id),...items.map(x=>x.stationId),...journeyPoints.map(p=>p.id)]);return [...ids].map(entry);},
  timer(id){return `<div class="map-timer-head">★ ${esc(metroIndex.get(id).name)}</div>${timeMarkup(id,true)}<button data-metro-open="${id}">역 보기</button>`;},
  popup(s){return `<b>지하철 ${esc(s.name)}</b><p>${esc(s.ars)}</p><button data-metro-open="${s.id}">도착예정·즐겨찾기</button>`;},
  share(){return items.filter(x=>x.schoolId===school.id);}
 };
}
