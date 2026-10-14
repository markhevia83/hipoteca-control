/* Local copies are opt-in and scoped to the verified account, never a login substitute. */
(function (global) {
  'use strict';
  const PREFIX = 'hc-team-drafts-v1:';
  const RECOVERY_PREFIX = 'hc-team-recovery-v1:';
  const valid = d => d && d.schema === 1 && typeof d.account === 'string' &&
    typeof d.payload?.id === 'string' && Array.isArray(d.payload.applicants) &&
    (d.baseVersion === null || Number.isInteger(d.baseVersion));
  function drafts(storage, account) {
    const prefix = PREFIX + encodeURIComponent(account) + ':';
    const recoveryPrefix = RECOVERY_PREFIX + encodeURIComponent(account) + ':';
    // Each wrapper has a private recovery slot. Other tabs never overwrite it.
    const writer = global.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    const key = id => prefix + encodeURIComponent(id);
    const recoveryId = id => writer + ':' + encodeURIComponent(id);
    const recoveryKey = id => recoveryPrefix + recoveryId(id);
    const observed = new Map();
    function readRecovery(k) {
      const raw = storage.getItem(k);
      if (raw === null) return null;
      const value = JSON.parse(raw);
      if (!valid(value) || value.account !== account || typeof value.recoveryId !== 'string' ||
          k !== recoveryPrefix + value.recoveryId || !value.recoveryId.endsWith(':' + encodeURIComponent(value.payload.id))) throw Error('LOCAL_CORRUPT');
      return value;
    }
    function read(id, observe = true) {
      const raw = storage.getItem(key(id));
      if (raw === null) { if(observe) observed.set(id,null); return null; }
      const value = JSON.parse(raw);
      if (!valid(value) || value.account !== account || value.payload.id !== id) throw Error('LOCAL_CORRUPT');
      if(observe) observed.set(id,raw);
      return value;
    }
    return {
      read,
      list() {
        const result = []; result.errors = 0;
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k?.startsWith(prefix) && !k.endsWith(':previous')) { try { const value=read(decodeURIComponent(k.slice(prefix.length)));if(value)result.push(value); } catch (_) { result.errors++; } }
        }
        return result;
      },
      recoveries() {
        const result = []; result.errors = 0;
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k?.startsWith(recoveryPrefix)) { try { const value=readRecovery(k);if(value)result.push(value); } catch (_) { result.errors++; } }
        }
        return result;
      },
      write(payload, baseVersion) {
        const value = {schema:1, account, payload:JSON.parse(JSON.stringify(payload)), baseVersion, savedAt:new Date().toISOString()};
        if (!valid(value)) throw Error('LOCAL_INVALID');
        // localStorage has no cross-tab transaction. Keep this writer's latest
        // complete edit before touching the shared main or reporting a conflict.
        readRecovery(recoveryKey(payload.id)); // Preserve an unreadable recovery.
        storage.setItem(recoveryKey(payload.id), JSON.stringify({...value,recoveryId:recoveryId(payload.id)}));
        const raw = storage.getItem(key(payload.id));
        if(raw !== (observed.get(payload.id) ?? null)) throw Error('LOCAL_CONFLICT');
        const previous = read(payload.id,false); // Never replace an unreadable draft.
        if (previous && JSON.stringify(previous.payload) === JSON.stringify(payload) && previous.baseVersion === baseVersion) return previous;
        if (previous) storage.setItem(key(payload.id) + ':previous', JSON.stringify(previous));
        storage.setItem(key(payload.id), JSON.stringify(value));
        observed.set(payload.id,JSON.stringify(value)); // Atomic; old main survives quota failure.
        return value;
      },
      acknowledge(payload) {
        const value = read(payload.id, false);
        // A late network response may not remove a newer edit from another tab.
        if (value && JSON.stringify(value.payload) === JSON.stringify(payload)) {
          storage.removeItem(key(payload.id));
          storage.removeItem(key(payload.id) + ':previous');
          observed.set(payload.id,null);
        }
        const recovery = readRecovery(recoveryKey(payload.id));
        if (recovery && JSON.stringify(recovery.payload) === JSON.stringify(payload)) storage.removeItem(recoveryKey(payload.id));
      }
    };
  }
  function authStorage(local, session) {
    const flag = 'hc-team-remember-v1';
    let remember = false;
    try { remember = local.getItem(flag) === 'yes'; } catch (_) {}
    return {
      get remember() { return remember; },
      choose(value) {
        if (value) { local.setItem(flag, 'yes'); remember = true; }
        else { local.removeItem(flag); remember = false; }
      },
      getItem(key) { return (remember ? local.getItem(key) : null) || session.getItem(key); },
      setItem(key, value) {
        (remember ? local : session).setItem(key, value);
        (remember ? session : local).removeItem(key);
      },
      removeItem(key) { local.removeItem(key); session.removeItem(key); }
    };
  }
  global.HCTeamStorage = {drafts, authStorage};
  if (typeof module !== 'undefined') module.exports = global.HCTeamStorage;
})(typeof window === 'undefined' ? globalThis : window);
