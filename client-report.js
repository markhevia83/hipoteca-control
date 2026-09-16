/* Client reports are generated locally; no customer data is sent to a PDF service. */
(function (scope) {
  'use strict';
  const missing = 'No indicado';
  const present = v => v !== null && v !== undefined && String(v).trim() !== '';
  const text = v => present(v) ? String(v) : missing;
  const money = v => present(v) && Number.isFinite(Number(v)) ? new Intl.NumberFormat('es-ES', {style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Number(v)) : missing;
  const pct = v => present(v) && Number.isFinite(Number(v)) ? new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(Number(v))+' %' : missing;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const date = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v.split('-').reverse().join('/') : text(v);
  function field(c,key,label,type='text') {
    return `<div><label for="report-${key}">${label}</label><input id="report-${key}" data-root="${key}" type="${type}" ${type==='number'?'step="any" min="0"':''} value="${esc(c[key])}"></div>`;
  }
  function details(c) {
    return `<section class="hc-block"><h2>Datos del asesoramiento</h2><div class="hc-fields">${field(c,'adviceDate','Fecha del asesoramiento','date')}${field(c,'referredBy','Referenciado')}${field(c,'phone','Teléfono','tel')}<div><label for="report-modality">Modalidad</label><select id="report-modality" data-root="modality">${['Pendiente','Presencial','A distancia'].map(v=>`<option ${v===(c.modality||'Pendiente')?'selected':''}>${v}</option>`).join('')}</select></div>${field(c,'advisor','Asesor/a')}</div></section>`;
  }
  function operation(c,rates) {
    return `<section class="hc-block"><h2>Vivienda y gastos</h2><div class="hc-fields">${field(c,'property','Vivienda / descripción de la operación')}<div><label for="report-community">Comunidad autónoma</label><select id="report-community" data-root="community"><option value="">Pendiente</option>${Object.keys(rates).map(v=>`<option ${v===c.community?'selected':''}>${esc(v)}</option>`).join('')}</select></div>${field(c,'fixed','Notaría, registro y gestoría (€)','number')}${field(c,'agency','Honorarios inmobiliaria (€)','number')}${field(c,'finance','Honorarios financiación (€)','number')}</div><p>El ITP usa la estimación de la calculadora actual. Revisa los gastos y posibles bonificaciones para esta operación.</p></section>`;
  }
  function comparisons(c) {
    return `<section class="hc-block"><div class="hc-head"><h2>Bancos y condiciones comparados</h2><button class="hc-subtle" data-add-offer>+ Añadir banco</button></div>${(c.offers||[]).map((o,i)=>`<div class="hc-card" style="margin-bottom:12px"><h3>Oferta ${i+1}</h3><div class="hc-fields">${[['bank','Banco'],['type','Tipo de hipoteca'],['tin','TIN (%)','number'],['tae','TAE (%)','number'],['term','Plazo (años)','number'],['payment','Cuota mensual (€)','number']].map(([k,l,t='text'])=>`<div><label for="offer-${i}-${k}">${l}</label><input id="offer-${i}-${k}" data-offer="${i}" data-field="${k}" type="${t}" ${t==='number'?'step="any" min="0"':''} value="${esc(o[k])}"></div>`).join('')}</div><label for="offer-${i}-conditions">Condiciones, vinculaciones y comisiones</label><textarea id="offer-${i}-conditions" data-offer="${i}" data-field="conditions">${esc(o.conditions)}</textarea><button class="hc-danger" data-remove-offer="${i}">Quitar banco ${i+1}</button></div>`).join('')||'<p>No hay ofertas comparadas registradas.</p>'}<label for="report-clientNotes">Conclusiones y próximos pasos para el cliente</label><textarea id="report-clientNotes" data-root="clientNotes">${esc(c.clientNotes)}</textarea></section>`;
  }
  function build(c,f,JsPDF) {
    const doc = new JsPDF({unit:'mm',format:'a4',compress:true});
    const ink = '#153a33', muted = '#5d706a';
    let y = 0;
    const clean = v => text(v).normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\u202f|\u00a0/g,' ');
    function page(first=false) {
      if(!first) doc.addPage();
      doc.setFillColor(ink);doc.rect(0,0,210,30,'F');doc.setTextColor('#ffffff');
      doc.setFont('helvetica','bold');doc.setFontSize(19);doc.text('hipoteca.',17,16);
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('INFORME DE ASESORAMIENTO',193,16,{align:'right'});
      doc.setTextColor(ink);doc.setFontSize(10);y=41;
    }
    function room(h) {if(y+h>275)page();}
    function heading(v) {room(24);doc.setFillColor('#edf5f1');doc.rect(17,y-5,176,10,'F');doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(ink);doc.text(clean(v),21,y+1);y+=13;}
    function row(label,value) {
      doc.setFont('helvetica','normal');doc.setFontSize(10);
      const labels=doc.splitTextToSize(clean(label),61), values=doc.splitTextToSize(clean(value),108);
      const count=Math.max(labels.length,values.length);
      if(count*5+4<224)room(count*5+4);
      for(let i=0;i<count;i++) {room(6);doc.setTextColor(muted);if(labels[i])doc.text(labels[i],19,y);doc.setTextColor(ink);if(values[i])doc.text(values[i],84,y);y+=5;}
      y+=2;
    }
    const rows = list => list.forEach(([k,v])=>row(k,v));
    page(true);heading('Datos del cliente y del asesoramiento');
    rows([['Expediente',c.name],['Fecha del asesoramiento',date(c.adviceDate)],['Modalidad',c.modality],['Asesor/a',c.advisor],['Referenciado',c.referredBy],['Teléfono',c.phone]]);
    (c.applicants||[]).forEach((a,i)=>{
      const active=['name','age','income','tenure','activity','autonomoYears','monthlyProfit','annualProfit','bank'].some(k=>present(a[k])) || (a.contract && a.contract!=='Pendiente') || (a.asnef && a.asnef!=='Pendiente');
      if(!active)return;
      heading(`Solicitante ${i+1}`);
      rows([['Nombre',a.name],['Edad',present(a.age)?`${a.age} años`:missing],['Situación laboral',a.employment==='propia'?'Por cuenta propia':a.employment==='ajena'?'Por cuenta ajena':missing]]);
      rows(a.employment==='propia' ? [['Actividad / empresa',a.activity],['Antigüedad como autónomo',a.autonomoYears],['Rendimiento neto mensual',money(a.monthlyProfit)],['Beneficio neto anual',money(a.annualProfit)]] : [['Contrato',a.contract],['Antigüedad laboral',a.tenure],['Ingresos netos por paga',money(a.income)],['Número de pagas',a.pays]]);
      rows([['Banco habitual',a.bank],['ASNEF',a.asnef]]);
    });
    heading('Economía familiar, préstamos y aval');
    rows([['Ingresos netos mensuales',money(f.incomeMonthly)],['Ahorros disponibles',money(c.savings)],['Posibilidad de aval',c.guarantor]]);
    if(!(c.loans||[]).length)row('Préstamos','No hay préstamos registrados.');
    (c.loans||[]).forEach((l,i)=>{room(44);rows([[`Préstamo ${i+1}`,l.bank],['Titular / concepto',`${text(l.holder)} / ${text(l.concept)}`],['Cuota mensual',money(l.payment)],['Saldo pendiente',money(l.balance)]]);});
    heading('Vivienda, operación y gastos');
    rows([['Vivienda / operación',c.property],['Precio de compra',money(c.price)],['Comunidad autónoma',c.community],['ITP estimado',c.community&&present(c.price)?money(f.itp):'Pendiente de completar'],['Notaría, registro y gestoría',money(c.fixed)],['Honorarios inmobiliaria',money(c.agency)],['Honorarios financiación',money(c.finance)],['Total gastos estimados',c.community&&present(c.price)?money(f.costs):'Pendiente de completar']]);
    heading('Financiación y modalidad hipotecaria');
    const complete=Number(c.price)>0&&!!c.community&&present(c.savings);
    rows([['Hipoteca necesaria',complete?money(f.mortgage):'Pendiente de completar'],['Financiación / precio',complete?pct(f.pct):'Pendiente de completar'],['Tipo de hipoteca',c.mortgageType]]);
    if(c.mortgageType!=='variable')row('Interés fijo / inicial',pct(c.rate));
    if(c.mortgageType!=='fija')row('Interés variable estimado',pct(c.variableRate));
    if(c.mortgageType==='mixta')row('Tramo fijo',present(c.mixedYears)?c.mixedYears+' años':missing);
    rows([['Comisión de apertura',pct(c.openingCommission)],['Apertura financiada',c.financeCommission?'Sí':'No'],['Importe de apertura',complete?money(f.openingFee):'Pendiente de completar'],['Seguros / mes',money(c.insurance)],['Plan de pensiones / mes',money(c.pensionPlan)],['Protección de pagos / mes',money(c.paymentProtection)],['Plazo calculado por edad',f.termYears?`${f.termYears} años (hasta 75 años)`:missing],['Cuota hipotecaria inicial',complete&&f.termYears?money(f.mortgagePayment):'Pendiente de completar'],['Cuotas de préstamos / mes',money(f.loanMonthly)],['Endeudamiento total',complete&&f.incomeMonthly&&f.termYears?pct(f.debtRatio):'Pendiente de completar']]);
    heading('Bancos y condiciones comparados');
    if(!(c.offers||[]).length)row('Ofertas','No hay ofertas comparadas registradas.');
    (c.offers||[]).forEach((o,i)=>{room(65);rows([[`Oferta ${i+1}`,o.bank],['Tipo de hipoteca',o.type],['TIN / TAE',`${pct(o.tin)} / ${pct(o.tae)}`],['Plazo',present(o.term)?o.term+' años':missing],['Cuota mensual',money(o.payment)],['Condiciones y vinculaciones',o.conditions]]);});
    if(present(c.clientNotes)){heading('Conclusiones y próximos pasos');row('Observaciones',c.clientNotes);}
    room(49);heading('Alcance del informe');
    row('Información orientativa','Resumen de los datos introducidos y de las estimaciones del asesoramiento. Las condiciones están sujetas al estudio y aprobación de cada entidad. No constituye una oferta vinculante.');
    row('Datos pendientes','Los campos sin completar se muestran como no indicados. Revisa importes, gastos e impuestos antes de entregar el informe.');
    for(let p=1;p<=doc.getNumberOfPages();p++){doc.setPage(p);doc.setDrawColor('#d5e1dc');doc.line(17,281,193,281);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(muted);doc.text('Hipoteca Control · Documento confidencial',17,287);doc.text(`${p} / ${doc.getNumberOfPages()}`,193,287,{align:'right'});}
    doc.setProperties({title:'Asesoramiento hipotecario',author:'Hipoteca Control',subject:'Resumen para el cliente'});
    return doc;
  }
  function bind(root,c,getComputed,render) {
    root.querySelector('[data-add-offer]')?.addEventListener('click',()=>{(c.offers ||= []).push({});render();});
    root.querySelectorAll('[data-remove-offer]').forEach(b=>b.onclick=()=>{c.offers.splice(+b.dataset.removeOffer,1);render();});
    root.querySelectorAll('[data-offer]').forEach(el=>{el.oninput=el.onchange=()=>{c.offers[+el.dataset.offer][el.dataset.field]=el.value;};});
    // Also makes existing form labels accessible without altering the current layout.
    root.querySelectorAll('input,select,textarea').forEach((el,i)=>{if(!el.id)el.id=`hc-field-${i}`;const label=el.previousElementSibling;if(label?.tagName==='LABEL')label.htmlFor=el.id;});
    root.querySelector('[data-client-pdf]')?.addEventListener('click',()=>{
      try {
        if(!scope.jspdf?.jsPDF)throw new Error('No se ha podido cargar el generador. Recarga la página y vuelve a intentarlo.');
        const snapshot=structuredClone(c), doc=build(snapshot,getComputed(),scope.jspdf.jsPDF), blob=doc.output('blob');
        const slug=(snapshot.name||'cliente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').slice(0,70);
        const name=`Asesoramiento-${slug}-${snapshot.adviceDate||today()}.pdf`;
        const dialog=document.createElement('dialog');dialog.className='hc-pdf-dialog';
        dialog.innerHTML='<h2>PDF para el cliente</h2><p>Incluye los datos actuales, también los cambios sin guardar. Revisa el documento antes de compartirlo.</p><div class="hc-pdf-actions"><a class="hc-primary" data-download>Descargar PDF</a><button class="hc-subtle" data-share>Compartir PDF</button><button class="hc-subtle" data-close>Cerrar</button></div><p role="status" data-pdf-status></p>';
        root.append(dialog);
        const url=URL.createObjectURL(blob), link=dialog.querySelector('[data-download]');link.href=url;link.download=name;
        const file=new File([blob],name,{type:'application/pdf'}),share=dialog.querySelector('[data-share]'),status=dialog.querySelector('[data-pdf-status]');
        if(!navigator.share||!navigator.canShare?.({files:[file]})){share.hidden=true;status.textContent='Descarga el PDF y adjúntalo a tu correo o mensaje.';}
        else share.onclick=async()=>{share.disabled=true;try{await navigator.share({files:[file],title:'Asesoramiento hipotecario'});status.textContent='PDF compartido.';}catch(e){status.textContent=e.name==='AbortError'?'Envío cancelado. El PDF sigue disponible.':'No se ha podido compartir. Descarga el PDF y adjúntalo a tu mensaje.';}finally{share.disabled=false;}};
        dialog.querySelector('[data-close]').onclick=()=>dialog.close();
        dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);dialog.remove();},{once:true});dialog.showModal();
      } catch(e) {alert('No se ha podido generar el PDF. '+e.message);}
    });
  }
  scope.HCReport={details,operation,comparisons,bind,build,today};
})(typeof window!=='undefined'?window:globalThis);
