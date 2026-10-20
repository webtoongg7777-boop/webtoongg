global.window={};
require('./data-naver.js');require('./data-kakao.js');require('./data-ranking.js');
const R=['로판','성장로판','궁중로맨스','왕족/귀족','서양'];
for (const [p,arr] of [['naver',window.DATA_NAVER],['kakao',window.DATA_KAKAO]]){
 const c=arr.filter(w=>!w.finished && w.age!=='RATE_18' && w.age!=='ADULT' && w.age!=='AGE_19' && (w.tags||[]).some(t=>t==='로판'||t==='성장로판'))
  .sort((a,b)=>b.favorites-a.favorites).slice(0,15);
 console.log('==',p);
 for(const w of c) console.log(w.id,w.title,'|',w.author,'|',w.age,'|',w.favorites,'|',w.genres.join(','),'|',(w.tags||[]).join(','),'|',w.thumb);
}
console.log(Object.keys(window).join(','));
