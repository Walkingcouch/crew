'use strict';

/**
 * payments/__tests__/fake-supabase.js
 *
 * A minimal in-memory stand-in for @supabase/supabase-js's query builder,
 * supporting exactly the chains payments/*.js and lib/invoices.js use
 * (from/select/eq/single/insert/update/delete, with the .eq().eq() CAS
 * guard pattern), so the escrow lifecycle test can run without a live
 * Supabase project. Not a general-purpose mock, just enough surface area
 * for these specific call patterns.
 */

function makeStore() {
  const tables = new Map();
  let autoId = 1;
  let invoiceSeq = 1;

  function table(name) {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  }

  function matches(row, filters) {
    return filters.every(([col, val]) => row[col] === val);
  }

  function builder(name) {
    const filters = [];
    let pendingInsert = null;
    let pendingUpdate = null;
    let selectCols = null;
    let wantSingle = false;
    let isDelete = false;

    const api = {
      select(cols) { selectCols = cols; return api; },
      eq(col, val) { filters.push([col, val]); return api; },
      single() { wantSingle = true; return exec(); },
      delete() { isDelete = true; return exec(); },
      insert(obj) { pendingInsert = Array.isArray(obj) ? obj : [obj]; return api; },
      update(obj) { pendingUpdate = obj; return api; },
      in(col, vals) { filters.push([col, { __in: vals }]); return api; },
      then(resolve, reject) { return exec().then(resolve, reject); }, // allow `await builder` without terminal call
    };

    async function exec() {
      const rows = table(name);

      if (pendingInsert) {
        const inserted = [];
        for (const obj of pendingInsert) {
          // Emulate unique constraints the tests rely on.
          if (name === 'webhook_events' && rows.some(r => r.provider_event_id === obj.provider_event_id)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          if (name === 'invoices' && rows.some(r => r.booking_id === obj.booking_id && r.recipient === obj.recipient)) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
          const row = { id: obj.id || String(autoId++), ...obj };
          if (name === 'invoices' && !row.invoice_number) {
            row.invoice_number = 'CRW-INV-' + String(invoiceSeq++).padStart(6, '0');
          }
          rows.push(row);
          inserted.push(row);
        }
        if (wantSingle) return { data: inserted[0], error: null };
        return { data: inserted, error: null };
      }

      if (pendingUpdate) {
        const matched = rows.filter(r => matches(r, filters.filter(([, v]) => typeof v !== 'object')));
        for (const row of matched) Object.assign(row, pendingUpdate);
        if (wantSingle) return { data: matched[0] || null, error: matched.length ? null : { message: 'no rows' } };
        return { data: matched, error: null };
      }

      if (isDelete) {
        const keep = rows.filter(r => !matches(r, filters.filter(([, v]) => typeof v !== 'object')));
        const table_ = table(name);
        table_.length = 0;
        table_.push(...keep);
        return { data: null, error: null };
      }

      // Plain select
      let result = rows.filter(r => {
        return filters.every(([col, val]) => {
          if (val && typeof val === 'object' && val.__in) return val.__in.includes(r[col]);
          return r[col] === val;
        });
      });
      if (wantSingle) {
        return result.length ? { data: result[0], error: null } : { data: null, error: { message: 'no rows found' } };
      }
      return { data: result, error: null, count: result.length };
    }

    return api;
  }

  return {
    from(name) { return builder(name); },
    channel() { return { on() { return this; }, subscribe() { return this; } }; },
    storage: {
      from() {
        return {
          async upload() { return { data: { path: 'fake' }, error: null }; },
          async createSignedUrl(path) { return { data: { signedUrl: `https://fake.local/${path}` }, error: null }; },
        };
      },
    },
    _tables: tables,
  };
}

/** Installs a fake @supabase/supabase-js into require.cache so every
 *  payments/*.js module that does require('@supabase/supabase-js') gets
 *  the same fake client instance. Must be called before requiring any
 *  payments/*.js module for the first time in the test process. */
function installFakeSupabase() {
  const store = makeStore();
  const modulePath = require.resolve('@supabase/supabase-js');
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: { createClient: () => store },
  };
  return store;
}

module.exports = { installFakeSupabase, makeStore };
