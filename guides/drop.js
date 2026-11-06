// Rature · guides : le fichier choisi ou glissé sur la page s'ouvre directement dans l'éditeur, l'outil du guide déjà choisi.
// Il passe par le stockage du navigateur (IndexedDB « plume », celui de l'éditeur, clé « envoi ») : il ne quitte pas l'appareil.
// Sans JavaScript, le bouton reste un simple lien vers l'éditeur.
const zone = document.querySelector('.dropzone'), input = zone?.querySelector('input'), go = zone?.dataset.go;
function handoff(files) {
  if (!files?.length) return;
  files = [...files];
  const r = indexedDB.open('plume', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onerror = () => { location.href = zone.querySelector('a').href; }; // stockage refusé : l'éditeur s'ouvre, on y choisit le fichier
  r.onsuccess = () => {
    const tx = r.result.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(files, 'envoi');
    tx.oncomplete = () => { location.href = go; };
    tx.onerror = r.onerror;
  };
}
if (zone) {
  zone.querySelector('a').onclick = e => { e.preventDefault(); input.click(); };
  input.onchange = () => handoff(input.files);
  addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  addEventListener('dragleave', e => { if (!e.relatedTarget) zone.classList.remove('over'); });
  addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); handoff(e.dataTransfer.files); });
}
