'use strict';

/**
 * payments/__tests__/fake-supabase.js
 *
 * A minimal in-memory stand-in for @supabase/supabase-js's query builder,
 * supporting the chains payments/*.js, lib/invoices.js, lib/quotes-routes.js
 * and lib/cron-jobs.js use (select/eq/neq/in/gt/gte/lt/lte/is/not, single,
 * insert/update/delete/upsert), so tests can run without a live Supabase
 * project. Not a general-purpose mock, just enough surface area for these
 * specific call patterns. Comparisons work on ISO date strings and numbers
 * via plain JS `<`/`>` (lexicographic ISO-8601 comparison is correct for
 * same-format datetime strings, matching Postgres's own timestamp ordering
 * for that comparison shape).
 */

function cmp(a, b) {
  if (a === undefined || a === null) return b === undefined || b === null ? 0 : -1;
  if (b === undefined || b === null) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function rowMatchesFilter(row, { col, op, val }) {
  const cell = row[col];
  switch (op) {
    case 'eq':  return cell === val;
    case 'neq': return cell !== val;
    case 'in':  return val.includes(cell);
    case 'gt':  return cmp(cell, val) > 0;
    case 'gte': return cmp(cell, val) >= 0;
    case 'lt':  return cmp(cell, val) < 0;
    case 'lte': return cmp(cell, val) <= 0;
    case 'is':  return val === null ? (cell === null || cell === undefined) : cell === val;
    case 'not_is': return val === null ? !(cell === null || cell === undefined) : cell !== val;
    case 'or': return val.some(f => rowMatchesFilter(row, f));
    default: throw new Error(`fake-supabase: unsupported operator "${op}"`);
  }
}

function rowMatchesAll(row, filters) {
  return filters.every(f => rowMatchesFilter(row, f));
}

function makeStore() {
  const tables = new Map();
  let autoId = 1;
  let invoiceSeq = 1;

  function table(name) {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  }

  function builder(name) {
    const filters = [];
    let pendingInsert = null;
    let pendingUpdate = null;
    let pendingUpsert = null;
    let upsertConflictCols = null;
    let wantSingle = false;
    let isDelete = false;

    const api = {
      select() { return api; },
      eq(col, val)  { filters.push({ col, op: 'eq', val }); return api; },
      neq(col, val) { filters.push({ col, op: 'neq', val }); return api; },
      in(col, vals) { filters.push({ col, op: 'in', val: vals }); return api; },
      gt(col, val)  { filters.push({ col, op: 'gt', val }); return api; },
      gte(col, val) { filters.push({ col, op: 'gte', val }); return api; },
      lt(col, val)  { filters.push({ col, op: 'lt', val }); return api; },
      lte(col, val) { filters.push({ col, op: 'lte', val }); return api; },
      is(col, val)  { filters.push({ col, op: 'is', val }); return api; },
      not(col, _operator, val) { filters.push({ col, op: 'not_is', val }); return api; },
      order() { return api; },
      // Simplified: supports the "colA.eq.x,colB.lt.y" shape used by
      // credentials-routes.js's outstanding-credentials check.
      or(expr) {
        const parts = expr.split(',').map(p => {
          const [col, op, ...rest] = p.split('.');
          const rawVal = rest.join('.');
          const opMap = { eq: 'eq', lt: 'lt', gt: 'gt', gte: 'gte', lte: 'lte' };
          let val = rawVal;
          if (val === 'true') val = true;
          else if (val === 'false') val = false;
          return { col, op: opMap[op] || 'eq', val };
        });
        filters.push({ col: null, op: 'or', val: parts });
        return api;
      },
      single() { wantSingle = true; return exec(); },
      delete() { isDelete = true; return exec(); },
      insert(obj) { pendingInsert = Array.isArray(obj) ? obj : [obj]; return api; },
      update(obj) { pendingUpdate = obj; return api; },
      upsert(obj, opts) {
        pendingUpsert = Array.isArray(obj) ? obj : [obj];
        upsertConflictCols = (opts?.onConflict || '').split(',').filter(Boolean);
        return api;
      },
      then(resolve, reject) { return exec().then(resolve, reject); }, // allow `await builder` without a terminal call
    };

    async function exec() {
      const rows = table(name);

      if (pendingUpsert) {
        const results = [];
        for (const obj of pendingUpsert) {
          const existing = upsertConflictCols.length
            ? rows.find(r => upsertConflictCols.every(c => r[c] === obj[c]))
            : null;
          if (existing) {
            Object.assign(existing, obj);
            results.push(existing);
          } else {
            const row = { id: obj.id || String(autoId++), ...obj };
            rows.push(row);
            results.push(row);
          }
        }
        if (wantSingle) return { data: results[0], error: null };
        return { data: results, error: null };
      }

      if (pendingInsert) {
        const inserted = [];
        for (const obj of pendingInsert) {
          // Emulate the unique constraints the tests rely on.
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
        const matched = rows.filter(r => rowMatchesAll(r, filters));
        for (const row of matched) Object.assign(row, pendingUpdate);
        if (wantSingle) return { data: matched[0] || null, error: matched.length ? null : { message: 'no rows' } };
        return { data: matched, error: null };
      }

      if (isDelete) {
        const keep = rows.filter(r => !rowMatchesAll(r, filters));
        const table_ = table(name);
        table_.length = 0;
        table_.push(...keep);
        return { data: null, error: null };
      }

      // Plain select
      const result = rows.filter(r => rowMatchesAll(r, filters));
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
 *  payments/*.js and lib/*.js module that does require('@supabase/supabase-js')
 *  gets the same fake client instance. Must be called before requiring any
 *  such module for the first time in the test process. */
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
