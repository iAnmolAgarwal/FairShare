'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const INDEX = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const CORE = fs.readFileSync(path.join(__dirname, '..', 'core.js'), 'utf8');
const APP = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

const HTML = INDEX.replace(
  '<script src="core.js?v=0" defer></script>\n<script src="app.js?v=0" defer></script>',
  '<script>' + CORE + '</' + 'script><script>' + APP + '</' + 'script>'
);

// jsdom has no <dialog> API. Like browsers, close() fires "close" as a later task,
// so the focus-restoring close handlers run in these tests.
function installDialogShim(window) {
  const proto = window.HTMLDialogElement.prototype;
  proto.showModal = function () {
    this.open = true;
  };
  proto.close = function (returnValue) {
    if (!this.open) {
      return;
    }
    this.open = false;
    if (returnValue !== undefined) {
      this.returnValue = returnValue;
    }
    window.setTimeout(() => this.dispatchEvent(new window.Event('close')), 0);
  };
}

const tick = (window) => new Promise((resolve) => window.setTimeout(resolve, 0));

function page(seed, options) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message)));
  vc.on('error', (...a) => errors.push('error: ' + a.join(' ')));
  const html = (options && options.html) || HTML;
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    virtualConsole: vc,
    beforeParse(window) {
      installDialogShim(window);
      window.matchMedia = (query) => ({ matches: Boolean(options && options.desktop && query === '(min-width: 900px)') });
      if (seed !== undefined) {
        window.localStorage.setItem('fairshare.activeTrip.v1', seed);
      }
      if (options && options.beforeParse) {
        options.beforeParse(window);
      }
    }
  });
  return { dom, errors };
}

test('app smoke: desktop dashboard renders all workspace cards', () => {
  const { dom, errors } = page(undefined, { desktop: true });
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'Desktop test');
  assert.equal(doc.getElementById('view-expenses').hidden, false, 'expenses card is visible');
  assert.equal(doc.getElementById('view-balances').hidden, false, 'balances card is visible');
  assert.equal(doc.getElementById('view-settle').hidden, false, 'settle card is visible');
  assert.ok(doc.querySelector('#view-balances .balance-list'), 'balances render in desktop dashboard');
  assert.ok(doc.querySelector('#view-settle .settle-list'), 'settlements render in desktop dashboard');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

function addMember(doc, name) {
  doc.getElementById('member-name').value = name;
  doc.getElementById('add-member').click();
}

function createTrip(doc, name) {
  doc.getElementById('trip-name').value = name;
  doc.getElementById('trip-currency').value = 'INR';
  doc.getElementById('create-trip').click();
}

function addExpense(doc, win, opts) {
  doc.getElementById('add-expense-fab').click();
  doc.getElementById('expense-description').value = opts.desc;
  doc.getElementById('expense-amount').value = opts.amount;
  doc.getElementById('expense-payer').value = opts.payer;
  if (opts.date) doc.getElementById('expense-date').value = opts.date;
  doc.querySelectorAll('#participant-list input[type=checkbox]').forEach((box) => {
    box.checked = opts.participants.indexOf(box.value) !== -1;
  });
  doc.getElementById('expense-form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
}

function balances(doc) {
  const map = {};
  doc.querySelectorAll('#balance-list .balance-item').forEach((li) => {
    const name = li.querySelector('.balance-name');
    const amount = li.querySelector('.balance-amount');
    if (name && amount) map[name.textContent] = amount.textContent;
  });
  return map;
}

function settlementLines(doc) {
  return Array.from(doc.querySelectorAll('#settle-list li')).map((li) => li.textContent);
}

function findError(doc) {
  return doc.getElementById('load-failure').hidden === false ? 'load-failure visible' : null;
}

test('app smoke: on first load with empty storage, only setup screen is visible', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  assert.ok(!doc.getElementById('setup-screen').hidden, 'setup screen visible');
  assert.ok(doc.getElementById('workspace-screen').hidden, 'workspace hidden');
  assert.ok(!doc.getElementById('expense-dialog').open, 'expense dialog closed');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: trip saved under old storage key still loads after rename', () => {
  const oldTrip = JSON.stringify({
    schemaVersion: 2,
    name: 'Legacy',
    members: ['A', 'B'],
    expenses: [{ seq: 1, description: 'Old', amountPaise: 5000, payer: 'A', date: '2026-01-01', participants: ['A', 'B'] }],
    nextSeq: 2,
    revision: 0
  });
  const { dom, errors } = page(oldTrip);
  const doc = dom.window.document;
  assert.ok(!doc.getElementById('workspace-screen').hidden, 'workspace visible from old-key data');
  assert.equal(doc.getElementById('trip-title').textContent, 'Legacy', 'trip name restored');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: sample trip creates Goa balances through the normal save path', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  doc.getElementById('try-sample').click();

  assert.ok(doc.getElementById('workspace-screen').hidden === false, 'workspace opens');
  assert.equal(doc.getElementById('trip-title').textContent, 'Goa Trip');
  doc.getElementById('tab-balances').click();
  const bal = balances(doc);
  assert.equal(doc.querySelector('.total-row'), null, 'balances has no repeated total row');
  assert.ok(bal.Rohan.includes('12,200'), 'Rohan +12,200: ' + bal.Rohan);
  assert.ok(bal.Kabir.includes('6,200') && bal.Kabir.includes('-'), 'Kabir -6,200: ' + bal.Kabir);
  assert.ok(bal.Aarav.includes('4,600') && bal.Aarav.includes('-'), 'Aarav -4,600: ' + bal.Aarav);
  assert.ok(bal.Meera.includes('1,400') && bal.Meera.includes('-'), 'Meera -1,400: ' + bal.Meera);
  assert.equal(doc.querySelectorAll('#expense-list .expense-row').length, 3, 'three sample expenses appear');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: USD trip uses USD amount label and formatting', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  doc.getElementById('trip-name').value = 'USD trip';
  doc.getElementById('trip-currency').value = 'USD';
  doc.getElementById('create-trip').click();
  assert.equal(doc.getElementById('trip-summary').textContent, '2 members · $0 total');
  doc.getElementById('add-expense-fab').click();
  assert.equal(doc.getElementById('expense-amount-label').textContent, 'Amount (USD)');
  assert.equal(doc.getElementById('expense-amount').placeholder, '0.00');
  doc.getElementById('expense-description').value = 'Lunch';
  doc.getElementById('expense-amount').value = '12.34';
  doc.getElementById('expense-payer').value = 'A';
  doc.getElementById('expense-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.ok(doc.querySelector('.expense-row-amount').textContent.includes('$12.34'), 'expense shows USD amount');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: create trip, add expenses, verify balances and settlements', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;

  addMember(doc, 'A');
  addMember(doc, 'B');
  addMember(doc, 'C');
  addMember(doc, 'D');
  createTrip(doc, 'Goa 2026');

  assert.equal(findError(doc), null, 'no load failure');
  assert.equal(doc.getElementById('setup-screen').hidden, true, 'setup is hidden once the trip exists');
  assert.equal(doc.getElementById('workspace-screen').hidden, false, 'workspace is shown');

  addExpense(doc, dom.window, { desc: 'A pays 100', amount: '100', payer: 'A', date: '2026-02-01', participants: ['A', 'B', 'C'] });
  addExpense(doc, dom.window, { desc: 'B pays 60', amount: '60', payer: 'B', date: '2026-02-02', participants: ['A', 'B', 'C', 'D'] });
  addExpense(doc, dom.window, { desc: 'C pays 90', amount: '90', payer: 'C', date: '2026-02-03', participants: ['C', 'D'] });

  doc.getElementById('tab-balances').click();
  const bal = balances(doc);
  assert.ok(bal.A.includes('51.66'), 'A +51.66: ' + bal.A);
  assert.ok(bal.B.includes('11.67'), 'B +11.67: ' + bal.B);
  assert.ok(bal.C.includes('3.33') && bal.C.includes('-'), 'C -3.33: ' + bal.C);
  assert.ok(bal.D.includes('60') && bal.D.includes('-'), 'D -60: ' + bal.D);

  doc.getElementById('tab-settle').click();
  const lines = settlementLines(doc);
  assert.ok(lines.some((l) => l.includes('D pays A')), 'D pays A in settlements');
  assert.ok(lines.some((l) => l.includes('D pays B')), 'D pays B in settlements');
  assert.ok(lines.some((l) => l.includes('C pays B')), 'C pays B in settlements');
  assert.ok(Array.from(doc.querySelectorAll('#settle-list .settle-row-button')).every((item) => item.textContent.includes('pays')), 'settlement rows have visible payment names');

  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: mark suggested payment paid and undo it', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A'); addMember(doc, 'B'); createTrip(doc, 'Payments');
  addExpense(doc, dom.window, { desc: 'Dinner', amount: '100', payer: 'A', participants: ['A', 'B'] });
  doc.getElementById('tab-settle').click();
  const row = doc.querySelector('.settle-row-button');
  row.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 10 }));
  row.dispatchEvent(new dom.window.PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 150, clientY: 12 }));
  row.dispatchEvent(new dom.window.PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 12 }));
  assert.equal(JSON.parse(dom.window.localStorage.getItem('fairshare.activeTrip.v1')).payments.length, 1, 'payment recorded');
  doc.getElementById('app-toast-undo').click();
  assert.equal(JSON.parse(dom.window.localStorage.getItem('fairshare.activeTrip.v1')).payments.length, 0, 'payment undone');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: settle record payment pre-fills the first suggestion', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'Prefill');
  addExpense(doc, dom.window, { desc: 'Dinner', amount: '100', payer: 'A', participants: ['A', 'B'] });
  doc.getElementById('tab-settle').click();
  doc.getElementById('record-payment').click();
  assert.equal(doc.getElementById('payment-from').value, 'B');
  assert.equal(doc.getElementById('payment-to').value, 'A');
  assert.equal(doc.getElementById('payment-amount').value, '50');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: swiping a suggested payment records it', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'Swipe payment');
  addExpense(doc, dom.window, { desc: 'Dinner', amount: '100', payer: 'A', participants: ['A', 'B'] });
  doc.getElementById('tab-settle').click();
  const row = doc.querySelector('.settle-row-button');
  Object.defineProperty(row, 'offsetWidth', { configurable: true, value: 300 });
  row.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 10 }));
  row.dispatchEvent(new dom.window.PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 150, clientY: 12 }));
  row.dispatchEvent(new dom.window.PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 12 }));
  assert.equal(JSON.parse(dom.window.localStorage.getItem('fairshare.activeTrip.v1')).payments.length, 1, 'swipe records payment');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: same-day payment appears above an earlier expense', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'Same day');
  addExpense(doc, dom.window, { desc: 'Today expense', amount: '100', payer: 'A', participants: ['A', 'B'] });
  doc.getElementById('record-payment').click();
  doc.getElementById('payment-from').value = 'B';
  doc.getElementById('payment-to').value = 'A';
  doc.getElementById('payment-amount').value = '10';
  doc.getElementById('payment-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  const rows = Array.from(doc.querySelectorAll('#expense-list .expense-row'));
  assert.ok(rows[0].classList.contains('payment-row'), 'payment is newest on the same day');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: manually record a payment', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A'); addMember(doc, 'B'); createTrip(doc, 'Manual payment');
  doc.getElementById('record-payment').click();
  doc.getElementById('payment-from').value = 'B'; doc.getElementById('payment-to').value = 'A';
  doc.getElementById('payment-amount').value = '25';
  doc.getElementById('payment-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(JSON.parse(dom.window.localStorage.getItem('fairshare.activeTrip.v1')).payments[0].amountPaise, 2500);
  assert.ok(doc.querySelector('.payment-row'), 'payment appears in expenses feed');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: invalid submit focuses first invalid field', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'Test');

  doc.getElementById('add-expense-fab').click();
  doc.getElementById('expense-description').value = '';
  doc.getElementById('expense-amount').value = '';
  doc.getElementById('expense-payer').value = '';
  doc.getElementById('expense-date').value = '';
  doc.getElementById('expense-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));

  const focused = doc.activeElement;
  assert.ok(focused === doc.getElementById('expense-description'), 'focus on description, got: ' + (focused && focused.id));

  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: Cancel button closes the dialog without adding an expense', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'CancelTest');
  doc.getElementById('add-expense-fab').click();
  doc.getElementById('expense-description').value = 'Should not appear';
  doc.getElementById('cancel-expense-dialog').click();
  assert.ok(!doc.getElementById('expense-dialog').open, 'dialog is closed after Cancel');
  assert.equal(doc.querySelectorAll('#expense-list .expense-row').length, 0, 'no expenses added after cancel');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: Save expense through dialog creates expense and closes sheet', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'SaveTest');
  doc.getElementById('add-expense-fab').click();
  assert.equal(doc.getElementById('expense-dialog').getAttribute('aria-labelledby'), 'expense-form-title');
  assert.equal(doc.querySelectorAll('#participant-list input[type=checkbox]').length, 2, 'participants are real checkboxes');
  assert.equal(doc.querySelectorAll('#participant-list label.participant').length, 2, 'participants use chip labels');
  assert.equal(doc.getElementById('delete-expense-dialog').hidden, true, 'delete is hidden while adding');
  doc.getElementById('expense-description').value = 'Dinner';
  doc.getElementById('expense-amount').value = '50';
  doc.getElementById('expense-payer').value = 'A';
  doc.querySelectorAll('#participant-list input[type=checkbox]').forEach((box) => { box.checked = true; });
  doc.getElementById('expense-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.ok(!doc.getElementById('expense-dialog').open, 'dialog is closed after save');
  assert.ok(doc.querySelectorAll('#expense-list .expense-row').length > 0, 'expense row appears');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: edit and delete use the expense row and sheet', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'EditDeleteTest');
  addExpense(doc, dom.window, { desc: 'Dinner', amount: '50', payer: 'A', participants: ['A', 'B'] });

  doc.getElementById('edit-expense-1').click();
  assert.ok(doc.getElementById('expense-dialog').open, 'edit sheet opens from row');
  assert.equal(doc.getElementById('delete-expense-dialog').textContent, 'Delete');
  assert.equal(doc.querySelector('.expense-dialog-footer #save-expense').textContent, 'Save changes');
  assert.equal(doc.getElementById('expense-amount').value, '50');
  doc.getElementById('expense-amount').value = '60';
  doc.getElementById('expense-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.ok(!doc.getElementById('expense-dialog').open, 'edit sheet closes after save');
  assert.ok(doc.getElementById('edit-expense-1').textContent.includes('₹60'), 'row shows edited amount');

  doc.getElementById('edit-expense-1').click();
  doc.getElementById('delete-expense-dialog').click();
  assert.ok(!doc.getElementById('expense-dialog').open, 'delete closes edit sheet');
  assert.equal(doc.querySelectorAll('.expense-row').length, 0, 'deleted row is removed');
  assert.ok(!doc.getElementById('app-toast-undo').hidden, 'toast undo is visible');
  doc.getElementById('app-toast-undo').click();
  assert.equal(doc.querySelectorAll('.expense-row').length, 1, 'undo restores row');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: loading with #settle hash opens Settle up view', () => {
  const { dom } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'HashTest');
  // Switch to settle and set hash
  doc.getElementById('tab-settle').click();
  dom.window.location.hash = '#settle';
  // Reload-style: create a new page with the hash
  const saved = dom.window.localStorage.getItem('fairshare.activeTrip.v1');
  dom.window.close();

  const { dom: dom2, errors: err2 } = page(saved);
  const doc2 = dom2.window.document;
  doc2.defaultView.location.hash = '#settle';
  // Trigger hashchange
  doc2.defaultView.dispatchEvent(new dom2.window.Event('hashchange'));
  assert.ok(!doc2.getElementById('view-settle').hidden, 'settle view is visible');
  assert.ok(doc2.getElementById('view-expenses').hidden, 'expenses view is hidden');
  assert.equal(err2.length, 0, 'no console errors: ' + err2.join(' | '));
  dom2.window.close();
});

test('app smoke: reload from localStorage preserves balances', () => {
  const { dom: dom1 } = page();
  const doc1 = dom1.window.document;

  addMember(doc1, 'A');
  addMember(doc1, 'B');
  addMember(doc1, 'C');
  addMember(doc1, 'D');
  createTrip(doc1, 'Goa 2026');
  addExpense(doc1, dom1.window, { desc: 'A pays 100', amount: '100', payer: 'A', date: '2026-02-01', participants: ['A', 'B', 'C'] });
  addExpense(doc1, dom1.window, { desc: 'B pays 60', amount: '60', payer: 'B', date: '2026-02-02', participants: ['A', 'B', 'C', 'D'] });
  addExpense(doc1, dom1.window, { desc: 'C pays 90', amount: '90', payer: 'C', date: '2026-02-03', participants: ['C', 'D'] });

  const saved = dom1.window.localStorage.getItem('fairshare.activeTrip.v1');
  dom1.window.close();

  assert.ok(saved, 'trip was saved to localStorage');

  const { dom: dom2, errors } = page(saved);
  const doc2 = dom2.window.document;
  const bal = balances(doc2);
  assert.ok(bal.A.includes('51.66'), 'A +51.66 after reload: ' + bal.A);
  assert.ok(bal.B.includes('11.67'), 'B +11.67 after reload: ' + bal.B);
  assert.ok(bal.C.includes('3.33') && bal.C.includes('-'), 'C -3.33 after reload: ' + bal.C);
  assert.ok(bal.D.includes('60') && bal.D.includes('-'), 'D -60 after reload: ' + bal.D);
  assert.equal(errors.length, 0, 'no console errors after reload: ' + errors.join(' | '));
  dom2.window.close();
});

test('app smoke: start new without exporting shows empty setup and clears saved data', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;

  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'Test');

  const savedBefore = dom.window.localStorage.getItem('fairshare.activeTrip.v1');
  assert.ok(savedBefore, 'trip exists before start new');

  doc.getElementById('new-trip').click();
  assert.ok(doc.getElementById('new-trip-dialog').open, 'new trip dialog is open');
  assert.equal(doc.activeElement.id, 'confirm-cancel', 'cancel receives initial focus');
  doc.getElementById('confirm-start-new').click();

  assert.ok(!doc.getElementById('setup-screen').hidden, 'setup screen is visible');
  assert.ok(doc.getElementById('workspace-screen').hidden, 'workspace is hidden');
  assert.equal(doc.getElementById('trip-name').value, '', 'trip name is empty');

  const savedAfter = dom.window.localStorage.getItem('fairshare.activeTrip.v1');
  assert.equal(savedAfter, null, 'saved trip is removed');

  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: failed export keeps the current trip and leaves confirmation open', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'Keep me');
  const savedBefore = dom.window.localStorage.getItem('fairshare.activeTrip.v1');
  dom.window.URL.createObjectURL = () => { throw new Error('download unavailable'); };
  doc.getElementById('trip-options').click();
  doc.getElementById('new-trip').click();
  doc.getElementById('confirm-export-start').click();
  assert.ok(doc.getElementById('new-trip-dialog').open, 'confirmation stays open');
  assert.ok(doc.getElementById('new-trip-dialog-error').textContent.includes('Could not export'), 'export error is inside dialog');
  assert.equal(dom.window.localStorage.getItem('fairshare.activeTrip.v1'), savedBefore, 'trip remains saved');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: copy summary falls back when clipboard API is unavailable', async () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'Copy fallback');
  dom.window.navigator.clipboard = {
    writeText: () => Promise.reject(),
  };
  doc.getElementById('tab-settle').click();
  doc.getElementById('copy-settle').click();
  await tick(dom.window);
  assert.equal(
    doc.getElementById('app-toast-text').textContent,
    'Copy failed. Select and copy the summary manually.',
  );
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: copy summary succeeds when clipboard API works', async () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  createTrip(doc, 'Copy success');
  dom.window.navigator.clipboard = {
    writeText: () => Promise.resolve(),
  };
  doc.getElementById('tab-settle').click();
  doc.getElementById('copy-settle').click();
  await tick(dom.window);
  assert.equal(
    doc.getElementById('app-toast-text').textContent,
    'Summary copied',
  );
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: missing element shows load failure', () => {
  const noTripName = INDEX.replace(
    'id="trip-name"',
    'id="trip-name-removed"',
  ).replace(
    '<script src="core.js?v=0" defer></script>\n<script src="app.js?v=0" defer></script>',
    '<script>' + CORE + '</' + 'script><script>' + APP + '</' + 'script>',
  );
  const { dom, errors } = page(undefined, { html: noTripName });
  const doc = dom.window.document;
  assert.ok(
    !doc.getElementById('load-failure').hidden,
    'load failure is visible when an element is missing',
  );
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: tapping a suggested payment asks to mark it paid, without editing or delete', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A'); addMember(doc, 'B'); createTrip(doc, 'Confirm');
  addExpense(doc, dom.window, { desc: 'Dinner', amount: '100', payer: 'A', participants: ['A', 'B'] });
  doc.getElementById('tab-settle').click();
  doc.querySelector('.settle-row-button').click();
  assert.equal(doc.getElementById('settle-dialog').open, true, 'confirm popup opens');
  assert.match(doc.getElementById('settle-dialog-amount').textContent, /50/);
  assert.equal(doc.getElementById('settle-edit'), null, 'no amount editing');
  assert.equal(doc.getElementById('payment-dialog').open, false, 'payment sheet stays closed');
  doc.getElementById('settle-confirm').click();
  const stored = JSON.parse(dom.window.localStorage.getItem('fairshare.activeTrip.v1'));
  assert.equal(stored.payments.length, 1, 'confirm records the payment');
  assert.equal(stored.payments[0].amountPaise, 5000);
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: a right swipe never records a payment', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A'); addMember(doc, 'B'); createTrip(doc, 'Right');
  addExpense(doc, dom.window, { desc: 'Dinner', amount: '100', payer: 'A', participants: ['A', 'B'] });
  doc.getElementById('tab-settle').click();
  const row = doc.querySelector('.settle-row-button');
  Object.defineProperty(row, 'offsetWidth', { configurable: true, value: 300 });
  row.dispatchEvent(new dom.window.PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 10 }));
  row.dispatchEvent(new dom.window.PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 12 }));
  row.dispatchEvent(new dom.window.PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 260, clientY: 12 }));
  assert.equal(JSON.parse(dom.window.localStorage.getItem('fairshare.activeTrip.v1')).payments.length, 0);
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: undo restores a deleted payment', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A'); addMember(doc, 'B'); createTrip(doc, 'Undo pay');
  addExpense(doc, dom.window, { desc: 'Dinner', amount: '100', payer: 'A', participants: ['A', 'B'] });
  doc.getElementById('tab-settle').click();
  doc.querySelector('.settle-row-button').click();
  doc.getElementById('settle-confirm').click();
  doc.getElementById('tab-expenses').click();
  doc.querySelector('#expense-list .payment-row').click();
  doc.getElementById('delete-payment').click();
  assert.equal(JSON.parse(dom.window.localStorage.getItem('fairshare.activeTrip.v1')).payments.length, 0, 'deleted');
  doc.getElementById('app-toast-undo').click();
  assert.equal(JSON.parse(dom.window.localStorage.getItem('fairshare.activeTrip.v1')).payments.length, 1, 'restored by undo');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: adding a member keeps the chosen currency', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  doc.getElementById('trip-currency').value = 'JPY';
  addMember(doc, 'A'); addMember(doc, 'B');
  assert.equal(doc.getElementById('trip-currency').value, 'JPY');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: closing sheets returns focus to what opened them', async () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A'); addMember(doc, 'B'); createTrip(doc, 'Focus');
  addExpense(doc, dom.window, { desc: 'Dinner', amount: '100', payer: 'A', participants: ['A', 'B'] });
  await tick(dom.window);

  const fab = doc.getElementById('add-expense-fab');
  fab.focus();
  fab.click();
  doc.getElementById('expense-dialog').close();
  await tick(dom.window);
  assert.equal(doc.activeElement, fab, 'cancelled add sheet refocuses the + button');

  doc.getElementById('tab-settle').click();
  const row = doc.querySelector('.settle-row-button');
  row.focus();
  row.click();
  doc.getElementById('settle-cancel').click();
  await tick(dom.window);
  assert.equal(doc.activeElement, row, 'cancelled settle popup refocuses its row');

  doc.querySelector('.settle-row-button').click();
  doc.getElementById('settle-confirm').click();
  await tick(dom.window);
  assert.ok(doc.activeElement && doc.activeElement !== doc.body, 'focus is kept after marking paid, got: ' + doc.activeElement.tagName);
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

const KEY = 'fairshare.activeTrip.v1';
const seedTrip = (extra) => JSON.stringify(Object.assign({
  schemaVersion: 4, id: 'trip-aaaaaaaa', name: 'Seeded', currency: 'INR', members: ['A', 'B'],
  expenses: [{ seq: 1, description: 'Dinner', amountPaise: 10000, payer: 'A', date: '2026-01-05', participants: ['A', 'B'] }],
  nextSeq: 3, payments: [{ seq: 2, from: 'B', to: 'A', amountPaise: 2000, date: '2026-01-06' }], revision: 1,
}, extra));

test('app smoke: a new trip saved in another tab at the same revision is never overwritten', () => {
  const { dom, errors } = page(seedTrip());
  const doc = dom.window.document;
  const replacement = seedTrip({ id: 'trip-bbbbbbbb', name: 'Other tab', expenses: [], payments: [], nextSeq: 1 });
  dom.window.localStorage.setItem(KEY, replacement);
  addExpense(doc, dom.window, { desc: 'Taxi', amount: '50', payer: 'A', participants: ['A', 'B'] });
  assert.equal(dom.window.localStorage.getItem(KEY), replacement, 'other tab trip is kept');
  assert.equal(doc.getElementById('conflict-notice').hidden, false, 'conflict is shown');

  doc.getElementById('new-trip').click();
  doc.getElementById('confirm-start-new').click();
  assert.equal(doc.getElementById('new-trip-dialog').open, true, 'dialog stays open to show the problem');
  assert.equal(doc.getElementById('new-trip-dialog-error').hidden, false, 'reason is visible');
  assert.equal(dom.window.localStorage.getItem(KEY), replacement, 'start new did not delete the other trip');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: deleting a payment keeps focus on Undo, and Undo restores old-dated payments', async () => {
  const { dom, errors } = page(seedTrip({ payments: [{ seq: 2, from: 'B', to: 'A', amountPaise: 2000, date: '1999-12-31' }] }));
  const doc = dom.window.document;
  doc.getElementById('edit-payment-2').click();
  doc.getElementById('delete-payment').click();
  await tick(dom.window);
  assert.equal(doc.activeElement && doc.activeElement.id, 'app-toast-undo', 'Undo keeps focus after the sheet closes');
  await new Promise((resolve) => dom.window.setTimeout(resolve, 80));
  assert.match(doc.getElementById('app-toast-live').textContent, /Payment deleted/, 'deletion is announced');
  doc.getElementById('app-toast-undo').click();
  const stored = JSON.parse(dom.window.localStorage.getItem(KEY));
  assert.equal(stored.payments.length, 1, 'payment dated 1999 is restored');
  assert.equal(doc.activeElement && doc.activeElement.id, 'edit-payment-2', 'focus returns to the restored row');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: Undo survives a failed save so it can be retried', () => {
  const { dom, errors } = page(seedTrip());
  const doc = dom.window.document;
  doc.getElementById('edit-expense-1').click();
  doc.getElementById('delete-expense-dialog').click();
  assert.equal(JSON.parse(dom.window.localStorage.getItem(KEY)).expenses.length, 0);
  const proto = dom.window.Storage.prototype;
  const realSet = proto.setItem;
  proto.setItem = function () { throw new Error('quota'); };
  doc.getElementById('app-toast-undo').click();
  assert.equal(doc.getElementById('app-toast').hidden, false, 'Undo is still offered');
  proto.setItem = realSet;
  doc.getElementById('app-toast-undo').click();
  assert.equal(JSON.parse(dom.window.localStorage.getItem(KEY)).expenses.length, 1, 'retry restores the expense');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: a large recorded payment can be edited and saved unchanged', () => {
  const { dom, errors } = page(seedTrip({ payments: [{ seq: 2, from: 'B', to: 'A', amountPaise: 3000000000, date: '2026-01-06' }] }));
  const doc = dom.window.document;
  doc.getElementById('edit-payment-2').click();
  assert.equal(doc.getElementById('save-payment').textContent, 'Save changes');
  doc.getElementById('payment-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(doc.getElementById('payment-dialog').open, false, 'sheet closes after saving');
  assert.equal(JSON.parse(dom.window.localStorage.getItem(KEY)).payments[0].amountPaise, 3000000000);
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: New trip keeps the unreadable-data backup and stores its own recovery copy', () => {
  const { dom, errors } = page(seedTrip());
  const doc = dom.window.document;
  dom.window.localStorage.setItem('fairshare.backup.v1', 'old unreadable data');
  doc.getElementById('new-trip').click();
  doc.getElementById('confirm-start-new').click();
  assert.equal(doc.getElementById('new-trip-dialog').open, false);
  assert.equal(dom.window.localStorage.getItem(KEY), null);
  assert.equal(dom.window.localStorage.getItem('fairshare.backup.v1'), 'old unreadable data');
  assert.equal(JSON.parse(dom.window.localStorage.getItem('fairshare.lastRemoved.v1')).name, 'Seeded');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: Export and start new checks other tabs before exporting, and a retry after a failure closes', () => {
  const { dom, errors } = page(seedTrip());
  const doc = dom.window.document;
  let exports = 0;
  dom.window.URL.createObjectURL = () => { exports += 1; return 'blob:x'; };
  dom.window.URL.revokeObjectURL = () => {};
  const mine = dom.window.localStorage.getItem(KEY);
  dom.window.localStorage.setItem(KEY, seedTrip({ id: 'trip-bbbbbbbb' }));
  doc.getElementById('new-trip').click();
  doc.getElementById('confirm-export-start').click();
  assert.equal(exports, 0, 'nothing exported when the trip changed elsewhere');
  assert.equal(doc.getElementById('new-trip-dialog-error').hidden, false);
  dom.window.localStorage.setItem(KEY, mine);
  doc.getElementById('confirm-export-start').click();
  assert.equal(exports, 1);
  assert.equal(doc.getElementById('new-trip-dialog').open, false, 'successful retry closes the dialog');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: a trip saved before ids existed gets one on its next save', () => {
  const legacy = JSON.parse(seedTrip());
  delete legacy.id;
  const { dom, errors } = page(JSON.stringify(legacy));
  const doc = dom.window.document;
  addExpense(doc, dom.window, { desc: 'Taxi', amount: '50', payer: 'A', participants: ['A', 'B'] });
  const stored = JSON.parse(dom.window.localStorage.getItem(KEY));
  assert.equal(stored.expenses.length, 2);
  assert.ok(Core_isTripId(stored.id), 'id assigned: ' + stored.id);
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

function Core_isTripId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id);
}

test('app smoke: a failed payment save is explained inside the payment sheet', () => {
  const { dom, errors } = page(seedTrip());
  const doc = dom.window.document;
  doc.getElementById('edit-payment-2').click();
  dom.window.localStorage.setItem(KEY, seedTrip({ revision: 7 }));
  doc.getElementById('payment-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(doc.getElementById('payment-dialog').open, true);
  assert.match(doc.getElementById('payment-error').textContent, /another tab/);
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

// Keys written while the app was called SplitSafar.
const LEGACY_PREFIX = 'splitsafar.';

test('app smoke: data saved under legacy keys is moved to the new keys on load', () => {
  const { dom, errors } = page(undefined, {
    beforeParse(window) {
      window.localStorage.setItem(LEGACY_PREFIX + 'activeTrip.v1', seedTrip());
      window.localStorage.setItem(LEGACY_PREFIX + 'backup.v1', 'old unreadable data');
      window.localStorage.setItem(LEGACY_PREFIX + 'lastRemoved.v1', seedTrip({ name: 'Removed' }));
    }
  });
  const doc = dom.window.document;
  const store = dom.window.localStorage;
  assert.equal(doc.getElementById('workspace-screen').hidden, false, 'legacy trip opens in the workspace');
  assert.equal(JSON.parse(store.getItem(KEY)).name, 'Seeded');
  assert.equal(store.getItem('fairshare.backup.v1'), 'old unreadable data');
  assert.equal(JSON.parse(store.getItem('fairshare.lastRemoved.v1')).name, 'Removed');
  for (const name of ['activeTrip.v1', 'backup.v1', 'lastRemoved.v1']) {
    assert.equal(store.getItem(LEGACY_PREFIX + name), null, 'legacy ' + name + ' is removed');
  }
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: legacy data never overwrites data already under the new key', () => {
  const legacy = seedTrip({ name: 'Legacy' });
  const { dom, errors } = page(seedTrip(), {
    beforeParse(window) {
      window.localStorage.setItem(LEGACY_PREFIX + 'activeTrip.v1', legacy);
    }
  });
  const store = dom.window.localStorage;
  assert.equal(JSON.parse(store.getItem(KEY)).name, 'Seeded', 'current trip is kept');
  assert.equal(store.getItem(LEGACY_PREFIX + 'activeTrip.v1'), legacy, 'legacy copy is left alone');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: a failed migration write keeps the legacy copy and the app still loads', () => {
  const legacy = seedTrip();
  const { dom, errors } = page(undefined, {
    beforeParse(window) {
      window.localStorage.setItem(LEGACY_PREFIX + 'activeTrip.v1', legacy);
      window.Storage.prototype.setItem = function () { throw new Error('quota'); };
    }
  });
  const doc = dom.window.document;
  assert.equal(doc.getElementById('setup-screen').hidden, false, 'setup screen is shown');
  assert.equal(dom.window.localStorage.getItem(LEGACY_PREFIX + 'activeTrip.v1'), legacy, 'legacy data is not lost');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: the app loads when every storage call throws', () => {
  const { dom, errors } = page(undefined, {
    beforeParse(window) {
      const proto = window.Storage.prototype;
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        proto[method] = function () { throw new Error('denied'); };
      }
    }
  });
  const doc = dom.window.document;
  assert.equal(doc.getElementById('load-failure').hidden, true, 'no load failure');
  assert.equal(doc.getElementById('setup-screen').hidden, false, 'setup screen is shown');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

function withLanguage(language) {
  return {
    beforeParse(window) {
      Object.defineProperty(window.navigator, 'language', { value: language, configurable: true });
    }
  };
}

test('app smoke: the currency picker has a Common group, then every currency by name', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  const Core = dom.window.FairShareCore;
  const select = doc.getElementById('trip-currency');
  const groups = Array.from(select.children);
  assert.deepEqual(groups.map((g) => g.tagName + ':' + g.label), ['OPTGROUP:Common', 'OPTGROUP:All currencies']);
  const common = Array.from(groups[0].querySelectorAll('option'));
  assert.equal(common[0].value, 'USD');
  assert.equal(common[0].textContent, 'USD - US Dollar');
  assert.ok(common.some((o) => o.value === 'INR') && common.some((o) => o.value === 'EUR'));
  const all = Array.from(groups[1].querySelectorAll('option'));
  assert.equal(all.length, Core.CURRENCY_CODES.length, 'every supported currency is listed');
  assert.ok(all.some((o) => o.value === 'KWD' && o.textContent === 'KWD - Kuwaiti Dinar'));
  assert.equal(all.some((o) => o.value === 'XAU' || o.value === 'XXX'), false);
  const names = all.map((o) => o.textContent.slice(6));
  assert.deepEqual(names, names.slice().sort((a, b) => a.localeCompare(b, 'en')), 'sorted by name');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: a new trip defaults to the currency of the browser region', () => {
  for (const [language, currency] of [['en-IN', 'INR'], ['de-DE', 'EUR'], ['ja', 'JPY'], ['en-US', 'USD'], ['es-419', 'USD']]) {
    const { dom, errors } = page(undefined, withLanguage(language));
    const doc = dom.window.document;
    assert.equal(doc.getElementById('trip-currency').value, currency, language);
    assert.equal(doc.getElementById('expense-amount-label').textContent, 'Amount (' + currency + ')');
    assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
    dom.window.close();
  }
});

test('app smoke: a saved trip keeps its currency whatever the browser region', () => {
  const { dom, errors } = page(seedTrip(), withLanguage('de-DE'));
  assert.equal(dom.window.document.getElementById('trip-currency').value, 'INR');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: a KWD trip takes three-decimal amounts for expenses and payments', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  addMember(doc, 'A');
  addMember(doc, 'B');
  doc.getElementById('trip-name').value = 'Kuwait';
  doc.getElementById('trip-currency').value = 'KWD';
  doc.getElementById('create-trip').click();
  doc.getElementById('add-expense-fab').click();
  assert.equal(doc.getElementById('expense-amount').placeholder, '0.000');
  doc.getElementById('expense-description').value = 'Dinner';
  doc.getElementById('expense-amount').value = '12.345';
  doc.getElementById('expense-payer').value = 'A';
  doc.getElementById('expense-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.ok(doc.querySelector('.expense-row-amount').textContent.includes('12.345'), 'expense shows three decimals');
  assert.equal(JSON.parse(dom.window.localStorage.getItem(KEY)).expenses[0].amountPaise, 12345);
  doc.getElementById('tab-settle').click();
  doc.getElementById('record-payment').click();
  assert.equal(doc.getElementById('payment-amount').placeholder, '0.000');
  assert.equal(doc.getElementById('payment-amount-label').textContent, 'Amount (KWD)');
  assert.match(doc.getElementById('payment-amount').value, /^6\.17[23]$/, 'suggested payment prefills three decimals');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: a JPY trip uses a whole-number placeholder', () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  doc.getElementById('trip-currency').value = 'JPY';
  doc.getElementById('trip-currency').dispatchEvent(new dom.window.Event('change'));
  assert.equal(doc.getElementById('expense-amount').placeholder, '0');
  assert.equal(doc.getElementById('expense-amount-label').textContent, 'Amount (JPY)');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: a saved trip in a currency outside the picker list keeps it selected', () => {
  const { dom, errors } = page(seedTrip({ currency: 'HRK' }));
  const doc = dom.window.document;
  const select = doc.getElementById('trip-currency');
  assert.equal(doc.getElementById('workspace-screen').hidden, false, 'trip loads');
  assert.equal(doc.getElementById('recovery-notice').hidden, true, 'not treated as corrupted');
  assert.equal(select.value, 'HRK');
  assert.equal(select.selectedOptions[0].textContent, 'HRK - Croatian Kuna');
  assert.match(doc.getElementById('trip-summary').textContent, /HRK\s100 total/, 'amount formats');
  doc.getElementById('add-expense-fab').click();
  assert.equal(doc.getElementById('expense-amount-label').textContent, 'Amount (HRK)');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: an expense that would overflow the trip total is refused with a message', () => {
  const nearMax = Number.MAX_SAFE_INTEGER - 10000 - 50;
  const seed = seedTrip({ payments: [{ seq: 2, from: 'B', to: 'A', amountPaise: nearMax, date: '2026-01-06' }] });
  const { dom, errors } = page(seed);
  const doc = dom.window.document;
  addExpense(doc, dom.window, { desc: 'Taxi', amount: '1', payer: 'A', participants: ['A', 'B'] });
  const message = doc.getElementById('dialog-save-error');
  assert.equal(message.hidden, false);
  assert.match(message.textContent, /too large/);
  assert.equal(JSON.parse(dom.window.localStorage.getItem(KEY)).expenses.length, 1, 'nothing saved');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

const IMPORTED = {
  schemaVersion: 4, id: 'trip-cccccccc', name: 'Lisbon', currency: 'EUR', members: ['Ana', 'Ben'],
  expenses: [{ seq: 1, description: 'Hotel', amountPaise: 45000, payer: 'Ana', date: '2026-03-01', participants: ['Ana', 'Ben'] }],
  nextSeq: 3, payments: [{ seq: 2, from: 'Ben', to: 'Ana', amountPaise: 5000, date: '2026-03-02' }],
};
const exportFileText = (trip) => JSON.stringify({ app: 'FairShare', exportVersion: 1, schemaVersion: 4, exportedAt: '2026-03-05T10:00:00.000Z', trip: trip }, null, 2);

// Browsers cannot script the file picker, so the chosen file is set on the input directly.
function chooseFile(dom, text, size) {
  const win = dom.window;
  const input = win.document.getElementById('import-file');
  const file = new win.File([text], 'trip.json', { type: 'application/json' });
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
}

// announce() refills the live region after 50 ms.
const announced = (win) => new Promise((resolve) => win.setTimeout(resolve, 60));

async function settle(win) {
  for (let i = 0; i < 5; i += 1) {
    await tick(win);
  }
}

test('app smoke: importing a trip with no trip saved opens it on the Expenses view', async () => {
  const { dom, errors } = page();
  const doc = dom.window.document;
  const input = doc.getElementById('import-file');
  let pickerOpened = 0;
  input.click = () => { pickerOpened += 1; };
  assert.equal(input.type, 'file');
  assert.equal(input.accept, '.json,application/json');
  doc.getElementById('import-trip-setup').click();
  assert.equal(pickerOpened, 1, 'the Import a trip button opens the file picker');
  chooseFile(dom, exportFileText(IMPORTED));
  await settle(dom.window);
  assert.equal(doc.getElementById('workspace-screen').hidden, false);
  assert.equal(doc.getElementById('setup-screen').hidden, true);
  assert.equal(doc.getElementById('trip-title').textContent, 'Lisbon');
  assert.equal(dom.window.location.hash, '#expenses');
  assert.equal(doc.activeElement.id, 'view-expenses-title');
  assert.equal(doc.querySelectorAll('#expense-list li').length, 2, 'expense and payment listed');
  assert.equal(doc.getElementById('app-toast-text').textContent, 'Imported Lisbon');
  assert.equal(doc.getElementById('app-toast-undo').hidden, true, 'nothing to undo');
  await announced(dom.window);
  assert.equal(doc.getElementById('app-toast-live').textContent, 'Imported Lisbon', 'announced');
  const stored = JSON.parse(dom.window.localStorage.getItem(KEY));
  assert.equal(stored.name, 'Lisbon');
  assert.equal(stored.id, 'trip-cccccccc');
  assert.equal(stored.revision, 1);
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: importing over a trip asks first, keeps a recovery copy, and Undo restores it', async () => {
  const { dom, errors } = page(seedTrip());
  const doc = dom.window.document;
  doc.getElementById('import-file').click = () => {};
  doc.getElementById('trip-options').click();
  const items = Array.from(doc.querySelectorAll('#trip-menu [role="menuitem"]')).map((item) => item.id);
  assert.deepEqual(items.slice(0, 2), ['export-trip', 'import-trip'], 'Import trip sits next to Export trip');
  doc.getElementById('import-trip').click();
  chooseFile(dom, exportFileText(IMPORTED));
  await settle(dom.window);
  const dialog = doc.getElementById('import-dialog');
  assert.equal(dialog.open, true, 'replacing asks first');
  assert.match(doc.getElementById('import-dialog-text').textContent, /Importing Lisbon replaces Seeded/);
  assert.equal(doc.activeElement.id, 'import-cancel');
  assert.equal(JSON.parse(dom.window.localStorage.getItem(KEY)).name, 'Seeded', 'nothing replaced yet');

  doc.getElementById('import-replace').click();
  await settle(dom.window);
  assert.equal(dialog.open, false);
  assert.equal(doc.getElementById('trip-title').textContent, 'Lisbon');
  const imported = JSON.parse(dom.window.localStorage.getItem(KEY));
  assert.equal(imported.name, 'Lisbon');
  assert.equal(imported.revision, 2, 'saved through the revision check');
  assert.equal(JSON.parse(dom.window.localStorage.getItem('fairshare.lastRemoved.v1')).name, 'Seeded');
  assert.equal(doc.getElementById('app-toast-text').textContent, 'Imported Lisbon');
  assert.equal(doc.getElementById('app-toast-undo').hidden, false);
  assert.equal(doc.activeElement.id, 'app-toast-undo', 'focus stays on Undo after the dialog closes');

  doc.getElementById('app-toast-undo').click();
  await settle(dom.window);
  const restored = JSON.parse(dom.window.localStorage.getItem(KEY));
  assert.equal(restored.name, 'Seeded');
  assert.equal(restored.id, 'trip-aaaaaaaa');
  assert.equal(restored.revision, 3);
  assert.deepEqual(restored.payments, JSON.parse(seedTrip()).payments);
  assert.equal(doc.getElementById('trip-title').textContent, 'Seeded');
  assert.equal(doc.activeElement.id, 'trip-title');
  assert.equal(doc.getElementById('app-toast').hidden, true);
  await announced(dom.window);
  assert.match(doc.getElementById('app-toast-live').textContent, /Import undone\. Seeded is back\./);
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: Export and replace exports first; Cancel and other-tab changes keep the trip', async () => {
  const { dom, errors } = page(seedTrip());
  const doc = dom.window.document;
  let exports = 0;
  dom.window.URL.createObjectURL = () => { exports += 1; return 'blob:x'; };
  dom.window.URL.revokeObjectURL = () => {};
  doc.getElementById('import-file').click = () => {};
  const mine = dom.window.localStorage.getItem(KEY);

  doc.getElementById('trip-options').click();
  doc.getElementById('import-trip').click();
  chooseFile(dom, exportFileText(IMPORTED));
  await settle(dom.window);
  doc.getElementById('import-cancel').click();
  await settle(dom.window);
  assert.equal(doc.getElementById('import-dialog').open, false);
  assert.equal(doc.activeElement.id, 'trip-options', 'focus returns to the menu button');
  assert.equal(dom.window.localStorage.getItem(KEY), mine, 'Cancel keeps the trip');

  doc.getElementById('import-trip').click();
  chooseFile(dom, exportFileText(IMPORTED));
  await settle(dom.window);
  dom.window.localStorage.setItem(KEY, seedTrip({ id: 'trip-bbbbbbbb', name: 'Other tab' }));
  doc.getElementById('import-export-replace').click();
  assert.equal(exports, 0, 'nothing exported when the trip changed elsewhere');
  assert.match(doc.getElementById('import-dialog-error').textContent, /changed in another tab/);
  assert.equal(JSON.parse(dom.window.localStorage.getItem(KEY)).name, 'Other tab', 'other tab trip kept');

  dom.window.localStorage.setItem(KEY, mine);
  // Checked without waiting: jsdom cannot follow the download link the export clicks.
  doc.getElementById('import-export-replace').click();
  assert.equal(exports, 1, 'exported before replacing');
  assert.equal(doc.getElementById('import-dialog').open, false);
  assert.equal(JSON.parse(dom.window.localStorage.getItem(KEY)).name, 'Lisbon');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});

test('app smoke: a file that cannot be imported shows an alert and changes nothing', async () => {
  const { dom, errors } = page(seedTrip());
  const doc = dom.window.document;
  const Core = dom.window.FairShareCore;
  doc.getElementById('import-file').click = () => {};
  const before = dom.window.localStorage.getItem(KEY);
  const notice = doc.getElementById('import-error');
  assert.equal(notice.getAttribute('role'), 'alert');

  doc.getElementById('trip-options').click();
  doc.getElementById('import-trip').click();
  chooseFile(dom, 'this is not json');
  await settle(dom.window);
  assert.equal(notice.hidden, false);
  assert.equal(doc.getElementById('import-error-text').textContent, Core.IMPORT_ERRORS.notJson);
  assert.equal(doc.activeElement.id, 'dismiss-import-error', 'focus moves to the alert');
  assert.equal(doc.getElementById('import-dialog').open, false, 'no replace dialog for a bad file');

  chooseFile(dom, exportFileText(Object.assign({}, IMPORTED, { schemaVersion: 99 })));
  await settle(dom.window);
  assert.equal(doc.getElementById('import-error-text').textContent, Core.IMPORT_ERRORS.newer);

  chooseFile(dom, exportFileText(IMPORTED), Core.MAX_IMPORT_SIZE + 1);
  await settle(dom.window);
  assert.equal(doc.getElementById('import-error-text').textContent, Core.IMPORT_ERRORS.tooLarge);

  doc.getElementById('dismiss-import-error').click();
  assert.equal(notice.hidden, true);
  assert.equal(doc.activeElement.id, 'trip-options', 'focus returns to where the import started');
  assert.equal(dom.window.localStorage.getItem(KEY), before, 'saved trip untouched');
  assert.equal(doc.getElementById('trip-title').textContent, 'Seeded');
  assert.equal(errors.length, 0, 'no console errors: ' + errors.join(' | '));
  dom.window.close();
});
