/* Local previews only. Personal bytes never fall back to a network endpoint. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
function asset(id) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('ocr-local-testing');
    open.onerror = () => reject(new Error('Local database unavailable'));
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('assets')) { db.close(); resolve(null); return; }
      const tx = db.transaction('assets', 'readonly'), get = tx.objectStore('assets').get(id);
      get.onsuccess = () => resolve(get.result?.blob ?? null); get.onerror = () => reject(get.error);
      tx.oncomplete = () => db.close(); tx.onabort = () => db.close();
    };
  });
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !/^\/local-(assets|crop)\//.test(url.pathname)) return;
  event.respondWith((async () => {
    try {
      const parts = url.pathname.split('/'), id = decodeURIComponent(parts[2]);
      const page = parts[3] || '1'; const blob = await asset(`${id}:${page}`);
      if (!blob) return new Response('Local source unavailable', {status:404});
      if (parts[1] === 'local-assets') return new Response(blob, {headers:{'Content-Type':'image/png','Cache-Control':'no-store'}});
      const image = await createImageBitmap(blob);
      try {
        const coords = ['x1','y1','x2','y2'].map(k => Number(url.searchParams.get(k)));
        const [x1,y1,x2,y2] = coords;
        if (coords.some(v => !Number.isInteger(v)) || !(0<=x1 && x1<x2 && x2<=image.width && 0<=y1 && y1<y2 && y2<=image.height)) return new Response('Invalid crop', {status:422});
        const canvas = new OffscreenCanvas(x2-x1,y2-y1);
        canvas.getContext('2d').drawImage(image,x1,y1,x2-x1,y2-y1,0,0,x2-x1,y2-y1);
        return new Response(await canvas.convertToBlob({type:'image/png'}), {headers:{'Content-Type':'image/png','Cache-Control':'no-store'}});
      } finally { image.close(); }
    } catch { return new Response('Local preview unavailable', {status:503}); }
  })());
});
