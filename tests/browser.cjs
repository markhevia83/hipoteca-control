const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
const base=process.env.BASE_URL||'http://127.0.0.1:8765';
function mock(){
 Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>({update:async()=>{}}),controller:{postMessage:(_,ports)=>ports[0].postMessage(true)}}});
 window.supabase={createClient:(_url,_key,options)=>{
  const storage=options.auth.storage;let callback=()=>{};window.mockWrites=0;window.mockFail=true;
  const session=()=>{const value=storage.getItem('hc-team-auth-v1');return value?JSON.parse(value):null};
  const user=()=>session()?.user;
  const profile=()=>({user_id:user().id,active:true,role:'employee',display_name:user().id});
  const rows=()=>JSON.parse(localStorage.getItem('mock-cloud')||'[]');
  return {auth:{stopAutoRefresh:async()=>{},getSession:async()=>({data:{session:session()}}),getUser:async()=>({data:{user:user()}}),onAuthStateChange:fn=>callback=fn,signInWithPassword:async({email})=>{storage.setItem('hc-team-auth-v1',JSON.stringify({user:{id:email}}));return {data:{}}},signOut:async()=>{storage.removeItem('hc-team-auth-v1');callback('SIGNED_OUT');return {error:null}}},rpc:async()=>({data:null}),from(table){let operation='read',payload,filters={};const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q},order:()=>q,range:async()=>({data:rows()}),insert:p=>{operation='insert';payload=p;return q},update:p=>{operation='update';payload=p;return q},maybeSingle:()=>q,single:()=>q,then(resolve){let result;if(table==='hc_team_members')result={data:filters.user_id?profile():[profile()]};else if(table==='hc_team_notices')result={data:{accepted_at:'yes'}};else if(operation==='read')result={data:rows()};else {window.mockWrites++;if(window.mockFail)result={error:{status:503}};else {let data=rows(),old=data.find(r=>r.id===(payload.id||filters.id));const row={id:payload.id||filters.id,payload:payload.payload,owner_id:user().id,version:(old?.version||0)+1,updated_at:new Date().toISOString()};data=data.filter(r=>r.id!==row.id);data.push(row);localStorage.setItem('mock-cloud',JSON.stringify(data));result={data:row}}}return Promise.resolve(result).then(resolve)}};return q}};
 }};
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await context.route('https://**',r=>r.abort());await context.addInitScript(mock);
 let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/equipo.html');await page.locator('#team-email').fill('account-a@example.test');await page.locator('#team-password').fill('synthetic-password');await page.locator('#team-remember').check();await page.locator('#team-login button[type=submit]').click();
 await page.locator('[data-new]').first().click();await page.locator('[data-root=name]').fill('BORRADOR SINTÉTICO');
 await page.waitForTimeout(900);assert.match(await page.locator('#team-message').innerText(),/Copia local guardada/);
 // Reload restores the draft after verified login and cloud permissions read.
 await page.reload();await page.getByRole('button',{name:'Abrir',exact:true}).click();assert.equal(await page.locator('[data-root=name]').inputValue(),'BORRADOR SINTÉTICO');
 await page.locator('[data-root=name]').fill('EDICIÓN REABIERTA');await page.waitForTimeout(900);
 // Browser restart model: only localStorage retained, no sessionStorage.
 const state=await context.storageState();await context.close();
 const next=await browser.newContext({storageState:state,viewport:{width:390,height:844},acceptDownloads:true});await next.route('https://**',r=>r.abort());await next.addInitScript(mock);page=await next.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/equipo.html');await page.getByRole('button',{name:'Abrir',exact:true}).click();assert.equal(await page.locator('[data-root=name]').inputValue(),'EDICIÓN REABIERTA');
 await page.evaluate(()=>{window.mockFail=false});await page.locator('[data-save]').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mock-cloud')).length),1);
 // Repeated save cannot duplicate cloud row.
 await page.locator('[data-save]').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mock-cloud')).length),1);
 await page.locator('#team-out').click();await page.locator('#team-email').fill('account-b@example.test');await page.locator('#team-password').fill('synthetic-password');await page.evaluate(()=>localStorage.removeItem('mock-cloud'));await page.locator('#team-login button[type=submit]').click();await page.waitForTimeout(100);assert.equal(await page.locator('[data-open]').count(),0);
 // Genuine local app: save/reload, export, restore, duplicate import, quota.
 await page.goto(base+'/index.html');await page.locator('[data-new]').first().click();await page.locator('[data-root=name]').fill('LOCAL SINTÉTICO');await page.reload();assert.match(await page.locator('.hc-list').innerText(),/LOCAL SINTÉTICO/);
 const download=page.waitForEvent('download');await page.locator('[data-backup-export]').click();const backup=await download;const path='/tmp/hipoteca-synthetic-backup.json';await backup.saveAs(path);assert.equal(JSON.parse(fs.readFileSync(path)).cases.length,1);
 page.on('dialog',d=>d.accept());await page.locator('input[type=file]').setInputFiles(path);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('hipoteca-control-inline-v1')).length),1);
 await page.evaluate(()=>{localStorage.removeItem('hipoteca-control-inline-v1')});await page.locator('input[type=file]').setInputFiles(path);await page.waitForTimeout(100);await page.reload();assert.match(await page.locator('.hc-list').innerText(),/LOCAL SINTÉTICO/);
 await page.screenshot({path:'/tmp/hipoteca-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: mobile team draft reload/restart, sync/repeat save, logout/account isolation; local reload/export/import/repeat import. No page errors.');
})().catch(e=>{console.error(e);process.exit(1)});
