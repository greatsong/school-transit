// 수업용 자료입니다. 실제 교통정보나 인증키를 포함하지 않습니다.

{
const school = {name: "당곡고등학교", purpose: "하교할 때 기다릴 교통편 확인"};
console.log(school.name, school.purpose);
}

{
const stops = [{name:"학교 앞", ars:"12345", direction:"역 방면"}, {name:"학교 앞", ars:"54321", direction:"주택가 방면"}];
console.table(stops);
}

{
const prediction = 90;
const elapsed = 11;
const remaining = prediction - elapsed;
console.log(`${Math.floor(remaining / 60)}분 ${remaining % 60}초`);
}

{
const saved = {school:"우리 학교", stations:["학교 앞"], hours:["08:00"]};
const shared = {school:saved.school, stations:saved.stations};
console.log(JSON.stringify(shared));
}

{
const directMeters = 300;
console.log(`직선거리 ${directMeters}m`);
console.log("도보 경로와 소요시간은 지도에서 별도 확인");
}

{
const checks = ["학교 검색", "방면 확인", "예제 표시", "개인 시간대 제외", "휴대전화 도보 연결"];
console.log(checks.map(x => `확인: ${x}`).join("\n"));
}
