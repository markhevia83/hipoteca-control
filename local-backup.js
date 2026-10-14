/* Explicit portable backup; never replaces existing cases or silently imports team data. */
(function () {
  'use strict';
  const key = 'hipoteca-control-inline-v1';
  function read() {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(data)) throw Error('El registro local no es válido.');
    return data;
  }
  function valid(c) { return c && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(c.id) && Array.isArray(c.applicants) && c.applicants.every(a => a && typeof a === 'object' && !Array.isArray(a)) && ['loans','offers','followups'].every(k => c[k] === undefined || Array.isArray(c[k]) && c[k].every(v => v && typeof v === 'object' && !Array.isArray(v)));  }
  const panel = document.createElement('section');
  panel.style = 'max-width:1000px;margin:16px auto;padding:16px;box-sizing:border-box';
  panel.innerHTML = '<p>Modo local: los expedientes se guardan en este navegador y dispositivo. No se comparten con el equipo ni aparecen automáticamente en otro móvil. El modo privado o borrar los datos del navegador puede eliminarlos. Descarga copias regularmente y protege este dispositivo.</p><button type="button" data-backup-export>Descargar copia JSON</button> <button type="button" data-backup-import>Recuperar copia JSON</button><input type="file" accept="application/json,.json" hidden><p role="status" data-backup-status></p>';
  document.getElementById('hc-app').after(panel);
  const status = text => panel.querySelector('[data-backup-status]').textContent = text;
  panel.querySelector('[data-backup-export]').onclick = () => {
    try {
      const blob = new Blob([JSON.stringify({format:'hipoteca-control-backup',version:1,cases:read()},null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'hipoteca-control-copia-'+new Date().toISOString().slice(0,10)+'.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url),60000);
      status('Copia descargada. Contiene datos personales: guárdala en un lugar privado.');
    } catch (_) { status('No se puede leer la copia local. No se ha modificado el registro.'); }
  };
  const input = panel.querySelector('input');
  panel.querySelector('[data-backup-import]').onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files[0]; input.value = ''; if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw Error('Archivo demasiado grande (máximo 10 MB).');
      const backup = JSON.parse(await file.text());
      const incoming = Array.isArray(backup) ? backup : backup.format === 'hipoteca-control-backup' && backup.version === 1 ? backup.cases : null;
      if (!Array.isArray(incoming) || !incoming.every(valid)) throw Error('La copia no tiene un formato válido.');
      if (!confirm('Se añadirán los expedientes de esta copia a este navegador. Los que ya existan no se sobrescribirán. El archivo puede contener datos personales. ¿Continuar?')) return;
      const existing = read();
      const ids = new Set(existing.map(c => c.id)), additions = [];
      for (const c of incoming) if (!ids.has(c.id)) { ids.add(c.id); additions.push(c); }
      // Preserve the original, and stop without touching it if storage is unavailable/full.
      localStorage.setItem(key + ':before-import',JSON.stringify(existing));
      localStorage.setItem(key,JSON.stringify([...additions,...existing]));
      status(additions.length+' expedientes recuperados; '+(incoming.length-additions.length)+' ya existían. Vuelve a cargar la página para verlos.');
    } catch (e) { status('No se ha importado la copia. '+e.message+' Los datos anteriores se conservan.'); }
  };
})();
