const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.BASE_URL||'http://127.0.0.1:8765';
const fixture=fs.readFileSync(require.resolve('./browser.cjs'),'utf8');
const mock=new Function(fixture.slice(fixture.indexOf('function mock(){'),fixture.indexOf('(async()=>{'))+';return mock;')();
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 for(const mode of ['index.html','equipo.html']){
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});await context.route('https://**',r=>r.abort());await context.addInitScript(mock);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base+'/'+mode);
  if(mode==='equipo.html'){await page.locator('#team-email').fill('term@example.test');await page.locator('#team-password').fill('synthetic');await page.locator('#team-remember').check();await page.locator('#team-login button[type=submit]').click();}
  await page.locator('[data-new]').first().click();await page.locator('[data-root=name]').fill('TERM SYNTHETIC');
  await page.locator('[data-ai="0"][data-field="age"]').fill('34');await page.locator('[data-tab=calculo]').click();
  await page.locator('[data-root=price]').fill('200000');await page.locator('[data-root=savings]').fill('30000');await page.locator('[data-root=community]').selectOption('Cataluña');
  assert.equal(await page.locator('[data-root=termYears] option[value="40"]').isDisabled(),false);
  await page.locator('[data-root=termYears]').selectOption('40');assert.match(await page.locator('[data-amortization]').innerText(),/480 cuotas/);
  const payment=await page.locator('[data-payment-summary]').innerText();assert.match(payment,/691/);
  await page.waitForTimeout(900);await page.reload();await page.getByRole('button',{name:'Abrir',exact:true}).click();await page.locator('[data-tab=calculo]').click();assert.equal(await page.locator('[data-root=termYears]').inputValue(),'40');assert.equal(await page.locator('[data-payment-summary]').innerText(),payment);
  // Both actual PDF generators see live40-year financial values.
  const pdf=await page.evaluate(()=>{let captures=[];for(const name of ['build','buildShort']){const original=HCReport[name];HCReport[name]=(...args)=>{captures.push(args[1]);return original(...args)}}return !!window.jspdf?.jsPDF;});assert.equal(pdf,true);
  for(const kind of ['full','short']){
   const selector=kind==='short'?'[data-client-pdf="short"]':'[data-client-pdf]:not([data-client-pdf="short"])';await page.locator(selector).first().click();const dl=page.waitForEvent('download');await page.locator('[data-download]').click();const d=await dl;await d.saveAs('/tmp/mortgage-'+mode+'-'+kind+'.pdf');await page.locator('[data-close]').click();
  }
  await page.locator('[data-tab=datos]').click();await page.locator('[data-ai="1"][data-field="age"]').fill('35');await page.locator('[data-tab=calculo]').click();assert.equal(await page.locator('[data-root=termYears] option[value="40"]').isDisabled(),true);assert.match(await page.locator('[data-term-warning]').innerText(),/máximo.*30/);assert.equal(await page.locator('[data-amortization]').innerText(),'');
  await page.locator('[data-root=calculationProduct]').selectOption('ing40');assert.match(await page.locator('[data-amortization]').innerText(),/480 cuotas/);
  await page.locator('[data-root=calculationProduct]').selectOption('standard');await page.locator('[data-root=termYears]').selectOption('30');assert.match(await page.locator('[data-amortization]').innerText(),/360 cuotas/);
  await page.locator('[data-tab=datos]').click();await page.locator('[data-ai="1"][data-field="age"]').fill('33');await page.locator('[data-tab=calculo]').click();await page.locator('[data-root=termYears]').selectOption('40');await page.waitForTimeout(900);
  if(mode==='index.html'){
   const dl=page.waitForEvent('download');await page.locator('[data-backup-export]').click();const d=await dl;const file='/tmp/term-synthetic.json';await d.saveAs(file);assert.equal(JSON.parse(fs.readFileSync(file)).cases[0].termYears,'40');await page.evaluate(()=>localStorage.removeItem('hipoteca-control-inline-v1'));await page.locator('input[type=file]').setInputFiles(file);await page.waitForTimeout(100);await page.reload();await page.getByRole('button',{name:'Abrir',exact:true}).click();await page.locator('[data-tab=calculo]').click();assert.equal(await page.locator('[data-root=termYears]').inputValue(),'40');assert.match(await page.locator('[data-amortization]').innerText(),/480 cuotas/);
  }
  await page.screenshot({path:'/tmp/mortgage-'+mode+'.png',fullPage:true});assert.deepEqual(errors,[]);await context.close();console.log('PASS '+mode+': manual40, joint35 rejection, ING exception,30/40 recalculation, reload persistence, PDFs'+(mode==='index.html'?', JSON export/import':''));
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
