const {test}=require('node:test');const assert=require('node:assert/strict');
const {drafts,authStorage}=require('../team-storage.js');
function memory(){const m=new Map();return {get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}}
const payload={id:'11111111-1111-4111-8111-111111111111',name:'Synthetic',applicants:[]};
test('draft survives new storage wrapper and accounts cannot enumerate each other',()=>{const s=memory();drafts(s,'A').write(payload,null);assert.deepEqual(drafts(s,'A').list()[0].payload,payload);assert.equal(drafts(s,'B').list().length,0)});
test('atomic quota failure retains previous draft and backup',()=>{const s=memory(),d=drafts(s,'A');d.write(payload,1);const set=s.setItem;s.setItem=(k,v)=>{if(!k.endsWith(':previous'))throw Error('quota');set(k,v)};assert.throws(()=>d.write({...payload,name:'new'},1));assert.equal(d.read(payload.id).payload.name,'Synthetic')});
test('corrupt data is not overwritten',()=>{const s=memory(),d=drafts(s,'A');d.write(payload,null);const k='hc-team-drafts-v1:A:'+payload.id;s.setItem(k,'broken');assert.throws(()=>d.write(payload,null));assert.equal(s.getItem(k),'broken')});
test('late response cannot acknowledge newer edits',()=>{const d=drafts(memory(),'A');d.write({...payload,name:'new'},3);d.acknowledge(payload);assert.equal(d.read(payload.id).payload.name,'new')});
test('acknowledged identical draft removed without deleting other drafts',()=>{const d=drafts(memory(),'A');d.write(payload,1);d.write({...payload,id:'second'},1);d.acknowledge(payload);assert.equal(d.list().length,1)});
test('legacy session read, opt-in persistence, and logout remove both copies',()=>{const l=memory(),s=memory();s.setItem('auth','legacy');let a=authStorage(l,s);assert.equal(a.getItem('auth'),'legacy');a.choose(true);a.setItem('auth','new');assert.equal(s.getItem('auth'),null);a=authStorage(l,memory());assert.equal(a.getItem('auth'),'new');a.removeItem('auth');assert.equal(l.getItem('auth'),null)});
test('without opt-in tokens never persist across session restart',()=>{const l=memory(),s=memory(),a=authStorage(l,s);a.setItem('auth','token');assert.equal(l.getItem('auth'),null);assert.equal(authStorage(l,memory()).getItem('auth'),null)});

test('interleaved tabs and late acknowledgement cannot overwrite unseen edits',()=>{const s=memory(),a=drafts(s,'A'),b=drafts(s,'A');a.write(payload,1);b.list();b.write({...payload,name:'B edit'},1);a.acknowledge(payload);assert.throws(()=>a.write({...payload,name:'A edit'},1),/LOCAL_CONFLICT/);assert.equal(b.read(payload.id).payload.name,'B edit')});
test('corrupt draft does not prevent healthy draft recovery',()=>{const s=memory(),d=drafts(s,'A');d.write(payload,1);s.setItem('hc-team-drafts-v1:A:broken','broken');const list=d.list();assert.equal(list.length,1);assert.equal(list.errors,1)});

test('simultaneous writes preserve each writer even if shared main loses a race',()=>{
  const s=memory(),seed=drafts(s,'A');seed.write(payload,1);
  const a=drafts(s,'A'),b=drafts(s,'A');a.list();b.list();
  const main='hc-team-drafts-v1:A:'+payload.id,set=s.setItem;let interleave=true;
  s.setItem=(k,v)=>{if(k===main&&interleave){interleave=false;b.write({...payload,name:'B simultaneous edit'},1);}set(k,v)};
  a.write({...payload,name:'A simultaneous edit'},1);
  assert.equal(a.read(payload.id).payload.name,'A simultaneous edit');
  a.write({...payload,name:'A later edit'},1);
  const names=a.recoveries().map(r=>r.payload.name);
  assert.ok(names.includes('A later edit'));assert.ok(names.includes('B simultaneous edit'));
  assert.equal(drafts(s,'other-account').recoveries().length,0);
  a.acknowledge({...payload,name:'A later edit'});
  assert.ok(b.recoveries().some(r=>r.payload.name==='B simultaneous edit'));
});

test('recovery survives restart and blocked main writes',()=>{
  const s=memory(),a=drafts(s,'A');a.write(payload,1);
  const b=drafts(s,'A');
  assert.throws(()=>b.write({...payload,name:'Unseen conflicting edit'},1),/LOCAL_CONFLICT/);
  const restored=drafts(s,'A').recoveries();
  assert.equal(restored.errors,0);assert.equal(restored.length,2);
  assert.ok(restored.some(r=>r.payload.name==='Unseen conflicting edit'));
  assert.ok(restored.every(r=>r.account==='A'&&r.baseVersion===1&&typeof r.recoveryId==='string'));
});

test('acknowledgement racing another writer cannot erase its recovery',()=>{
  const s=memory(),a=drafts(s,'A');a.write(payload,1);const b=drafts(s,'A');b.list();
  const main='hc-team-drafts-v1:A:'+payload.id,remove=s.removeItem;let interleave=true;
  s.removeItem=k=>{if(k===main&&interleave){interleave=false;b.write({...payload,name:'B edit during acknowledge'},1);}remove(k)};
  a.acknowledge(payload);
  assert.ok(drafts(s,'A').recoveries().some(r=>r.payload.name==='B edit during acknowledge'));
});

test('a failed recovery write leaves the shared draft untouched',()=>{
  const s=memory(),a=drafts(s,'A');a.write(payload,1);const set=s.setItem;
  s.setItem=(k,v)=>{if(k.startsWith('hc-team-recovery-v1:'))throw Error('quota');set(k,v)};
  assert.throws(()=>a.write({...payload,name:'Unsaved edit'},1),/quota/);
  assert.equal(a.read(payload.id).payload.name,'Synthetic');
});

test('corrupt recovery is isolated from healthy recovery copies',()=>{
  const s=memory(),a=drafts(s,'A');a.write(payload,1);
  s.setItem('hc-team-recovery-v1:A:broken','broken');
  const recovery=drafts(s,'A').recoveries();assert.equal(recovery.length,1);assert.equal(recovery.errors,1);
});
