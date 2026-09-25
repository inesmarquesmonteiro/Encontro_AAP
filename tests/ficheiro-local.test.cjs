const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const data = JSON.parse(fs.readFileSync('dados.json', 'utf8'));
const html = fs.readFileSync('index.html', 'utf8');
const embedded = html.match(/<script id="route-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
function context(protocol, imported, storageBlocked=false) {
  const ctx = vm.createContext({
    location: {protocol},
    localStorage: {getItem: () => {if(storageBlocked)throw new Error('blocked');return imported;}},
    document: {addEventListener() {}, getElementById: () => ({textContent: embedded})},
    fetch: async () => {throw new Error('O HTML local não deve chamar fetch.');}
  });
  vm.runInContext(fs.readFileSync('ficheiro-local.js','utf8'), ctx);
  return ctx;
}
test('O HTML inclui uma cópia completa e atualizada do JSON', () => {
  assert.deepEqual(JSON.parse(embedded), data);
});
test('file: carrega o roteiro sem fetch ou servidor', async () => {
  const result=await vm.runInContext('readRouteData()',context('file:'));
  assert.equal(result.etapas.length,12);
  assert.equal(result.etapas.at(-1).distanciaAcumulada,3.3);
});
test('file: funciona quando localStorage está bloqueado', async () => {
  const result=await vm.runInContext('readRouteData()',context('file:',null,true));
  assert.equal(result.titulo,data.titulo);
});
test('Roteiro importado tem prioridade sobre a cópia incluída', async () => {
  const result=await vm.runInContext('readRouteData()',context('file:',JSON.stringify({...data,titulo:'Roteiro alterado'})));
  assert.equal(result.titulo,'Roteiro alterado');
});
test('Dados guardados ilegíveis não impedem abrir o HTML', async () => {
  const result=await vm.runInContext('readRouteData()',context('file:','{inválido'));
  assert.equal(result.titulo,data.titulo);
});
test('Scripts e estilos necessários existem localmente', () => {
  for(const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"/g)) {
    const path=match[1];
    if(/\.(js|css)$/.test(path))assert.ok(fs.existsSync(path),path);
  }
  assert.ok(html.includes('class="brand" href="index.html"'));
});
test('A formatação está incluída no HTML e corresponde ao CSS editável', () => {
  const inline=html.match(/<style id="app-styles">\n([\s\S]*?)\n  <\/style>/);
  assert.ok(inline);
  assert.equal(inline[1],fs.readFileSync('style.css','utf8'));
  assert.ok(!inline[1].includes('@import'));
});
test('O JavaScript incluído está atualizado, na ordem certa e depois do conteúdo', () => {
  const sources=[...html.matchAll(/<script data-local-source="([^"]+)">\n([\s\S]*?)\n<\/script>/g)];
  assert.deepEqual(sources.map(m=>m[1]),['vendor/leaflet/leaflet.js','caderno.js','ficheiro-local.js','memorias.js','script.js']);
  for(const m of sources){assert.equal(m[2],fs.readFileSync(m[1],'utf8'));new vm.Script(m[2]);assert.ok(m.index>html.indexOf('id="route-data"'));}
});
test('A inicialização local preenche o conteúdo principal e liga o botão de início', async () => {
  const elements=new Map();
  function element(selector){
    if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',hidden:false,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},querySelector:s=>element(selector+' '+s)});
    return elements.get(selector);
  }
  element('#route-data').textContent=embedded;
  const errors=[];
  const ctx=vm.createContext({
    location:{protocol:'file:'},
    document:{querySelector:element,getElementById:id=>element('#'+id),querySelectorAll:()=>[],addEventListener(){}},
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    setInterval(){},window:{},console:{error:(...args)=>errors.push(args)},
    fetch:()=>{throw new Error('fetch inesperado');}
  });
  for(const name of ['caderno.js','ficheiro-local.js','memorias.js','script.js'])vm.runInContext(fs.readFileSync(name,'utf8'),ctx,{filename:name});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(errors,[]);
  assert.match(element('#main').innerHTML,/Um caderno/);
  assert.equal(typeof element('#start-walk').listeners.click,'function');
});
