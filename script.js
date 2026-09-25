'use strict';
// Todo o conteúdo editável encontra-se em dados.json.
const STORAGE_KEY='missao-coimbra-v1';
let etapas=[],TOTAL=0,config={},contentKey='';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const km=n=>new Intl.NumberFormat('pt-PT',{maximumFractionDigits:2}).format(n);
const letters=['A','B','C','D'];
const arrow='<span aria-hidden="true">↗</span>';
const pin='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const main=$('#main');
let state=null,selected=null,stageMap=null,routeMap=null,routeMarkers=[],saveUnavailable=false;

function validState(s){
  if(!s||s.version!==3||!Number.isInteger(s.index)||s.index<0||s.index>=etapas.length||!Array.isArray(s.answers)||s.answers.length!==etapas.length||!Number.isFinite(s.startedAt)||s.startedAt<=0||s.startedAt>Date.now()||!(s.finishedAt===null||(Number.isFinite(s.finishedAt)&&s.finishedAt>=s.startedAt&&s.finishedAt<=Date.now())))return false;
  if(!s.answers.every((a,i)=>(a===null||Number.isInteger(a)&&a>=0&&a<4)&&(i<s.index?a!==null:i>s.index?a===null:true)))return false;
  if(!Puzzle.validProgress(s,missions().map(e=>e.missao.id)))return false;
  if(etapas.some((e,i)=>i<s.index&&e.missao&&!s.missions[e.missao.id]))return false;
  return !s.finishedAt||(s.index===etapas.length-1&&s.answers.every(a=>a!==null));
}
function load(){try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){const parsed=JSON.parse(raw);if(parsed?.version===1){parsed.version=2;delete parsed.team;}if(validState(parsed)&&(!parsed.contentKey||parsed.contentKey===contentKey)){state=parsed;state.contentKey=contentKey;}else{localStorage.removeItem(STORAGE_KEY);$('#content-warning').hidden=false;}}}catch{saveUnavailable=true;}}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));saveUnavailable=false;}catch{saveUnavailable=true;}$('#storage-warning').hidden=!saveUnavailable;}
function elapsedTime(now=Date.now()){
  const seconds=state?Math.max(0,Math.floor(((state.finishedAt??now)-state.startedAt)/1000)):0;
  return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
}
function updateElapsed(){document.querySelectorAll('[data-elapsed]').forEach(el=>el.textContent=elapsedTime());}
setInterval(updateElapsed,1000);
document.addEventListener('visibilitychange',updateElapsed);
function stats(){return{answered:state?state.answers.filter(a=>a!==null).length:0};}
function osm(e){return `https://www.openstreetmap.org/?mlat=${e.latitude}&mlon=${e.longitude}#map=18/${e.latitude}/${e.longitude}`;}
function moveFocus(){main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function cleanupMap(){if(stageMap){stageMap.remove();stageMap=null;}}
function syncFooter(){$('#memories-footer').hidden=!state;$('#restart-footer').hidden=!state;$('#storage-warning').hidden=!saveUnavailable;notebookStatus();}

function welcome(){
  cleanupMap();const s=stats();
  main.innerHTML=`<section class="welcome fade-in" aria-labelledby="welcome-title"><div class="welcome-copy"><div class="edition"><p class="eyebrow">PEDDY-PAPER · COIMBRA</p></div><h1 id="welcome-title">Um caderno.<br>Seis <em>descobertas.</em></h1><p class="intro">${esc(config.introducao)}</p><div class="trip-facts"><div><strong>${km(TOTAL)} km</strong><small>para descobrir</small></div><div><strong data-elapsed>${elapsedTime()}</strong><small>tempo decorrido</small></div><div><strong>${etapas.length} perguntas</strong><small>+ 6 missões de observação</small></div></div>${state?`<div class="resume-block"><div class="resume-card"><div><strong>O teu passeio</strong><span>${state.finishedAt?'Passeio concluído':`Paragem ${state.index+1} de ${etapas.length}`} · ${s.answered} ${s.answered===1?'pergunta explorada':'perguntas exploradas'}</span></div><span aria-hidden="true">↗</span></div><div class="resume-actions"><button class="primary" id="resume">${state.finishedAt?'Rever o passeio':'Continuar o passeio'} ${arrow}</button><button class="text-button" data-action="restart">Começar de novo</button></div><p class="start-note">O teu progresso ficou guardado neste telemóvel.</p></div>`:`<div class="start-form"><button class="primary" id="start-walk" type="button">Começar o passeio ${arrow}</button><p class="start-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M10 17h4"/></svg>Cada pessoa no seu telemóvel. O passeio é em conjunto.</p></div>`}</div><div class="welcome-visual"><div class="hero-placeholder" aria-hidden="true">Coimbra.</div><img src="images/coimbra-hero.jpg" alt="A cidade de Coimbra na encosta, vista sobre o rio Mondego" fetchpriority="high" width="2592" height="1944"><div class="journey-seal"><span>DESCOBRIR</span><b>${km(TOTAL)} km</b><span>A PÉ · EM CONJUNTO</span></div><div class="visual-caption"><p class="eyebrow">40°12′ N · 8°25′ W</p><h2>Há histórias em cada subida.</h2><p>E uma boa desculpa para parar pelo caminho.</p></div></div></section>${notebookIntro()}<section class="route-strip" aria-label="Resumo do roteiro"><p class="eyebrow">O VOSSO<br>CAMINHO</p><div class="route-stops">${[...new Set([0,Math.floor((etapas.length-1)/2),etapas.length-1])].map(i=>`<span>${esc(etapas[i].local)}</span>`).join('<i>—</i>')}</div><button data-action="map" aria-label="Abrir mapa do percurso">↗</button></section><div class="welcome-bottom"><p>Olhem para a cidade, recuperem as seis peças e montem a fotografia no final. Sem pontos, competição ou pressa.</p><button data-action="info">O que saber antes de partir ↗</button></div>`;
  const hero=$('.welcome-visual img');hero.addEventListener('error',e=>e.target.hidden=true);hero.addEventListener('load',()=>$('.hero-placeholder').hidden=true);if(hero.complete&&hero.naturalWidth)$('.hero-placeholder').hidden=true;
  $('#start-walk')?.addEventListener('click',()=>{state={version:3,contentKey,index:0,answers:etapas.map(()=>null),startedAt:Date.now(),finishedAt:null,missions:{},puzzleOrder:Puzzle.initial(),puzzleSolved:false};save();renderStage();moveFocus();});
  $('#resume')?.addEventListener('click',()=>{resumeWalk();moveFocus();});syncFooter();
}

function renderStage(){
  cleanupMap();selected=null;const e=etapas[state.index],a=state.answers[state.index],answered=a!==null,s=stats(),pct=Math.round(e.distanciaAcumulada/TOTAL*100);
  main.innerHTML=`<section class="game fade-in" aria-labelledby="stage-title"><div class="scorebar" aria-label="O teu progresso"><div><small>PARAGEM</small><strong>${e.id} <span>/ ${etapas.length}</span></strong></div><div><small>DESCOBERTAS</small><strong>${s.answered} <span>/ ${etapas.length}</span></strong></div><div><small>DISTÂNCIA ESTIMADA</small><strong>${km(e.distanciaAcumulada)} <span>/ ${km(TOTAL)} km</span></strong></div></div><p class="elapsed-line">Tempo decorrido <strong data-elapsed>${elapsedTime()}</strong></p><div class="stage-heading"><div><p class="eyebrow">ETAPA ${e.id} DE ${etapas.length} · O TEU PASSEIO</p><h1 id="stage-title">${esc(e.local)}</h1></div><span class="stage-count" aria-hidden="true">${String(e.id).padStart(2,'0')}</span></div><div class="game-layout"><div class="stage-context"><figure class="stage-photo"><span class="photo-number" aria-hidden="true">${String(e.id).padStart(2,'0')}</span>${e.imagem?`<img src="${esc(e.imagem)}" alt="${esc(e.foto)}" hidden>`:''}<figcaption><p class="eyebrow">MISSÃO COIMBRA</p><h2>${esc(e.tema)}</h2><p class="photo-status"></p></figcaption></figure><div class="location">${pin}<p><strong>O vosso ponto de encontro</strong>${esc(e.localizacao)}</p></div><div id="stage-map" class="mini-map" aria-label="Mapa de ${esc(e.local)}"></div><div class="map-foot"><span class="fine-print">Marcador aproximado · sem GPS</span><a href="${osm(e)}" target="_blank" rel="noopener">Abrir mapa ↗</a></div><div class="progress-card"><div class="progress-label"><strong>O caminho faz-se a pé</strong><span>${pct}%</span></div><progress value="${e.distanciaAcumulada}" max="${TOTAL}" aria-label="${pct}% do percurso estimado concluído"></progress><div class="distance-labels"><span>≈ ${km(e.distanciaAcumulada)} km percorridos</span><span>Faltam ≈ ${km(TOTAL-e.distanciaAcumulada)} km</span></div><p class="fine-print">${pct}% da Missão Coimbra concluída · estimativa por etapa</p></div>${e.aviso?`<p class="stage-advice">${esc(e.aviso)} <button class="text-button" data-action="info">Ver informações</button></p>`:''}</div><div class="question-panel"><div class="question-meta"><p class="eyebrow">O DESAFIO DESTA PARAGEM</p><span class="pill ${e.comica?'comic':''}">${esc(e.categoria||(e.comica?'Pausa cómica':'Uma descoberta'))}</span></div><form id="answer-form"><fieldset><legend>${esc(e.pergunta)}</legend><div class="options">${e.respostas.map((text,i)=>`<label class="option ${answered?(i===e.correta?'correct':i===a?'wrong':''):''}"><input type="radio" name="answer" value="${i}" ${answered?'disabled':''} ${a===i?'checked':''}><span class="letter">${letters[i]}</span><span class="answer-text">${esc(text)}</span>${answered&&(i===e.correta||i===a)?`<span class="answer-mark">${i===e.correta?'✓':'✕'}<span class="sr-only"> ${i===e.correta?'Resposta certa':'Resposta errada'}</span></span>`:''}</label>`).join('')}</div></fieldset>${!answered?`<div class="answer-actions"><button id="confirm-answer" class="primary" type="submit" disabled>Confirmar resposta <span aria-hidden="true">→</span></button><p class="selection-hint">${e.comica?'Uma brincadeira para descontrair.':'Escolhe a tua resposta. Depois, partilhem a descoberta.'}</p></div>`:''}</form><div id="answer-feedback" aria-live="polite">${answered?feedback(e,a):''}</div></div></div></section>`;
  $('.stage-context').insertAdjacentHTML('beforeend',Memories.stageHTML());
  const photo=$('.stage-photo img');if(photo){photo.addEventListener('load',()=>{photo.hidden=false;$('.stage-photo').classList.add('has-photo');$('.photo-status').hidden=true;});photo.addEventListener('error',()=>photo.hidden=true);if(photo.complete&&photo.naturalWidth)photo.dispatchEvent(new Event('load'));}
  $('#answer-form').addEventListener('change',event=>{selected=Number(event.target.value);$('#confirm-answer').disabled=false;});
  $('#answer-form').addEventListener('submit',event=>{event.preventDefault();if(state.answers[state.index]!==null||!Number.isInteger(selected))return;state.answers[state.index]=selected;save();renderStage();const feedbackEl=$('.feedback');feedbackEl.tabIndex=-1;feedbackEl.focus({preventScroll:true});feedbackEl.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});});
  $('#next-stage')?.addEventListener('click',()=>{if(state.answers[state.index]===null||!missionDone(etapas[state.index]))return;if(state.index===etapas.length-1){renderPuzzle();}else{state.index++;save();renderStage();}moveFocus();});
  $('#next-map')?.addEventListener('click',()=>openMap(state.index+1));
  stageMap=buildMap('stage-map',state.index,false);syncFooter();
}

function feedback(e,a){
  const correct=a===e.correta,next=etapas[state.index+1],distance=next?Math.round((next.distanciaAcumulada-e.distanciaAcumulada)*1000):0;
  const title=e.categoria==='Lenda académica'?(correct?'✓ É essa a lenda!':'A lenda conta-se assim…'):e.comica?(correct?'✓ Apanhámos a brincadeira!':'Uma pausa para rir.'):correct?'✓ É isso mesmo!':'Uma nova descoberta!';
  return `<div class="feedback ${e.comica?'neutral':correct?'':'incorrect'}"><h3>${title}</h3>${!correct?`<p><strong>A resposta é ${letters[e.correta]}.</strong></p>`:''}<p>${esc(e.explicacao)}</p>${e.fonte?`<a class="source" href="${esc(e.fonte)}" target="_blank" rel="noopener">Fonte: ${esc(e.fonteNome||'Consultar referência')} ↗</a>`:''}</div>${missionHTML(e)}<div class="next-stop"><p class="eyebrow">${next?'PARAGEM CONCLUÍDA · A SEGUIR':'ESTÃO DE VOLTA AO MONDEGO'}</p><h3>${next?esc(next.local):'A missão está cumprida.'}</h3>${next?`<p class="fine-print">${esc(e.caminho||'Sigam até ao ponto de encontro da próxima paragem.')}</p><div class="travel"><span>≈ ${distance} m</span><button id="next-map" type="button">Ver no mapa ↗</button></div>`:`<p class="fine-print">${etapas.length} paragens, seis peças. Está na hora de reconstruir a fotografia e descobrir a mensagem.</p>`}<button class="primary" id="next-stage" type="button" ${missionDone(e)?'':'disabled'}>${next?'Já cheguei · próxima pergunta':'Abrir a última página'} ${arrow}</button>${!missionDone(e)?'<p class="selection-hint">Recupera a peça acima — podes pedir ajuda — antes de continuar.</p>':next?'<p class="selection-hint">Avancem quando chegarem à próxima paragem.</p>':''}</div>`;
}

function renderFinish(){
  cleanupMap();const time=elapsedTime();
  main.innerHTML=`<section class="finish fade-in" aria-labelledby="finish-title"><div class="finish-medal" aria-hidden="true">✦</div><p class="eyebrow">DO MONDEGO À ALTA. E DE VOLTA.</p><h1 id="finish-title">Coimbra fica<br><em>contigo.</em></h1><p class="finish-message">${esc(config.caderno.palavras.join(' '))}</p><p class="notebook-complete">Caderno reconstruído · 6 descobertas guardadas</p><div class="finish-stats"><div><b>${km(TOTAL)} km</b><small>percurso total</small></div><div><b>${etapas.length}</b><small>paragens descobertas</small></div><div><b>${time}</b><small>tempo decorrido</small></div></div><p class="fine-print">O tempo inclui as pausas e os períodos com a página fechada.<br>O passeio termina aqui. A conversa pode continuar à beira-rio.</p><button class="primary" data-action="memories">Criar o meu cartão de Coimbra ↗</button><button class="secondary" data-action="map">Rever o percurso ${arrow}</button><button class="text-button" data-action="restart">Voltar a passear</button><details><summary>Revisitar as perguntas e as histórias</summary>${etapas.map((e,i)=>`<div class="review-item"><h3>${e.id}. ${esc(e.local)}${e.comica?' · pausa cómica':''}</h3><p>${esc(e.pergunta)}</p><p class="muted">A tua resposta: ${letters[state.answers[i]]} · ${esc(e.respostas[state.answers[i]])}</p><p><strong>${e.comica?'A brincadeira':'A descoberta'}: ${letters[e.correta]} · ${esc(e.respostas[e.correta])}</strong></p><p class="muted">${esc(e.explicacao)}</p>${e.fonte?`<a href="${esc(e.fonte)}" target="_blank" rel="noopener">Consultar fonte ↗</a>`:''}</div>`).join('')}</details></section>`;syncFooter();
}

function buildMap(id,index,all){
  const element=document.getElementById(id),e=etapas[index];
  if(!window.L){element.innerHTML=`<div class="map-error">O mapa não está disponível.<a href="${osm(e)}" target="_blank" rel="noopener">Consultar no OpenStreetMap ↗</a></div>`;return null;}
  const map=L.map(element,{scrollWheelZoom:false}).setView([e.latitude,e.longitude],16);
  const layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
  let tileWarning=null;
  layer.on('tileerror',()=>{if(!tileWarning){tileWarning=L.control({position:'bottomleft'});tileWarning.onAdd=()=>{const el=L.DomUtil.create('div','tile-warning');el.textContent='Mapa sem ligação. Consultem a lista de paragens.';return el;};tileWarning.addTo(map);}});
  layer.on('tileload',()=>{if(tileWarning){map.removeControl(tileWarning);tileWarning=null;}});
  const items=all?etapas:[e];if(all){routeMarkers=[];L.polyline(etapas.map(e=>[e.latitude,e.longitude]),{color:'#995921',weight:4,dashArray:'6 5',opacity:1}).addTo(map);}
  items.forEach(point=>{const i=point.id-1,done=state&&state.answers[i]!==null;const marker=L.marker([point.latitude,point.longitude],{icon:L.divIcon({className:`map-pin ${i===index?'active':''} ${done?'done':''}`,html:point.id===1&&all&&etapas[0].latitude===etapas.at(-1).latitude&&etapas[0].longitude===etapas.at(-1).longitude?`1/${etapas.length}`:String(point.id),iconSize:all&&point.id===1?[34,34]:[30,30]}),title:`${point.id}. ${point.local}`,alt:`Paragem ${point.id}: ${point.local}`}).addTo(map).bindPopup(`<strong>${point.id}. ${esc(point.local)}</strong><br>${esc(point.localizacao)}<br><a href="${osm(point)}" target="_blank" rel="noopener">Abrir no OpenStreetMap ↗</a>`);if(all){routeMarkers[i]=marker;if(point.id===etapas.length&&point.latitude===etapas[0].latitude&&point.longitude===etapas[0].longitude){map.removeLayer(marker);routeMarkers[i]=routeMarkers[0];}}});
  if(all)map.fitBounds(L.latLngBounds(etapas.map(e=>[e.latitude,e.longitude])),{padding:[30,30]});
  return map;
}

function openMap(focusIndex){
  if(!etapas.length)return;
  const index=Number.isInteger(focusIndex)?focusIndex:state?.index??0;
  $('#route-list').innerHTML=etapas.map((e,i)=>`<li class="${state?.index===i?'current':''} ${state&&state.answers[i]!==null?'done':''}"><span class="route-number">${e.id}</span><button type="button" data-point="${i}">${esc(e.local)}${state?.index===i?' · etapa atual':''}</button><small>≈ ${km(e.distanciaAcumulada)} km</small></li>`).join('');
  if(!$('#map-dialog').open)$('#map-dialog').showModal();
  if(routeMap){routeMap.remove();routeMap=null;}routeMap=buildMap('route-map',index,true);
  requestAnimationFrame(()=>{routeMap?.invalidateSize();if(Number.isInteger(focusIndex)){routeMap?.setView([etapas[index].latitude,etapas[index].longitude],17);routeMarkers[index]?.openPopup();}});
}

document.addEventListener('click',event=>{
  const close=event.target.closest('[data-close]');if(close){close.closest('dialog').close();return;}
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='map')openMap();
  if(action==='info')$('#info-dialog').showModal();
  if(action==='restart')$('#restart-dialog').showModal();
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
    for(const field of ['imagem','foto','fonte','fonteNome','caminho','aviso','categoria'])if(e[field]!=null&&typeof e[field]!=='string')throw new Error(prefix+`${field} deve ser texto.`);
    if(e.fonte&&!/^https?:\/\//i.test(e.fonte))throw new Error(prefix+'a fonte deve começar por https:// ou http://.');
    if(e.imagem&&(!/^images\/[\w/.-]+$/i.test(e.imagem)||e.imagem.includes('..')))throw new Error(prefix+'a imagem deve ser um caminho dentro de images/.');
  });
  if(previous<=0)throw new Error('A distância total deve ser maior do que zero.');
  validateNotebookData(data);
  if(data.creditos!=null){
    if(!Array.isArray(data.creditos))throw new Error('creditos deve ser uma lista.');
    for(const c of data.creditos){
      if(!c||['titulo','autor','licenca'].some(k=>typeof c[k]!=='string')||['fonte','licencaUrl'].some(k=>typeof c[k]!=='string'||!/^https?:\/\//i.test(c[k])))throw new Error('Cada crédito precisa de título, autor, licença e ligações http(s) válidas.');
    }
  }
  return data;
}
function contentFingerprint(data){
  // Só alterações à ordem/locais/perguntas/respostas invalidam respostas antigas.
  const text=JSON.stringify([data.etapas.map(e=>[e.local,e.pergunta,e.respostas,e.correta,e.comica,e.missao]),data.caderno.palavras]);
  let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(16);
}
async function initialize(){
  main.innerHTML='<section class="finish"><p class="eyebrow">MISSÃO COIMBRA</p><h1>A preparar<br><em>o passeio…</em></h1></section>';
  try{
    config=validateData(await readRouteData());
    etapas=config.etapas.map((e,i)=>({...e,id:i+1,respostas:e.respostas.map(r=>r.texto),correta:letters.indexOf(e.correta),foto:e.foto||e.local}));
    TOTAL=etapas.at(-1).distanciaAcumulada;contentKey=contentFingerprint(config);
    document.title=config.titulo+' — um passeio para descobrir em conjunto';
    $('.map-note').textContent=`${km(TOTAL)} km · ${etapas.length} paragens · circuito pedonal`;
    $('#info-knowledge').textContent=`${etapas.filter(e=>!e.comica).length} perguntas`;
    $('#info-comic').textContent=`${etapas.filter(e=>e.comica).length} pausas cómicas`;
    $('#info-distance').textContent=km(TOTAL);
    load();if(state)save();welcome();
  }catch(error){
    console.error('Conteúdo do passeio:',error);
    main.innerHTML=`<section class="finish"><p class="eyebrow">MISSÃO COIMBRA</p><h1>O passeio ainda<br><em>não abriu.</em></h1><p>Não foi possível carregar o conteúdo. Tenta novamente ou verifica o ficheiro dados.json.</p><p class="fine-print">${esc(error.message)}</p><button id="retry-load" class="primary">Tentar novamente</button></section>`;
    $('#retry-load').addEventListener('click',initialize);
  }
}
initialize();

function resumeWalk(){if(state.finishedAt)renderFinish();else if(state.answers.every(a=>a!==null))renderPuzzle();else renderStage();}
