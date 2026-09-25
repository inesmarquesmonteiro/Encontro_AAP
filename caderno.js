'use strict';

// Regras puras: também utilizadas nos testes, sem navegador.
const Puzzle = {
  initial: () => [3, 0, 5, 1, 4, 2],
  validOrder: order => Array.isArray(order) && order.length === 6 && new Set(order).size === 6 && order.every(n => Number.isInteger(n) && n >= 0 && n < 6),
  solved: order => Puzzle.validOrder(order) && order.every((n, i) => n === i),
  swap(order, a, b) {
    if (!Puzzle.validOrder(order) || ![a,b].every(n=>Number.isInteger(n)&&n>=0&&n<6)) throw new Error('Peças inválidas.');
    const next = [...order]; [next[a], next[b]] = [next[b], next[a]]; return next;
  },
  validProgress(s, ids) {
    if (!s.missions || typeof s.missions !== 'object' || Array.isArray(s.missions) || !Puzzle.validOrder(s.puzzleOrder) || typeof s.puzzleSolved !== 'boolean') return false;
    if (!Object.entries(s.missions).every(([id, value]) => ids.includes(id) && ['found', 'helped'].includes(value))) return false;
    if (s.puzzleSolved && (!Puzzle.solved(s.puzzleOrder) || !ids.every(id=>s.missions[id]))) return false;
    return !s.finishedAt || s.puzzleSolved;
  }
};
if (typeof module !== 'undefined') module.exports = Puzzle;

let selectedPiece = null;
function missions() { return etapas.filter(e => e.missao); }
function collected() { return state ? missions().filter(e => state.missions[e.missao.id]).length : 0; }
function missionDone(e) { return !e.missao || Boolean(state?.missions[e.missao.id]); }
function notebookStatus() {
  const button = document.getElementById('notebook-button');
  if (!button) return;
  button.hidden = !state;
  button.querySelector('span').textContent = `Caderno ${collected()}/6`;
}
function notebookIntro() {
  return `<aside class="notebook-intro"><p class="eyebrow">UM PEDDY-PAPER PELA CIDADE</p><h2>${esc(config.caderno.titulo)}</h2><p>${esc(config.caderno.introducao)}</p><p class="fiction-note">Uma história fictícia para descobrir lugares reais.</p><div class="notebook-recipe"><span>12 perguntas</span><span>6 peças escondidas</span><span>1 mensagem final</span></div></aside>`;
}
function missionHTML(e) {
  if (!e.missao) return '';
  const m = e.missao, number = missions().findIndex(x=>x.missao.id===m.id)+1;
  if (missionDone(e)) return `<section class="mission-card found"><p class="eyebrow">PEÇA ${number} DE 6 · RECUPERADA</p><h3>${esc(m.titulo)}</h3><p>${esc(m.explicacao)}</p><div class="found-piece"><span aria-hidden="true">${number.toString().padStart(2,'0')}</span><div><small>Um fragmento da mensagem</small><strong>${esc(config.caderno.palavras[number-1])}</strong></div></div><button class="secondary" data-action="notebook">Ver o meu caderno · ${collected()}/6</button></section>`;
  return `<section class="mission-card" id="mission-card"><p class="eyebrow">OLHA À TUA VOLTA · PEÇA ${number} DE 6</p><h3>${esc(m.titulo)}</h3><p class="mission-instructions">${esc(m.instrucoes)}</p><figure class="clue-photo"><img src="${esc(m.imagem||e.imagem)}" alt="${esc(m.imagemAlt||e.foto)}" loading="lazy"><figcaption>Fotografia de referência · podes observar no local ou usar a imagem.</figcaption></figure><form id="mission-form" data-mission-id="${esc(m.id)}"><fieldset><legend>${esc(m.pergunta)}</legend><div class="options mission-options">${m.respostas.map(r=>`<label class="option"><input type="radio" name="mission-answer" value="${r.letra}"><span class="letter">${r.letra}</span><span class="answer-text">${esc(r.texto)}</span></label>`).join('')}</div></fieldset><button class="primary" type="submit" disabled>Guardar a descoberta <span aria-hidden="true">＋</span></button><p class="mission-status" role="status"></p></form><details class="mission-help"><summary>Dar uma pista</summary><p>${esc(m.dica)}</p><p class="fine-print">Não consegues observar o detalhe ou preferes continuar? Podes descobrir a solução e guardar a peça, sem penalização.</p><button class="secondary" type="button" data-reveal-mission="${esc(m.id)}">Revelar e guardar a peça</button></details></section>`;
}
function collectMission(id, helped) {
  const e = etapas[state?.index];
  if (!e?.missao || e.missao.id !== id || state.answers[state.index] === null) return;
  state.missions[id] = helped ? 'helped' : 'found'; save(); renderStage();
  const card = document.querySelector('.mission-card');card?.scrollIntoView({block:'center',behavior:'smooth'});
  if(card){card.tabIndex=-1;card.focus({preventScroll:true});}
}
function openNotebook() {
  if (!state) return;
  const count = collected();
  document.getElementById('notebook-content').innerHTML = `<p class="notebook-count"><strong>${count}</strong> / 6 peças recuperadas</p><p>Uma fotografia desfeita, seis descobertas pela cidade. A última página abre no regresso às Docas.</p><div class="collection-grid">${missions().map((e,i)=>`<div class="collection-piece ${missionDone(e)?'collected':''}"><span>${String(i+1).padStart(2,'0')}</span><strong>${missionDone(e)?esc(config.caderno.palavras[i]):'Por descobrir'}</strong><small>${esc(e.local)}</small></div>`).join('')}</div>${state.puzzleSolved?`<div class="notebook-message"><p class="eyebrow">A MENSAGEM DO CADERNO</p><h3>${esc(config.caderno.palavras.join(' '))}</h3></div>`:'<p class="fine-print">As peças são guardadas neste telemóvel. Procurem em conjunto; não há pontos nem ordem de chegada.</p>'}`;
  document.getElementById('notebook-dialog').showModal();
}
function renderPuzzle() {
  if (!state || state.answers.some(a=>a===null)) return;
  cleanupMap(); selectedPiece=null;
  if (collected()!==6) {
    main.innerHTML='<section class="finish"><h1>Falta uma página.</h1><p>Recupera as peças do caderno antes de montar a fotografia.</p><button class="primary" id="recover-mission">Voltar à descoberta em falta</button></section>';
    document.getElementById('recover-mission').onclick=()=>{
      const e=missions().find(e=>!missionDone(e));state.index=e.id-1;save();renderStage();moveFocus();
    };return;
  }
  main.innerHTML=`<section class="puzzle-page fade-in"><div class="puzzle-heading"><p class="eyebrow">DOCAS DO MONDEGO · A ÚLTIMA PÁGINA</p><h1>As peças voltam<br>a <em>encontrar-se.</em></h1><p>Recuperaste as seis peças. Junta a fotografia e lê a mensagem que o estudante deixou no caderno.</p></div><div class="puzzle-surface"><p class="puzzle-instruction" id="puzzle-instruction">Toca numa peça e depois noutra para trocar as duas de lugar.</p><div id="puzzle-board" class="puzzle-board" role="group" aria-label="Puzzle de seis peças, três colunas e duas linhas"></div><p id="puzzle-status" class="puzzle-status" role="status" aria-live="polite"></p><div class="puzzle-toolbar"><button class="secondary" data-action="notebook">O meu caderno</button><details><summary>Uma ajuda?</summary><p>${esc(config.caderno.dicaFinal)}</p><figure class="puzzle-reference"><img src="${esc(config.caderno.imagemFinal)}" alt="${esc(config.caderno.imagemAlt)}"><figcaption>Fotografia completa, para ajudar a juntar as peças.</figcaption></figure><button class="secondary" id="solve-puzzle">Montar com ajuda</button></details></div><div id="puzzle-reveal" hidden><p class="eyebrow">A MENSAGEM ESTAVA NO CAMINHO</p><h2>${esc(config.caderno.palavras.join(' '))}</h2><p>${esc(config.caderno.mensagemFinal)}</p><button class="primary" id="complete-notebook">Fechar o caderno · terminar passeio ${arrow}</button></div></div><p class="elapsed-line">Tempo decorrido <strong data-elapsed>${elapsedTime()}</strong></p><p class="fine-print puzzle-caption">Narrativa fictícia · fotografia real de Coimbra · sem pontuação.</p></section>`;
  paintPuzzle();
  document.getElementById('solve-puzzle').onclick=()=>{state.puzzleOrder=[0,1,2,3,4,5];state.puzzleSolved=true;save();selectedPiece=null;paintPuzzle();};
  document.getElementById('complete-notebook').onclick=()=>{if(!state.puzzleSolved)return;state.finishedAt=Date.now();save();renderFinish();moveFocus();};
  syncFooter();
}
function paintPuzzle() {
  const board=document.getElementById('puzzle-board');if(!board)return;
  board.innerHTML=state.puzzleOrder.map((piece,position)=>`<button type="button" class="puzzle-tile ${selectedPiece===position?'selected':''}" data-piece-position="${position}" aria-pressed="${selectedPiece===position}" aria-label="Posição ${position+1}: ${esc(config.caderno.palavras[piece])}. ${state.puzzleSolved?'Peça colocada.':'Selecionar para trocar.'}" ${state.puzzleSolved?'disabled':''} style="background-image:url('${esc(config.caderno.imagemFinal)}');background-position:${(piece%3)*50}% ${Math.floor(piece/3)*100}%"><span>${esc(config.caderno.palavras[piece])}</span></button>`).join('');
  document.getElementById('puzzle-instruction').textContent=state.puzzleSolved?'A fotografia está completa. A mensagem também.':selectedPiece===null?'Toca numa peça e depois noutra para trocar as duas de lugar.':`Peça na posição ${selectedPiece+1} selecionada. Escolhe a peça com que queres trocar.`;
  document.getElementById('puzzle-reveal').hidden=!state.puzzleSolved;
  document.getElementById('solve-puzzle').disabled=state.puzzleSolved;
  if(state.puzzleSolved)document.getElementById('puzzle-status').textContent='Caderno reconstruído! Descobre a mensagem abaixo.';
}
function handleNotebookClick(event) {
  if(event.target.closest('[data-action="notebook"]'))openNotebook();
  const reveal=event.target.closest('[data-reveal-mission]');if(reveal)collectMission(reveal.dataset.revealMission,true);
  const tile=event.target.closest('[data-piece-position]');
  if(!tile||!state||state.puzzleSolved)return;
  const position=Number(tile.dataset.piecePosition);
  if(selectedPiece===null){selectedPiece=position;paintPuzzle();}
  else if(selectedPiece===position){selectedPiece=null;paintPuzzle();}
  else{state.puzzleOrder=Puzzle.swap(state.puzzleOrder,selectedPiece,position);selectedPiece=null;state.puzzleSolved=Puzzle.solved(state.puzzleOrder);save();paintPuzzle();if(!state.puzzleSolved)document.getElementById('puzzle-status').textContent='Peças trocadas. Continua a juntar a fotografia e a frase.';}
  document.querySelector(`[data-piece-position="${position}"]`)?.focus({preventScroll:true});
}
function validateNotebookData(data) {
  const c=data.caderno, all=data.etapas.filter(e=>e.missao);
  const imageOk=s=>typeof s==='string'&&/^images\/[\w/.-]+$/.test(s)&&!s.includes('..');
  if(!c||!Array.isArray(c.palavras)||c.palavras.length!==6||!c.palavras.every(w=>typeof w==='string'&&w.trim()))throw new Error('O caderno precisa de seis palavras ou fragmentos.');
  if(!imageOk(c.imagemFinal))throw new Error('Indica uma imagemFinal do caderno dentro de images/.');
  for(const key of ['titulo','introducao','imagemAlt','dicaFinal','mensagemFinal'])if(typeof c[key]!=='string'||!c[key].trim())throw new Error(`Preenche caderno.${key}.`);
  if(all.length!==6)throw new Error('Distribui as seis missões do caderno por seis etapas.');
  const ids=new Set();all.forEach(e=>{const m=e.missao;if(typeof m.id!=='string'||!/^[-a-z0-9]+$/.test(m.id)||ids.has(m.id))throw new Error('Cada missão precisa de um id único.');ids.add(m.id);
    for(const field of ['titulo','instrucoes','pergunta','dica','explicacao'])if(typeof m[field]!=='string'||!m[field].trim())throw new Error(`Preenche missao.${field} em ${e.local}.`);
    if(!Array.isArray(m.respostas)||m.respostas.length!==4||!m.respostas.every((r,i)=>r.letra==='ABCD'[i]&&typeof r.texto==='string'&&r.texto.trim())||!'ABCD'.split('').includes(m.correta))throw new Error(`A missão de ${e.local} precisa de opções A–D e uma correta.`);
    if(m.imagem&&!imageOk(m.imagem))throw new Error('Imagem de missão inválida.');
  });
}
if(typeof document!=='undefined'){
  document.addEventListener('click',handleNotebookClick);
  document.addEventListener('change',event=>{if(event.target.name==='mission-answer'){event.target.closest('form').querySelector('button[type="submit"]').disabled=false;}});
  document.addEventListener('submit',event=>{
    if(event.target.id!=='mission-form')return;event.preventDefault();const m=etapas[state.index].missao;
    const answer=new FormData(event.target).get('mission-answer');if(!answer)return;
    if(answer===m.correta)collectMission(m.id,false);
    else{const status=event.target.querySelector('.mission-status');status.textContent='Olha mais uma vez. Podes tentar de novo ou pedir uma pista.';status.tabIndex=-1;status.focus({preventScroll:true});}
  });
}
