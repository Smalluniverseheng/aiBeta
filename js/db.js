/* ==================== DB · IndexedDB 本地缓存 ====================
 * 缓存小说章节、图片、模型列表等大文件
 * v5.4
 */
const DB = (() => {
  const DB_NAME = 'ThirdPartyAI_DB';
  const DB_VERSION = 1;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('cache')) {
          d.createObjectStore('cache', { keyPath: 'key' });
        }
        if (!d.objectStoreNames.contains('novel')) {
          d.createObjectStore('novel', { keyPath: 'key' });
        }
        if (!d.objectStoreNames.contains('images')) {
          d.createObjectStore('images', { keyPath: 'key' });
        }
      };
    });
  }

  async function get(key, storeName) {
    storeName = storeName || 'cache';
    try {
      const d = await open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { return null; }
  }

  async function set(key, value, storeName) {
    storeName = storeName || 'cache';
    try {
      const d = await open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put({ key, value, updatedAt: Date.now() });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { return false; }
  }

  async function del(key, storeName) {
    storeName = storeName || 'cache';
    try {
      const d = await open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { return false; }
  }

  async function clear(storeName) {
    storeName = storeName || 'cache';
    try {
      const d = await open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { return false; }
  }

  async function keys(storeName) {
    storeName = storeName || 'cache';
    try {
      const d = await open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) { return []; }
  }

  return { open, get, set, del, clear, keys };
})();
