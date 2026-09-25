const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('memorias.js','utf8');
function create(indexedDB){
 const ctx=vm.createContext({indexedDB,state:{startedAt:10},contentKey:'route',Blob,URL});
 vm.runInContext(source,ctx);return {api:vm.runInContext('Memories',ctx),ctx};
}
function fakeDB(){
 const data=new Map();
 const db={transaction(){const tx={objectStore(){return {
 getAll(){const r={};queueMicrotask(()=>{r.result=[...data.values()];r.onsuccess();});return r;},
 put(p){queueMicrotask(()=>{data.set(p.id,structuredClone(p));tx.oncomplete();});},
 delete(id){queueMicrotask(()=>{data.delete(id);tx.oncomplete();});}
 };}};return tx;}};
 return {open(){const r={};queueMicrotask(()=>{r.result=db;r.onsuccess();});return r;}};
}
const photo={id:'route:10:0',trip:'route:10',index:0,blob:new Blob(['photo'],{type:'image/jpeg'})};
test('Falha de armazenamento mantém a fotografia na sessão e comunica insucesso',async()=>{
 const {api}=create({open(){throw new Error('Blocked');}});
 assert.equal(await api.store(photo),false);
 assert.equal((await api.records())[0].blob.size,5);
 assert.equal(await api.store(photo,true),false);
 assert.equal((await api.records()).length,0);
});
test('Fotografia sobrevive a uma nova instância; remoção é persistente',async()=>{
 const database=fakeDB(),first=create(database).api;
 assert.equal(await first.store(photo),true);
 const second=create(database).api;
 assert.equal((await second.records()).length,1);
 
 
 await second.store(photo,true);
 assert.equal((await create(database).api.records()).length,0);
});
test('Álbuns de passeios diferentes não misturam fotografias',async()=>{
 const {api,ctx}=create(fakeDB());await api.store(photo);
 vm.runInContext('state.startedAt=20',ctx);assert.equal((await api.records()).length,0);
 vm.runInContext('state.startedAt=10;contentKey="other"',ctx);assert.equal((await api.records()).length,0);
});
test('Ficheiros demasiado grandes ou não fotográficos são rejeitados antes de descodificar',async()=>{
 const {api}=create(fakeDB());
 await assert.rejects(api.compress({size:31*1024*1024,type:'image/jpeg'}),/demasiado grande/);
 await assert.rejects(api.compress({size:10,type:'application/pdf'}),/Escolhe uma fotografia/);
});
