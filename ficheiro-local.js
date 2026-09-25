'use strict';

const LOCAL_ROUTE_KEY='missao-coimbra-roteiro-importado';
let pendingRoute=null;
let sessionRoute=null;

async function readRouteData(){
  if(sessionRoute)return sessionRoute;
  try{const imported=localStorage.getItem(LOCAL_ROUTE_KEY);if(imported)return JSON.parse(imported);}catch{}
  if(location.protocol!=='file:'){
    const response=await fetch('dados.json',{cache:'no-store'});
    if(!response.ok)throw new Error(`Não foi possível ler dados.json (HTTP ${response.status}).`);
    return response.json();
  }
  return JSON.parse(document.getElementById('route-data').textContent);
}

function openRouteEditor(){
  pendingRoute=null;document.getElementById('apply-route').disabled=true;
  document.getElementById('route-file').value='';document.getElementById('import-status').textContent='';
  document.getElementById('route-editor-dialog').showModal();
}

function useRoute(data){
  sessionRoute=data||JSON.parse(document.getElementById('route-data').textContent);
  try{
    if(data)localStorage.setItem(LOCAL_ROUTE_KEY,JSON.stringify(data));else localStorage.removeItem(LOCAL_ROUTE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  }catch{
    document.getElementById('storage-warning').hidden=false;
  }
  state=null;cleanupMap();if(routeMap){routeMap.remove();routeMap=null;}
  document.getElementById('route-editor-dialog').close();
  initialize().then(moveFocus);
}

document.addEventListener('click',event=>{
  if(event.target.closest('[data-action="edit-route"]'))openRouteEditor();
});
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('route-file').addEventListener('change',async event=>{
    pendingRoute=null;document.getElementById('apply-route').disabled=true;
    const file=event.target.files[0];if(!file)return;
    try{
      if(file.size>2_000_000)throw new Error('Escolhe um JSON com menos de 2 MB.');
      pendingRoute=validateData(JSON.parse(await file.text()));
      document.getElementById('import-status').textContent=`${pendingRoute.etapas.length} paragens · ${km(pendingRoute.etapas.at(-1).distanciaAcumulada)} km · seis missões. Pronto para carregar.`;
      document.getElementById('apply-route').disabled=false;
    }catch(error){document.getElementById('import-status').textContent=`Não foi possível ler este roteiro: ${error.message}`;}
  });
  document.getElementById('apply-route').addEventListener('click',()=>{if(pendingRoute)useRoute(pendingRoute);});
  document.getElementById('restore-route').addEventListener('click',()=>useRoute(null));
});
