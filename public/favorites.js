import {SCHOOLS} from './stops.js';
export const STORAGE_KEY='school-bus-favorites-v1';
const allowed=new Set(SCHOOLS.flatMap(s=>s.stops.map(x=>x.id)));
export const favoriteKey=f=>JSON.stringify([f.stopId,f.routeId||null,f.direction||'']);
export function restoreFavorites(raw, validStops=allowed) {
  let parsed;
  try {parsed=JSON.parse(raw);}catch{return {items:[],defaultStop:null};}
  const items=[],seen=new Set();
  for(const x of Array.isArray(parsed?.items)?parsed.items.slice(0,100):[]) {
    if(!x || !validStops.has(x.stopId))continue;
    if(x.routeId!==null && !/^\d{1,16}$/.test(x.routeId))continue;
    const item={stopId:x.stopId,routeId:x.routeId,direction:x.routeId?String(x.direction||'').slice(0,100):'',name:x.routeId?String(x.name||'버스').slice(0,80):''};
    const key=favoriteKey(item);if(seen.has(key))continue;seen.add(key);items.push(item);
  }
  const ids=favoriteStopIds(items);
  return {items,defaultStop:ids.includes(parsed?.defaultStop)?parsed.defaultStop:ids[0]||null};
}
export function favoriteStopIds(items){return [...new Set(items.map(x=>x.stopId))];}
export function favoriteRoutes(items,stopId,routes){
  const choices=items.filter(x=>x.stopId===stopId);
  if(choices.some(x=>x.routeId===null))return routes;
  return routes.filter(r=>choices.some(x=>x.routeId===r.id && x.direction===r.direction));
}
