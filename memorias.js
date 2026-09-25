'use strict';
// Fotografias privadas: apenas IndexedDB neste navegador, nunca enviadas.
const Memories = (() => {
  const volatile = new Map();
  let dbPromise, urls=[], revision=0, busy=false;
  const trip = () => state ? `${contentKey}:${state.startedAt}` : '';
  const key = i => `${trip()}:${i}`;
  const el = id => document.getElementById(id);
  function database(){
    if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open('coimbra-memorias',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'id'});
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Armazenamento ocupado.'));
    }).catch(error=>{dbPromise=null;throw error;});
    return dbPromise;
  }
  async function records(){
    let saved=[];
    try{const db=await database();saved=await new Promise((resolve,reject)=>{const r=db.transaction('photos').objectStore('photos').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}catch{}
    const map=new Map(saved.filter(r=>r.trip===trip()).map(r=>[r.id,r]));
    for(const [id,r] of volatile)if(r.trip===trip())map.set(id,r);
    return [...map.values()].filter(r=>!r.deleted).sort((a,b)=>a.index-b.index);
  }
  async function store(record,remove=false){
    volatile.set(record.id,remove?{...record,deleted:true}:record);
    try{
      const db=await database();
      await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');const s=tx.objectStore('photos');if(remove)s.delete(record.id);else s.put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
      volatile.delete(record.id);return true;
    }catch{return false;}
  }
  function image(blob){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Não foi possível abrir esta imagem. Experimenta JPEG ou PNG.'));};img.src=url;});}
  function blob(canvas,type='image/jpeg',quality=.86){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível preparar a imagem.')),type,quality));}
  async function compress(file){
    if(file.size>30*1024*1024)throw new Error('A fotografia é demasiado grande. Escolhe uma imagem com menos de 30 MB.');
    if(file.type&&!file.type.startsWith('image/'))throw new Error('Escolhe uma fotografia.');
    const img=await image(file),scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(img,0,0,canvas.width,canvas.height);return blob(canvas);
  }
  function clearURLs(){urls.forEach(u=>URL.revokeObjectURL(u));urls=[];}
  function url(b){const u=URL.createObjectURL(b);urls.push(u);return u;}
  function stageHTML(){return `<aside class="memory-stop"><p class="eyebrow">UMA REDE DE MEMÓRIAS</p><h3>Este lugar, pelo teu olhar.</h3><p>Guarda uma fotografia para o teu postal de Coimbra.</p><button type="button" class="secondary" data-action="memories">Guardar uma memória</button><small>Opcional · podes continuar sem fotografia.</small></aside>`;}
  function open(){
    if(!state)return;
    if(!el('memories-dialog')){
      const dialog=document.createElement('dialog');dialog.id='memories-dialog';dialog.className='memories-dialog';dialog.setAttribute('aria-labelledby','memories-title');
      dialog.innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">O TEU POSTAL DO PASSEIO</p><h2 id="memories-title">Coimbra — uma rede de memórias</h2></div><button class="icon-button" data-close aria-label="Fechar fotografias">×</button></div><p>Os lugares ligam-se. As memórias ficam contigo.</p><label class="file-label" for="photo-stop">Local da fotografia</label><select id="photo-stop"></select><div class="memory-actions"><label class="secondary photo-pick">Tirar fotografia<input id="photo-camera" type="file" accept="image/*" capture="environment"></label><label class="secondary photo-pick">Escolher da galeria<input id="photo-gallery" type="file" accept="image/*"></label></div><p class="fine-print">Uma fotografia por paragem. Adicionar outra substitui a anterior. As fotografias ficam apenas neste navegador; descarrega o cartão para conservar a recordação.</p><p id="photo-status" role="status" aria-live="polite"></p><div class="memory-selection"><h3>Escolhe até seis fotografias</h3><span id="photo-count"></span></div><div id="photo-list" class="photo-list"></div><button id="make-postcard" class="primary" type="button">Criar o meu cartão</button><p class="fine-print">Podes criar uma prévia durante o passeio ou o cartão final quando terminares.</p><div id="postcard-output" hidden><img id="postcard-preview" alt="Postal de Coimbra com as fotografias escolhidas ligadas numa rede de memórias"><a id="download-postcard" class="primary" download="coimbra-rede-de-memorias.png">Descarregar cartão</a><a id="open-postcard" class="text-button" target="_blank" rel="noopener">Abrir imagem para guardar</a><p class="fine-print">Também podes manter o dedo sobre a imagem e escolher guardar.</p></div>`;
      document.body.append(dialog);
      for(const id of ['photo-camera','photo-gallery'])el(id).addEventListener('change',addPhoto);
      el('make-postcard').addEventListener('click',makeCard);
      dialog.addEventListener('close',()=>{revision++;clearURLs();el('postcard-output').hidden=true;});
      el('photo-list').addEventListener('change',selectPhoto);
      el('photo-list').addEventListener('click',removePhoto);
    }
    el('photo-stop').innerHTML=etapas.map((e,i)=>`<option value="${i}">${i+1}. ${esc(e.local)}</option>`).join('');el('photo-stop').value=String(state.index);
    el('photo-status').textContent='';el('memories-dialog').showModal();refresh();
  }
  function status(message){el('photo-status').textContent=message;}
  function lock(value){busy=value;el('make-postcard').disabled=value;el('photo-stop').disabled=value;for(const id of ['photo-camera','photo-gallery'])el(id).disabled=value;el('photo-list').querySelectorAll('button,input').forEach(e=>e.disabled=value);}
  async function refresh(){
    const version=++revision,photos=await records();if(version!==revision||!el('memories-dialog').open)return;
    clearURLs();el('postcard-output').hidden=true;
    el('photo-count').textContent=`${photos.filter(p=>p.selected).length} / 6 escolhidas`;
    el('photo-list').innerHTML=photos.length?photos.map(p=>`<article class="memory-thumb"><img src="${url(p.blob)}" alt="A tua fotografia em ${esc(etapas[p.index].local)}"><label><input type="checkbox" data-select-photo="${p.index}" ${p.selected?'checked':''}>${esc(etapas[p.index].local)}</label><button type="button" class="text-button" data-remove-photo="${p.index}">Remover fotografia</button></article>`).join(''):'<p class="fine-print">Ainda não há fotografias. O cartão também pode ser criado só com o roteiro.</p>';
  }
  async function addPhoto(event){
    const file=event.target.files[0];event.target.value='';if(!file||busy)return;
    const index=Number(el('photo-stop').value),currentTrip=trip(),id=key(index);lock(true);status('A preparar a fotografia…');
    try{
      const compressed=await compress(file);if(trip()!==currentTrip)return;
      const photos=await records(),previous=photos.find(p=>p.id===id);
      const saved=await store({id,trip:currentTrip,index,blob:compressed,selected:previous?previous.selected:photos.filter(p=>p.selected).length<6});
      await refresh();status(saved?'Fotografia guardada neste dispositivo.':'Fotografia disponível só nesta sessão: não foi possível guardá-la no navegador. Descarrega o cartão antes de fechar.');
    }catch(error){status(error.message);}finally{lock(false);}
  }
  async function selectPhoto(event){
    const input=event.target;if(!input.matches('[data-select-photo]')||busy)return;lock(true);
    try{const photos=await records(),p=photos.find(p=>p.index===Number(input.dataset.selectPhoto));if(!p)return;
      if(input.checked&&photos.filter(p=>p.selected).length>=6){input.checked=false;status('Escolhe no máximo seis fotografias. Desmarca uma para escolher outra.');return;}
      p.selected=input.checked;const saved=await store(p);await refresh();status(saved?'Seleção atualizada.':'Seleção atualizada apenas nesta sessão.');
    }finally{lock(false);}
  }
  async function removePhoto(event){
    const button=event.target.closest('[data-remove-photo]');if(!button||busy)return;lock(true);
    try{const p=(await records()).find(p=>p.index===Number(button.dataset.removePhoto));if(p){const saved=await store(p,true);await refresh();status(saved?'Fotografia removida deste passeio.':'Removida nesta sessão; não foi possível atualizar o armazenamento.');}}finally{lock(false);}
  }
  function line(ctx,points,color,width=3){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
  function text(ctx,value,x,y,max,size=24,color='#183f36',family='sans-serif'){
    ctx.fillStyle=color;ctx.font=`${size}px ${family}`;
    while(ctx.measureText(value).width>max&&size>14){size--;ctx.font=`${size}px ${family}`;}ctx.fillText(value,x,y,max);
  }
  function cover(ctx,img,x,y,w,h){const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),sw=w/scale,sh=h/scale;ctx.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,x,y,w,h);}
  async function makeCard(){
    if(busy)return;lock(true);status('A desenhar a tua rede de memórias…');
    const version=revision;
    try{
      const chosen=(await records()).filter(p=>p.selected).slice(0,6);
      const images=await Promise.all(chosen.map(p=>image(p.blob)));
      const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=1920;const c=canvas.getContext('2d');
      c.fillStyle='#f8f5ec';c.fillRect(0,0,1440,1920);
      // Azulejos geométricos e silhueta desenhados localmente; sem imagens externas.
      for(let x=30;x<1440;x+=60){line(c,[[x,24],[x+20,44],[x,64],[x-20,44],[x,24]],'#8bb4b7',2);line(c,[[x,1860],[x+20,1880],[x,1900],[x-20,1880],[x,1860]],'#8bb4b7',2);}
      text(c,'COIMBRA',80,178,1280,88,'#183f36','Georgia');text(c,'UMA REDE DE MEMÓRIAS',84,232,1280,26);
      const date=new Date(state.startedAt).toLocaleDateString('pt-PT');
      text(c,`${date}  ·  ${km(TOTAL)} km de roteiro  ·  ${elapsedTime()} decorridos`,84,285,1250,25);
      text(c,state.finishedAt?'Do Mondego à Alta. E de volta.':'O passeio continua · cartão em construção',84,327,1250,22,'#63716a');
      // Torre da Universidade, telhados e arcos sobre uma linha do Mondego.
      line(c,[[800,215],[835,215],[835,174],[885,150],[935,174],[935,215],[973,215],[973,125],[987,125],[987,93],[1012,76],[1037,93],[1037,125],[1051,125],[1051,215],[1100,215],[1100,180],[1150,155],[1200,180],[1200,215],[1350,215]],'#91a99a',3);
      c.strokeStyle='#91a99a';c.beginPath();c.arc(1012,145,12,0,Math.PI*2);c.stroke();line(c,[[1012,145],[1012,135]],'#91a99a',2);
      for(let i=0;i<6;i++){c.beginPath();c.arc(875+i*78,255,27,Math.PI,0);c.stroke();}
      line(c,[[800,275],[900,280],[1000,274],[1110,285],[1230,278],[1350,286]],'#8bb4b7',3);
      const imageByStop=new Map(chosen.map((p,i)=>[p.index,images[i]]));
      const slots=[...chosen];
      for(const index of [...new Set([0,2,3,5,7,10,...etapas.map((_,i)=>i)])]){if(slots.length>=6)break;if(etapas[index]&&!slots.some(p=>p.index===index))slots.push({index});}
      slots.sort((a,b)=>a.index-b.index);
      const centers=slots.map((_,i)=>[i%2?1060:380,465+Math.floor(i/2)*400]);
      const routePoints=[];for(let row=0;row<Math.ceil(slots.length/2);row++){const a=row*2,b=a+1;if(row%2){if(centers[b])routePoints.push(centers[b]);routePoints.push(centers[a]);}else{routePoints.push(centers[a]);if(centers[b])routePoints.push(centers[b]);}}
      line(c,routePoints,'#b59a59',5);
      slots.forEach((p,i)=>{
        const [cx,cy]=centers[i],x=cx-280,y=cy+24;
        c.fillStyle='#183f36';c.beginPath();c.arc(cx,cy,13,0,Math.PI*2);c.fill();c.fillStyle='#edce91';c.beginPath();c.arc(cx,cy,5,0,Math.PI*2);c.fill();
        c.fillStyle='#fff';c.fillRect(x-8,y-8,576,302);
        if(imageByStop.has(p.index))cover(c,imageByStop.get(p.index),x,y,560,240);else{c.fillStyle='#e7ece2';c.fillRect(x,y,560,240);text(c,String(p.index+1).padStart(2,'0'),x+220,y+153,160,90,'#90a18b','Georgia');}
        text(c,`${String(p.index+1).padStart(2,'0')} · ${etapas[p.index].local}`,x+10,y+276,535,23);
      });
      text(c,'Os lugares ligam-se. As memórias ficam contigo.',80,1730,1280,36,'#183f36','Georgia');
      text(c,'E-REDES · Coimbra, em boa companhia',80,1780,1280,24,'#63716a');
      const output=await blob(canvas,'image/png');if(version!==revision||!el('memories-dialog').open)return;
      const outputURL=url(output);el('postcard-preview').src=outputURL;el('download-postcard').href=outputURL;el('open-postcard').href=outputURL;el('postcard-output').hidden=false;status('Cartão pronto. Descarrega-o para guardar a recordação.');el('postcard-output').scrollIntoView({block:'start',behavior:'smooth'});
    }catch(error){status('Não foi possível criar o cartão. '+error.message);}finally{lock(false);}
  }
  if(typeof document!=='undefined')document.addEventListener('click',e=>{if(e.target.closest('[data-action="memories"]'))open();});
  return {stageHTML,open};
})();
