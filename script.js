'use strict';
// Todo o conteúdo editável encontra-se em dados.json.
const STORAGE_KEY='missao-coimbra-v1';
let etapas=[],TOTAL=0,config={},contentKey='';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const km=n=>new Intl.NumberFormat('pt-PT',{maximumFractionDigits:2}).format(n);
const letters=['A','B','C','D'];
const arrow='<span aria-hidden="true">→</span>';
const pin='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const main=$('#main');
let state=null,selected=null,view=0,stageMap=null,routeMap=null,routeMarkers=[],saveUnavailable=false,cardURL=null,cardRun=0;

function validState(s){
  if(!s||s.version!==4||!Number.isInteger(s.index)||s.index<0||s.index>=etapas.length||!Array.isArray(s.answers)||s.answers.length!==etapas.length||!Number.isFinite(s.startedAt)||s.startedAt<=0||s.startedAt>Date.now()||!(s.finishedAt===null||(Number.isFinite(s.finishedAt)&&s.finishedAt>=s.startedAt&&s.finishedAt<=Date.now())))return false;
  if(!s.answers.every((a,i)=>(a===null||Number.isInteger(a)&&a>=0&&a<4)&&(i<s.index?a!==null:i>s.index?a===null:true)))return false;
  return !s.finishedAt||(s.index===etapas.length-1&&s.answers.every(a=>a!==null));
}
// Versões anteriores tinham o caderno e o puzzle; as respostas continuam válidas.
function migrate(s){if(s&&[2,3].includes(s.version)){s.version=4;for(const k of ['team','missions','puzzleOrder','puzzleSolved'])delete s[k];}if(s?.version===1){s.version=4;delete s.team;}return s;}
function load(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const parsed=migrate(JSON.parse(raw));if(validState(parsed)&&(!parsed.contentKey||parsed.contentKey===contentKey)){state=parsed;state.contentKey=contentKey;}else{localStorage.removeItem(STORAGE_KEY);$('#content-warning').hidden=false;}}}catch{saveUnavailable=true;}}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));saveUnavailable=false;}catch{saveUnavailable=true;}$('#storage-warning').hidden=!saveUnavailable;}
function elapsedTime(now=Date.now()){
  const seconds=state?Math.max(0,Math.floor(((state.finishedAt??now)-state.startedAt)/1000)):0;
  return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
}
function updateElapsed(){document.querySelectorAll('[data-elapsed]').forEach(el=>el.textContent=elapsedTime());}
setInterval(updateElapsed,1000);
document.addEventListener('visibilitychange',updateElapsed);
function answeredCount(){return state?state.answers.filter(a=>a!==null).length:0;}
function osm(e){return `https://www.openstreetmap.org/?mlat=${e.latitude}&mlon=${e.longitude}#map=18/${e.latitude}/${e.longitude}`;}
function moveFocus(){main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function cleanupMap(){if(stageMap){stageMap.remove();stageMap=null;}}
function resetPage(){cleanupMap();cardRun++;Memories.clearURLs();if(cardURL){URL.revokeObjectURL(cardURL);cardURL=null;}}
function syncFooter(onWelcome=false){$('#restart-footer').hidden=!state||onWelcome;$('#storage-warning').hidden=!saveUnavailable;}
function shortName(e){return e.local.split(' · ')[0];}

function welcome(){
  resetPage();const n=answeredCount();
  const how=['Chega a cada paragem e responde à pergunta.','Tira uma fotografia do lugar, se quiseres.','No fim, recebe o teu cartão de Coimbra.'];
  main.innerHTML=`<section class="welcome fade-in" aria-labelledby="welcome-title"><div class="hero"><div class="hero-placeholder" aria-hidden="true"></div><img src="images/coimbra-hero.jpg" alt="A cidade de Coimbra na encosta, vista sobre o rio Mondego" fetchpriority="high" width="2592" height="1944"><div class="hero-text"><p class="eyebrow">PEDDY-PAPER · COIMBRA</p><h1 id="welcome-title">${esc(config.titulo)}</h1></div></div><div class="welcome-body"><p class="intro">${esc(config.introducao)}</p><ul class="facts" aria-label="O percurso"><li><b>${etapas.length}</b>paragens</li><li><b>${km(TOTAL)}</b>km a pé</li><li><b>1</b>cartão final</li></ul>${state?`<div class="resume-card"><strong>${state.finishedAt?'Percurso concluído':`Vais na paragem ${state.index+1} de ${etapas.length}`}</strong><span>${n} ${n===1?'pergunta respondida':'perguntas respondidas'} · <span data-elapsed>${elapsedTime()}</span></span></div><button class="primary" id="resume">${state.finishedAt?'Ver o meu cartão':'Continuar o percurso'} ${arrow}</button><button class="text-button" data-action="restart">Começar de novo</button>`:`<ol class="how">${how.map(t=>`<li>${t}</li>`).join('')}</ol><button class="primary" id="start-walk" type="button">Começar o percurso ${arrow}</button>`}</div></section>`;
  const hero=$('.hero img');hero.addEventListener('error',e=>e.target.hidden=true);hero.addEventListener('load',()=>$('.hero-placeholder').hidden=true);
  $('#start-walk')?.addEventListener('click',()=>{state={version:4,contentKey,index:0,answers:etapas.map(()=>null),startedAt:Date.now(),finishedAt:null};save();renderStage();moveFocus();});
  $('#resume')?.addEventListener('click',()=>{resumeWalk();moveFocus();});syncFooter(true);
}

// Os nós acendem-se à medida que o percurso avança: a rede do cartão final.
function gridProgress(current){
  return `<nav class="grid-progress" aria-label="Paragens"><ol>${etapas.map((e,i)=>{const done=state.answers[i]!==null,reachable=i<=state.index;return `<li class="${done?'done':''} ${i===current?'current':''}">${reachable?`<button type="button" data-view="${i}" aria-label="Paragem ${i+1}: ${esc(e.local)}${done?', respondida':''}" ${i===current?'aria-current="step"':''}></button>`:`<span aria-hidden="true"></span>`}</li>`;}).join('')}</ol><p><span>Paragem <b>${current+1}</b> de ${etapas.length} · ${km(etapas[current].distanciaAcumulada)} km</span><span class="clock" data-elapsed>${elapsedTime()}</span></p></nav>`;
}

function renderStage(index=state.index){
  resetPage();selected=null;view=index;
  const e=etapas[index],a=state.answers[index],answered=a!==null;
  main.innerHTML=`<section class="stage fade-in" aria-labelledby="stage-title">${gridProgress(index)}<header class="stage-head">${e.imagem?`<img class="stage-img" src="${esc(e.imagem)}" alt="${esc(e.foto)}" hidden>`:''}<p class="eyebrow">PARAGEM ${String(e.id).padStart(2,'0')}${e.comica?' · PAUSA CÓMICA':e.categoria?` · ${esc(e.categoria.toUpperCase())}`:''}</p><h1 id="stage-title">${esc(e.local)}</h1><p class="tema">${esc(e.tema)}</p></header><details class="where" id="where"><summary>${pin}<span>Onde é o ponto de encontro?</span></summary><p>${esc(e.localizacao)}</p><div id="stage-map" class="mini-map" aria-label="Mapa de ${esc(e.local)}"></div><a class="map-link" href="${osm(e)}" target="_blank" rel="noopener">Abrir no mapa ↗</a></details>${e.aviso?`<p class="advice">${esc(e.aviso)}</p>`:''}<form id="answer-form" class="question"><fieldset><legend>${esc(e.pergunta)}</legend><div class="options">${e.respostas.map((text,i)=>`<label class="option ${answered?(i===e.correta?'correct':i===a?'wrong':''):''}"><input type="radio" name="answer" value="${i}" ${answered?'disabled':''} ${a===i?'checked':''}><span class="letter">${letters[i]}</span><span class="answer-text">${esc(text)}</span>${answered&&(i===e.correta||i===a)?`<span class="answer-mark">${i===e.correta?'✓':'✕'}<span class="sr-only"> ${i===e.correta?'Resposta certa':'Resposta errada'}</span></span>`:''}</label>`).join('')}</div></fieldset>${!answered?`<button id="confirm-answer" class="primary" type="submit" disabled>Confirmar resposta</button>`:''}</form><div id="after-answer" aria-live="polite">${answered?afterAnswer(e,a):''}</div></section>`;
  const img=$('.stage-img');if(img){img.addEventListener('load',()=>img.hidden=false);img.addEventListener('error',()=>img.remove());}
  $('#where').addEventListener('toggle',()=>{if($('#where').open&&!stageMap)stageMap=buildMap('stage-map',index,false);else stageMap?.invalidateSize();});
  $('#answer-form').addEventListener('change',event=>{selected=Number(event.target.value);$('#confirm-answer').disabled=false;});
  $('#answer-form').addEventListener('submit',event=>{event.preventDefault();if(state.answers[index]!==null||!Number.isInteger(selected))return;state.answers[index]=selected;save();renderStage(index);const f=$('.feedback');f.tabIndex=-1;f.focus({preventScroll:true});f.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});
  if(answered)Memories.paintSlot(index);
  syncFooter();
}

function afterAnswer(e,a){
  const i=e.id-1,correct=a===e.correta,next=etapas[i+1],current=i===state.index,distance=next?Math.round((next.distanciaAcumulada-e.distanciaAcumulada)*1000):0;
  const title=e.categoria==='Lenda académica'?(correct?'É essa a lenda!':'A lenda conta-se assim…'):e.comica?(correct?'Apanhaste a brincadeira!':'Uma pausa para rir.'):correct?'Certo!':`Afinal, é a ${letters[e.correta]}.`;
  const feedback=`<div class="feedback ${e.comica?'neutral':correct?'':'incorrect'}"><h2>${title}</h2><p>${esc(e.explicacao)}</p>${e.fonte?`<a class="source" href="${esc(e.fonte)}" target="_blank" rel="noopener">Fonte: ${esc(e.fonteNome||'consultar')} ↗</a>`:''}</div>`;
  const photo=`<section class="photo-slot" data-photo-slot="${i}" aria-label="Fotografia desta paragem"><h2>Uma memória deste lugar</h2>${e.desafio?`<p class="photo-challenge">${esc(e.desafio)}</p>`:''}<div class="photo-body"><p class="fine-print">A carregar…</p></div><p class="photo-status" role="status"></p></section>`;
  let move;
  if(state.finishedAt)move=`<div class="next"><button class="primary" type="button" data-action="card">Voltar ao cartão ${arrow}</button></div>`;
  else if(!current)move=`<div class="next"><button class="primary" type="button" data-view="${state.index}">Voltar à paragem ${state.index+1} ${arrow}</button></div>`;
  else if(next)move=`<div class="next"><p class="eyebrow">A SEGUIR · ≈ ${distance} m</p><h2>${esc(next.local)}</h2>${e.caminho?`<p>${esc(e.caminho)}</p>`:''}<button class="text-button" type="button" data-action="map" data-map-focus="${i+1}">Ver no mapa</button><button class="primary" id="next-stage" type="button">Cheguei · próxima paragem ${arrow}</button></div>`;
  else move=`<div class="next"><p class="eyebrow">ÚLTIMA PARAGEM</p><h2>O circuito está fechado.</h2><p>Termina para ver o teu cartão de Coimbra, com as fotografias ligadas numa rede.</p><button class="primary" id="finish-walk" type="button">Terminar e criar o cartão ${arrow}</button></div>`;
  return feedback+photo+move;
}

function renderFinish(){
  resetPage();
  main.innerHTML=`<section class="finish fade-in" aria-labelledby="finish-title"><p class="eyebrow">CIRCUITO FECHADO</p><h1 id="finish-title">Coimbra ficou <em>ligada.</em></h1><p class="finish-stats">${etapas.length} paragens · ${km(TOTAL)} km · <span data-elapsed>${elapsedTime()}</span></p><figure class="card-frame"><div id="card-slot" class="card-slot" role="status">A ligar a tua rede…</div></figure><div class="card-actions" id="card-actions" hidden><button class="primary" id="share-card" type="button" hidden>Partilhar cartão</button><a class="primary" id="download-card" download="coimbra-a-energia-que-nos-liga.png">Guardar cartão</a></div><p class="fine-print center">As fotografias ficam só neste telemóvel. Guarda o cartão antes de recomeçar.</p><details class="album"><summary>Acrescentar ou trocar fotografias</summary><div class="album-grid">${etapas.map((e,i)=>`<section class="photo-slot compact" data-photo-slot="${i}"><h3>${i+1}. ${esc(shortName(e))}</h3><div class="photo-body"></div><p class="photo-status" role="status"></p></section>`).join('')}</div></details><details class="review"><summary>Rever as perguntas</summary>${etapas.map((e,i)=>`<div class="review-item"><h3>${e.id}. ${esc(e.local)}</h3><p>${esc(e.pergunta)}</p><p class="muted">A tua resposta: ${letters[state.answers[i]]} · ${esc(e.respostas[state.answers[i]])}</p><p><strong>${letters[e.correta]} · ${esc(e.respostas[e.correta])}</strong></p><p class="muted">${esc(e.explicacao)}</p></div>`).join('')}</details></section>`;
  etapas.forEach((_,i)=>Memories.paintSlot(i));
  $('#share-card').addEventListener('click',shareCard);
  drawCard();syncFooter();
}
async function drawCard(){
  const run=++cardRun,slot=$('#card-slot');if(!slot)return;
  slot.textContent='A ligar a tua rede…';$('#card-actions').hidden=true;
  try{
    const png=await Memories.makeCard();if(run!==cardRun)return;
    if(cardURL)URL.revokeObjectURL(cardURL);cardURL=URL.createObjectURL(png);drawCard.file=new File([png],'coimbra-a-energia-que-nos-liga.png',{type:'image/png'});
    slot.innerHTML=`<img src="${cardURL}" alt="Cartão de Coimbra: as tuas fotografias ligadas numa rede elétrica sobre o mapa do percurso">`;
    $('#download-card').href=cardURL;$('#card-actions').hidden=false;
    $('#share-card').hidden=!(navigator.canShare&&navigator.canShare({files:[drawCard.file]}));
  }catch(error){if(run===cardRun)slot.textContent='Não foi possível criar o cartão. '+error.message;}
}
async function shareCard(){try{await navigator.share({files:[drawCard.file],title:'Coimbra · a energia que nos liga'});}catch{}}
Memories.onChange=()=>{if(state?.finishedAt&&$('#card-slot'))drawCard();};

function buildMap(id,index,all){
  const element=document.getElementById(id),e=etapas[index];
  if(!window.L){element.innerHTML=`<div class="map-error">O mapa não está disponível.<a href="${osm(e)}" target="_blank" rel="noopener">Consultar no OpenStreetMap ↗</a></div>`;return null;}
  const map=L.map(element,{scrollWheelZoom:false}).setView([e.latitude,e.longitude],16);
  const layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
  let tileWarning=null;
  layer.on('tileerror',()=>{if(!tileWarning){tileWarning=L.control({position:'bottomleft'});tileWarning.onAdd=()=>{const el=L.DomUtil.create('div','tile-warning');el.textContent='Mapa sem ligação. Consultem a lista de paragens.';return el;};tileWarning.addTo(map);}});
  layer.on('tileload',()=>{if(tileWarning){map.removeControl(tileWarning);tileWarning=null;}});
  const items=all?etapas:[e];if(all){routeMarkers=[];L.polyline(etapas.map(e=>[e.latitude,e.longitude]),{color:'#b8862c',weight:4,dashArray:'6 5',opacity:1}).addTo(map);}
  items.forEach(point=>{const i=point.id-1,done=state&&state.answers[i]!==null;const marker=L.marker([point.latitude,point.longitude],{icon:L.divIcon({className:`map-pin ${i===index?'active':''} ${done?'done':''}`,html:point.id===1&&all&&etapas[0].latitude===etapas.at(-1).latitude&&etapas[0].longitude===etapas.at(-1).longitude?`1/${etapas.length}`:String(point.id),iconSize:all&&point.id===1?[34,34]:[30,30]}),title:`${point.id}. ${point.local}`,alt:`Paragem ${point.id}: ${point.local}`}).addTo(map).bindPopup(`<strong>${point.id}. ${esc(point.local)}</strong><br>${esc(point.localizacao)}<br><a href="${osm(point)}" target="_blank" rel="noopener">Abrir no OpenStreetMap ↗</a>`);if(all){routeMarkers[i]=marker;if(point.id===etapas.length&&point.latitude===etapas[0].latitude&&point.longitude===etapas[0].longitude){map.removeLayer(marker);routeMarkers[i]=routeMarkers[0];}}});
  if(all)map.fitBounds(L.latLngBounds(etapas.map(e=>[e.latitude,e.longitude])),{padding:[30,30]});
  return map;
}

function openMap(focusIndex){
  if(!etapas.length)return;
  const index=Number.isInteger(focusIndex)?focusIndex:state?.index??0;
  $('#route-list').innerHTML=etapas.map((e,i)=>`<li class="${state?.index===i?'current':''} ${state&&state.answers[i]!==null?'done':''}"><span class="route-number">${e.id}</span><button type="button" data-point="${i}">${esc(e.local)}</button><small>${km(e.distanciaAcumulada)} km</small></li>`).join('');
  if(!$('#map-dialog').open)$('#map-dialog').showModal();
  if(routeMap){routeMap.remove();routeMap=null;}routeMap=buildMap('route-map',index,true);
  requestAnimationFrame(()=>{routeMap?.invalidateSize();if(Number.isInteger(focusIndex)){routeMap?.setView([etapas[index].latitude,etapas[index].longitude],17);routeMarkers[index]?.openPopup();}});
}

document.addEventListener('click',event=>{
  const close=event.target.closest('[data-close]');if(close){close.closest('dialog').close();return;}
  const actionEl=event.target.closest('[data-action]'),action=actionEl?.dataset.action;
  if(action==='map'){const f=actionEl.dataset.mapFocus;openMap(f===undefined?undefined:Number(f));}
  if(action==='info')$('#info-dialog').showModal();
  if(action==='restart')$('#restart-dialog').showModal();
  if(action==='card'&&state?.finishedAt){renderFinish();moveFocus();}
  const go=event.target.closest('[data-view]');if(go&&state){renderStage(Number(go.dataset.view));moveFocus();}
  if(event.target.closest('#next-stage')&&state.answers[state.index]!==null&&state.index<etapas.length-1){state.index++;save();renderStage();moveFocus();}
  if(event.target.closest('#finish-walk')&&state.answers.every(a=>a!==null)){state.finishedAt=Date.now();save();renderFinish();moveFocus();}
  const point=event.target.closest('[data-point]');if(point&&routeMap){const i=Number(point.dataset.point);routeMap.setView([etapas[i].latitude,etapas[i].longitude],17);routeMarkers[i]?.openPopup();$('#route-map').scrollIntoView({block:'nearest'});}
});
$('#confirm-restart').addEventListener('click',()=>{try{localStorage.removeItem(STORAGE_KEY);}catch{saveUnavailable=true;}state=null;$('#restart-dialog').close();welcome();moveFocus();});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));

function validateData(data){
  if(!data||!Array.isArray(data.etapas)||data.etapas.length<2)throw new Error('dados.json precisa de pelo menos duas etapas.');
  if(typeof data.titulo!=='string'||!data.titulo.trim()||typeof data.introducao!=='string')throw new Error('Preenche titulo e introducao com texto.');
  let previous=-1;
  data.etapas.forEach((e,i)=>{
    const prefix=`Etapa ${i+1}: `;
    for(const field of ['local','tema','localizacao','pergunta','explicacao'])if(typeof e[field]!=='string'||!e[field].trim())throw new Error(prefix+`o campo ${field} precisa de texto.`);
    if(!Number.isFinite(e.latitude)||Math.abs(e.latitude)>90||!Number.isFinite(e.longitude)||Math.abs(e.longitude)>180)throw new Error(prefix+'coordenadas inválidas.');
    if(!Number.isFinite(e.distanciaAcumulada)||e.distanciaAcumulada<0||e.distanciaAcumulada<previous||(i===0&&e.distanciaAcumulada!==0))throw new Error(prefix+'a distância deve começar em 0 e nunca diminuir.');
    previous=e.distanciaAcumulada;
    if(!Array.isArray(e.respostas)||e.respostas.length!==4||!e.respostas.every((r,j)=>r&&r.letra===letters[j]&&typeof r.texto==='string'&&r.texto.trim()))throw new Error(prefix+'usa quatro respostas com letra A, B, C e D, por esta ordem, e texto.');
    if(!letters.includes(e.correta))throw new Error(prefix+'correta deve ser A, B, C ou D.');
    if(typeof e.comica!=='boolean')throw new Error(prefix+'comica deve ser true ou false.');
    for(const field of ['imagem','foto','fonte','fonteNome','caminho','aviso','categoria','desafio'])if(e[field]!=null&&typeof e[field]!=='string')throw new Error(prefix+`${field} deve ser texto.`);
    if(e.fonte&&!/^https?:\/\//i.test(e.fonte))throw new Error(prefix+'a fonte deve começar por https:// ou http://.');
    if(e.imagem&&(!/^images\/[\w/.-]+$/i.test(e.imagem)||e.imagem.includes('..')))throw new Error(prefix+'a imagem deve ser um caminho dentro de images/.');
  });
  if(previous<=0)throw new Error('A distância total deve ser maior do que zero.');
  return data;
}
function contentFingerprint(data){
  // Só alterações à ordem/locais/perguntas/respostas invalidam respostas antigas.
  const text=JSON.stringify(data.etapas.map(e=>[e.local,e.pergunta,e.respostas,e.correta,e.comica]));
  let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);
}
async function initialize(){
  main.innerHTML='<section class="finish"><p class="eyebrow">COIMBRA EM REDE</p><h1>A preparar<br><em>o passeio…</em></h1></section>';
  try{
    config=validateData(await readRouteData());
    etapas=config.etapas.map((e,i)=>({...e,id:i+1,respostas:e.respostas.map(r=>r.texto),correta:letters.indexOf(e.correta),foto:e.foto||e.local}));
    TOTAL=etapas.at(-1).distanciaAcumulada;contentKey=contentFingerprint(config);
    document.title=config.titulo+' — um passeio para descobrir em conjunto';
    $('.map-note').textContent=`${km(TOTAL)} km · ${etapas.length} paragens · circuito pedonal`;
    $('#info-distance').textContent=km(TOTAL);
    load();if(state)save();welcome();
  }catch(error){
    console.error('Conteúdo do passeio:',error);
    main.innerHTML=`<section class="finish"><p class="eyebrow">COIMBRA EM REDE</p><h1>O passeio ainda<br><em>não abriu.</em></h1><p>Não foi possível carregar o conteúdo. Tenta novamente ou verifica o ficheiro dados.json.</p><p class="fine-print">${esc(error.message)}</p><button id="retry-load" class="primary">Tentar novamente</button></section>`;
    $('#retry-load').addEventListener('click',initialize);
  }
}
initialize();

function resumeWalk(){if(state.finishedAt)renderFinish();else renderStage();}
