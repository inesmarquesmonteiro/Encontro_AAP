'use strict';
// Fotografias privadas: apenas IndexedDB neste navegador, nunca enviadas.
const Memories = (() => {
  const volatile = new Map();
  let dbPromise, urls=[], busy=false, onChange=()=>{};
  const trip = () => state ? `${contentKey}:${state.startedAt}` : '';
  const key = i => `${trip()}:${i}`;
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

  // Bloco de fotografia de uma paragem: guardar é imediato, sem criar o cartão.
  const camera='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  function slotHTML(index,record){
    const name=esc(etapas[index].local);
    if(record)return `<div class="photo-saved"><img src="${url(record.blob)}" alt="A tua fotografia em ${name}"><div><p><strong>Fotografia guardada</strong>Vai entrar no teu cartão final.</p><div class="photo-tools"><label class="chip">Trocar<input class="visually-hidden" type="file" accept="image/*" data-photo-for="${index}"></label><button type="button" class="chip" data-remove-photo="${index}">Remover</button></div></div></div>`;
    return `<label class="photo-cta">${camera}<span><strong>Tirar fotografia</strong><small>Opcional · fica para o cartão final</small></span><input class="visually-hidden" type="file" accept="image/*" capture="environment" data-photo-for="${index}"></label><label class="gallery-link">ou escolher da galeria<input class="visually-hidden" type="file" accept="image/*" data-photo-for="${index}"></label>`;
  }
  async function paintSlot(index){
    const slot=document.querySelector(`[data-photo-slot="${index}"]`);if(!slot)return;
    const record=(await records()).find(r=>r.index===index);
    const body=slot.querySelector('.photo-body');if(body)body.innerHTML=slotHTML(index,record);
  }
  function status(index,message){const el=document.querySelector(`[data-photo-slot="${index}"] .photo-status`);if(el)el.textContent=message;}
  async function addPhoto(input){
    const file=input.files[0],index=Number(input.dataset.photoFor);input.value='';if(!file||busy)return;
    busy=true;const currentTrip=trip();status(index,'A guardar a fotografia…');
    try{
      const compressed=await compress(file);if(trip()!==currentTrip)return;
      const saved=await store({id:key(index),trip:currentTrip,index,blob:compressed});
      await paintSlot(index);status(index,saved?'':'Guardada só nesta sessão: o navegador não permite guardar. Mantém a página aberta.');onChange(index);
    }catch(error){status(index,error.message);}finally{busy=false;}
  }
  async function removePhoto(index){
    if(busy)return;busy=true;
    try{const r=(await records()).find(r=>r.index===index);if(r){await store(r,true);await paintSlot(index);onChange(index);}}finally{busy=false;}
  }
  if(typeof document!=='undefined'){
    document.addEventListener('change',e=>{if(e.target.matches?.('[data-photo-for]'))addPhoto(e.target);});
    document.addEventListener('click',e=>{const b=e.target.closest?.('[data-remove-photo]');if(b)removePhoto(Number(b.dataset.removePhoto));});
  }

  // ——— Cartão final: a rede elétrica de Coimbra, com uma fotografia em cada nó ———
  const W=1080,H=1920,NET_TOP=400,NET_BOTTOM=1400,LABEL=52,NIGHT='#0a211d',GOLD='#f4c761',CREAM='#fbf3df';
  function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function cover(c,img,x,y,w,h){const s=Math.max(w/img.naturalWidth,h/img.naturalHeight),sw=w/s,sh=h/s;c.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,x,y,w,h);}
  function fit(c,value,max,size,style){c.font=`${style} ${size}px ${FONT}`;while(c.measureText(value).width>max&&size>12){size--;c.font=`${style} ${size}px ${FONT}`;}return size;}
  let FONT='sans-serif';
  const SERIF=`"DM Serif Display", Georgia, serif`;
  // Projeção simples das coordenadas reais; o Mondego segue a margem direita.
  const RIVER=[[40.2135,-8.4345],[40.2100,-8.4322],[40.2072,-8.4307],[40.2045,-8.4288],[40.2022,-8.4262],[40.2000,-8.4222],[40.1985,-8.4170]];
  // Cada nó ocupa o círculo e a etiqueta por baixo; afastam-se sem perder a geografia.
  function layout(radii,labels,box){
    const lat0=etapas[0].latitude,k=Math.cos(lat0*Math.PI/180);
    const raw=etapas.map(e=>[(e.longitude)*k,-e.latitude]);
    const xs=raw.map(p=>p[0]),ys=raw.map(p=>p[1]),minX=Math.min(...xs),minY=Math.min(...ys);
    const bw=Math.max(...xs)-minX||1e-6,bh=Math.max(...ys)-minY||1e-6,s=Math.min(box.w/bw,box.h/bh);
    const ox=box.x+(box.w-bw*s)/2,oy=box.y+(box.h-bh*s)/2;
    const project=(lat,lon)=>[ox+(lon*k-minX)*s,oy+(-lat-minY)*s];
    const home=etapas.map(e=>project(e.latitude,e.longitude));
    home.forEach((p,i)=>home.slice(0,i).forEach(q=>{if(Math.hypot(p[0]-q[0],p[1]-q[1])<1){p[0]+=40;p[1]+=30;}}));
    const pts=home.map(p=>[...p]),gap=18;
    const rect=i=>{const [x,y]=pts[i],r=radii[i],half=Math.max(r,labels[i]/2);return [x-half,y-r,x+half,y+r+LABEL];};
    for(let it=0;it<900;it++){const pull=it<700?.01:0;
      for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
        const a=rect(i),b=rect(j),ox2=Math.min(a[2],b[2])-Math.max(a[0],b[0])+gap,oy2=Math.min(a[3],b[3])-Math.max(a[1],b[1])+gap;
        if(ox2<=0||oy2<=0)continue;
        if(ox2<oy2*.5){const dir=pts[j][0]>=pts[i][0]?1:-1;pts[i][0]-=dir*ox2/2;pts[j][0]+=dir*ox2/2;}
        else{const dir=pts[j][1]>=pts[i][1]?1:-1;pts[i][1]-=dir*oy2/2;pts[j][1]+=dir*oy2/2;}
      }
      pts.forEach((p,i)=>{p[0]+=(home[i][0]-p[0])*pull;p[1]+=(home[i][1]-p[1])*pull;const r=radii[i],half=Math.max(r,labels[i]/2);p[0]=Math.min(W-30-half,Math.max(30+half,p[0]));p[1]=Math.min(NET_BOTTOM-r-LABEL,Math.max(NET_TOP+r,p[1]));});
    }
    return {pts,project};
  }
  function curve(c,a,b,sag,offset=0){
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len*offset,ny=dx/len*offset;
    const cx=(a[0]+b[0])/2+nx,cy=(a[1]+b[1])/2+ny+sag;
    c.beginPath();c.moveTo(a[0]+nx,a[1]+ny);c.quadraticCurveTo(cx,cy,b[0]+nx,b[1]+ny);
    return t=>[(1-t)*(1-t)*(a[0]+nx)+2*(1-t)*t*cx+t*t*(b[0]+nx),(1-t)*(1-t)*(a[1]+ny)+2*(1-t)*t*cy+t*t*(b[1]+ny)];
  }
  function pylon(c,x,y){
    c.save();c.strokeStyle='rgba(244,199,97,.75)';c.lineWidth=2.5;c.beginPath();
    c.moveTo(x-16,y+62);c.lineTo(x,y-6);c.lineTo(x+16,y+62);
    c.moveTo(x-20,y+4);c.lineTo(x+20,y+4);c.moveTo(x-14,y+22);c.lineTo(x+14,y+22);
    c.moveTo(x-11,y+14);c.lineTo(x+9,y+34);c.moveTo(x+11,y+14);c.lineTo(x-9,y+34);
    c.moveTo(x-8,y+36);c.lineTo(x+13,y+58);c.moveTo(x+8,y+36);c.lineTo(x-13,y+58);c.stroke();c.restore();
  }
  function bolt(c,x,y,s,color){c.fillStyle=color;c.beginPath();[[.1,-1],[-.55,.15],[-.05,.15],[-.2,1],[.55,-.2],[.05,-.2],[.25,-1]].forEach(([px,py],i)=>i?c.lineTo(x+px*s,y+py*s):c.moveTo(x+px*s,y+py*s));c.closePath();c.fill();}
  function skyline(c,random){
    const base=1840,hill=x=>base-24-80*Math.exp(-(((x-600)/300)**2))-14*Math.exp(-(((x-150)/150)**2));
    const shapes=[];
    for(let x=-10;x<W+10;){const w=30+random()*40,h=26+random()*52;shapes.push({x,w,h,top:hill(x+w/2)-h,roof:random()>.5});x+=w-2;}
    c.fillStyle='#06140f';
    c.beginPath();c.moveTo(0,H);for(let x=0;x<=W;x+=10)c.lineTo(x,hill(x)+8);c.lineTo(W,H);c.fill();
    shapes.forEach(s=>{c.beginPath();c.moveTo(s.x,base+40);c.lineTo(s.x,s.top);if(s.roof)c.lineTo(s.x+s.w/2,s.top-16);c.lineTo(s.x+s.w,s.top);c.lineTo(s.x+s.w,base+40);c.fill();});
    // Paço das Escolas, Torre da Universidade e Sé Velha, em silhueta.
    const t=hill(600);c.fillRect(480,t-80,250,120);c.fillRect(584,t-140,40,100);c.fillRect(577,t-150,54,12);
    c.beginPath();c.arc(604,t-150,15,Math.PI,0);c.fill();c.fillRect(602,t-184,4,24);
    c.fillRect(310,hill(360)-96,110,130);for(let i=0;i<6;i++)c.fillRect(310+i*19,hill(360)-110,11,16);
    c.fillStyle=GOLD;c.globalAlpha=.9;c.beginPath();c.arc(604,t-118,8,0,Math.PI*2);c.fill();
    // Janelas acesas: a cidade ligada.
    [...shapes,{x:480,w:250,top:t-80},{x:584,w:40,top:t-140},{x:310,w:110,top:hill(360)-96}].forEach(s=>{
      for(let y=s.top+14;y<base-4;y+=22)for(let x=s.x+8;x<s.x+s.w-12;x+=18){if(random()<.28){c.globalAlpha=.45+random()*.5;c.fillRect(x,y,7,10);}}
    });
    c.globalAlpha=1;
    const water=c.createLinearGradient(0,base,0,H);water.addColorStop(0,'#0d3531');water.addColorStop(1,'#061712');c.fillStyle=water;c.fillRect(0,base,W,H-base);
    c.fillStyle=GOLD;for(let i=0;i<46;i++){c.globalAlpha=.15+random()*.35;c.fillRect(random()*W,base+8+random()*(H-base-16),14+random()*40,2);}c.globalAlpha=1;
  }
  async function draw(){
    try{await Promise.all([document.fonts.load(`150px ${SERIF}`),document.fonts.load(`italic 60px ${SERIF}`),document.fonts.load('600 24px "DM Sans"')]);if(document.fonts.check('600 24px "DM Sans"'))FONT='"DM Sans", system-ui, sans-serif';}catch{}
    const photos=await records(),byStop=new Map();
    await Promise.all(photos.map(async p=>{try{byStop.set(p.index,await image(p.blob));}catch{}}));
    const random=rng(state.startedAt|0);
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');
    const bg=c.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#123a33');bg.addColorStop(.55,NIGHT);bg.addColorStop(1,'#071814');c.fillStyle=bg;c.fillRect(0,0,W,H);
    c.fillStyle='rgba(251,243,223,.07)';for(let y=24;y<1600;y+=36)for(let x=24;x<W;x+=36)c.fillRect(x,y,2,2);
    // Cabeçalho
    const date=new Date(state.finishedAt||Date.now()).toLocaleDateString('pt-PT',{day:'numeric',month:'long',year:'numeric'});
    c.textAlign='center';c.fillStyle=GOLD;fit(c,`COIMBRA EM REDE  ·  ${date.toUpperCase()}`,900,26,'700');c.fillText(`COIMBRA EM REDE  ·  ${date.toUpperCase()}`,W/2,118);
    c.fillStyle=CREAM;c.font=`150px ${SERIF}`;c.fillText('Coimbra',W/2,262);
    c.fillStyle=GOLD;c.font=`italic 54px ${SERIF}`;c.fillText('a energia que nos liga',W/2,334);
    // Rede
    const radius=byStop.size>8?78:88,radii=etapas.map((_,i)=>byStop.has(i)?radius:44);
    const names=etapas.map(e=>e.local.split(' · ')[0]);
    const labels=names.map(n=>{const size=fit(c,n,230,22,'600');c.font=`600 ${size}px ${FONT}`;return c.measureText(n).width+24;});
    const {pts,project}=layout(radii,labels,{x:170,y:450,w:820,h:840});
    const river=RIVER.map(([la,lo])=>project(la,lo));
    c.save();c.beginPath();c.rect(0,NET_TOP-20,W,NET_BOTTOM-NET_TOP+20);c.clip();
    c.lineCap='round';c.lineJoin='round';
    const riverPath=()=>{c.beginPath();c.moveTo(...river[0]);for(let i=1;i<river.length-1;i++){const mx=(river[i][0]+river[i+1][0])/2,my=(river[i][1]+river[i+1][1])/2;c.quadraticCurveTo(river[i][0],river[i][1],mx,my);}c.lineTo(...river.at(-1));};
    riverPath();c.strokeStyle='rgba(38,110,112,.55)';c.lineWidth=90;c.stroke();
    riverPath();c.strokeStyle='rgba(120,190,190,.35)';c.lineWidth=2;c.setLineDash([2,16]);c.stroke();c.setLineDash([]);
    // O nome do rio fica no troço mais afastado dos nós.
    const spots=river.slice(0,-1).flatMap((a,i)=>{const b=river[i+1];return [.25,.5,.75].map(t=>({x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,angle:Math.atan2(b[1]-a[1],b[0]-a[0])}));}).filter(q=>q.x>90&&q.x<W-90&&q.y>NET_TOP+70&&q.y<NET_BOTTOM-70);
    const clearance=q=>Math.min(...pts.map((p,i)=>Math.max(Math.abs(p[0]-q.x)-Math.max(radii[i],labels[i]/2),p[1]-radii[i]-q.y,q.y-p[1]-radii[i]-LABEL)));
    const spot=spots.reduce((best,q)=>!best||clearance(q)>clearance(best)?q:best,null);
    if(spot){let angle=spot.angle;if(Math.abs(angle)>Math.PI/2)angle+=Math.PI;c.save();c.translate(spot.x,spot.y);c.textAlign='center';c.rotate(angle);c.fillStyle='rgba(190,230,225,.7)';c.font=`italic 30px ${SERIF}`;c.fillText('Mondego',0,10);c.restore();}
    c.restore();
    // Linhas de energia entre paragens consecutivas, a fechar o circuito.
    const edges=pts.map((p,i)=>[p,pts[(i+1)%pts.length],i]);
    c.save();c.shadowColor='rgba(244,199,97,.85)';c.shadowBlur=18;
    for(const [a,b] of edges){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),sag=Math.min(60,len*.12);for(const off of [-5,5]){curve(c,a,b,sag,off);c.strokeStyle='rgba(244,199,97,.9)';c.lineWidth=2.5;c.stroke();}}
    c.restore();
    for(const [a,b,i] of edges){
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<radii[i]+radii[(i+1)%pts.length]+40)continue;
      const at=curve(c,a,b,Math.min(60,len*.12));
      c.save();c.shadowColor=CREAM;c.shadowBlur=14;c.fillStyle='#fffbe9';
      const steps=Math.floor(len/46);for(let s=1;s<steps;s++){const [x,y]=at(s/steps);if(Math.hypot(x-a[0],y-a[1])>radii[i]+8&&Math.hypot(x-b[0],y-b[1])>radii[(i+1)%pts.length]+8){c.beginPath();c.arc(x,y,s%3?2.5:4.5,0,Math.PI*2);c.fill();}}
      c.restore();
      if(len>260){const [x,y]=at(.5);pylon(c,x,y);}
    }
    // Nós: fotografias como subestações da rede.
    pts.forEach(([x,y],i)=>{
      const r=radii[i],img=byStop.get(i);
      c.save();c.shadowColor='rgba(244,199,97,.9)';c.shadowBlur=img?40:22;c.fillStyle=img?CREAM:'#123a33';c.beginPath();c.arc(x,y,r+(img?8:0),0,Math.PI*2);c.fill();c.restore();
      if(img){c.save();c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip();cover(c,img,x-r,y-r,r*2,r*2);c.restore();
        const bx=x+r*.72,by=y-r*.72;c.fillStyle=GOLD;c.beginPath();c.arc(bx,by,22,0,Math.PI*2);c.fill();c.fillStyle=NIGHT;c.font=`700 22px ${FONT}`;c.fillText(String(i+1),bx,by+8);}
      else{c.strokeStyle=GOLD;c.lineWidth=3;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.fillStyle=GOLD;c.font=`34px ${SERIF}`;c.fillText(String(i+1),x,y+12);}
      const name=names[i],size=fit(c,name,230,22,'600'),tw=c.measureText(name).width,ly=y+r+36;
      c.fillStyle='rgba(6,20,16,.72)';c.beginPath();c.roundRect(x-tw/2-12,ly-size-4,tw+24,size+16,14);c.fill();
      c.fillStyle=CREAM;c.font=`600 ${size}px ${FONT}`;c.fillText(name,x,ly+2);
    });
    // Resumo
    const stats=[[`${byStop.size}/${etapas.length}`,'MEMÓRIAS LIGADAS'],[`${km(TOTAL)} km`,'DE CIRCUITO'],[elapsedTime(),'TEMPO DECORRIDO']];
    stats.forEach(([v,l],i)=>{const x=W/6+i*W/3;c.fillStyle=CREAM;c.font=`58px ${SERIF}`;c.fillText(v,x,1500);c.fillStyle='rgba(251,243,223,.6)';c.font=`700 18px ${FONT}`;c.fillText(l,x,1536);});
    c.fillStyle='rgba(244,199,97,.35)';c.fillRect(W/3,1452,1,94);c.fillRect(2*W/3,1452,1,94);
    skyline(c,random);
    footer(c);
    return canvas;
  }
  function footer(c){bolt(c,W/2-236,1884,15,GOLD);c.textAlign='center';c.fillStyle=CREAM;c.font=`600 24px ${FONT}`;c.fillText('E-REDES  ·  Coimbra, em boa companhia',W/2+12,1893);}
  async function makeCard(){if(busy)throw new Error('Aguarda que a fotografia termine de ser guardada.');return blob(await draw(),'image/png');}

  // ——— Álbum em PDF: o cartão e uma página grande por fotografia ———
  function wrap(c,text,max){
    const lines=[];let line='';
    for(const word of String(text).split(/\s+/)){const next=line?line+' '+word:word;if(line&&c.measureText(next).width>max){lines.push(line);line=word;}else line=next;}
    if(line)lines.push(line);return lines;
  }
  function rounded(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
  // Mosaicos do OpenStreetMap, com recurso a um esquema do percurso quando não há ligação.
  const tiles=new Map();
  function tile(url){
    if(!tiles.has(url))tiles.set(url,new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';const timer=setTimeout(()=>reject(new Error('timeout')),6000);img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);reject(new Error('tile'));};img.src=url;}).catch(error=>{tiles.delete(url);throw error;}));
    return tiles.get(url);
  }
  async function mapPanel(c,index,x,y,w,h){
    const Z=16,S=1.5,N=256*2**Z,e=etapas[index];
    const world=(lat,lon)=>{const r=lat*Math.PI/180;return [(lon+180)/360*N,(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*N];};
    const [cx,cy]=world(e.latitude,e.longitude);
    const project=(lat,lon)=>{const [px,py]=world(lat,lon);return [x+w/2+(px-cx)*S,y+h/2+(py-cy)*S];};
    c.save();rounded(c,x,y,w,h,24);c.clip();
    let online=false;
    try{
      const jobs=[];
      for(let tx=Math.floor((cx-w/2/S)/256);tx<=Math.floor((cx+w/2/S)/256);tx++)for(let ty=Math.floor((cy-h/2/S)/256);ty<=Math.floor((cy+h/2/S)/256);ty++)
        jobs.push(tile(`https://tile.openstreetmap.org/${Z}/${tx}/${ty}.png`).then(img=>[img,tx,ty]));
      const loaded=await Promise.all(jobs);
      for(const [img,tx,ty] of loaded)c.drawImage(img,x+w/2+(tx*256-cx)*S,y+h/2+(ty*256-cy)*S,256*S,256*S);
      c.fillStyle='rgba(10,33,29,.12)';c.fillRect(x,y,w,h);online=true;
    }catch{
      c.fillStyle='#123a33';c.fillRect(x,y,w,h);
      c.fillStyle='rgba(251,243,223,.08)';for(let py=y+18;py<y+h;py+=30)for(let px=x+18;px<x+w;px+=30)c.fillRect(px,py,2,2);
      const river=RIVER.map(([la,lo])=>project(la,lo));c.beginPath();river.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));
      c.lineCap='round';c.lineJoin='round';c.strokeStyle='rgba(38,110,112,.6)';c.lineWidth=70;c.stroke();
    }
    // Percurso completo, com a paragem desta página em destaque.
    const route=etapas.map(p=>project(p.latitude,p.longitude));
    c.lineCap='round';c.lineJoin='round';
    c.beginPath();route.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle='rgba(6,20,16,.55)';c.lineWidth=11;c.stroke();
    c.setLineDash([14,10]);c.strokeStyle=GOLD;c.lineWidth=5;c.stroke();c.setLineDash([]);
    route.forEach(([px,py],i)=>{if(i===index)return;c.beginPath();c.arc(px,py,9,0,Math.PI*2);c.fillStyle=CREAM;c.fill();c.strokeStyle=NIGHT;c.lineWidth=3;c.stroke();});
    const [px,py]=route[index];
    c.save();c.shadowColor='rgba(244,199,97,.9)';c.shadowBlur=24;c.beginPath();c.arc(px,py,30,0,Math.PI*2);c.fillStyle=GOLD;c.fill();c.restore();
    c.strokeStyle=NIGHT;c.lineWidth=4;c.stroke();c.fillStyle=NIGHT;c.textAlign='center';c.font=`700 28px ${FONT}`;c.fillText(String(index+1),px,py+10);
    if(online){const text='© OpenStreetMap';c.font=`600 16px ${FONT}`;const tw=c.measureText(text).width;c.fillStyle='rgba(255,255,255,.85)';c.fillRect(x+w-tw-20,y+h-30,tw+20,30);c.fillStyle='#333';c.textAlign='right';c.fillText(text,x+w-10,y+h-9);}
    c.restore();
    c.strokeStyle='rgba(244,199,97,.6)';c.lineWidth=2;rounded(c,x,y,w,h,24);c.stroke();
  }
  function background(c){
    const bg=c.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#123a33');bg.addColorStop(.55,NIGHT);bg.addColorStop(1,'#071814');c.fillStyle=bg;c.fillRect(0,0,W,H);
  }
  async function photoPage(index,img){
    const e=etapas[index],canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');
    background(c);c.textAlign='left';
    const X=60,CW=W-120;
    // Cabeçalho
    let y=110;c.fillStyle=GOLD;c.font=`700 24px ${FONT}`;c.fillText(`COIMBRA EM REDE  ·  PARAGEM ${String(index+1).padStart(2,'0')} DE ${etapas.length}`,X,y);
    c.font=`66px ${SERIF}`;const title=wrap(c,e.local,CW).slice(0,2);y+=34;
    c.fillStyle=CREAM;title.forEach(line=>{y+=70;c.fillText(line,X,y);});
    y+=54;c.fillStyle=GOLD;c.font=`italic 36px ${SERIF}`;c.fillText(e.tema,X,y);
    const top=y+40;
    // Parte de baixo, calculada de baixo para cima: mapa, ponto de encontro e desafio.
    const mapH=380,mapY=1800-mapH;
    c.font=`28px ${FONT}`;const place=wrap(c,e.localizacao,CW-40).slice(0,3);
    const placeY=mapY-36-place.length*40-34;
    c.font=`italic 34px ${SERIF}`;const challenge=e.desafio?wrap(c,e.desafio,CW-40).slice(0,3):[];
    const challengeY=placeY-(challenge.length?challenge.length*46+40:0);
    // Fotografia inteira, sem cortes, no espaço que sobra.
    const boxH=challengeY-40-top,scale=Math.min(CW/img.naturalWidth,boxH/img.naturalHeight);
    const pw=img.naturalWidth*scale,ph=img.naturalHeight*scale,px=(W-pw)/2,py=top+(boxH-ph)/2;
    c.save();c.shadowColor='rgba(244,199,97,.55)';c.shadowBlur=36;c.fillStyle=CREAM;rounded(c,px-8,py-8,pw+16,ph+16,26);c.fill();c.restore();
    c.save();rounded(c,px,py,pw,ph,20);c.clip();c.drawImage(img,px,py,pw,ph);c.restore();
    if(challenge.length){
      c.fillStyle=GOLD;c.fillRect(X,challengeY-4,6,challenge.length*46+4);
      c.fillStyle=CREAM;c.font=`italic 34px ${SERIF}`;challenge.forEach((line,i)=>c.fillText(line,X+30,challengeY+32+i*46));
    }
    c.fillStyle=GOLD;c.font=`700 20px ${FONT}`;c.fillText('PONTO DE ENCONTRO',X,placeY+20);
    c.fillStyle='rgba(251,243,223,.85)';c.font=`28px ${FONT}`;place.forEach((line,i)=>c.fillText(line,X,placeY+62+i*40));
    await mapPanel(c,index,X,mapY,CW,mapH);
    footer(c);
    return canvas;
  }
  async function jpeg(canvas){const b=await blob(canvas,'image/jpeg',.9);return new Uint8Array(await b.arrayBuffer());}
  // PDF mínimo: cada página é uma imagem JPEG do tamanho do cartão.
  function pdf(pages){
    const enc=new TextEncoder(),parts=[],offsets=[];let length=0;
    const push=x=>{const b=typeof x==='string'?enc.encode(x):x;parts.push(b);length+=b.length;};
    const obj=(n,...body)=>{offsets[n]=length;push(`${n} 0 obj\n`);body.forEach(push);push('\nendobj\n');};
    const PW=W/2,PH=H/2,size=3+pages.length*3;
    push('%PDF-1.4\n%âãÏÓ\n');
    obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
    obj(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,k)=>`${3+k*3} 0 R`).join(' ')}] >>`);
    pages.forEach((bytes,k)=>{
      const n=3+k*3,draw=`q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
      obj(n,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${n+2} 0 R >> >> /Contents ${n+1} 0 R >>`);
      obj(n+1,`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
      obj(n+2,`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`,bytes,'\nendstream');
    });
    const xref=length;
    push(`xref\n0 ${size}\n0000000000 65535 f \n`+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join(''));
    push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts,{type:'application/pdf'});
  }
  async function makeAlbum(progress=()=>{}){
    if(busy)throw new Error('Aguarda que a fotografia termine de ser guardada.');
    const photos=await records();if(!photos.length)throw new Error('Ainda não há fotografias para o álbum.');
    const total=photos.length+1,pages=[];
    progress(1,total);pages.push(await jpeg(await draw()));
    for(const p of photos){
      progress(pages.length+1,total);
      let img;try{img=await image(p.blob);}catch{continue;}
      pages.push(await jpeg(await photoPage(p.index,img)));
    }
    return pdf(pages);
  }
  return {slotHTML,paintSlot,records,store,compress,makeCard,makeAlbum,clearURLs,set onChange(fn){onChange=fn;}};
})();
