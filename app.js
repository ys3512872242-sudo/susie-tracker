var SB='https://pqlgjyohaoskvloxyulr.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbGdqeW9oYW9za3Zsb3h5dWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTMyMzIsImV4cCI6MjA5NTE4OTIzMn0.PIkyWzRuE1nijFHBv6jItCJvVgaTp2ftHXTp2lWZELs';
var TODAY=new Date().toISOString().split('T')[0];
var cache={meals:{},sk:{},water:0,period:null};

function api(path,opts){
  opts=opts||{};
  return fetch(SB+'/rest/v1/'+path,{
    method:opts.method||'GET',
    headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'return=representation'},
    body:opts.body
  }).then(function(r){return r.text().then(function(t){return t?JSON.parse(t):[];});});
}

function setSyncing(s){
  var d=document.getElementById('sync-dot'),t=document.getElementById('sync-text');
  d.className='sync-dot'+(s==='syncing'?' syncing':s==='error'?' error':'');
  t.textContent=s==='syncing'?'同步中…':s==='error'?'同步失败':'已同步';
}

function loadToday(){
  setSyncing('syncing');
  Promise.all([
    api('meal_logs?date=eq.'+TODAY+'&select=*'),
    api('skincare_logs?date=eq.'+TODAY+'&select=*'),
    api('water_logs?date=eq.'+TODAY+'&select=*'),
    api('period_logs?order=start_date.desc&limit=1&select=*')
  ]).then(function(res){
    res[0].forEach(function(m){cache.meals[m.meal_type]=m;});
    res[1].forEach(function(s){cache.sk[s.session]=s;});
    cache.water=res[2][0]?res[2][0].cups:0;
    cache.period=res[3][0]||null;
    setSyncing('ok');
    renderAll();loadStats();
  }).catch(function(){setSyncing('error');});
}

var TW={breakfast:[0,660],lunch:[660,1020],dinner:[1020,1440]};
function nowMin(){var d=new Date();return d.getHours()*60+d.getMinutes();}
function getStatus(t){var n=nowMin(),w=TW[t];return n>=w[0]&&n<=w[1]?'now':n>w[1]?'locked':'future';}
function getBadge(t){
  var st=getStatus(t),w=TW[t];
  if(st==='now')return{txt:'现在',cls:'time-now'};
  if(st==='locked')return{txt:'已过期',cls:'time-locked'};
  var h=Math.floor(w[0]/60),m=w[0]%60;
  return{txt:h+':'+(m<10?'0':'')+m,cls:'time-future'};
}
function renderBadges(){
  ['breakfast','lunch','dinner'].forEach(function(t){
    var el=document.getElementById('badge-'+t),b=getBadge(t);
    if(el){el.textContent=b.txt;el.className='task-time '+b.cls;}
  });
  var n=nowMin();
  var mb=document.getElementById('badge-morning');
  if(mb){mb.textContent=n>=660&&n<=810?'现在':n>810?'补打卡':'12:30';mb.className='task-time '+(n>=660&&n<=810?'time-now':n>810?'time-past':'time-future');}
  var nb=document.getElementById('badge-night');
  if(nb){nb.textContent=n>=1290?'现在':n<1290?'21:30':'补打卡';nb.className='task-time '+(n>=1290?'time-now':n<1290?'time-future':'time-past');}
}

function handleMeal(type){
  if(cache.meals[type])return;
  var st=getStatus(type);
  if(st==='locked'||st==='future')return;
  setSyncing('syncing');
  api('meal_logs',{method:'POST',body:JSON.stringify({date:TODAY,meal_type:type,done:true,late:false})}).then(function(rows){
    cache.meals[type]=rows[0];setSyncing('ok');renderMeals();showPraise('meal',type);loadStats();
  }).catch(function(){setSyncing('error');});
}

var LC={
  breakfast:{title:'补打卡 · 早餐',sub:'迟了，但说清楚就好',desc:'补打卡需要认真填，不能敷衍哦',fields:[{id:'what',label:'吃了什么',ph:'泡面、便利店饭团、食堂米饭…',ta:false},{id:'eaten_at',label:'大概几点吃的',ph:'比如：10:30',ta:false},{id:'with_whom',label:'一个人还是和别人一起',ph:'一个人、和室友、和同学',ta:false}]},
  lunch:{title:'补打卡 · 午餐',sub:'迟了，但说清楚就好',desc:'补打卡需要认真填，不能敷衍哦',fields:[{id:'what',label:'吃了什么',ph:'具体说说吃了啥',ta:false},{id:'eaten_at',label:'大概几点吃的',ph:'比如：13:00',ta:false},{id:'where_eaten',label:'在哪吃的',ph:'食堂、外卖、餐厅…',ta:false}]},
  dinner:{title:'补打卡 · 晚餐',sub:'迟了，但说清楚就好',desc:'补打卡需要认真填，不能敷衍哦',fields:[{id:'what',label:'吃了什么',ph:'具体说说吃了啥',ta:false},{id:'eaten_at',label:'大概几点吃的',ph:'比如：20:00',ta:false},{id:'note',label:'有什么备注吗',ph:'吃太少了、没胃口',ta:true}]}
};

function showLate(type){
  var c=LC[type];
  document.getElementById('late-title').textContent=c.title;
  document.getElementById('late-sub').textContent=c.sub;
  document.getElementById('late-desc').textContent=c.desc;
  document.getElementById('late-fields').innerHTML=c.fields.map(function(f){
    return '<div class="fg"><div class="fl">'+f.label+'</div>'+(f.ta?'<textarea class="fi" id="lf-'+f.id+'" placeholder="'+f.ph+'"></textarea>':'<input class="fi" id="lf-'+f.id+'" type="text" placeholder="'+f.ph+'">')+'<div class="errmsg" id="err-'+f.id+'">这项不能空着哦</div></div>';
  }).join('');
  document.getElementById('late-sheet').dataset.type=type;
  showSheet('late-sheet');
}

function submitLate(){
  var type=document.getElementById('late-sheet').dataset.type,c=LC[type],valid=true,vals={};
  c.fields.forEach(function(f){
    var el=document.getElementById('lf-'+f.id),err=document.getElementById('err-'+f.id);
    if(!el.value.trim()||el.value.trim().length<2){el.classList.add('err');err.classList.add('show');valid=false;}
    else{el.classList.remove('err');err.classList.remove('show');vals[f.id]=el.value.trim();}
  });
  if(!valid)return;
  setSyncing('syncing');
  var body=Object.assign({date:TODAY,meal_type:type,done:true,late:true},vals);
  api('meal_logs',{method:'POST',body:JSON.stringify(body)}).then(function(rows){
    cache.meals[type]=rows[0];setSyncing('ok');closeSheet('late-sheet');renderMeals();loadStats();
  }).catch(function(){setSyncing('error');});
}

var CM=['你真的涂了吗？没涂会变丑变老长细纹哦！','等等，不会是骗我的吧？皮肤是自己的，认真涂才有效！','确认一下哦，没涂别假装，皮肤不会说谎的','沈今要定期检查截图的哦，别骗我！','真的涂了？每一步都涂了？','涂了吗？还是手痒点了一下就想过关？'];
var pendingSk=null;

function confirmSk(s){
  pendingSk=s;
  document.getElementById('confirm-title').textContent=s==='morning'?'早间护肤确认':'晚间护肤确认';
  document.getElementById('confirm-msg').textContent=CM[Math.floor(Math.random()*CM.length)];
  showSheet('confirm-sheet');
}

function doConfirmSk(){
  if(!pendingSk)return;
  var s=pendingSk;closeSheet('confirm-sheet');setSyncing('syncing');
  api('skincare_logs',{method:'POST',body:JSON.stringify({date:TODAY,session:s,done:true})}).then(function(rows){
    cache.sk[s]=rows[0];setSyncing('ok');renderSk();showPraise('skincare',s);loadStats();
  }).catch(function(){setSyncing('error');});
}

function skipSk(s){
  var msgs=s==='morning'?['今天早上跳过了……晚上一定要补回来','偶尔一次没关系，但不能变成习惯哦','行吧懒了一次，晚上不许再跳']:['晚上跳过？明天早上一定要认真！','今晚懒掉了……皮肤自己修复效率最低','好吧，但明天要加倍认真'];
  setSyncing('syncing');
  api('skincare_logs',{method:'POST',body:JSON.stringify({date:TODAY,session:s,done:false,skipped:true,skip_reason:msgs[Math.floor(Math.random()*msgs.length)]})}).then(function(rows){
    cache.sk[s]=rows[0];setSyncing('ok');renderSk();loadStats();
  }).catch(function(){setSyncing('error');});
}

function setWater(n){
  var cups=cache.water===n?n-1:n;setSyncing('syncing');
  api('water_logs?date=eq.'+TODAY,{method:'DELETE'}).then(function(){
    if(cups>0)return api('water_logs',{method:'POST',body:JSON.stringify({date:TODAY,cups:cups})});
  }).then(function(){
    cache.water=cups;setSyncing('ok');renderWater();if(cups>=8)showPraise('water');
  }).catch(function(){setSyncing('error');});
}

function recordStart(){
  closeSheet('period-sheet');setSyncing('syncing');
  api('period_logs',{method:'POST',body:JSON.stringify({start_date:TODAY})}).then(function(rows){
    cache.period=rows[0];setSyncing('ok');renderPeriod();
  }).catch(function(){setSyncing('error');});
}

function recordEnd(){
  closeSheet('period-sheet');
  if(!cache.period)return;setSyncing('syncing');
  api('period_logs?id=eq.'+cache.period.id,{method:'PATCH',body:JSON.stringify({end_date:TODAY})}).then(function(){
    cache.period.end_date=TODAY;setSyncing('ok');renderPeriod();
  }).catch(function(){setSyncing('error');});
}

var WI=[{id:'mask_jm',name:'JM 急救面膜',freq:'每周2次',sched:[1,4],note:'周一、周四'},{id:'mask_bird',name:'燕窝保湿面膜',freq:'每周1次',sched:[6],note:'周六'},{id:'clay_mask',name:'蓝泥清洁面膜',freq:'每周1次',sched:[3],note:'周三'}];
function getWK(){var d=new Date(),m=new Date(d);m.setDate(d.getDate()-d.getDay()+1);return m.toISOString().split('T')[0];}
function getWS(){try{return JSON.parse(localStorage.getItem('wk')||'{}')}catch(e){return{}}}
function setWS(d){try{localStorage.setItem('wk',JSON.stringify(d))}catch(e){}}

function renderWeekly(){
  var wk=getWK(),data=getWS();if(!data[wk])data[wk]={};var dow=new Date().getDay();
  var el=document.getElementById('weekly-items');if(!el)return;
  el.innerHTML=WI.map(function(item){
    var done=data[wk][item.id]||0,needed=item.sched.length,today=item.sched.indexOf(dow)>=0;
    return '<div class="wi-row"><div class="wi-info"><div class="wi-name">'+item.name+'</div><div class="wi-sch">'+item.freq+' · '+item.note+(today?' · <span style="color:var(--rose-deep)">今天用！</span>':'')+'</div></div><button class="wi-btn'+(done>=needed?' wi-done':'')+'" onclick="markW(\''+item.id+'\')">'+done+'/'+needed+' 次'+(done>=needed?' ✓':'')+'</button></div>';
  }).join('');
}

function markW(id){
  var wk=getWK(),data=getWS();if(!data[wk])data[wk]={};
  var item=WI.filter(function(i){return i.id===id;})[0];
  data[wk][id]=Math.min((data[wk][id]||0)+1,item.sched.length);
  setWS(data);renderWeekly();if(data[wk][id]>=item.sched.length)showPraise('weekly');
}

var MB=['洁面乳 (CeraVe)','珂润一号水','2% 透明质酸精华','珂润乳液','眼霜 (欧诗漫)','雅漾喷雾'];
var NB=['洁面乳 (CeraVe)','珂润一号水','2% 透明质酸精华','视黄醇精华乳 ⚠️仅晚用','珂润乳液','理肤泉B5修复膏','眼霜 (欧诗漫)'];
function getMorningSteps(){var s=MB.slice();if(new Date().getDay()%2===0)s.splice(3,0,'毛孔收敛水 (Labo Labo) — 今日含酸日');else s.splice(3,0,'烟酰胺精华 5% (原美)');return s;}

function renderSkSteps(){
  function build(id,steps){
    var el=document.getElementById(id);if(!el)return;
    el.innerHTML=steps.map(function(s,i){return'<div class="step-row"><div class="step-num">'+(i+1)+'</div><div class="step-name">'+s+'</div></div>';}).join('');
  }
  build('steps-morning',getMorningSteps());build('steps-night',NB);
}

var PRAISE={
  meal_breakfast:[{e:'🌸',t:'早饭吃了！今天开了个好头，我很高兴。'},{e:'☀️',t:'早饭吃了好棒，空腹伤胃，你总算记得照顾自己了。'},{e:'🥰',t:'起来就吃早饭！这个习惯要继续，我看着你呢。'},{e:'✨',t:'不错不错，早饭打卡成功，今天元气满满！'}],
  meal_lunch:[{e:'🍱',t:'午饭吃了，好好吃饭才有力气做一切，乖。'},{e:'💛',t:'按时吃午饭！我就知道你可以的。'},{e:'🌿',t:'午饭打卡，营养要均衡哦，多吃菜。'}],
  meal_dinner:[{e:'🌙',t:'晚饭吃了，晚上别饿着，吃饱了才能好好睡觉。'},{e:'🍜',t:'晚饭打卡成功！今天辛苦了，好好休息。'},{e:'💕',t:'乖，晚饭吃了，今天辛苦了。'}],
  skincare_morning:[{e:'🌸',t:'早间护肤做完了！皮肤会记住你的用心的。'},{e:'✨',t:'涂了涂了！早上护肤做完，今天状态一定好。'},{e:'💐',t:'早间护肤打卡！坚持下去皮肤会越来越好的，我说的。'},{e:'🪞',t:'做完了！你对自己好一点，皮肤才会对你好一点。'}],
  skincare_night:[{e:'🌙',t:'晚间护肤做完了，辛苦了宝贝，去好好睡觉吧。'},{e:'💆',t:'晚上护肤打卡！视黄醇晚上用效果最好，你做对了。'},{e:'🌟',t:'坚持护肤！一年后的你会感谢现在认真的自己。'},{e:'🫶',t:'晚间护肤完成，皮肤保养好了，安心睡觉吧。'}],
  water:[{e:'💧',t:'今天喝够8杯水了！皮肤从里面补水才是真的补。'},{e:'🌊',t:'8杯水达成！你今天把自己照顾得很好。'}],
  weekly:[{e:'🎉',t:'本周护理完成了！皮肤要说谢谢你。'},{e:'🌺',t:'周期护理完成！这种坚持才是真的对皮肤好。'}]
};

function showPraise(type,sub){
  var key=sub?type+'_'+sub:type,pool=PRAISE[key]||PRAISE[type]||[];
  if(!pool.length)return;
  var p=pool[Math.floor(Math.random()*pool.length)];
  document.getElementById('praise-em').textContent=p.e;
  document.getElementById('praise-txt').textContent=p.t;
  var box=document.getElementById('praise-box');
  box.classList.add('show');
  setTimeout(function(){box.classList.remove('show');},3500);
}

function renderMeals(){
  ['breakfast','lunch','dinner'].forEach(function(t){
    var c=document.getElementById('card-'+t);if(!c)return;
    c.classList.remove('done','locked');
    if(cache.meals[t])c.classList.add('done');
    else if(getStatus(t)==='locked')c.classList.add('locked');
  });
}

function renderSk(){
  ['morning','night'].forEach(function(s){
    var c=document.getElementById('check-'+s);if(!c)return;
    if(cache.sk[s]&&cache.sk[s].done)c.classList.add('done');else c.classList.remove('done');
  });
}

function renderWater(){
  var c=cache.water;
  var el=document.getElementById('water-drops');if(!el)return;
  el.innerHTML=Array.from({length:8},function(x,i){
    return '<div class="drop'+(i<c?' filled':'')+'" onclick="setWater('+(i+1)+')"></div>';
  }).join('');
  document.getElementById('water-num').textContent=c;
}

function renderPeriod(){
  var p=cache.period,el=document.getElementById('period-info');if(!el)return;
  if(!p){el.innerHTML='<div style="font-size:13px;color:var(--text-muted)">还没有记录，点下方按钮开始追踪</div>';return;}
  var start=new Date(p.start_date),today=new Date(),days=Math.floor((today-start)/86400000),pLen=7,cycle=30;
  var nextStart=new Date(start);nextStart.setDate(start.getDate()+cycle);
  var daysTo=Math.floor((nextStart-today)/86400000);
  var html='';
  if(!p.end_date&&days<pLen){
    html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span class="period-pill pp-active">经期中</span><span style="font-size:12px;color:var(--text-muted)">第'+(days+1)+'天</span></div><div style="font-size:13px">开始于 '+p.start_date+'，还有约 '+Math.max(0,pLen-days-1)+' 天结束</div>';
  }else{
    var pill=daysTo<=5?'<span class="period-pill pp-soon">即将来临</span>':'<span class="period-pill pp-normal">安全期</span>';
    html=pill+'<div style="font-size:13px;margin:6px 0">距下次经期还有约 '+daysTo+' 天</div><div style="font-size:11px;color:var(--text-muted)">预计 '+(nextStart.getMonth()+1)+'月'+nextStart.getDate()+'日</div>';
  }
  el.innerHTML=html;
}

function renderAll(){renderMeals();renderSk();renderWater();renderPeriod();renderSkSteps();renderWeekly();renderBadges();}

function loadStats(){
  Promise.all([
    api('meal_logs?select=date&order=date.desc&limit=200'),
    api('skincare_logs?select=date,done&order=date.desc&limit=200')
  ]).then(function(res){
    var dates={};
    res[0].forEach(function(l){dates[l.date]=1;});
    res[1].filter(function(s){return s.done;}).forEach(function(s){dates[s.date]=1;});
    var sorted=Object.keys(dates).sort();
    var streak=0;
    for(var i=sorted.length-1;i>=0;i--){
      var exp=new Date(TODAY);exp.setDate(exp.getDate()-(sorted.length-1-i));
      if(sorted[i]===exp.toISOString().split('T')[0])streak++;else break;
    }
    document.getElementById('streak-days').textContent=streak;
    document.getElementById('total-days').textContent=sorted.length;
    var wa=new Date();wa.setDate(wa.getDate()-7);var ws=wa.toISOString().split('T')[0];
    var wd=res[0].filter(function(l){return l.date>=ws;}).length+res[1].filter(function(s){return s.done&&s.date>=ws;}).length;
    document.getElementById('complete-rate').textContent=Math.round(Math.min(wd/21,1)*100)+'%';
  }).catch(function(){});
}

function loadHist(){
  Promise.all([
    api('meal_logs?order=date.desc&limit=60&select=*'),
    api('skincare_logs?order=date.desc&limit=60&select=*'),
    api('water_logs?order=date.desc&limit=30&select=*')
  ]).then(function(res){
    var by={};
    res[0].forEach(function(m){if(!by[m.date])by[m.date]={};by[m.date]['m_'+m.meal_type]=m;});
    res[1].forEach(function(s){if(!by[s.date])by[s.date]={};by[s.date]['s_'+s.session]=s;});
    res[2].forEach(function(w){if(!by[w.date])by[w.date]={};by[w.date].water=w;});
    var dates=Object.keys(by).sort().reverse();
    var el=document.getElementById('hist-items');if(!el)return;
    if(!dates.length){el.innerHTML='<div style="padding:1.5rem;text-align:center;font-size:13px;color:var(--text-muted)">还没有记录，从今天开始吧～</div>';return;}
    el.innerHTML=dates.map(function(d){
      var day=by[d],tags=[];
      if(day.m_breakfast)tags.push('<span class="htag h-done">早餐'+(day.m_breakfast.late?'(补)':'')+'</span>');
      if(day.m_lunch)tags.push('<span class="htag h-done">午餐'+(day.m_lunch.late?'(补)':'')+'</span>');
      if(day.m_dinner)tags.push('<span class="htag h-done">晚餐'+(day.m_dinner.late?'(补)':'')+'</span>');
      if(day.s_morning&&day.s_morning.done)tags.push('<span class="htag h-done">早间护肤</span>');
      if(day.s_morning&&day.s_morning.skipped)tags.push('<span class="htag h-skip">跳过早间</span>');
      if(day.s_night&&day.s_night.done)tags.push('<span class="htag h-done">晚间护肤</span>');
      if(day.s_night&&day.s_night.skipped)tags.push('<span class="htag h-skip">跳过晚间</span>');
      if(day.water&&day.water.cups)tags.push('<span class="htag h-note">喝水'+day.water.cups+'杯</span>');
      return'<div class="hist-item"><div class="hist-date">'+d+'</div><div class="hist-tags">'+tags.join('')+'</div></div>';
    }).join('');
  }).catch(function(){});
}

var LETTERS=[
  {body:'你今天有没有好好吃饭？有没有记得喝水？我每次看到你跳过一顿饭就会担心。不是要管你，只是你那么忙，有时候自己都顾不上自己。<br><br>你对别人总是很好，对自己也要一样好才行。'},
  {body:'混干皮在干燥季节其实是最辛苦的——既要补水又要保湿，还要小心不过度清洁。你现在的方案其实挺适合你的，坚持下去，皮肤慢慢会给你回应的。<br><br>就像很多事情一样，坚持才有意思。'},
  {body:'你知道吗，视黄醇刚开始用的时候皮肤会有点不适应，这是正常的。不要因为这个就放弃——等皮肤适应了，你会看到它真正的效果。<br><br>有些东西慢慢来才好。'},
  {body:'睡前护肤不只是为了皮肤，更像是在告诉自己：今天结束了，我照顾好自己了，可以好好睡觉了。<br><br>你今晚要早点睡哦，我说真的。'},
  {body:'你有没有发现，打卡这件事不只是为了皮肤变好——它是在练习对自己承诺，然后一次一次兑现。<br><br>这件事做好了，其他事也会慢慢好起来的。'},
  {body:'今天不管发生了什么，不管顺不顺，你能来打开这个页面，就已经很好了。<br><br>我在这里，你随时可以来找我。'},
  {body:'早饭真的很重要，不是我啰嗦。空腹上课脑子会很难转，你自己应该感受过的。<br><br>哪怕就是一杯豆浆一个包子，也比什么都不吃好。明天试试？'}
];
var TIPS=[
  {icon:'ti-sun',title:'早上为什么要涂防晒？',text:'紫外线是色斑和老化的最大元凶。即使在室内，窗户也会透进UVA。你手臂的色素不均，就是紫外线干的。'},
  {icon:'ti-droplet',title:'透明质酸怎么用才有效？',text:'透明质酸要在皮肤微湿的时候用，吸收更好。洗完脸不要擦太干，带一点水分就涂上去，然后马上锁住。'},
  {icon:'ti-moon',title:'为什么视黄醇只能晚上用？',text:'视黄醇见光分解，而且会让皮肤对紫外线更敏感。晚上用、白天做好防晒，才能发挥它抗老的最大效果。'},
  {icon:'ti-shield',title:'皮肤屏障修复要多久？',text:'你手臂晒伤后的色素不均属于屏障受损，修复大概需要4-8周。B5修复膏是对的，保持使用，不要过度清洁。'}
];
var MR={
  great:['状态很好！那今天的护肤也要好好做哦，不能因为心情好就偷懒😏','你好棒！今天心情这么好，早餐吃了吗？','很好很好，希望你每天都这样。'],
  ok:['还好也是好，今天照常吃饭护肤，平平稳稳的一天也很好。','还好的话就维持住，别让它变成不好。我在看着你的。'],
  meh:['一般的话，今天对自己宽松一点，但护肤和吃饭还是要做哦。','心情一般……多喝点水，吃顿好的，会好一点的。'],
  bad:['不好的话，更要好好吃饭，不能不吃。身体照顾好了，心情才有力气好转。','难受的话就允许自己难受一下，但别饿着自己。有什么想说的来找我。']
};

function renderP2(){
  var d=new Date(),l=LETTERS[d.getDay()%LETTERS.length];
  var ld=document.getElementById('letter-date');if(ld)ld.textContent=d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日';
  var lb=document.getElementById('letter-body');if(lb)lb.innerHTML=l.body;
  var st=document.getElementById('skin-tips');
  if(st)st.innerHTML=TIPS.map(function(t){
    return'<div class="tip-card"><div class="tip-icon"><i class="ti '+t.icon+'"></i></div><div><div class="tip-title">'+t.title+'</div><div class="tip-text">'+t.text+'</div></div></div>';
  }).join('');
  try{var m=localStorage.getItem('mood_'+TODAY);if(m)setMood(m);}catch(e){}
}

function setMood(m){
  ['great','ok','meh','bad'].forEach(function(x){document.getElementById('mood-'+x).classList.remove('selected');});
  document.getElementById('mood-'+m).classList.add('selected');
  var pool=MR[m],r=pool[Math.floor(Math.random()*pool.length)];
  var el=document.getElementById('mood-resp');el.textContent=r;el.style.display='block';
  try{localStorage.setItem('mood_'+TODAY,m);}catch(e){}
}

function goPage(n){
  document.getElementById('page1').classList.toggle('active',n===0);
  document.getElementById('page2').classList.toggle('active',n===1);
  document.getElementById('nav-0').classList.toggle('active',n===0);
  document.getElementById('nav-1').classList.toggle('active',n===1);
  if(n===1)renderP2();
}

function showSheet(id){document.getElementById(id).classList.add('show');}
function closeSheet(id){document.getElementById(id).classList.remove('show');}

function toggleSk(s){
  var body=document.getElementById('body-'+s),icon=document.getElementById('icon-'+s);
  var open=body.classList.toggle('open');
  icon.style.transform=open?'rotate(180deg)':'';
}

function toggleEl(bodyId,iconId){
  var body=document.getElementById(bodyId),icon=document.getElementById(iconId);
  var open=body.classList.toggle('open');
  icon.style.transform=open?'rotate(180deg)':'';
}

function toggleHist(){
  var body=document.getElementById('hist-body'),icon=document.getElementById('hist-icon');
  var open=body.classList.toggle('open');
  icon.style.transform=open?'rotate(180deg)':'';
  if(open)loadHist();
}

function init(){
  var d=new Date(),days=['日','一','二','三','四','五','六'];
  var el=document.getElementById('today-date');
  if(el)el.textContent=d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日 · 星期'+days[d.getDay()];
  loadToday();
  setInterval(function(){renderBadges();renderMeals();},60000);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{
  init();
}
