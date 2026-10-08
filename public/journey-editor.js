import {WORKSPACE_KEY,parseWorkspace} from './workspace.js';
import {JOURNEY_KEY,journeyPoints,restoreJourneys,validateJourneys} from './journeys.js';
import {STORAGE_KEY,restoreFavorites} from './favorites.js';
import {METRO_KEY,cleanMetro} from './metro.js';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
const areas=parseWorkspace(read(WORKSPACE_KEY)),points=journeyPoints(areas),fav=restoreFavorites(read(STORAGE_KEY),points);
let metro=[];try{metro=cleanMetro(JSON.parse(read(METRO_KEY)),areas);}catch{}
const savedPoints=new Set([...fav.items.map(x=>x.stopId),...metro.map(x=>x.stationId)]);
let routes=restoreJourneys(read(JOURNEY_KEY),points),draft=null,version=0;
const cache=new Map();
const blankLeg=()=>({boardId:'',exitId:'',service:'',direction:'',name:'',walk:'',ride:''});
function list(){
 $('journeySavedList').innerHTML=routes.map(r=>`<article class="saved-school"><div><b>${esc(r.name)}</b><small>${r.enabled?r.start+'–'+r.end:'직접 선택'} · ${r.legs.length}구간</small></div><button type="button" data-edit="${r.id}">수정</button><button type="button" data-delete="${r.id}">삭제</button></article>`).join('')||'<p>등교는 정오 이전, 하교는 정오 이후로 시작할 수 있어요.</p>';
 for(const id of ['newMorning','newEvening','newExtra'])$(id).disabled=!points.size||routes.length>=8;
 if(!points.size)$('journeySaveStatus').textContent='먼저 학교를 등록해주세요.';
}
function options(selected,kind){return '<option value="">선택해주세요</option>'+[...points.values()].filter(p=>!kind||p.kind===kind).sort((a,b)=>Number(savedPoints.has(b.id))-Number(savedPoints.has(a.id))).map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${savedPoints.has(p.id)?'★ ':''}${p.kind==='metro'?'지하철':'버스'} ${esc(p.label)}</option>`).join('');}
function capture(){
 draft.name=$('journeyName').value.trim();draft.start=$('journeyStart').value;draft.end=$('journeyEnd').value;draft.enabled=$('journeyEnabled').checked;draft.finalWalk=$('finalWalk').value===''?NaN:Number($('finalWalk').value);draft.buffer=$('journeyBuffer').value===''?NaN:Number($('journeyBuffer').value);
 document.querySelectorAll('[data-leg]').forEach(row=>{const l=draft.legs[Number(row.dataset.leg)];for(const key of ['walk','ride'])l[key]=row.querySelector(`[data-field="${key}"]`).value;});
}
function renderLegs(){
 const token=++version;
 $('journeyLegs').innerHTML=draft.legs.map((l,i)=>`<fieldset class="journey-leg" data-leg="${i}"><legend>${i+1}. ${i?'환승해서 타기':'처음 타기'}</legend><label>승차 정류장·역<select data-board>${options(l.boardId)}</select></label><label>노선 · 방면<select data-service><option value="">승차 지점 선택 후 조회</option></select></label><p data-load role="status"></p><button type="button" data-retry>노선 다시 조회</button><label>하차 정류장·역<select data-exit>${options(l.exitId,points.get(l.boardId)?.kind)}</select></label><div class="journey-fields"><label>${i?'이전 하차 후 환승 도보':'출발지에서 첫 승차까지 도보'}(분)<input data-field="walk" type="number" min="0" max="180" step="1" required value="${l.walk}"></label><label>타고 가는 시간(분)<input data-field="ride" type="number" min="1" max="180" step="1" required value="${l.ride}"></label></div><div class="schedule-edit-actions"><button type="button" data-move="-1" ${i===0?'disabled':''}>↑ 순서</button><button type="button" data-move="1" ${i===draft.legs.length-1?'disabled':''}>↓ 순서</button><button type="button" data-remove ${draft.legs.length===1?'disabled':''}>구간 삭제</button></div></fieldset>`).join('');
 draft.legs.forEach((l,i)=>{if(l.boardId)loadChoices(i,token);});
 $('addLeg').disabled=draft.legs.length>=6;
}
function edit(route){draft=structuredClone(route);$('journeyForm').hidden=false;$('journeyName').value=draft.name;$('journeyStart').value=draft.start;$('journeyEnd').value=draft.end;$('journeyEnabled').checked=draft.enabled;$('finalWalk').value=draft.finalWalk;$('journeyBuffer').value=draft.buffer;$('journeyError').textContent='';renderLegs();$('journeyForm').scrollIntoView({behavior:'smooth',block:'start'});}
async function loadChoices(i,token=version,force=false){
 const leg=draft.legs[i],point=points.get(leg.boardId);if(!point)return;
 const row=$('journeyLegs').children[i],select=row.querySelector('[data-service]'),status=row.querySelector('[data-load]');status.textContent='노선·방면 조회 중…';select.disabled=true;
 const current=()=>version===token&&draft?.legs[i]===leg;
 try{
  let snap=cache.get(point.id);if(!snap||force){const url=point.kind==='metro'?'/api/subway?stationId='+point.id:`/api/arrivals?stopId=${point.id}&schoolId=${point.schoolId}`;const r=await fetch(url,{signal:AbortSignal.timeout(16000)});snap=await r.json();if(!r.ok)throw Error(snap.error||'조회 실패');cache.set(point.id,snap);}
  if(!current())return;
  const choices=point.kind==='metro'?(snap.trains||[]).map(t=>({service:t.line,name:t.line,direction:t.direction})):(snap.routes||[]).map(r=>({service:r.id,name:r.name,direction:r.direction}));
  const unique=[...new Map(choices.filter(c=>c.direction).map(c=>[JSON.stringify([c.service,c.direction]),c])).values()];
  if(leg.service&&!unique.some(c=>c.service===leg.service&&c.direction===leg.direction))unique.unshift({service:leg.service,name:leg.name,direction:leg.direction});
  select.innerHTML='<option value="">노선·방면 선택</option>'+unique.map(c=>`<option value="${esc(JSON.stringify(c))}" ${c.service===leg.service&&c.direction===leg.direction?'selected':''}>${esc(c.name)} · ${esc(c.direction)}</option>`).join('');
  status.textContent=(snap.source==='demo'?'예제 노선입니다. 실제 이동에 사용하지 마세요. ': '')+(unique.length?'도착정보에 있는 방면입니다. 하차 지점까지 운행하는지 확인하세요.':'현재 선택할 수 있는 노선이 없습니다. 나중에 다시 조회해주세요.');
 }catch(e){if(!current())return;status.textContent=e.name==='TimeoutError'?'조회 시간이 길어지고 있습니다. 다시 조회해주세요.':e.message;select.innerHTML=leg.service?`<option value="${esc(JSON.stringify({service:leg.service,name:leg.name,direction:leg.direction}))}">${esc(leg.name)} · ${esc(leg.direction)} (저장값)</option>`:'<option value="">조회 후 선택해주세요</option>';}
 finally{if(current())select.disabled=false;}
}
function create(name,start,end,enabled){edit({id:crypto.randomUUID(),name,start,end,enabled,finalWalk:0,buffer:1,legs:[blankLeg()]});}
$('newMorning').onclick=()=>create('출근·등교','00:00','12:00',true);$('newEvening').onclick=()=>create('퇴근·하교','12:00','00:00',true);$('newExtra').onclick=()=>create('추가 경로','18:00','21:00',false);
$('journeyLegs').addEventListener('change',e=>{const row=e.target.closest('[data-leg]');if(!row)return;capture();const l=draft.legs[Number(row.dataset.leg)];if(e.target.matches('[data-board]')){l.boardId=e.target.value;l.exitId='';l.service='';l.direction='';l.name='';renderLegs();}if(e.target.matches('[data-exit]'))l.exitId=e.target.value;if(e.target.matches('[data-service]')){const c=e.target.value?JSON.parse(e.target.value):{service:'',direction:'',name:''};Object.assign(l,c);}});
$('journeyLegs').addEventListener('click',e=>{const row=e.target.closest('[data-leg]');if(!row)return;const i=Number(row.dataset.leg);if(e.target.matches('[data-retry]')){loadChoices(i,version,true);return;}if(e.target.matches('[data-remove],[data-move]')){capture();if(e.target.hasAttribute('data-remove'))draft.legs.splice(i,1);else{const j=i+Number(e.target.dataset.move);[draft.legs[i],draft.legs[j]]=[draft.legs[j],draft.legs[i]];}renderLegs();}});
$('addLeg').onclick=()=>{capture();if(draft.legs.length<6){draft.legs.push(blankLeg());renderLegs();}};
$('cancelJourney').onclick=()=>{draft=null;version++;$('journeyForm').hidden=true;};
function save(next){try{localStorage.setItem(JOURNEY_KEY,JSON.stringify(next));routes=next;list();return true;}catch{$('journeySaveStatus').textContent='저장 공간에 접근하지 못했습니다. 브라우저 저장 설정을 확인해주세요.';return false;}}
$('journeyForm').onsubmit=e=>{e.preventDefault();capture();const normalized={...draft,legs:draft.legs.map(l=>({...l,walk:l.walk===''?NaN:Number(l.walk),ride:l.ride===''?NaN:Number(l.ride)}))};const next=routes.some(r=>r.id===draft.id)?routes.map(r=>r.id===draft.id?normalized:r):[...routes,normalized];const error=validateJourneys(next,points);$('journeyError').textContent=error;if(error)return;if(save(next)){$('journeyForm').hidden=true;draft=null;version++;$('journeySaveStatus').textContent='경로를 저장했습니다. 지도에서 현재 시간대의 경로를 확인하세요.';}};
$('journeySavedList').onclick=e=>{const editButton=e.target.closest('[data-edit]'),remove=e.target.closest('[data-delete]');if(editButton)edit(routes.find(r=>r.id===editButton.dataset.edit));if(remove){if(save(routes.filter(r=>r.id!==remove.dataset.delete))){draft=null;version++;$('journeyForm').hidden=true;$('journeySaveStatus').textContent='경로를 삭제했습니다.';}}};
list();
