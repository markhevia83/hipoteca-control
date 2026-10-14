const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
function engine(file){
 const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 const names=['const annuity =','const termPolicy =','const termOptions =','const moneyFields =','function amortization()'];
 const functions=source.split('\n').filter(line=>names.some(name=>line.trim().startsWith(name))).join('\n');
 const c={Intl,current:null,rates:{'Cataluña':10}};vm.createContext(c);vm.runInContext(functions+'\nthis.api={termPolicy,termOptions,moneyFields,amortization};',c);
 return {source,api:c.api,set:value=>c.current=value};
}
function sample(ages=[34],term='40',product='standard') {return {name:'SYNTHETIC',applicants:ages.map(age=>({age,income:'3000',pays:'12',employment:'ajena'})),termYears:term,calculationProduct:product,price:'200000',savings:'30000',community:'Cataluña',fixed:'3000',mortgageType:'fija',rate:'3',variableRate:'4',mixedYears:'5',loans:[],offers:[]};}
for(const file of ['index.html','equipo.html']){
 test(file+': strict under35 boundary, joint oldest and preserved ING exception',()=>{
  const {api}=engine(file);
  for(const [ages,product,cap,allowed] of [[[34],'standard',40,true],[[35],'standard',30,false],[[34,35],'standard',30,false],[[35,34],'standard',30,false],[[32,34],'standard',40,true],[[34,''],'standard',40,true],[[35],'ing40',40,true],[[36],'ing40',39,false],[[50],'standard',25,false]]){
   const p=api.termPolicy(sample(ages,'40',product));assert.equal(p.applicableLimit,cap);assert.equal(p.termAllowed,allowed);
  }
  assert.equal(api.termPolicy(sample([''])).termAllowed,false);
  assert.equal(api.termPolicy(sample([34],'4')).termAllowed,false);
  assert.equal(api.termPolicy(sample([34],'41')).termAllowed,false);
 });
 test(file+': selected term drives 480 payments and interest; changes invalidate without silently choosing a term',()=>{
  const e=engine(file),c=sample();e.set(c);const f=e.api.moneyFields(),rows=e.api.amortization();
  const expected=193000*.0025/(1-Math.pow(1.0025,-480));assert.ok(Math.abs(f.mortgagePayment-expected)<1e-8);assert.equal(rows.length,480);assert.ok(rows.at(-1).balance<1e-6);
  assert.ok(Math.abs(rows.reduce((sum,r)=>sum+r.principal,0)-f.mortgage)<1e-6);
  assert.ok(Math.abs(rows.reduce((sum,r)=>sum+r.interest,0)-(expected*480-f.mortgage))<1e-6);
  assert.match(e.api.termOptions(f),/<option value="40" selected >40 años/);
  c.termYears='30';assert.ok(e.api.moneyFields().mortgagePayment>f.mortgagePayment);assert.equal(e.api.amortization().length,360);
  c.termYears='40';c.applicants[0].age=35;assert.equal(e.api.moneyFields().termYears,0);assert.equal(e.api.moneyFields().mortgagePayment,0);assert.equal(e.api.amortization().length,0);assert.equal(c.termYears,'40');
  assert.match(e.api.termOptions(e.api.moneyFields()),/<option value="40" selected disabled>/);
 });
 test(file+': variable and mixed simulations use all 40 years',()=>{
  const e=engine(file),c=sample();e.set(c);
  for(const type of ['variable','mixta']){c.mortgageType=type;const rows=e.api.amortization();assert.equal(rows.length,480);assert.ok(rows.at(-1).balance<1e-6);assert.ok(Math.abs(rows[0].paid-e.api.moneyFields().mortgagePayment)<1e-8);if(type==='mixta')assert.ok(rows[60].paid>rows[59].paid);}
 });
 test(file+': persisted/exported/imported term remains explicit and is revalidated',()=>{
  const e=engine(file),c=JSON.parse(JSON.stringify(sample()));e.set(c);assert.equal(e.api.moneyFields().termYears,40);c.applicants.push({age:35});assert.equal(e.api.moneyFields().termYears,0);
  assert.match(e.source,/Esta regla de simulación no garantiza la aprobación de ninguna entidad/);
  assert.doesNotMatch(e.source,/Producto estándar · máximo 30 años/);
 });
}
function report(){const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','client-report.js'),'utf8'),c);return c.HCReport;}
class PDF {
 constructor(){this.strings=[];} text(s){this.strings.push(...(Array.isArray(s)?s:[s]));}splitTextToSize(s){return [s];}getNumberOfPages(){return 1;}
}
for(const fn of ['addPage','setFillColor','rect','setTextColor','setFont','setFontSize','setPage','setDrawColor','line','setProperties','roundedRect'])PDF.prototype[fn]=()=>{};
test('full and short PDF consume recalculated40-year values and block invalid short PDF',()=>{
 const e=engine('index.html'),c=sample();e.set(c);const f=e.api.moneyFields(),r=report(),full=r.build(c,f,PDF),short=r.buildShort(c,f,PDF);
 assert.ok(full.strings.includes('40 años'));assert.ok(full.strings.includes('40 años (titular mayor: 34)'));assert.ok(full.strings.includes('Producto estándar'));assert.ok(full.strings.some(s=>s.includes('Hasta 40 años si el titular mayor es menor de 35')));
 const amount=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(f.mortgagePayment).replace(/\u202f|\u00a0/g,' ');
 assert.ok(full.strings.includes(amount));assert.ok(short.strings.includes(amount+' / mes'));
 c.applicants[0].age=35;assert.throws(()=>r.buildShort(c,e.api.moneyFields(),PDF),/plazo permitido/);assert.ok(r.build(c,e.api.moneyFields(),PDF).strings.includes('Pendiente de seleccionar'));
});
