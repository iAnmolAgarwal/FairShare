'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Core = require('../core.js');

test('require() exposes the API without leaking globals', () => {
  assert.equal(typeof Core.parseAmount, 'function');
  assert.equal(typeof Core.computeBalances, 'function');
  assert.equal(typeof Core.migrateTrip, 'function');
  assert.equal(typeof globalThis.FairShareCore, 'undefined');
});

test('in a browser, core.js exposes only window.FairShareCore', () => {
  const vm = require('vm');
  const fs = require('fs');
  const path = require('path');
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'core.js'), 'utf8'), { window });
  assert.deepEqual(Object.keys(window), ['FairShareCore']);
  assert.equal(typeof window.FairShareCore.computeSettlements, 'function');
});

test('formatMoney formats INR, USD, JPY and EUR minor units', () => {
  assert.equal(Core.formatMoney(1840000, 'INR'), '₹18,400');
  assert.equal(Core.formatMoney(1840050, 'INR'), '₹18,400.50');
  assert.equal(Core.formatMoney(1234, 'USD'), '$12.34');
  assert.equal(Core.formatMoney(1000, 'JPY'), '¥1,000');
  assert.equal(Core.formatMoney(1234, 'EUR'), '€12.34');
});

test('parseAmount uses currency minor digits', () => {
  assert.deepEqual(Core.parseAmount('12.34', 'USD'), { ok: true, paise: 1234 });
  assert.equal(Core.parseAmount('100.5', 'JPY').ok, false);
  assert.deepEqual(Core.parseAmount('1000', 'JPY'), { ok: true, paise: 1000 });
});

test('parseAmount rejects every invalid amount with a specific message', () => {
  const cases = [
    ['', /enter an amount/i],
    ['0x10', /hexadecimal/i],
    ['0X1F', /hexadecimal/i],
    ['0b101', /binary/i],
    ['1e3', /exponent/i],
    ['2E4', /exponent/i],
    ['-5', /negative/i],
    ['+5', /sign/i],
    ['0', /greater than 0/i],
    ['0.00', /greater than 0/i],
    ['10.005', /2 decimal/i],
    ['1.234', /2 decimal/i],
    ['10000000000', /exceed/i],
    ['1000000000.01', /exceed/i],
    ['abc', /valid amount/i],
    ['1.2.3', /valid amount/i]
  ];
  for (const [input, pattern] of cases) {
    const result = Core.parseAmount(input);
    assert.equal(result.ok, false, `expected "${input}" to be rejected`);
    assert.match(result.message, pattern, `message for "${input}" was "${result.message}"`);
  }
});

test('parseAmount accepts plain rupee values and ignores commas', () => {
  assert.deepEqual(Core.parseAmount('1,200.50'), { ok: true, paise: 120050 });
  assert.deepEqual(Core.parseAmount('100'), { ok: true, paise: 10000 });
  assert.deepEqual(Core.parseAmount('0.01'), { ok: true, paise: 1 });
  assert.deepEqual(Core.parseAmount('1.5'), { ok: true, paise: 150 });
  assert.deepEqual(Core.parseAmount(' 42 '), { ok: true, paise: 4200 });
  assert.deepEqual(Core.parseAmount('1000000'), { ok: true, paise: 100000000 });
});

test('splitPaise distributes leftover paise in member order', () => {
  const r1 = Core.splitPaise(10000, ['A', 'B', 'C'], ['A', 'B', 'C']);
  assert.deepStrictEqual({ ...r1 }, { A: 3334, B: 3333, C: 3333 });
  const r2 = Core.splitPaise(10000, ['C', 'A', 'B'], ['A', 'B', 'C']);
  assert.deepStrictEqual({ ...r2 }, { A: 3334, B: 3333, C: 3333 });
  const r3 = Core.splitPaise(1500, ['A', 'B'], ['A', 'B']);
  assert.deepStrictEqual({ ...r3 }, { A: 750, B: 750 });
  const r4 = Core.splitPaise(1, ['A', 'B', 'C'], ['A', 'B', 'C']);
  assert.deepStrictEqual({ ...r4 }, { A: 1, B: 0, C: 0 });
  const r5 = Core.splitPaise(500, [], ['A', 'B']);
  assert.deepStrictEqual({ ...r5 }, {});
});

test('splitPaise distributes JPY minor units without fractions', () => {
  const shares = Core.splitPaise(1000, ['A', 'B', 'C'], ['A', 'B', 'C']);
  assert.deepStrictEqual({ ...shares }, { A: 334, B: 333, C: 333 });
});

test('computeBalances matches the A/B/C/D fixture and sums to zero', () => {
  const trip = {
    members: ['A', 'B', 'C', 'D'],
    expenses: [
      { amountPaise: 10000, payer: 'A', participants: ['A', 'B', 'C'] },
      { amountPaise: 6000, payer: 'B', participants: ['A', 'B', 'C', 'D'] },
      { amountPaise: 9000, payer: 'C', participants: ['C', 'D'] }
    ]
  };
  const balances = Core.computeBalances(trip);
  assert.deepStrictEqual({ ...balances }, { A: 5166, B: 1167, C: -333, D: -6000 });
  const sum = Object.values(balances).reduce((total, value) => total + value, 0);
  assert.equal(sum, 0);
});

test('payments reduce, remove and flip settlement direction', () => {
  const base = { members: ['A', 'B'], expenses: [{ amountPaise: 10000, payer: 'A', participants: ['A', 'B'] }], payments: [] };
  const partial = Object.assign({}, base, { payments: [{ seq: 1, from: 'B', to: 'A', amountPaise: 2500, date: '2026-02-01' }] });
  assert.deepStrictEqual(Core.computeSettlements(partial), [{ from: 'B', to: 'A', amountPaise: 2500 }]);
  const full = Object.assign({}, base, { payments: [{ seq: 1, from: 'B', to: 'A', amountPaise: 5000, date: '2026-02-01' }] });
  assert.deepStrictEqual(Core.computeSettlements(full), []);
  const over = Object.assign({}, base, { payments: [{ seq: 1, from: 'B', to: 'A', amountPaise: 7000, date: '2026-02-01' }] });
  assert.deepStrictEqual(Core.computeSettlements(over), [{ from: 'A', to: 'B', amountPaise: 2000 }]);
});

test('migrateTrip upgrades an old-format trip without losing data', () => {
  const old = {
    name: '  Legacy Trip  ',
    members: [' A ', 'B', 'C'],
    expenses: [
      { seq: 1, description: ' Lunch ', amount: 12.5, payer: 'A', date: '2026-01-02', participants: ['A', 'B', 'C'] }
    ],
    nextSeq: 2
  };
  const migrated = Core.migrateTrip(old);
  assert.equal(migrated.schemaVersion, Core.SCHEMA_VERSION);
  assert.equal(migrated.name, 'Legacy Trip');
  assert.deepEqual(migrated.members, ['A', 'B', 'C']);
  assert.equal(migrated.expenses.length, 1);
    assert.equal(migrated.currency, 'INR');
    assert.equal(migrated.expenses[0].amountPaise, 1250);
  assert.equal(migrated.expenses[0].description, 'Lunch');
  assert.equal(migrated.expenses[0].date, '2026-01-02');
  assert.equal(migrated.nextSeq, 2);
});

test('migrateTrip accepts an already-migrated trip', () => {
  const trip = {
    schemaVersion: 3,
    currency: 'INR',
    name: 'New',
    members: ['A', 'B'],
    expenses: [
      { seq: 3, description: 'Taxi', amountPaise: 950, payer: 'B', date: '2026-03-04', participants: ['A', 'B'] }
    ],
    nextSeq: 4
  };
  const migrated = Core.migrateTrip(trip);
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.expenses[0].amountPaise, 950);
  assert.equal(migrated.nextSeq, 4);
});

test('migrateTrip rejects corrupted or invalid data', () => {
  const bad = [
    null,
    undefined,
    'not an object',
    42,
    {},
    { name: '', members: ['A', 'B'], expenses: [] },
    { name: 'T', members: ['A'], expenses: [] },
    { name: 'T', members: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'], expenses: [] },
    { name: 'T', members: ['A', 'B', 'a'], expenses: [] },
    { name: 'T', members: ['A', 'B'], expenses: 'nope' },
    { name: 'T', members: ['A', 'B'], expenses: [null] },
    { name: 'T', members: ['A', 'B'], expenses: [{ description: '', amountPaise: 1, payer: 'A', date: '2026-01-01', participants: ['A'] }] },
    { name: 'T', members: ['A', 'B'], expenses: [{ description: 'x', amountPaise: 0, payer: 'A', date: '2026-01-01', participants: ['A'] }] },
    { name: 'T', members: ['A', 'B'], expenses: [{ description: 'x', amountPaise: 100, payer: 'Z', date: '2026-01-01', participants: ['A'] }] },
    { name: 'T', members: ['A', 'B'], expenses: [{ description: 'x', amountPaise: 100, payer: 'A', date: '2026-13-40', participants: ['A'] }] },
    { name: 'T', members: ['A', 'B'], expenses: [{ description: 'x', amountPaise: 100, payer: 'A', date: '2026-01-01', participants: [] }] },
    { name: 'T', members: ['A', 'B'], expenses: [{ description: 'x', amountPaise: 100, payer: 'A', date: '2026-01-01', participants: ['Z'] }] }
  ];
  for (const value of bad) {
    assert.equal(Core.migrateTrip(value), null, 'expected invalid trip to be rejected: ' + JSON.stringify(value));
  }
});

test('formatIndianDate renders ISO dates in Indian style', () => {
  assert.equal(Core.formatIndianDate('2026-09-22'), '22 Sep 2026');
  assert.equal(Core.formatIndianDate('2026-01-02'), '2 Jan 2026');
  assert.equal(Core.formatIndianDate('2026-12-31'), '31 Dec 2026');
  assert.equal(Core.formatIndianDate('not-a-date'), 'not-a-date');
});

test('isValidDateStr validates real calendar dates', () => {
  assert.equal(Core.isValidDateStr('2024-02-29'), true);
  assert.equal(Core.isValidDateStr('2026-02-29'), false);
  assert.equal(Core.isValidDateStr('2026-13-01'), false);
  assert.equal(Core.isValidDateStr('2026-1-1'), false);
  assert.equal(Core.isValidDateStr(null), false);
});

test('getDateValidationError enforces the local date range', () => {
  assert.equal(Core.getDateValidationError('2026-02-28', '2026-02-28'), null);
  assert.equal(Core.getDateValidationError('2026-02-29', '2026-03-01'), 'Choose a valid date.');
  assert.equal(Core.getDateValidationError('2024-02-29', '2024-03-01'), null);
  assert.equal(Core.getDateValidationError('2026-03-01', '2026-02-28'), "Date can't be in the future.");
  assert.equal(Core.getDateValidationError('1999-12-31', '2026-02-28'), 'Enter a date after 1 Jan 2000.');
});

test('sortedExpenses orders newest first and ties by most recently added', () => {
  const trip = {
    expenses: [
      { seq: 1, date: '2026-09-22' },
      { seq: 3, date: '2026-12-31' },
      { seq: 2, date: '2026-12-31' }
    ]
  };
  assert.deepEqual(Core.sortedExpenses(trip).map((e) => e.seq), [3, 2, 1]);
});

function fixtureTrip() {
  return {
    schemaVersion: 3,
    currency: 'INR',
    name: 'Fixture',
    members: ['A', 'B', 'C', 'D'],
    expenses: [
      { seq: 1, description: 'A pays 100', amountPaise: 10000, payer: 'A', date: '2026-02-01', participants: ['A', 'B', 'C'] },
      { seq: 2, description: 'B pays 60', amountPaise: 6000, payer: 'B', date: '2026-02-02', participants: ['A', 'B', 'C', 'D'] },
      { seq: 3, description: 'C pays 90', amountPaise: 9000, payer: 'C', date: '2026-02-03', participants: ['C', 'D'] }
    ],
    nextSeq: 4
  };
}

test('updateExpense changes balances correctly and they still sum to zero', () => {
  const trip = fixtureTrip();
  const updated = Core.updateExpense(trip, 2, {
    description: 'B pays 80',
    amountPaise: 8000,
    payer: 'B',
    date: '2026-02-02',
    participants: ['A', 'B', 'C', 'D']
  });
  assert.notEqual(updated, null);
  const balances = Core.computeBalances(updated);
  assert.deepStrictEqual({ ...balances }, { A: 4666, B: 2667, C: -833, D: -6500 });
  assert.equal(Object.values(balances).reduce((total, value) => total + value, 0), 0);
  assert.equal(updated.expenses[1].seq, 2);
  assert.equal(updated.expenses[1].amountPaise, 8000);
});

test('updateExpense returns a new trip and does not mutate the original', () => {
  const trip = fixtureTrip();
  const before = JSON.parse(JSON.stringify(trip));
  const updated = Core.updateExpense(trip, 2, {
    description: 'B pays 80',
    amountPaise: 8000,
    payer: 'B',
    date: '2026-02-02',
    participants: ['A', 'B', 'C', 'D']
  });
  assert.notEqual(updated, trip);
  assert.notEqual(updated.expenses, trip.expenses);
  assert.deepEqual(trip, before);
});

test('updateExpense keeps seq so same-date ordering is stable', () => {
  const trip = {
    schemaVersion: 3,
    currency: 'INR',
    name: 'T',
    members: ['A', 'B'],
    nextSeq: 4,
    expenses: [
      { seq: 1, description: 'first', amountPaise: 100, payer: 'A', date: '2026-02-01', participants: ['A'] },
      { seq: 2, description: 'second', amountPaise: 200, payer: 'A', date: '2026-02-01', participants: ['A'] },
      { seq: 3, description: 'third', amountPaise: 300, payer: 'A', date: '2026-02-01', participants: ['A'] }
    ]
  };
  const updated = Core.updateExpense(trip, 2, {
    description: 'second edited',
    amountPaise: 250,
    payer: 'A',
    date: '2026-02-01',
    participants: ['A']
  });
  assert.deepEqual(Core.sortedExpenses(updated).map((e) => e.seq), [3, 2, 1]);
});

test('updateExpense rejects an unknown seq', () => {
  const trip = fixtureTrip();
  assert.equal(Core.updateExpense(trip, 99, {
    description: 'x',
    amountPaise: 100,
    payer: 'A',
    date: '2026-02-01',
    participants: ['A']
  }), null);
});

test('updateExpense rejects invalid changes without modifying the trip', () => {
  const trip = fixtureTrip();
  const before = JSON.parse(JSON.stringify(trip));
  const invalid = [
    null,
    { description: '', amountPaise: 100, payer: 'A', date: '2026-02-01', participants: ['A'] },
    { description: 'x', amountPaise: 0, payer: 'A', date: '2026-02-01', participants: ['A'] },
    { description: 'x', amountPaise: -100, payer: 'A', date: '2026-02-01', participants: ['A'] },
    { description: 'x', amountPaise: 10.5, payer: 'A', date: '2026-02-01', participants: ['A'] },
    { description: 'x', amountPaise: 2000000000, payer: 'A', date: '2026-02-01', participants: ['A'] },
    { description: 'x', amountPaise: 100, payer: 'Z', date: '2026-02-01', participants: ['A'] },
    { description: 'x', amountPaise: 100, payer: 'A', date: '2026-13-01', participants: ['A'] },
    { description: 'x', amountPaise: 100, payer: 'A', date: '2026-02-01', participants: [] },
    { description: 'x', amountPaise: 100, payer: 'A', date: '2026-02-01', participants: ['Z'] }
  ];
  for (const changes of invalid) {
    assert.equal(Core.updateExpense(trip, 2, changes), null);
  }
  assert.deepEqual(trip, before);
});

test('removeExpense deletes the expense and balances still sum to zero', () => {
  const trip = fixtureTrip();
  const updated = Core.removeExpense(trip, 3);
  assert.notEqual(updated, null);
  assert.equal(updated.expenses.length, 2);
  const balances = Core.computeBalances(updated);
  assert.deepStrictEqual({ ...balances }, { A: 5166, B: 1167, C: -4833, D: -1500 });
  assert.equal(Object.values(balances).reduce((total, value) => total + value, 0), 0);
});

test('restoreExpense returns the exact original trip', () => {
  const trip = fixtureTrip();
  const removed = trip.expenses[2];
  const afterRemove = Core.removeExpense(trip, 3);
  const restored = Core.restoreExpense(afterRemove, removed);
  assert.deepEqual(restored, trip);
});

test('removeExpense rejects an unknown seq', () => {
  const trip = fixtureTrip();
  assert.equal(Core.removeExpense(trip, 99), null);
});

test('removeExpense and restoreExpense never mutate their inputs', () => {
  const trip = fixtureTrip();
  const before = JSON.parse(JSON.stringify(trip));
  const removed = trip.expenses[2];
  const removedBefore = JSON.parse(JSON.stringify(removed));
  const afterRemove = Core.removeExpense(trip, 3);
  Core.restoreExpense(afterRemove, removed);
  assert.deepEqual(trip, before);
  assert.deepEqual(removed, removedBefore);
});

test('restoreExpense rejects duplicates and bad input', () => {
  const trip = fixtureTrip();
  assert.equal(Core.restoreExpense(trip, trip.expenses[0]), null);
  assert.equal(Core.restoreExpense(trip, null), null);
  assert.equal(Core.restoreExpense(null, trip.expenses[0]), null);
  assert.equal(Core.removeExpense(null, 1), null);
});

test('computeBalances works with __proto__ as a member name', () => {
  const trip = {
    members: ['__proto__', 'B'],
    expenses: [
      { amountPaise: 10000, payer: '__proto__', participants: ['__proto__', 'B'] }
    ]
  };
  const balances = Core.computeBalances(trip);
  assert.equal(Object.keys(balances).length, 2);
  assert.equal(typeof balances.__proto__, 'number');
  assert.equal(typeof balances.B, 'number');
  const sum = Object.values(balances).reduce((total, val) => total + val, 0);
  assert.equal(sum, 0);
});

test('migrateTrip rejects duplicate participants', () => {
  const raw = {
    name: 'T',
    members: ['A', 'B'],
    expenses: [
      { seq: 1, description: 'x', amount: 10, payer: 'A', date: '2026-01-01', participants: ['A', 'A', 'B'] }
    ]
  };
  assert.equal(Core.migrateTrip(raw), null);
});

test('migrateTrip rejects duplicate expense seq values', () => {
  const raw = {
    name: 'T',
    members: ['A', 'B'],
    expenses: [
      { seq: 1, description: 'x', amount: 10, payer: 'A', date: '2026-01-01', participants: ['A', 'B'] },
      { seq: 1, description: 'y', amount: 20, payer: 'B', date: '2026-01-02', participants: ['A', 'B'] }
    ]
  };
  assert.equal(Core.migrateTrip(raw), null);
});

test('migrateTrip rejects legacy amount 1e308', () => {
  const raw = {
    name: 'T',
    members: ['A', 'B'],
    expenses: [
      { seq: 1, description: 'x', amount: 1e308, payer: 'A', date: '2026-01-01', participants: ['A', 'B'] }
    ]
  };
  assert.equal(Core.migrateTrip(raw), null);
});

test('validateExpenseFields rejects duplicate participants', () => {
  assert.equal(Core.validateExpenseFields({
    description: 'x', amountPaise: 100, payer: 'A', date: '2026-01-01', participants: ['A', 'A', 'B']
  }, ['A', 'B']), false);
});

test('validateExpenseFields rejects non-existing seq', () => {
  assert.equal(Core.validateExpenseFields({
    description: 'x', amountPaise: 100, payer: 'A', date: '2026-01-01', participants: ['A'], seq: -1
  }, ['A', 'B']), false);
});

test('validateExpenseFields rejects duplicate seq', () => {
  assert.equal(Core.validateExpenseFields({
    description: 'x', amountPaise: 100, payer: 'A', date: '2026-01-01', participants: ['A'], seq: 1
  }, ['A', 'B'], [1, 2]), false);
});

test('checkSaveConflict allows save when revision matches', () => {
  const trip = JSON.stringify({ revision: 3, name: 'T', members: ['A', 'B'], expenses: [], nextSeq: 1 });
  assert.deepEqual(Core.checkSaveConflict(3, trip), { ok: true });
});

test('checkSaveConflict rejects save when revision differs', () => {
  const trip = JSON.stringify({ revision: 5, name: 'T', members: ['A', 'B'], expenses: [], nextSeq: 1 });
  assert.deepEqual(Core.checkSaveConflict(3, trip), { ok: false, storedRevision: 5 });
});

test('checkSaveConflict allows save when stored data is null', () => {
  assert.deepEqual(Core.checkSaveConflict(0, null), { ok: true });
});

test('checkSaveConflict allows save when stored data is the JSON text null', () => {
  assert.deepEqual(Core.checkSaveConflict(0, 'null'), { ok: true });
});

test('checkSaveConflict allows save when stored data is a non-object JSON value', () => {
  assert.deepEqual(Core.checkSaveConflict(0, 'true'), { ok: true });
  assert.deepEqual(Core.checkSaveConflict(0, '[1,2]'), { ok: true });
  assert.deepEqual(Core.checkSaveConflict(0, '"hello"'), { ok: true });
  assert.deepEqual(Core.checkSaveConflict(0, '42'), { ok: true });
});

test('checkSaveConflict allows save when stored data lacks trip structure even with revision', () => {
  assert.deepEqual(Core.checkSaveConflict(0, JSON.stringify({ revision: 5 })), { ok: true });
});

test('checkSaveConflict allows save when stored data is unparseable', () => {
  assert.deepEqual(Core.checkSaveConflict(0, '{bad'), { ok: true });
});

test('checkSaveConflict treats missing revision as 0', () => {
  const stored = JSON.stringify({ name: 'T', members: ['A', 'B'], expenses: [], nextSeq: 1 });
  assert.deepEqual(Core.checkSaveConflict(0, stored), { ok: true });
  assert.deepEqual(Core.checkSaveConflict(1, stored), { ok: false, storedRevision: 0 });
});

test('prepareSave with empty storage and no current trip saves as revision 1', () => {
  const saved = Core.prepareSave(0, null);
  assert.deepEqual(saved, { ok: true, nextRevision: 1 });
});

test('prepareSave with matching revision saves with next revision', () => {
  const trip = JSON.stringify({ name: 'T', members: ['A', 'B'], expenses: [], nextSeq: 1, revision: 3 });
  const saved = Core.prepareSave(3, trip);
  assert.deepEqual(saved, { ok: true, nextRevision: 4 });
});

test('prepareSave with different revision is a conflict', () => {
  const trip = JSON.stringify({ name: 'T', members: ['A', 'B'], expenses: [], nextSeq: 1, revision: 5 });
  const saved = Core.prepareSave(3, trip);
  assert.deepEqual(saved, { ok: false, storedRevision: 5 });
});

test('prepareSave with corrupted or null stored value does not crash and allows save', () => {
  assert.deepEqual(Core.prepareSave(0, 'null'), { ok: true, nextRevision: 1 });
  assert.deepEqual(Core.prepareSave(0, 'true'), { ok: true, nextRevision: 1 });
  assert.deepEqual(Core.prepareSave(0, '{bad'), { ok: true, nextRevision: 1 });
  assert.deepEqual(Core.prepareSave(0, JSON.stringify({})), { ok: true, nextRevision: 1 });
});

test('computeSettlements produces the expected payments for the A/B/C/D fixture', () => {
  const trip = fixtureTrip();
  const settlements = Core.computeSettlements(trip);
  assert.deepStrictEqual(settlements, [
    { from: 'D', to: 'A', amountPaise: 5166 },
    { from: 'D', to: 'B', amountPaise: 834 },
    { from: 'C', to: 'B', amountPaise: 333 }
  ]);
});

test('computeSettlements payments exactly cancel all balances', () => {
  const trip = fixtureTrip();
  const settlements = Core.computeSettlements(trip);
  const paid = {};
  const received = {};
  trip.members.forEach((m) => { paid[m] = 0; received[m] = 0; });
  settlements.forEach((s) => {
    paid[s.from] += s.amountPaise;
    received[s.to] += s.amountPaise;
  });
  const net = Core.computeBalances(trip);
  trip.members.forEach((m) => {
    const expected = net[m];
    const actual = received[m] - paid[m];
    assert.equal(actual, expected, `net for ${m}: expected ${expected}, got ${actual}`);
  });
});

test('computeSettlements returns empty list for an all-settled trip', () => {
  const trip = { members: ['A', 'B'], expenses: [] };
  assert.deepStrictEqual(Core.computeSettlements(trip), []);
});

test('computeSettlements works with a __proto__ member', () => {
  const trip = {
    members: ['__proto__', 'B'],
    expenses: [{ amountPaise: 10000, payer: '__proto__', participants: ['__proto__', 'B'] }]
  };
  const settlements = Core.computeSettlements(trip);
  const sumPaid = settlements.reduce((t, s) => t + s.amountPaise, 0);
  const sumReceived = settlements.reduce((t, s) => t + s.amountPaise, 0);
  assert.equal(sumPaid, sumReceived, 'total paid equals total received');
  assert.equal(settlements.length, 1);
  assert.equal(settlements[0].from, 'B');
  assert.equal(settlements[0].to, '__proto__');
});

test('buildExport produces the correct object shape and file name', () => {
  const trip = { name: 'Goa 2026', members: ['A', 'B'] };
  const now = '2026-09-22T10:00:00.000Z';
  const result = Core.buildExport(trip, now);
  assert.equal(result.object.app, 'FairShare');
  assert.equal(result.object.exportVersion, 1);
  assert.equal(result.object.schemaVersion, Core.SCHEMA_VERSION);
  assert.equal(result.object.exportedAt, now);
  assert.deepEqual(result.object.trip, trip);
  assert.equal(result.fileName, 'fairshare-goa-2026-2026-09-22.json');
});

test('buildExport slug handles special characters', () => {
  const trip = { name: 'My Trip! #1 (test)', members: ['A'] };
  const result = Core.buildExport(trip, '2026-09-22T00:00:00.000Z');
  assert.equal(result.fileName, 'fairshare-my-trip-1-test-2026-09-22.json');
});

const { migrateTrip, parseAmount, addPayment } = Core;

test('migrateTrip shares one sequence counter across expenses and payments', () => {
  const trip = migrateTrip({
    name: 'Seq', members: ['a', 'b'],
    expenses: [{ seq: 1, description: 'x', amountPaise: 100, payer: 'a', date: '2026-01-01', participants: ['a', 'b'] }],
    payments: [{ seq: 2, from: 'b', to: 'a', amountPaise: 50, date: '2026-01-02' }],
  });
  assert.equal(trip.nextSeq, 3);
  assert.equal('nextPaymentSeq' in trip, false, 'payments share nextSeq; no second counter');
});

test('migrateTrip assigns sequences to legacy expenses without seq', () => {
  const trip = migrateTrip({
    name: 'Legacy', members: ['a', 'b'],
    expenses: [
      { description: 'x', amountPaise: 100, payer: 'a', date: '2026-01-01', participants: ['a', 'b'] },
      { description: 'y', amountPaise: 200, payer: 'b', date: '2026-01-02', participants: ['a', 'b'] },
    ],
  });
  assert.deepEqual(trip.expenses.map((e) => e.seq), [1, 2]);
});

test('currency lookups ignore inherited object keys', () => {
  assert.equal(migrateTrip({ name: 'P', members: ['a', 'b'], expenses: [], currency: 'constructor' }), null);
  assert.equal(parseAmount('12', 'toString').ok, false);
});

test('payments may exceed the single-expense cap so any settlement can be recorded', () => {
  const trip = migrateTrip({ name: 'Big', members: ['a', 'b'], expenses: [] });
  const updated = addPayment(trip, { seq: 1, from: 'a', to: 'b', amountPaise: 1500000000, date: '2026-01-01' });
  assert.ok(updated);
});

test('parseAmount reads decimal commas and rejects ambiguous separators', () => {
  assert.deepEqual(parseAmount('12,50', 'EUR'), { ok: true, paise: 1250 });
  assert.deepEqual(parseAmount('1,00,000', 'INR'), { ok: true, paise: 10000000 });
  assert.deepEqual(parseAmount('1,234,567', 'USD'), { ok: true, paise: 123456700 });
  assert.equal(parseAmount('1,2345', 'USD').ok, false);
});

test('parseAmount rejects ambiguous comma input instead of inflating it', () => {
  for (const raw of ['0,001', '0,010', '1,234,56,789', '12,3456']) {
    assert.equal(Core.parseAmount(raw, 'EUR').ok, false, raw);
  }
  assert.equal(Core.parseAmount('12,34,567', 'INR').paise, 123456700);
  assert.equal(Core.parseAmount('1,234,567', 'USD').paise, 123456700);
  assert.equal(Core.parseAmount('-12,50', 'EUR').message, 'Amount cannot be negative.');
});

test('parseAmount accepts a larger explicit limit for payments', () => {
  assert.equal(Core.parseAmount('30000000', 'INR').ok, false);
  assert.equal(Core.parseAmount('30000000', 'INR', Core.MAX_PAYMENT_MINOR).paise, 3000000000);
});

test('migrateTrip keeps seq 0, a larger stored nextSeq, and never reuses a payment seq', () => {
  const base = { name: 'S', members: ['a', 'b'] };
  const exp = (seq) => Object.assign({ description: 'x', amountPaise: 100, payer: 'a', date: '2026-01-01', participants: ['a', 'b'] }, seq === undefined ? {} : { seq });
  const kept = Core.migrateTrip(Object.assign({}, base, { expenses: [exp(0), exp(1)], nextSeq: 50 }));
  assert.deepEqual(kept.expenses.map((e) => e.seq), [0, 1]);
  assert.equal(kept.nextSeq, 50);
  const legacy = Core.migrateTrip(Object.assign({}, base, {
    expenses: [exp()], payments: [{ seq: 1, from: 'b', to: 'a', amountPaise: 50, date: '2026-01-02' }],
  }));
  assert.equal(legacy.expenses[0].seq, 2);
  assert.equal(legacy.nextSeq, 3);
});

test('migrateTrip rejects payment seqs that are not safe integers', () => {
  const trip = Core.migrateTrip({ name: 'S', members: ['a', 'b'], expenses: [],
    payments: [{ seq: 1e308, from: 'b', to: 'a', amountPaise: 50, date: '2026-01-02' }] });
  assert.equal(trip, null);
});

test('checkSaveConflict treats a different trip id at the same revision as a conflict', () => {
  const stored = JSON.stringify({ name: 'New', members: ['a', 'b'], revision: 1, id: 'trip-bbbbbbbb' });
  assert.equal(Core.checkSaveConflict(1, stored, 'trip-aaaaaaaa').ok, false);
  assert.equal(Core.checkSaveConflict(1, stored, 'trip-bbbbbbbb').ok, true);
  assert.equal(Core.checkSaveConflict(1, stored).ok, true, 'id is only compared when the caller has a trip');
});

test('updatePayment validates the replacement and keeps the seq', () => {
  const trip = Core.migrateTrip({ name: 'S', members: ['a', 'b'], expenses: [],
    payments: [{ seq: 4, from: 'b', to: 'a', amountPaise: 50, date: '2026-01-02' }] });
  assert.equal(Core.updatePayment(trip, 4, { from: 'b', to: 'b', amountPaise: 50, date: '2026-01-02' }), null, 'same payer and payee is rejected');
  const updated = Core.updatePayment(trip, 4, { from: 'a', to: 'b', amountPaise: 70, date: '2026-01-03' });
  assert.deepEqual(updated.payments, [{ seq: 4, from: 'a', to: 'b', amountPaise: 70, date: '2026-01-03' }]);
  assert.equal(Core.updatePayment(trip, 9, { from: 'a', to: 'b', amountPaise: 70, date: '2026-01-03' }), null, 'unknown seq');
});

test('parseAmount rejects a three-digit leading group in Indian grouping', () => {
  assert.equal(Core.parseAmount('123,45,678', 'INR').ok, false);
  assert.equal(Core.parseAmount('12,34,567', 'INR').paise, 123456700);
});

test('stored payments above the typed limit still load, and their settlements can be recorded', () => {
  const pay = (seq, amountPaise) => ({ seq, from: 'a', to: 'b', amountPaise, date: '2026-01-01' });
  const one = Core.migrateTrip({ name: 'S', members: ['a', 'b'], expenses: [], payments: [pay(1, Core.MAX_PAYMENT_MINOR + 1)] });
  assert.ok(one, 'a large stored payment is not treated as corrupt');
  const two = Core.migrateTrip({ name: 'S', members: ['a', 'b'], expenses: [], payments: [pay(1, 1e13), pay(2, 1e13)] });
  const settlement = Core.computeSettlements(two)[0];
  assert.equal(settlement.amountPaise, 2e13);
  assert.ok(Core.addPayment(two, Object.assign({ seq: 3, date: '2026-01-02' }, settlement)));
});

test('trips whose total volume is not a safe integer are rejected', () => {
  const pay = (seq) => ({ seq, from: 'a', to: 'b', amountPaise: 9e15, date: '2026-01-01' });
  assert.equal(Core.migrateTrip({ name: 'S', members: ['a', 'b'], expenses: [], payments: [pay(1), pay(2)] }), null);
});

test('sequence numbers are bounded so the next one is always exact', () => {
  const trip = Core.migrateTrip({ name: 'S', members: ['a', 'b'],
    expenses: [{ description: 'x', amountPaise: 1, payer: 'a', date: '2026-01-01', participants: ['a'] }],
    payments: [{ seq: 2147483647, from: 'a', to: 'b', amountPaise: 1, date: '2026-01-01' }] });
  assert.equal(trip, null, 'no seq can be allocated past the limit');
});
