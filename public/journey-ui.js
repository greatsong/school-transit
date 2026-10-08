import {JOURNEY_KEY,journeyPoints,restoreJourneys,activeJourney,forecastLeg,planJourney} from './journeys.js';
import {walkingAppUrl} from './workspace.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=t=>new Date(t).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false});
const duration=s=>`${Math.floor(Math.ceil(s)/60)}분 ${Math.ceil(s)%60}초`;
export function createJourneyUI({areas,shared,snapshot,nowFor,load,onChange,onFocus}){
 const points=journeyPoints(areas);let raw=null;try{raw=localStorage.getItem(JOURNEY_KEY);}catch{}
 const routes=shared?[]:restoreJourneys(raw,points);
 let selected=null,lastKey='',manual=false;
 const el=id=>document.getElementById(id);
 el('journeySelect').innerHTML='<option value="">기본 즐겨찾기 지도</option>'+routes.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
 const forecast=leg=>{const snap=snapshot(leg.boardId);return forecastLeg(leg,points.get(leg.boardId),snap,snap?nowFor(snap):Date.now());};
 function render(){
  el('journeyCurrent').textContent=selected?`${manual?'직접 선택':selected.start+'–'+selected.end+' 자동 선택'} · 지금 출발 기준`:'시간대 경로를 등록하면 이곳에서 예상 환승을 확인할 수 있어요.';
  if(!selected){el('journeyPlan').innerHTML='';return;}
  const now=Date.now(),plan=planJourney(selected,forecast,now);
  el('journeyPlan').innerHTML=`${plan.demo?'<p class="mode-notice">예제 데이터 · 실제 이동에 사용하지 마세요.</p>':''}<ol class="journey-timeline">${plan.steps.map((s,i)=>{
   const b=points.get(s.leg.boardId),x=points.get(s.leg.exitId),prev=i?points.get(selected.legs[i-1].exitId):null;
   return `<li><small>${i?'환승 도보':'첫 승차까지 도보'} ${s.leg.walk}분${prev?` · <a href="${esc(walkingAppUrl(prev,b))}" target="_blank" rel="noopener">Google 지도에서 확인 ↗</a>`:''}</small><h3><button class="favorite-link" data-journey-point="${b.id}">${esc(b.name)} · ${esc(s.leg.name)} ↗</button></h3><p>${esc(s.leg.direction)}</p>${s.state==='estimated'?`<p class="journey-estimate"><b>${clock(s.departure)} 도착 차편 · ${duration((s.departure-now)/1000)} 후</b><br>${clock(s.reach)} 승차 지점 도달 예상 → 대기 ${duration(s.wait)}${s.skipped?'<br>더 먼저 오는 차편은 설정한 도보·여유시간상 제외':''}</p><p>탑승 ${s.leg.ride}분 → <button class="favorite-link" data-journey-point="${x.id}">${esc(x.name)}</button> ${clock(s.exit)} 하차 예상</p>`:`<p class="journey-unknown">${esc(s.reason)}</p>`}</li>`;
  }).join('')}</ol><p><b>${plan.arrival?`마지막 도보 ${selected.finalWalk}분 포함 · ${clock(plan.arrival)} 도착 예상 (약 ${Math.ceil((plan.arrival-now)/60000)}분)`:'전체 도착시각은 다음 차편 확인 후 계산합니다.'}</b></p><p class="countdown-note">입력한 이동시간 + 매 탑승 전 여유 ${selected.buffer}분 기준입니다. 실제 환승 가능 여부는 지연·출입구·승강장에 따라 달라집니다. 아직 조회되지 않는 차편은 추정해서 만들지 않습니다.</p>`;
  document.querySelectorAll('[data-journey-time]').forEach(node=>{const l=selected.legs[Number(node.dataset.journeyTime)],f=l&&forecast(l);node.textContent=f?.arrivals.length?duration(f.arrivals[0]):f?.reason||'도착정보 없음';});
 }
 function choose(route,focus=true){selected=route;el('journeySelect').value=route?.id||'';onChange();render();if(route){for(const id of new Set(route.legs.map(l=>l.boardId)))load(id);if(focus)onFocus(points.get(route.legs[0].boardId));}}
 function apply(force=false,focus=true){const active=activeJourney(routes),key=active?.id||'';if(force||key!==lastKey){manual=false;lastKey=key;choose(active,focus);}}
 el('journeySelect').onchange=e=>{manual=true;choose(routes.find(r=>r.id===e.target.value)||null);};
 el('journeyAuto').onclick=()=>apply(true);
 el('journeyPlan').onclick=e=>{const b=e.target.closest('[data-journey-point]');if(b)onFocus(points.get(b.dataset.journeyPoint));};
 return {apply,render,get active(){return selected;},get points(){return selected?[...new Set(selected.legs.flatMap(l=>[l.boardId,l.exitId]))].map(id=>points.get(id)):[];},get boardIds(){return selected?[...new Set(selected.legs.map(l=>l.boardId))]:[];},
  timer(id){if(!selected)return '';return selected.legs.map((l,i)=>l.boardId===id?`<div class="map-timer-head">${i+1}. ${esc(points.get(id).name)}</div><div class="map-timer-route"><b>${esc(l.name)}</b><span data-journey-time="${i}">조회 중…</span><small>${esc(l.direction)}</small></div>`:'').join('');}
 };
}
