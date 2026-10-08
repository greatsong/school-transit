import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreFavorites,favoriteStopIds,favoriteRoutes} from '../public/favorites.js';
const stopId='116900091',other='120000417';
const route={stopId,routeId:'115000012',name:'6633',direction:'강서공영차고지'};
test('restores valid favorites and default while rejecting corrupt or unknown storage',()=>{
 assert.deepEqual(restoreFavorites('oops'),{items:[],defaultStop:null});
 const saved=restoreFavorites(JSON.stringify({items:[route,route,{stopId:'bogus',routeId:null}],defaultStop:stopId}));
 assert.equal(saved.items.length,1);assert.equal(saved.defaultStop,stopId);
 assert.deepEqual(restoreFavorites(JSON.stringify(saved)),saved);
});
test('same route in a different direction remains a separate favorite',()=>{
 const items=[route,{...route,direction:'여의도'}];
 const routes=[{id:route.routeId,direction:route.direction},{id:route.routeId,direction:'여의도'},{id:'1',direction:'다른 노선'}];
 assert.equal(favoriteRoutes(items,stopId,routes).length,2);
 assert.equal(favoriteRoutes([route],stopId,routes).length,1);
 assert.deepEqual(favoriteStopIds(items),[stopId]);
});
test('station favorite includes every route once; removing it preserves route choices',()=>{
 const whole={stopId,routeId:null,direction:'',name:''};
 const routes=[{id:route.routeId,direction:route.direction},{id:'123',direction:'종점'}];
 assert.equal(favoriteRoutes([whole,route],stopId,routes).length,2);
 assert.equal(favoriteRoutes([route],stopId,routes).length,1);
});
test('removed default falls back to another saved stop; clear leaves no default',()=>{
 const state=restoreFavorites(JSON.stringify({items:[{...route,stopId:other}],defaultStop:stopId}));
 assert.equal(state.defaultStop,other);
 assert.equal(restoreFavorites(JSON.stringify({items:[],defaultStop:other})).defaultStop,null);
});
test('stops are deduplicated for startup and manual refresh requests',()=>{
 assert.deepEqual(favoriteStopIds([route,{...route,routeId:'2'},{stopId:other,routeId:null}]),[stopId,other]);
});
