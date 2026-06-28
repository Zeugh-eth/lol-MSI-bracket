(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const KEY = 'msi2026sim';
  function b64encode(str) {
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64decode(b64) {
    if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
    return decodeURIComponent(escape(atob(b64)));
  }
  function encode(state) { return b64encode(JSON.stringify(state)); }
  function decode(str) {
    if (!str) return null;
    try { const o = JSON.parse(b64decode(str)); return (o && typeof o === 'object') ? o : null; }
    catch (e) { return null; }
  }
  function save(state, storage) { try { storage.setItem(KEY, encode(state)); } catch (e) {} }
  function load(storage) { try { return decode(storage.getItem(KEY)); } catch (e) { return null; } }
  return { __name: 'MSI_Persist', KEY, encode, decode, save, load };
});
