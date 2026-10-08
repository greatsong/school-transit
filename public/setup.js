import {JOURNEY_KEY} from './journeys.js';
import {METRO_KEY,cleanMetro} from './metro.js';
import {SCHOOL_CATALOG} from './school-catalog.js';
import {SITE} from './site.js';
import {WORKSPACE_KEY,parseWorkspace,cleanAreas,removeArea} from './workspace.js';
import {STORAGE_KEY,restoreFavorites} from './favorites.js';
import {SCHEDULE_KEY,restoreSchedule} from './schedule.js';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
let areas=parseWorkspace(read(WORKSPACE_KEY)),busy=false;
function render(){
 $('savedSchools').innerHTML=areas.length?areas.map(a=>`<div class="saved-school"><div><b>${esc(a.name)}</b><small>${a.stops.length}개 정류장</small></div><a class="refresh" href="/#school=${a.id}">지도 보기</a><button class="remove-school" data-remove="${a.id}" aria-label="${esc(a.name)} 등록 해제">해제</button></div>`).join(''):'<p>학교를 검색해 등록해주세요.</p>';
}
async function add(id){
 if(busy)return;if(areas.length>=8&&!areas.some(s=>s.id===id)){$('setupStatus').textContent='학교는 8곳까지 등록할 수 있어요. 사용하지 않는 학교를 해제해주세요.';return;}
 busy=true;$('setupStatus').textContent='학교 주변 정류장을 확인하고 있어요…';
 try{
  const response=await fetch('/api/nearby?schoolId='+id,{signal:AbortSignal.timeout(16000)}),data=await response.json();if(!response.ok)throw Error(data.error);
  const area=cleanAreas([data])[0];if(!area)throw Error('학교 정보를 확인할 수 없습니다.');
  const next=[...areas.filter(a=>a.id!==id),area];
  localStorage.setItem(WORKSPACE_KEY,JSON.stringify(next));areas=next;render();
  $('setupStatus').innerHTML=`${esc(area.name)} · ${area.stops.length}개 정류장을 저장했습니다. <a class="refresh" href="/#school=${area.id}">지도에서 정류장·역 고르기 →</a>`;
 }catch(e){$('setupStatus').textContent=e.name==='QuotaExceededError'||e.name==='SecurityError'?'이 브라우저의 저장 공간을 사용할 수 없습니다. 개인 브라우저에서 저장을 허용한 뒤 다시 등록해주세요.':e.name==='TimeoutError'?'연결 시간이 길어지고 있습니다. 다시 시도해주세요.':e.message;}
 finally{busy=false;}
}
$('schoolSearch').addEventListener('submit',e=>{e.preventDefault();const q=$('schoolQuery').value.trim().replace(/\s/g,'').toLowerCase();
 const rows=q.length>=2?SCHOOL_CATALOG.filter(s=>[s.name,s.address].some(v=>v.replace(/\s/g,'').toLowerCase().includes(q))).slice(0,20):[];
 $('searchResults').innerHTML=rows.length?rows.map(s=>`<button class="search-result" data-add="${s.id}"><b>${esc(s.name)}</b><small>${esc(s.address)}</small><span>이 학교 등록</span></button>`).join(''):'<p>검색 결과가 없습니다. 학교 이름 또는 학교의 도로명·건물번호를 두 글자 이상 입력해주세요.</p>';
});
document.addEventListener('click',e=>{
 const addButton=e.target.closest('[data-add]');if(addButton){add(addButton.dataset.add);return;}
 const remove=e.target.closest('[data-remove]');if(remove){
  const valid=new Set(areas.flatMap(s=>s.stops.map(x=>x.id)));
  const next=removeArea(areas,restoreFavorites(read(STORAGE_KEY),valid),restoreSchedule(read(SCHEDULE_KEY),valid),remove.dataset.remove);
  try{localStorage.setItem(WORKSPACE_KEY,JSON.stringify(next.areas));localStorage.setItem(STORAGE_KEY,JSON.stringify(next.favorites));localStorage.setItem(SCHEDULE_KEY,JSON.stringify(next.schedule));areas=next.areas;let metro=[];try{metro=JSON.parse(read(METRO_KEY)||'[]');}catch{}localStorage.setItem(METRO_KEY,JSON.stringify(cleanMetro(metro,areas)));render();$('setupStatus').textContent='학교 등록을 해제했습니다. 다시 검색해 등록할 수 있어요.';}
  catch{$('setupStatus').textContent='저장 공간에 접근하지 못했습니다.';}
 }
});
$('resetSettings').addEventListener('click',()=>{try{[WORKSPACE_KEY,STORAGE_KEY,SCHEDULE_KEY,METRO_KEY,JOURNEY_KEY].forEach(k=>localStorage.removeItem(k));areas=[];render();$('resetStatus').textContent='이 앱의 학교·즐겨찾기·시간대·이동 경로 설정을 지웠습니다.';$('setupStatus').textContent='';}catch{$('resetStatus').textContent='설정을 지우지 못했습니다. 브라우저의 사이트 데이터 메뉴를 이용해주세요.';}});
render();
const defaultSchool=SCHOOL_CATALOG.find(s=>s.id===SITE.defaultSchoolId);
if(defaultSchool){$('schoolQuery').value=defaultSchool.name;$('searchResults').innerHTML=`<button class="search-result" data-add="${defaultSchool.id}">${esc(defaultSchool.name)} 등록</button>`;}
fetch('/api/config').then(r=>r.json()).then(c=>{if(c.mode==='demo'){$('modeNotice').hidden=false;$('modeNotice').textContent='수업용 예제 모드 · 신도림중학교 또는 당곡고등학교로 연습하세요. 실제 연결 후 서울 전체 학교를 검색할 수 있습니다.';}}).catch(()=>{});
