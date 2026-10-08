export const MAX_AGE = 180;
export function arrivalView(arrival, generatedAt, now = Date.now()) {
  const age = (now - generatedAt) / 1000;
  if (!Number.isFinite(age) || age < -30 || age > MAX_AGE) return {text:'새로고침 필요', kind:'stale'};
  if (arrival.status === 'waiting') return {text:'출발 대기',kind:'waiting'};
  if (arrival.status === 'ended') return {text:'운행 종료',kind:'waiting'};
  if (arrival.status !== 'running' || !Number.isFinite(arrival.seconds)) return {text:arrival.message || '도착정보 없음',kind:'waiting'};
  const left = Math.ceil(arrival.seconds - Math.max(0, age));
  if (left <= 0) return {text:'예정시간 경과 · 새로고침',kind:'stale'};
  return {text:`${Math.floor(left / 60) ? Math.floor(left / 60) + '분 ' : ''}${left % 60}초`,kind:'running'};
}
