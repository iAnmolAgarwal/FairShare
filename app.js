(function bootApp() {
  "use strict";

  function hasCore() {
    return typeof window.FairShareCore === "object";
  }

  function showLoadFailure() {
    const fail = document.getElementById("load-failure");
    const app = document.getElementById("app");
    const status = document.getElementById("loading-status");
    if (fail) {
      fail.hidden = false;
    }
    if (app) {
      app.hidden = true;
    }
    if (status) {
      status.hidden = true;
    }
  }

  if (!hasCore()) {
    showLoadFailure();
    return;
  }
  const bootStatus = document.getElementById("loading-status");
  if (bootStatus) {
    bootStatus.hidden = true;
  }
  const appRoot = document.getElementById("app");
  if (appRoot) {
    appRoot.hidden = false;
  }

  const Core = window.FairShareCore;

  const STORAGE_KEY = "fairshare.activeTrip.v1";
  const BACKUP_KEY = "fairshare.backup.v1";
  // Recovery copy of the trip most recently cleared by "New trip" (kept apart from
  // BACKUP_KEY, which only ever holds unreadable data).
  const LAST_REMOVED_KEY = "fairshare.lastRemoved.v1";
  // Key prefix used while the app was called SplitSafar; read once by
  // migrateLegacyStorage() so trips saved under the old name are kept.
  const LEGACY_KEY_PREFIX = "splitsafar.";
  const SCHEMA_VERSION = Core.SCHEMA_VERSION;
  const MIN_MEMBERS = Core.MIN_MEMBERS;
  const MAX_MEMBERS = Core.MAX_MEMBERS;
  const parseAmount = Core.parseAmount;
  const formatMoney = Core.formatMoney;
  const computeBalances = Core.computeBalances;
  const computeSettlements = Core.computeSettlements;
  const prepareSave = Core.prepareSave;
  const buildExport = Core.buildExport;
  const migrateTrip = Core.migrateTrip;
  const getDateValidationError = Core.getDateValidationError;
  const formatIndianDate = Core.formatIndianDate;
  const updateExpense = Core.updateExpense;
  const removeExpense = Core.removeExpense;
  const restoreExpense = Core.restoreExpense;
  const validateExpenseFields = Core.validateExpenseFields;
  const addPayment = Core.addPayment;
  const removePayment = Core.removePayment;

  let state = null;
  let editingSeq = null;
  let pendingUndo = null;
  let activeDialog = null;
  let dialogOpener = null;
  let paymentDialogOpener = null;
  let pendingSettlement = null;
  let settleDialogOpener = null;
  let editingPaymentSeq = null;
  const setupMembers = [];

  const setupScreen = document.getElementById("setup-screen");
  const workspaceScreen = document.getElementById("workspace-screen");

  const recoveryNotice = document.getElementById("recovery-notice");
  const recoveryNoticeText = document.getElementById("recovery-notice-text");
  const dismissRecoveryBtn = document.getElementById("dismiss-recovery");
  const storageWarning = document.getElementById("storage-warning");
  const storageWarningText = document.getElementById("storage-warning-text");
  const dismissStorageWarningBtn = document.getElementById(
    "dismiss-storage-warning",
  );
  const conflictNotice = document.getElementById("conflict-notice");
  const conflictNoticeText = document.getElementById("conflict-notice-text");
  const dismissConflictBtn = document.getElementById("dismiss-conflict");
  const reloadFailureBtn = document.getElementById("reload-failure");

  const tripNameInput = document.getElementById("trip-name");
  const tripNameError = document.getElementById("trip-name-error");
  const memberNameInput = document.getElementById("member-name");
  const memberError = document.getElementById("member-error");
  const addMemberBtn = document.getElementById("add-member");
  const memberListEl = document.getElementById("member-list");
  const memberCountEl = document.getElementById("member-count");
  const memberMinError = document.getElementById("member-min-error");
  const createError = document.getElementById("create-error");
  const createTripBtn = document.getElementById("create-trip");
  const tripCurrencySelect = document.getElementById("trip-currency");
  const tripCurrencyError = document.getElementById("trip-currency-error");
  const heroStartBtn = document.getElementById("hero-start");
  const trySampleBtn = document.getElementById("try-sample");
  const previewAmounts = {
    villa: document.getElementById("preview-villa"),
    dinner: document.getElementById("preview-dinner"),
    cabs: document.getElementById("preview-cabs"),
    rohan: document.getElementById("preview-rohan"),
    kabir: document.getElementById("preview-kabir"),
    aarav: document.getElementById("preview-aarav"),
    meera: document.getElementById("preview-meera"),
  };

  const tripTitleEl = document.getElementById("trip-title");
  const tripSummaryEl = document.getElementById("trip-summary");
  const tripTotalEl = document.getElementById("trip-total");
  const expensesStat = document.getElementById("expenses-stat");
  const balancesStat = document.getElementById("balances-stat");
  const settleStat = document.getElementById("settle-stat");
  const balancesEmptyTitle = document.getElementById("balances-empty-title");
  const balancesEmptyText = document.getElementById("balances-empty-text");
  const settleProgress = document.getElementById("settle-progress");
  const settleProgressAmount = document.getElementById("settle-progress-amount");
  const settleMeterFill = document.getElementById("settle-meter-fill");
  const settleFlow = document.getElementById("settle-flow");
  const settleEmptyTitle = document.getElementById("settle-empty-title");
  const settleEmptyText = document.getElementById("settle-empty-text");
  const settleDialogPair = document.getElementById("settle-dialog-pair");
  const settleSquareArt = document.getElementById("settle-square-art");
  const settleSquareStats = document.getElementById("settle-square-stats");
  const balancesSquareArt = document.getElementById("balances-square-art");
  const tripHeader = document.querySelector(".trip-header");
  const tripMini = document.getElementById("trip-mini");
  const tripMiniName = document.getElementById("trip-mini-name");
  const tripMiniTotal = document.getElementById("trip-mini-total");
  const amountPrefix = document.getElementById("expense-amount-prefix");
  const splitPreview = document.getElementById("split-preview");
  const tripOptionsBtn = document.getElementById("trip-options");
  const tripMenu = document.getElementById("trip-menu");
  const appToast = document.getElementById("app-toast");
  const appToastText = document.getElementById("app-toast-text");
  const appToastUndo = document.getElementById("app-toast-undo");
  const newTripDialog = document.getElementById("new-trip-dialog");
  const settleDialog = document.getElementById("settle-dialog");
  const settleDialogAmount = document.getElementById("settle-dialog-amount");
  const settleDialogText = document.getElementById("settle-dialog-text");
  const settleConfirmBtn = document.getElementById("settle-confirm");
  const settleCancelBtn = document.getElementById("settle-cancel");
  const newTripDialogText = document.getElementById("new-trip-dialog-text");
  const newTripDialogError = document.getElementById("new-trip-dialog-error");
  const balancesEmpty = document.getElementById("balances-empty");
  const balanceListEl = document.getElementById("balance-list");
  const settleEmpty = document.getElementById("settle-empty");
  const settleSummary = document.getElementById("settle-summary");
  const settleHint = document.getElementById("settle-hint");
  const settleList = document.getElementById("settle-list");
  const copySettleBtn = document.getElementById("copy-settle");
  const tabExpenses = document.getElementById("tab-expenses");
  const tabBalances = document.getElementById("tab-balances");
  const tabSettle = document.getElementById("tab-settle");
  const viewExpenses = document.getElementById("view-expenses");
  const viewBalances = document.getElementById("view-balances");
  const viewSettle = document.getElementById("view-settle");
  const viewExpensesTitle = document.getElementById("view-expenses-title");
  const viewBalancesTitle = document.getElementById("view-balances-title");
  const viewSettleTitle = document.getElementById("view-settle-title");
  const toggleExpenseBtn = document.getElementById("add-expense-fab");
  const emptyAddExpenseBtn = document.getElementById("empty-add-expense");
  const paymentDialog = document.getElementById("payment-dialog");
  const paymentForm = document.getElementById("payment-form");
  const paymentFrom = document.getElementById("payment-from");
  const paymentTo = document.getElementById("payment-to");
  const paymentAmount = document.getElementById("payment-amount");
  const paymentDate = document.getElementById("payment-date");
  const paymentError = document.getElementById("payment-error");
  // Where the payment error sits when it is not about one field.
  const paymentErrorHome = paymentError ? paymentError.parentElement : null;
  const paymentTitle = document.getElementById("payment-form-title");
  const savePaymentBtn = document.getElementById("save-payment");
  const deletePaymentBtn = document.getElementById("delete-payment");
  const recordPaymentBtn = document.getElementById("record-payment");
  const paymentDialogCancel = document.getElementById("cancel-payment-dialog");
  const expenseDialog = document.getElementById("expense-dialog");
  const cancelExpenseDialogBtn = document.getElementById(
    "cancel-expense-dialog",
  );

  const expenseForm = document.getElementById("expense-form");
  const descriptionInput = document.getElementById("expense-description");
  const descriptionError = document.getElementById("description-error");
  const amountInput = document.getElementById("expense-amount");
  const amountLabel = document.getElementById("expense-amount-label");
  const amountError = document.getElementById("amount-error");
  const payerSelect = document.getElementById("expense-payer");
  const payerError = document.getElementById("payer-error");
  const dateInput = document.getElementById("expense-date");
  const dateError = document.getElementById("date-error");
  const participantListEl = document.getElementById("participant-list");
  const participantsError = document.getElementById("participants-error");
  const participantsField = document.getElementById("participants-field");
  const participantsToggle = document.getElementById("participants-toggle");
  const expenseFormTitle = document.getElementById("expense-form-title");
  const saveExpenseBtn = document.getElementById("save-expense");
  const deleteExpenseDialogBtn = document.getElementById(
    "delete-expense-dialog",
  );
  const dialogSaveError = document.getElementById("dialog-save-error");

  const expenseListEl = document.getElementById("expense-list");
  const expensesEmptyEl = document.getElementById("expenses-empty");
  const exportTripBtn = document.getElementById("export-trip");
  const newTripBtn = document.getElementById("new-trip");
  const recordPaymentMenu = document.getElementById("record-payment-menu");
  const confirmExportStart = document.getElementById("confirm-export-start");
  const confirmStartNew = document.getElementById("confirm-start-new");
  const confirmCancel = document.getElementById("confirm-cancel");
  const importTripBtn = document.getElementById("import-trip");
  const importTripSetupBtn = document.getElementById("import-trip-setup");
  const importFileInput = document.getElementById("import-file");
  const importError = document.getElementById("import-error");
  const importErrorText = document.getElementById("import-error-text");
  const dismissImportErrorBtn = document.getElementById("dismiss-import-error");
  const importDialog = document.getElementById("import-dialog");
  const importDialogText = document.getElementById("import-dialog-text");
  const importDialogError = document.getElementById("import-dialog-error");
  const importExportReplaceBtn = document.getElementById("import-export-replace");
  const importReplaceBtn = document.getElementById("import-replace");
  const importCancelBtn = document.getElementById("import-cancel");
  const tripMenuItems = Array.from(
    tripMenu.querySelectorAll('[role="menuitem"]'),
  );
  let toastTimer = null;
  let pendingAnnouncement = null;
  let lastSaveError = "";
  const appToastLive = document.getElementById("app-toast-live");
  // Touch browsers keep :hover on the last tapped element, so only real hover pauses the toast.
  const HOVER_QUERY = window.matchMedia ? window.matchMedia("(hover: hover)") : null;
  let newTripDialogOpener = null;
  // The control that asked for a file, and the trip read from it while the user
  // confirms replacing the current one.
  let importOpener = null;
  let importDialogOpener = null;
  let pendingImport = null;
  const allElements = [
    setupScreen, workspaceScreen,
    recoveryNotice, recoveryNoticeText, dismissRecoveryBtn,
    storageWarning, storageWarningText, dismissStorageWarningBtn,
    conflictNotice, conflictNoticeText, dismissConflictBtn, reloadFailureBtn,
    tripNameInput, tripNameError, memberNameInput, memberError, addMemberBtn,
    memberListEl, memberCountEl, memberMinError, createError, createTripBtn,
    tripCurrencySelect, tripCurrencyError, heroStartBtn, trySampleBtn,
    tripTitleEl, tripSummaryEl, tripOptionsBtn, tripMenu, appToast,
    appToastText, appToastUndo, newTripDialog, settleDialog, settleDialogAmount,
    settleDialogText, settleConfirmBtn, settleCancelBtn, newTripDialogText,
    newTripDialogError, balancesEmpty, balanceListEl, settleEmpty, settleSummary,
    settleHint, settleList, copySettleBtn, tabExpenses, tabBalances, tabSettle,
    viewExpenses, viewBalances, viewSettle, viewExpensesTitle, viewBalancesTitle,
    viewSettleTitle, toggleExpenseBtn, emptyAddExpenseBtn, paymentDialog,
    paymentForm, paymentFrom, paymentTo, paymentAmount, paymentDate,
    paymentError, paymentTitle, savePaymentBtn, deletePaymentBtn,
    recordPaymentBtn, paymentDialogCancel, expenseDialog, cancelExpenseDialogBtn,
    expenseForm, descriptionInput, descriptionError, amountInput, amountLabel,
    amountError, payerSelect, payerError, dateInput, dateError,
    participantListEl, participantsError, participantsField, participantsToggle,
    expenseFormTitle, saveExpenseBtn, deleteExpenseDialogBtn, dialogSaveError,
    settleSquareArt, settleSquareStats, balancesSquareArt, tripHeader, tripMini,
    tripMiniName, tripMiniTotal,
    expenseListEl, expensesEmptyEl, exportTripBtn, newTripBtn,
    recordPaymentMenu, confirmExportStart, confirmStartNew, confirmCancel,
    appToastLive, importTripBtn, importTripSetupBtn, importFileInput, importError,
    importErrorText, dismissImportErrorBtn, importDialog, importDialogText,
    importDialogError, importExportReplaceBtn, importReplaceBtn, importCancelBtn,
    tripTotalEl, expensesStat, balancesStat, settleStat, balancesEmptyTitle,
    balancesEmptyText, settleProgress, settleProgressAmount, settleMeterFill,
    settleFlow, settleEmptyTitle, settleEmptyText, settleDialogPair, amountPrefix,
    splitPreview,
  ];
  if (allElements.some((el) => el === null)) {
    showLoadFailure();
    return;
  }

  const errorControls = new Map();
  errorControls.set(tripNameError, tripNameInput);
  errorControls.set(tripCurrencyError, tripCurrencySelect);
  errorControls.set(memberError, memberNameInput);
  errorControls.set(descriptionError, descriptionInput);
  errorControls.set(amountError, amountInput);
  errorControls.set(payerError, payerSelect);
  errorControls.set(dateError, dateInput);
  errorControls.set(participantsError, participantsField);

  function showError(el, message) {
    el.textContent = message;
    el.hidden = false;
    const control = errorControls.get(el);
    if (control) {
      control.setAttribute("aria-invalid", "true");
    }
  }

  function showDialogSaveError(message) {
    lastSaveError = message;
    if (expenseDialog.open) {
      dialogSaveError.textContent = message;
      dialogSaveError.hidden = false;
    }
  }

  function clearError(el) {
    el.textContent = "";
    el.hidden = true;
    const control = errorControls.get(el);
    if (control) {
      control.removeAttribute("aria-invalid");
    }
  }

  function clearAllErrors() {
    clearError(descriptionError);
    clearError(amountError);
    clearError(payerError);
    clearError(dateError);
    clearError(participantsError);
  }

  function clearDialogSaveError() {
    dialogSaveError.textContent = "";
    dialogSaveError.hidden = true;
  }

  function showToast(message, undo) {
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    appToastUndo.hidden = !undo;
    appToast.hidden = false;
    appToastText.textContent = message;
    // "Fado night deleted." + "Undo available." must not read as "deleted.."
    announce(undo ? message.replace(/[.\s]+$/, "") + ". Undo available." : message);
    if (undo) {
      appToastUndo.focus();
    }
    scheduleToastHide(undo ? 10000 : 3000);
  }

  // The live region stays in the DOM; emptying it first and refilling it a moment
  // later makes screen readers repeat an identical message.
  function announce(message) {
    appToastLive.textContent = "";
    window.setTimeout(() => {
      appToastLive.textContent = message;
    }, 50);
  }

  function scheduleToastHide(delay) {
    toastTimer = setTimeout(() => {
      const hovered = HOVER_QUERY && HOVER_QUERY.matches && appToast.matches(":hover");
      if (appToast.contains(document.activeElement) || hovered) {
        scheduleToastHide(3000);
        return;
      }
      toastTimer = null;
      appToast.hidden = true;
      pendingUndo = null;
    }, delay);
  }

  function activeViewHeading() {
    const panel = [viewExpenses, viewBalances, viewSettle].find((view) => !view.hidden);
    return document.getElementById((panel || viewExpenses).id + "-title");
  }

  // Return focus to the opener, its re-rendered replacement (same id), or, if
  // neither can take focus, the visible view's heading.
  function restoreFocus(opener, fallback) {
    const target =
      opener && opener.isConnected
        ? opener
        : opener && opener.id
          ? document.getElementById(opener.id)
          : null;
    if (target) {
      target.focus();
      if (document.activeElement === target) {
        return;
      }
    }
    const heading = fallback && !fallback.closest("[hidden]") ? fallback : activeViewHeading();
    if (heading) {
      heading.focus();
    }
  }

  function isBackdropClick(dialog, event) {
    if (event.target !== dialog) {
      return false;
    }
    const rect = dialog.getBoundingClientRect();
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    );
  }

  function showRecoveryNotice(backupFailed) {
    if (backupFailed) {
      recoveryNoticeText.textContent =
        "Saved trip data could not be read and could not be backed up. A new trip was started.";
    } else {
      recoveryNoticeText.textContent =
        "Saved trip data could not be read. A backup copy has been kept on this device, and a new trip was started.";
    }
    recoveryNotice.hidden = false;
  }

  function showStorageWarning(message) {
    storageWarningText.textContent = message;
    storageWarning.hidden = false;
  }

  // "23 Sep" for dates in the current year, "30 Dec 2025" otherwise.
  function shortDate(dateStr) {
    const full = formatIndianDate(dateStr);
    return dateStr.slice(0, 4) === todayLocalStr().slice(0, 4) ? full.replace(/ \d{4}$/, "") : full;
  }

  function todayLocalStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    );
  }

  function backupStoredData(raw) {
    try {
      localStorage.setItem(BACKUP_KEY, raw);
      return true;
    } catch {
      // Backup storage is best-effort; nothing else can be done if unavailable.
      return false;
    }
  }

  function showConflict(message) {
    conflictNoticeText.textContent = message;
    conflictNotice.hidden = false;
    showDialogSaveError(message);
  }

  // Trips saved before ids existed get one on their next save.
  function stampTrip(trip, revision) {
    trip.revision = revision;
    if (!trip.id) {
      trip.id = makeTripId();
    }
  }

  // Trip ids only tell one saved trip from another, so without Web Crypto a
  // timestamp plus a per-page counter is unique enough.
  let tripIdCounter = 0;

  function makeTripId() {
    const cryptoApi = window.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }
    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
      const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    tripIdCounter += 1;
    return "trip-" + Date.now().toString(36) + "-" + tripIdCounter.toString(36);
  }

  // Another tab replaced or changed the trip if its id or revision differs.
  function isDifferentTrip(stored) {
    if (!state || !stored || typeof stored !== "object") {
      return false;
    }
    const storedRevision = Number.isInteger(stored.revision) ? stored.revision : 0;
    const storedId = Core.isValidTripId(stored.id) ? stored.id : null;
    return storedRevision !== state.revision || storedId !== state.id;
  }

  function storedTripIsValid(raw) {
    try {
      return migrateTrip(JSON.parse(raw)) !== null;
    } catch {
      return false;
    }
  }

  function saveState(newState) {
    const baseRevision = state ? state.revision || 0 : 0;
    let storedRaw;
    try {
      storedRaw = localStorage.getItem(STORAGE_KEY);
    } catch {
      showStorageWarning(
        "Your trip could not be saved on this device. Storage may be full or unavailable, so changes may be lost when you leave this page.",
      );
      showDialogSaveError("Your trip could not be saved on this device.");
      return false;
    }
    if (state && storedRaw === null) {
      showConflict("This trip was removed in another tab. Please reload to continue.");
      return false;
    }
    const ignoreStored = !state && storedRaw !== null && !storedTripIsValid(storedRaw);
    const save = prepareSave(
      baseRevision,
      ignoreStored ? null : storedRaw,
      state ? state.id : undefined,
    );
    if (!save.ok) {
      showConflict("This trip was changed in another tab. Please reload to see the latest changes.");
      return false;
    }
    stampTrip(newState, save.nextRevision);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch {
      // Storage full or private mode — show a visible warning instead of failing silently.
      showStorageWarning(
        "Your trip could not be saved on this device. Storage may be full or unavailable, so changes may be lost when you leave this page.",
      );
      showDialogSaveError(
        "Your trip could not be saved on this device. Changes may be lost when you leave this page.",
      );
      return false;
    }
    state = newState;
    return true;
  }

  function buildSummaryText() {
    const settlements = computeSettlements(state);
    const lines = ["FairShare - " + state.name];
    (state.payments || []).forEach((payment) => {
      lines.push(
        "Already paid: " +
          payment.from +
          " paid " +
          payment.to +
          " " +
          formatMoney(payment.amountPaise, state.currency),
      );
    });
    settlements.forEach((s) => {
      lines.push(
        s.from +
          " pays " +
          s.to +
          " " +
          formatMoney(s.amountPaise, state.currency),
      );
    });
    return lines.join("\n");
  }

  function copySummary() {
    const text = buildSummaryText();
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      navigator.clipboard
        .writeText(text)
        .then(() => showToast("Summary copied"))
        .catch(() => {
          showToast("Copy failed. Select and copy the summary manually.");
        });
    } else {
      showToast("Copy failed. Select and copy the summary manually.");
    }
  }

  // One-time move of data saved under the legacy key names. A key is copied only when
  // its new name is still empty, and the legacy key is removed only after the copy.
  function migrateLegacyStorage() {
    [STORAGE_KEY, BACKUP_KEY, LAST_REMOVED_KEY].forEach((key) => {
      const legacyKey = LEGACY_KEY_PREFIX + key.slice(key.indexOf(".") + 1);
      try {
        const legacy = localStorage.getItem(legacyKey);
        if (legacy === null || localStorage.getItem(key) !== null) {
          return;
        }
        localStorage.setItem(key, legacy);
        localStorage.removeItem(legacyKey);
      } catch {
        // Migration is best effort; the legacy copy stays put if storage is unavailable.
      }
    });
  }

  function readStoredTrip() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return { trip: null };
    }
    if (!raw) {
      return { trip: null };
    }
    try {
      const parsed = JSON.parse(raw);
      const trip = migrateTrip(parsed);
      if (!trip) {
        const backedUp = backupStoredData(raw);
        return { trip: null, corrupted: true, backupFailed: !backedUp };
      }
      trip.revision =
        typeof parsed.revision === "number" && Number.isInteger(parsed.revision)
          ? parsed.revision
          : 0;
      return { trip: trip, migrated: parsed.schemaVersion !== SCHEMA_VERSION };
    } catch {
      const backedUp = backupStoredData(raw);
      return { trip: null, corrupted: true, backupFailed: !backedUp };
    }
  }

  function renderMemberList() {
    memberListEl.replaceChildren();
    if (setupMembers.length === 0) {
      const empty = document.createElement("li");
      empty.className = "muted member-empty";
      empty.textContent = "Add at least 2 people to split with.";
      memberListEl.appendChild(empty);
    }
    setupMembers.forEach((name, index) => {
      memberListEl.appendChild(buildMemberChip(name, index));
    });
    memberCountEl.textContent =
      setupMembers.length > MAX_MEMBERS
        ? setupMembers.length + " (max " + MAX_MEMBERS + ")"
        : setupMembers.length + " of " + MAX_MEMBERS;
  }

  function buildMemberChip(name, index) {
    const item = document.createElement("li");
    item.className = "member-item";
    const label = document.createElement("span");
    label.className = "member-name";
    label.textContent = name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "\u00d7";
    remove.dataset.index = index;
    remove.setAttribute("aria-label", "Remove " + name);
    remove.addEventListener("click", () => {
      removeMember(index);
    });
    item.appendChild(createAvatar(name, setupMembers));
    item.appendChild(label);
    item.appendChild(remove);
    return item;
  }

  function addMember() {
    clearError(memberError);
    const name = memberNameInput.value.trim();
    if (name === "") {
      showError(memberError, "Enter a member name.");
      return;
    }
    const lowered = name.toLowerCase();
    const duplicate = setupMembers.some(
      (member) => member.toLowerCase() === lowered,
    );
    if (duplicate) {
      showError(memberError, "That member is already in the list.");
      return;
    }
    setupMembers.push(name);
    memberNameInput.value = "";
    clearError(memberMinError);
    clearError(createError);
    renderMemberList();
  }

  function removeMember(index) {
    clearError(memberError);
    setupMembers.splice(index, 1);
    clearError(memberMinError);
    clearError(createError);
    renderMemberList();
    if (setupMembers.length === 0) {
      memberNameInput.focus();
    } else {
      const nextIdx = index < setupMembers.length ? index : index - 1;
      const btn = memberListEl.querySelector(
        '.remove-btn[data-index="' + nextIdx + '"]',
      );
      if (btn) {
        btn.focus();
      }
    }
  }

  function createTrip(initialExpenses) {
    const expenses = Array.isArray(initialExpenses) ? initialExpenses : [];
    clearError(tripNameError);
    clearError(tripCurrencyError);
    clearError(memberMinError);
    clearError(createError);
    const name = tripNameInput.value.trim();
    const currency = tripCurrencySelect.value;
    let valid = true;
    if (name === "") {
      showError(tripNameError, "Enter a trip name.");
      valid = false;
    }
    if (!Core.isSupportedCurrency(currency)) {
      showError(tripCurrencyError, "Select a supported currency.");
      valid = false;
    }
    if (setupMembers.length < MIN_MEMBERS) {
      showError(
        memberMinError,
        "Add at least " + MIN_MEMBERS + " members to create a trip.",
      );
      valid = false;
    } else if (setupMembers.length > MAX_MEMBERS) {
      showError(
        memberMinError,
        "A trip can have at most " + MAX_MEMBERS + " members.",
      );
      valid = false;
    }
    if (!valid) {
      return;
    }
    exitEditMode();
    const newState = {
      schemaVersion: SCHEMA_VERSION,
      id: makeTripId(),
      name: name,
      currency: currency,
      members: setupMembers.slice(),
      expenses: expenses,
      nextSeq: expenses.length + 1,
      payments: [],
      revision: 0,
    };
    if (!saveState(newState)) {
      return;
    }
    workspaceScreen.hidden = false;
    setupScreen.hidden = true;
    exitEditMode();
    resetExpenseForm();
    renderWorkspace();
    switchView("expenses");
    tripTitleEl.focus();
  }

  function renderPreviewAmounts() {
    previewAmounts.villa.textContent = formatMoney(1840000, "INR");
    previewAmounts.dinner.textContent = formatMoney(480000, "INR");
    previewAmounts.cabs.textContent = formatMoney(160000, "INR");
    previewAmounts.rohan.textContent = formatMoney(1220000, "INR");
    previewAmounts.kabir.textContent = formatMoney(-620000, "INR").replace(
      "-",
      "",
    );
    previewAmounts.aarav.textContent = formatMoney(-460000, "INR").replace(
      "-",
      "",
    );
    previewAmounts.meera.textContent = formatMoney(-140000, "INR").replace(
      "-",
      "",
    );
    document.getElementById("preview-pay-kabir").textContent =
      previewAmounts.kabir.textContent;
    document.getElementById("preview-pay-aarav").textContent =
      previewAmounts.aarav.textContent;
    document.getElementById("preview-pay-meera").textContent =
      previewAmounts.meera.textContent;
  }

  function createSampleTrip() {
    setupMembers.length = 0;
    ["Rohan", "Meera", "Aarav", "Kabir"].forEach((member) => {
      setupMembers.push(member);
    });
    tripCurrencySelect.value = "INR";
    tripNameInput.value = "Goa Trip";
    createTrip([
      {
        seq: 1,
        description: "Villa",
        amountPaise: 1840000,
        payer: "Rohan",
        date: dateDaysAgo(2),
        participants: setupMembers.slice(),
      },
      {
        seq: 2,
        description: "Beach dinner",
        amountPaise: 480000,
        payer: "Meera",
        date: dateDaysAgo(1),
        participants: setupMembers.slice(),
      },
      {
        seq: 3,
        description: "Airport cabs",
        amountPaise: 160000,
        payer: "Aarav",
        date: dateDaysAgo(0),
        participants: setupMembers.slice(),
      },
    ]);
  }

  function dateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const pad = (n) => String(n).padStart(2, "0");
    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate())
    );
  }

  function updateAmountCurrency() {
    const currency = state ? state.currency : tripCurrencySelect.value;
    amountLabel.textContent = "Amount (" + currency + ")";
    amountInput.placeholder = Core.amountPlaceholder(currency);
    amountPrefix.textContent = currencySymbol(currency);
  }

  // The symbol the trip's money format uses ("€", "₹", "HRK"), shown before the
  // amount field. Falls back to the code when the browser cannot format it.
  function currencySymbol(currency) {
    if (!Core.isSupportedCurrency(currency)) {
      return "";
    }
    const parts = splitMoney(formatMoney(0, currency));
    return (parts ? (parts.before || parts.after) : "").trim() || currency;
  }

  // "€1,210.20" -> { before: "€", number: "1,210.20", after: "" }, so the symbol
  // can be set smaller than the figures. Returns null if no digits are found.
  function splitMoney(text) {
    const match = /^(\D*?)(\d(?:.*\d)?)(\D*)$/.exec(text);
    return match ? { before: match[1], number: match[2], after: match[3] } : null;
  }

  function setMoney(el, minor) {
    const text = formatMoney(minor, state.currency);
    const parts = splitMoney(text);
    el.replaceChildren();
    if (!parts) {
      el.textContent = text;
      return;
    }
    [
      [parts.before, "money-symbol"],
      [parts.number, ""],
      [parts.after, "money-symbol"],
    ].forEach((part) => {
      if (!part[0]) {
        return;
      }
      if (!part[1]) {
        el.appendChild(document.createTextNode(part[0]));
        return;
      }
      const span = document.createElement("span");
      span.className = part[1];
      span.textContent = part[0];
      el.appendChild(span);
    });
  }

  function updateSplitPreview() {
    if (!state) {
      return;
    }
    const count = getSelectedParticipants().length;
    const everyone = state.members.length;
    if (count === 0) {
      splitPreview.textContent = "Pick at least one person to split with.";
      return;
    }
    const who = count === everyone ? "split " + count + " ways" : count + " of " + everyone + " people";
    const amount = parseAmount(amountInput.value, state.currency);
    if (!amountInput.value.trim() || !amount.ok) {
      splitPreview.textContent = count === 1 ? "One person covers it" : who.charAt(0).toUpperCase() + who.slice(1);
      return;
    }
    if (count === 1) {
      splitPreview.textContent = formatMoney(amount.paise, state.currency) + " for one person";
      return;
    }
    const share = formatMoney(Math.round(amount.paise / count), state.currency);
    const exact = amount.paise % count === 0;
    splitPreview.textContent = (exact ? "" : "About ") + share + " each \u00b7 " + who;
  }

  function setDateBounds(input) {
    input.min = "2000-01-01";
    input.max = todayLocalStr();
  }

  function currencyOptgroup(label, codes) {
    const group = document.createElement("optgroup");
    group.label = label;
    codes.forEach((code) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = code + " - " + Core.CURRENCY_NAMES[code];
      group.appendChild(option);
    });
    return group;
  }

  // Select a trip's currency. A valid code that is not in the list (for example a
  // retired currency from an older trip) gets its own option instead of being replaced.
  function selectCurrency(code) {
    tripCurrencySelect.value = code;
    if (tripCurrencySelect.value === code || !Core.isSupportedCurrency(code)) {
      return;
    }
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code + " - " + Core.currencyName(code);
    tripCurrencySelect.insertBefore(option, tripCurrencySelect.firstChild);
    tripCurrencySelect.value = code;
  }

  function renderCurrencyOptions() {
    const groups = Core.currencyPickerGroups();
    tripCurrencySelect.replaceChildren(
      currencyOptgroup("Common", groups.common),
      currencyOptgroup("All currencies", groups.all),
    );
    tripCurrencySelect.value = Core.defaultCurrencyForLocale(navigator.language);
    updateAmountCurrency();
  }

  function focusTripName() {
    if (typeof tripNameInput.scrollIntoView === "function") {
      const reduceMotion = prefersReducedMotion();
      tripNameInput.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }
    tripNameInput.focus();
  }

  function renderPayerOptions() {
    const prevValue = payerSelect.value;
    payerSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select member";
    payerSelect.appendChild(placeholder);
    state.members.forEach((member) => {
      const option = document.createElement("option");
      option.value = member;
      option.textContent = member;
      payerSelect.appendChild(option);
    });
    if (prevValue !== "" && state.members.indexOf(prevValue) !== -1) {
      payerSelect.value = prevValue;
    }
  }

  function renderParticipants(selected) {
    const selectedList = selected || null;
    participantListEl.replaceChildren();
    state.members.forEach((member, index) => {
      const row = document.createElement("label");
      row.className = "participant";
      row.setAttribute("for", "participant-" + index);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = member;
      checkbox.checked = selectedList
        ? selectedList.indexOf(member) !== -1
        : true;
      checkbox.id = "participant-" + index;
      checkbox.setAttribute("aria-describedby", "participants-error");
      checkbox.addEventListener("change", () => {
        clearError(participantsError);
        updateParticipantsToggle();
        updateSplitPreview();
      });

      const text = document.createElement("span");
      text.textContent = member;

      row.appendChild(checkbox);
      row.appendChild(text);
      participantListEl.appendChild(row);
    });
    updateParticipantsToggle();
  }

  function updateParticipantsToggle() {
    const boxes = Array.from(participantListEl.querySelectorAll("input"));
    participantsToggle.textContent =
      boxes.length > 0 && boxes.every((box) => box.checked)
        ? "Clear all"
        : "Select all";
  }

  function toggleParticipants() {
    const boxes = Array.from(participantListEl.querySelectorAll("input"));
    const selectAll = boxes.some((box) => !box.checked);
    boxes.forEach((box) => {
      box.checked = selectAll;
    });
    clearError(participantsError);
    updateParticipantsToggle();
    updateSplitPreview();
  }

  function getSelectedParticipants() {
    return Array.from(
      participantListEl.querySelectorAll("input[type=checkbox]"),
    )
      .filter((box) => box.checked)
      .map((box) => box.value);
  }

  function resetExpenseForm() {
    if (!state) {
      return;
    }
    descriptionInput.value = "";
    amountInput.value = "";
    payerSelect.value = "";
    dateInput.value = todayLocalStr();
    setDateBounds(dateInput);
    clearAllErrors();
    renderParticipants();
    updateSplitPreview();
  }

  function balanceKind(value) {
    if (value > 0) {
      return { group: 0, label: "gets back", cls: "positive" };
    }
    if (value < 0) {
      return { group: 1, label: "owes", cls: "negative" };
    }
    return { group: 2, label: "settled up", cls: "zero" };
  }

  function renderBalances() {
    const balances = computeBalances(state);
    balanceListEl.replaceChildren();
    const entries = state.members
      .map((member) => ({ member: member, value: balances[member] || 0 }))
      .sort((a, b) => {
        return (
          balanceKind(a.value).group - balanceKind(b.value).group ||
          Math.abs(b.value) - Math.abs(a.value)
        );
      });
    const largest = entries.reduce(
      (max, entry) => Math.max(max, Math.abs(entry.value)),
      0,
    );
    const hasActivity = state.expenses.length > 0 || (state.payments || []).length > 0;
    const allSquare = hasActivity && largest === 0;
    balancesEmpty.hidden = largest > 0;
    balancesEmpty.classList.toggle("is-square", allSquare);
    if (allSquare) {
      buildSquareArt(balancesSquareArt, state.members, true);
    }
    balancesEmptyTitle.textContent = allSquare ? "Everyone's square." : "No balances yet";
    balancesEmptyText.textContent = allSquare
      ? "Nobody owes anything right now."
      : "Add an expense to see who owes whom.";
    balanceListEl.hidden = !hasActivity;
    const owed = entries.filter((entry) => entry.value > 0).length;
    const owing = entries.filter((entry) => entry.value < 0).length;
    balancesStat.textContent = largest > 0
      ? owed + (owed === 1 ? " gets back" : " get back") + " \u00b7 " + owing + (owing === 1 ? " owes" : " owe")
      : allSquare ? "All square" : "";
    entries.forEach((entry) => {
      const value = entry.value;
      const kind = balanceKind(value);
      const label = kind.label;
      const cls = kind.cls;
      const item = document.createElement("li");
      item.className = "balance-item balance-item-rich " + cls;

      item.appendChild(createAvatar(entry.member));
      const content = document.createElement("span");
      content.className = "balance-copy";

      const nameEl = document.createElement("span");
      nameEl.className = "balance-name";
      nameEl.textContent = entry.member;

      const stateEl = document.createElement("span");
      stateEl.className = "balance-state";
      stateEl.textContent = label;
      content.appendChild(nameEl);
      content.appendChild(stateEl);

      const amountEl = document.createElement("span");
      amountEl.className = "balance-amount";
      // The word ("owes", "gets back") and the colour carry the sign.
      amountEl.textContent = formatMoney(Math.abs(value), state.currency);
      item.appendChild(content);
      item.appendChild(amountEl);

      const bar = document.createElement("span");
      bar.className = "balance-bar";
      bar.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.className = "balance-bar-fill";
      fill.style.width =
        largest > 0 ? (Math.abs(value) / largest) * 100 + "%" : "0%";
      bar.appendChild(fill);
      item.appendChild(bar);

      balanceListEl.appendChild(item);
    });
  }

  function sumAmounts(items) {
    return items.reduce((total, item) => total + item.amountPaise, 0);
  }

  function renderSettleProgress(settlements) {
    const payments = state.payments || [];
    const remaining = sumAmounts(settlements);
    const paid = sumAmounts(payments);
    const hasActivity = state.expenses.length > 0 || payments.length > 0;
    settleProgress.hidden = settlements.length === 0;
    settleProgressAmount.textContent = paid > 0
      ? formatMoney(paid, state.currency) + " paid so far"
      : "Nothing paid yet";
    const share = paid + remaining > 0 ? paid / (paid + remaining) : 0;
    settleMeterFill.style.width = Math.round(share * 1000) / 10 + "%";
    settleStat.textContent = settlements.length > 0
      ? formatMoney(remaining, state.currency) + " to move"
      : hasActivity ? "All square" : "";
    settleEmpty.classList.toggle("is-settled", hasActivity);
    // Nothing to summarise until something has been spent or paid.
    copySettleBtn.hidden = !hasActivity;
    if (settlements.length === 0) {
      buildSquareArt(settleSquareArt, state.members, hasActivity);
    }
    // Settled: the sentence stays for screen readers, the stats row shows it.
    settleEmptyText.classList.toggle("sr-only", hasActivity);
    settleSquareStats.hidden = !hasActivity;
    if (hasActivity) {
      renderSquareStats(payments);
      const count = state.expenses.length;
      settleEmptyTitle.textContent = "Everyone's square.";
      settleEmptyText.textContent =
        formatMoney(sumAmounts(state.expenses), state.currency) +
        " shared across " + count + (count === 1 ? " expense" : " expenses") +
        (payments.length > 0
          ? " \u00b7 " + payments.length + (payments.length === 1 ? " payment made" : " payments made")
          : "");
    } else {
      settleEmptyTitle.textContent = "Nothing to settle yet";
      settleEmptyText.textContent = "Add an expense and the fewest payments to square up appear here.";
    }
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  function svgEl(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs).forEach((key) => {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }

  function shortName(name, max) {
    const limit = max || 10;
    return name.length > limit ? name.slice(0, limit - 1) + "…" : name;
  }

  // A picture of the plan. One row per payment on the left (payer and amount),
  // an arc in the payer's colour to the person paid on the right. Rows are grouped
  // by who gets paid and each arc docks at its own port, so arcs never cross or
  // pile into one knot. The list below says the same in words.
  const FLOW_WIDTH = 340;

  function renderSettleFlow(settlements) {
    settleFlow.replaceChildren();
    settleFlow.hidden = settlements.length === 0;
    if (settlements.length === 0) {
      return;
    }
    const payees = settlements
      .map((s) => s.to)
      .filter((name, i, names) => names.indexOf(name) === i);
    const rowHeight = settlements.length > 6 ? 36 : 42;
    const portGap = 9;
    const groupGap = 14;
    const largest = Math.max.apply(null, settlements.map((s) => s.amountPaise));
    const arcs = svgEl("g", { class: "flow-arcs" });
    const nodes = svgEl("g", { class: "flow-nodes" });
    let top = 6;
    let order = 0;
    payees.forEach((to) => {
      const group = settlements.filter((s) => s.to === to);
      const capHeight = 28 + (group.length - 1) * portGap;
      const groupHeight = Math.max(group.length * rowHeight, capHeight + 40);
      const rowsTop = top + (groupHeight - group.length * rowHeight) / 2;
      const capTop = top + (groupHeight - capHeight - 34) / 2;
      group.forEach((s, i) => {
        const y = rowsTop + rowHeight * i + rowHeight / 2;
        const port = capTop + 14 + i * portGap;
        const tone = memberTone(s.from);
        const amountText = formatMoney(s.amountPaise, state.currency);
        const payer = svgEl("g", { class: "flow-payer " + tone });
        payer.appendChild(svgEl("circle", { cx: 15, cy: y, r: 13 }));
        const initial = svgEl("text", { x: 15, y: y + 4.5, "text-anchor": "middle", class: "flow-initial" });
        initial.textContent = s.from.charAt(0).toUpperCase();
        payer.appendChild(initial);
        const name = svgEl("text", { x: 36, y: y + 4.5, class: "flow-name" });
        name.textContent = shortName(s.from, amountText.length > 9 ? 7 : 10);
        payer.appendChild(name);
        const amount = svgEl("text", { x: 172, y: y + 4.5, "text-anchor": "end", class: "flow-amount" });
        amount.textContent = amountText;
        payer.appendChild(amount);
        nodes.appendChild(payer);
        arcs.appendChild(svgEl("path", {
          d: "M182 " + y + "C226 " + y + " 222 " + port + " 262 " + port,
          "stroke-width": (2 + (3 * s.amountPaise) / largest).toFixed(2),
          pathLength: "1",
          "data-from": s.from,
          "data-to": s.to,
          class: "flow-arc flow-arc-" + Math.min(order, 8) + " " + tone,
        }));
        arcs.appendChild(svgEl("circle", { cx: 182, cy: y, r: 3, class: "flow-port " + tone }));
        order += 1;
      });
      const received = group.reduce((sum, s) => sum + s.amountPaise, 0);
      const payee = svgEl("g", { class: "flow-payee " + memberTone(to) });
      payee.appendChild(svgEl("rect", { x: 262, y: capTop, width: 28, height: capHeight, rx: 14 }));
      const initial = svgEl("text", {
        x: 276, y: capTop + capHeight / 2 + 4.5, "text-anchor": "middle", class: "flow-initial",
      });
      initial.textContent = to.charAt(0).toUpperCase();
      payee.appendChild(initial);
      const name = svgEl("text", { x: 276, y: capTop + capHeight + 17, "text-anchor": "middle", class: "flow-name" });
      name.textContent = shortName(to, 9);
      payee.appendChild(name);
      const total = svgEl("text", { x: 276, y: capTop + capHeight + 32, "text-anchor": "middle", class: "flow-received" });
      total.textContent = "+" + formatMoney(received, state.currency);
      payee.appendChild(total);
      nodes.appendChild(payee);
      top += groupHeight + groupGap;
    });
    const height = Math.round(top - groupGap + 6);
    const svg = svgEl("svg", {
      viewBox: "0 0 " + FLOW_WIDTH + " " + height,
      focusable: "false",
      class: "settle-flow-svg",
    });
    svg.appendChild(arcs);
    svg.appendChild(nodes);
    settleFlow.appendChild(svg);
  }

  // The settled moment's picture: everyone on one orbit, evenly spaced, around a
  // check. Before anything is spent it is just the empty rings.
  function buildSquareArt(container, members, settled) {
    const key = (settled ? "1" : "0") + "|" + members.join("\u0000");
    if (container.dataset.key === key) {
      return;
    }
    container.dataset.key = key;
    container.replaceChildren();
    const svg = svgEl("svg", { viewBox: "0 0 300 132", focusable: "false", class: "square-svg" });
    const rings = svgEl("g", { class: "square-rings", transform: "rotate(-8 150 66)" });
    [[128, 46], [86, 31], [46, 17]].forEach((r, i) => {
      rings.appendChild(svgEl("ellipse", {
        cx: 150, cy: 66, rx: r[0], ry: r[1], pathLength: "1", class: "square-ring square-ring-" + i,
      }));
    });
    svg.appendChild(rings);
    if (settled) {
      const angle = (-8 * Math.PI) / 180;
      members.forEach((name, i) => {
        // Start at the top of the orbit and go round clockwise.
        const t = -Math.PI / 2 + (i * 2 * Math.PI) / members.length;
        const ex = 128 * Math.cos(t);
        const ey = 46 * Math.sin(t);
        const x = 150 + ex * Math.cos(angle) - ey * Math.sin(angle);
        const y = 66 + ex * Math.sin(angle) + ey * Math.cos(angle);
        const place = svgEl("g", { transform: "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")" });
        const member = svgEl("g", {
          class: "square-member square-member-" + i + " " + memberTone(name, members),
        });
        member.appendChild(svgEl("circle", { r: 13 }));
        const initial = svgEl("text", { y: 4.5, "text-anchor": "middle", class: "flow-initial" });
        initial.textContent = name.charAt(0).toUpperCase();
        member.appendChild(initial);
        place.appendChild(member);
        svg.appendChild(place);
      });
      const check = svgEl("g", { class: "square-check" });
      check.appendChild(svgEl("circle", { cx: 150, cy: 66, r: 19 }));
      check.appendChild(svgEl("path", { d: "M141 66.5l6 6 12-13", pathLength: "1" }));
      svg.appendChild(check);
    } else {
      svg.appendChild(svgEl("circle", { cx: 150, cy: 66, r: 5, class: "square-dot" }));
    }
    container.appendChild(svg);
  }

  function renderSquareStats(payments) {
    const stats = [[formatMoney(sumAmounts(state.expenses), state.currency), "shared"]];
    const count = state.expenses.length;
    stats.push([String(count), count === 1 ? "expense" : "expenses"]);
    if (payments.length > 0) {
      stats.push([String(payments.length), payments.length === 1 ? "payment" : "payments"]);
    }
    settleSquareStats.replaceChildren();
    stats.forEach((stat) => {
      const cell = document.createElement("span");
      cell.className = "square-stat";
      const value = document.createElement("strong");
      value.textContent = stat[0];
      const label = document.createElement("span");
      label.textContent = stat[1];
      cell.appendChild(value);
      cell.appendChild(label);
      settleSquareStats.appendChild(cell);
    });
  }

  function renderSettlements() {
    const settlements = computeSettlements(state);
    renderSettleProgress(settlements);
    renderSettleFlow(settlements);
    settleEmpty.hidden = settlements.length > 0;
    settleSummary.hidden = settlements.length === 0;
    settleSummary.textContent =
      settlements.length +
      (settlements.length === 1
        ? " payment settles everything"
        : " payments settle everything");
    settleHint.hidden = settlements.length === 0;
    settleHint.textContent = isTouchDevice()
      ? "Swipe left or tap a payment to mark it paid"
      : "Select a payment to mark it paid";
    settleList.replaceChildren();
    settleList.hidden = settlements.length === 0;
    settlements.forEach((s) => {
      const item = document.createElement("span");
      item.className = "settle-item";
      item.appendChild(createAvatar(s.from));
      const arrow = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      arrow.setAttribute("aria-hidden", "true");
      arrow.setAttribute("viewBox", "0 0 24 24");
      arrow.classList.add("settle-arrow");
      const arrowPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      arrowPath.setAttribute("d", "M4 12h15m-5-5 5 5-5 5");
      arrow.appendChild(arrowPath);
      item.appendChild(arrow);
      item.appendChild(createAvatar(s.to));
      const copy = document.createElement("span");
      copy.className = "settle-copy";
      copy.textContent = s.from + " pays " + s.to;
      item.appendChild(copy);
      const amount = document.createElement("strong");
      amount.className = "settle-amount";
      amount.textContent = formatMoney(s.amountPaise, state.currency);
      item.appendChild(amount);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "settle-row-button";
      row.appendChild(item);
      row.addEventListener("click", () => {
        if (!settleList.classList.contains("is-busy")) {
          openSettleDialog(s, row);
        }
      });
      attachPaymentSwipe(row, s);
      settleList.appendChild(wrapSettleRow(row));
    });
    nudgeFirstSettlement(settlements.length > 0);
  }

  function wrapSettleRow(row) {
    const listItem = document.createElement("li");
    listItem.className = "settle-swipe";
    const panel = document.createElement("span");
    panel.className = "settle-swipe-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.textContent = "\u2713 Paid";
    listItem.appendChild(panel);
    listItem.appendChild(row);
    return listItem;
  }

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  function nudgeFirstSettlement(hasSettlements) {
    if (!hasSettlements || !isTouchDevice()) {
      return;
    }
    try {
      if (localStorage.getItem("fairshare.settleSwipeHint.v1")) {
        return;
      }
      localStorage.setItem("fairshare.settleSwipeHint.v1", "1");
      const first = settleList.querySelector(".settle-row-button");
      if (first) {
        first.classList.add("settle-nudge");
      }
    } catch {
      // Discoverability is best effort when storage is unavailable.
    }
  }

  // Ten distinct tones, handed out in member order, so no two people on a trip
  // (up to the 10-member limit) share a colour. A name that is no longer a member
  // falls back to a stable hash.
  const TONE_COUNT = 10;

  function memberTone(name, members) {
    const list = members || (state ? state.members : []);
    const index = list.indexOf(name);
    if (index !== -1) {
      return "avatar-tone-" + (index % TONE_COUNT);
    }
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return "avatar-tone-" + (hash % TONE_COUNT);
  }

  function createAvatar(name, members) {
    const avatar = document.createElement("span");
    avatar.className = "expense-avatar " + memberTone(name, members);
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = name.charAt(0).toUpperCase();
    return avatar;
  }

  function createExpenseItem(expense) {
    const item = document.createElement("li");
    const row = document.createElement("button");
    row.type = "button";
    row.id = "edit-expense-" + expense.seq;
    row.className = "expense-row";

    const avatar = document.createElement("span");
    avatar.className = "expense-avatar " + memberTone(expense.payer);
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = expense.payer.charAt(0).toUpperCase();

    const main = document.createElement("span");
    main.className = "expense-row-main";
    const editHint = document.createElement("span");
    editHint.className = "sr-only";
    editHint.textContent = "Edit ";
    const description = document.createElement("span");
    description.className = "expense-row-description";
    description.appendChild(editHint);
    description.appendChild(document.createTextNode(expense.description));
    const meta = document.createElement("span");
    meta.className = "expense-row-meta";
    // The day header above the row already carries the date.
    meta.textContent =
      expense.payer +
      " paid \u00b7 " +
      (expense.participants.length === state.members.length
        ? "split with everyone"
        : "split " + expense.participants.length + " of " + state.members.length);
    main.appendChild(description);
    main.appendChild(meta);

    const amount = document.createElement("span");
    amount.className = "expense-row-amount";
    amount.textContent = formatMoney(expense.amountPaise, state.currency);

    row.appendChild(avatar);
    row.appendChild(main);
    row.appendChild(amount);
    row.addEventListener("click", () => {
      enterEditMode(expense);
    });

    if (expense.seq === editingSeq) {
      row.classList.add("editing");
      row.setAttribute("aria-current", "true");
    }
    item.appendChild(row);
    return item;
  }

  function typeRank(entry) {
    return entry.type === "payment" ? 0 : 1;
  }

  function dayLabel(dateStr) {
    const today = todayLocalStr();
    if (dateStr === today) {
      return "Today";
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pad = (n) => String(n).padStart(2, "0");
    const yStr = yesterday.getFullYear() + "-" + pad(yesterday.getMonth() + 1) + "-" + pad(yesterday.getDate());
    return dateStr === yStr ? "Yesterday" : shortDate(dateStr);
  }

  function createDayHeader(dateStr, totalPaise) {
    const item = document.createElement("li");
    item.className = "expense-day";
    const label = document.createElement("span");
    label.className = "expense-day-label";
    label.textContent = dayLabel(dateStr);
    item.appendChild(label);
    if (totalPaise > 0) {
      const total = document.createElement("span");
      total.className = "expense-day-total";
      total.textContent = formatMoney(totalPaise, state.currency);
      item.appendChild(total);
    }
    return item;
  }

  function renderExpenses() {
    expenseListEl.replaceChildren();
    expensesEmptyEl.hidden =
      state.expenses.length > 0 || (state.payments || []).length > 0;
    // Newest date first; within a day, the later seq first (payments before
    // expenses if an old trip reused a seq).
    const entries = state.expenses
      .map((expense) => ({ type: "expense", value: expense }))
      .concat(
        (state.payments || []).map((payment) => ({
          type: "payment",
          value: payment,
        })),
      );
    entries.sort(
      (a, b) =>
        b.value.date.localeCompare(a.value.date) ||
        b.value.seq - a.value.seq ||
        typeRank(a) - typeRank(b),
    );
    const dayTotals = {};
    state.expenses.forEach((expense) => {
      dayTotals[expense.date] = (dayTotals[expense.date] || 0) + expense.amountPaise;
    });
    let currentDay = null;
    entries.forEach((entry) => {
      if (entry.value.date !== currentDay) {
        currentDay = entry.value.date;
        expenseListEl.appendChild(createDayHeader(currentDay, dayTotals[currentDay] || 0));
      }
      if (entry.type === "expense") {
        expenseListEl.appendChild(createExpenseItem(entry.value));
        return;
      }
      const payment = entry.value;
      const item = document.createElement("li");
      const row = document.createElement("button");
      row.type = "button";
      row.className = "expense-row payment-row";
      row.id = "edit-payment-" + payment.seq;
      const editHint = document.createElement("span");
      editHint.className = "sr-only";
      editHint.textContent = "Edit payment ";
      const avatars = document.createElement("span");
      avatars.className = "payment-avatars";
      avatars.setAttribute("aria-hidden", "true");
      avatars.appendChild(createAvatar(payment.from));
      avatars.appendChild(createAvatar(payment.to));
      const main = document.createElement("span");
      main.className = "expense-row-main";
      const text = document.createElement("span");
      text.className = "expense-row-description";
      text.appendChild(editHint);
      text.appendChild(
        document.createTextNode(payment.from + " paid " + payment.to),
      );
      const meta = document.createElement("span");
      meta.className = "expense-row-meta";
      meta.textContent = "Recorded payment";
      main.appendChild(text);
      main.appendChild(meta);
      const amount = document.createElement("span");
      amount.className = "expense-row-amount payment-amount";
      amount.textContent = formatMoney(payment.amountPaise, state.currency);
      row.appendChild(avatars);
      row.appendChild(main);
      row.appendChild(amount);
      row.addEventListener("click", () => {
        openPaymentSheet(payment, row);
      });
      item.appendChild(row);
      expenseListEl.appendChild(item);
    });
  }

  // "20–23 Oct" within one month, "28 Oct – 2 Nov" across months, or one date.
  function tripDateRange() {
    const dates = state.expenses.map((expense) => expense.date).sort();
    if (dates.length === 0) {
      return "";
    }
    const first = dates[0];
    const last = dates[dates.length - 1];
    if (first === last) {
      return shortDate(first);
    }
    if (first.slice(0, 7) === last.slice(0, 7)) {
      return Number(first.slice(8)) + "\u2013" + shortDate(last);
    }
    return shortDate(first) + " \u2013 " + shortDate(last);
  }

  // What each person's share of the spending comes to. With partial splits the
  // shares differ, so the stat gives the range rather than a misleading average.
  function shareStat() {
    const shares = {};
    state.members.forEach((member) => {
      shares[member] = 0;
    });
    state.expenses.forEach((expense) => {
      const split = Core.splitPaise(expense.amountPaise, expense.participants, state.members);
      Object.keys(split).forEach((member) => {
        shares[member] = (shares[member] || 0) + split[member];
      });
    });
    const values = state.members.map((member) => shares[member]);
    const low = Math.min.apply(null, values);
    const high = Math.max.apply(null, values);
    if (low === high) {
      return formatMoney(low, state.currency) + " each";
    }
    return formatMoney(low, state.currency) + "\u2013" + formatMoney(high, state.currency) + " each";
  }

  function renderWorkspace() {
    let totalPaise = 0;
    state.expenses.forEach((expense) => {
      totalPaise += expense.amountPaise;
    });
    tripTitleEl.textContent = state.name;
    const count = state.expenses.length;
    const summary = [
      state.members.length + " people",
      count === 0 ? "No expenses yet" : count + (count === 1 ? " expense" : " expenses"),
    ];
    const range = tripDateRange();
    if (range) {
      summary.push(range);
    }
    tripSummaryEl.textContent = summary.join(" \u00b7 ");
    const hasActivity = count > 0 || (state.payments || []).length > 0;
    if (hasActivity && computeSettlements(state).length === 0) {
      const gap = document.createElement("span");
      gap.className = "sr-only";
      gap.textContent = " \u00b7 ";
      const square = document.createElement("span");
      square.className = "trip-square";
      square.textContent = "All square";
      tripSummaryEl.appendChild(gap);
      tripSummaryEl.appendChild(square);
    }
    setMoney(tripTotalEl, totalPaise);
    tripMiniName.textContent = state.name;
    setMoney(tripMiniTotal, totalPaise);
    expensesStat.textContent = count > 0 ? shareStat() : "";
    updateAmountCurrency();
    renderPayerOptions();
    renderBalances();
    renderSettlements();
    renderExpenses();
  }

  function renderPaymentMembers() {
    [paymentFrom, paymentTo].forEach((select) => {
      select.replaceChildren();
      state.members.forEach((member) => {
        const option = document.createElement("option");
        option.value = member;
        option.textContent = member;
        select.appendChild(option);
      });
    });
    paymentAmount.placeholder = Core.amountPlaceholder(state.currency);
    document.getElementById("payment-amount-prefix").textContent = currencySymbol(state.currency);
    document.getElementById("payment-amount-label").textContent =
      "Amount (" + state.currency + ")";
    setDateBounds(paymentDate);
  }

  function openPaymentSheet(payment, opener, suggestion) {
    editingPaymentSeq = payment ? payment.seq : null;
    paymentTitle.textContent = payment ? "Edit payment" : "Record a payment";
    savePaymentBtn.textContent = payment ? "Save changes" : "Record payment";
    deletePaymentBtn.hidden = !payment;
    renderPaymentMembers();
    fillPaymentFields(payment, suggestion);
    clearPaymentErrors();
    paymentDialogOpener = opener || document.activeElement;
    paymentDialog.showModal();
    document.body.classList.add("dialog-open");
    // Both record and edit start on the first field, From.
    paymentFrom.focus();
  }

  function fillPaymentFields(payment, suggestion) {
    const source = payment || suggestion || getFirstSettlement();
    paymentFrom.value = source ? source.from : state.members[0];
    paymentTo.value = source ? source.to : state.members[1] || state.members[0];
    paymentAmount.value = source
      ? paiseToInputValue(source.amountPaise, state.currency)
      : "";
    paymentDate.value = payment ? payment.date : todayLocalStr();
  }

  function getFirstSettlement() {
    return computeSettlements(state)[0] || null;
  }

  function attachPaymentSwipe(row, settlement) {
    let startX = 0;
    let startY = 0;
    let dragging = false;
    row.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") {
        return;
      }
      row.style.transition = "";
      startX = event.clientX;
      startY = event.clientY;
      dragging = false;
      if (typeof row.setPointerCapture === "function") {
        row.setPointerCapture(event.pointerId);
      }
    });
    row.addEventListener("pointermove", (event) => {
      if (event.pointerType === "mouse") {
        return;
      }
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (
        !dragging &&
        Math.abs(deltaX) > 10 &&
        Math.abs(deltaX) > Math.abs(deltaY)
      ) {
        dragging = true;
      }
      if (dragging && deltaX < 0) {
        row.style.transform = "translateX(" + deltaX + "px)";
      }
    });
    row.addEventListener("pointerup", (event) => {
      if (event.pointerType === "mouse" || !dragging) {
        return;
      }
      const deltaX = event.clientX - startX;
      const threshold = row.offsetWidth * 0.4;
      row.style.transition = prefersReducedMotion() ? "none" : "transform 180ms ease";
      if (deltaX <= -threshold) {
        row.style.transform = "translateX(-100%)";
        const recorded = recordSuggestedPayment(
          settlement.from,
          settlement.to,
          settlement.amountPaise,
        );
        if (!recorded) {
          row.style.transform = "translateX(0)";
        }
      } else {
        row.style.transform = "translateX(0)";
      }
      dragging = false;
    });
    row.addEventListener("pointercancel", () => {
      dragging = false;
      row.style.transform = "translateX(0)";
    });
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function openSettleDialog(settlement, opener) {
    pendingSettlement = settlement;
    settleDialogOpener = opener;
    settleDialogAmount.textContent = formatMoney(settlement.amountPaise, state.currency);
    const arrow = document.createElement("span");
    arrow.className = "settle-pair-line";
    settleDialogPair.replaceChildren(createAvatar(settlement.from), arrow, createAvatar(settlement.to));
    settleDialogText.textContent =
      settlement.from +
      " pays " +
      settlement.to +
      ". This records the payment and updates everyone's balances. You can undo it.";
    settleDialog.showModal();
    document.body.classList.add("dialog-open");
    settleConfirmBtn.focus();
  }

  // A paid row folds away and its arc fades to a dashed ghost before the plan is
  // redrawn. Skipped where the Web Animations API is missing or motion is reduced.
  function foldPaidRow(row, settlement, record) {
    const item = row && row.isConnected ? row.closest("li") : null;
    if (!item || typeof item.animate !== "function" || prefersReducedMotion()) {
      record();
      return;
    }
    row.focus();
    settleList.classList.add("is-busy");
    item.classList.add("is-paid");
    settleFlow.querySelectorAll(".flow-arc").forEach((arc) => {
      if (arc.getAttribute("data-from") === settlement.from && arc.getAttribute("data-to") === settlement.to) {
        arc.classList.add("is-paid");
      }
    });
    const fold = item.animate(
      [
        { height: item.offsetHeight + "px", opacity: 1 },
        { height: "0px", opacity: 0 },
      ],
      { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" },
    );
    fold.onfinish = () => {
      settleList.classList.remove("is-busy");
      if (!record()) {
        fold.cancel();
        item.classList.remove("is-paid");
        renderSettleFlow(computeSettlements(state));
      }
    };
  }

  function closeSettleDialog() {
    if (settleDialog.open) {
      settleDialog.close();
    }
  }

  function recordSuggestedPayment(from, to, amountPaise) {
    const payment = addPayment(state, {
      seq: state.nextSeq || 1,
      from: from,
      to: to,
      amountPaise: amountPaise,
      date: todayLocalStr(),
    });
    if (!payment) {
      showToast("This payment could not be recorded.");
      return false;
    }
    if (!saveState(payment)) {
      return false;
    }
    renderWorkspace();
    pendingUndo = {
      payment: payment.payments[payment.payments.length - 1],
      paymentRecorded: true,
    };
    const square = computeSettlements(state).length === 0;
    if (!square) {
      settleProgress.classList.remove("just-paid");
      // Reading layout restarts the pulse when two payments are marked in a row.
      void settleProgress.offsetWidth;
      settleProgress.classList.add("just-paid");
    }
    showToast(square ? "Payment recorded. Everyone's square." : "Payment recorded", true);
    return true;
  }

  function clearPaymentErrors() {
    paymentError.hidden = true;
    paymentErrorHome.appendChild(paymentError);
    [paymentFrom, paymentTo, paymentAmount, paymentDate].forEach((field) => {
      field.removeAttribute("aria-invalid");
    });
  }

  function showPaymentError(message, field) {
    paymentError.textContent = message;
    paymentError.hidden = false;
    const fieldWrap = field ? field.closest(".field") : null;
    (fieldWrap || paymentErrorHome).appendChild(paymentError);
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.focus();
    }
  }

  function readPaymentProblem(amount) {
    if (paymentFrom.value === paymentTo.value) {
      return { message: "From and To must be different members.", field: paymentTo };
    }
    if (!amount.ok) {
      return { message: amount.message, field: paymentAmount };
    }
    const dateProblem = getDateValidationError(paymentDate.value);
    return dateProblem ? { message: dateProblem, field: paymentDate } : null;
  }

  function savePayment(event) {
    event.preventDefault();
    clearPaymentErrors();
    const amount = parseAmount(paymentAmount.value, state.currency, Core.MAX_PAYMENT_MAJOR);
    const problem = readPaymentProblem(amount);
    if (problem) {
      showPaymentError(problem.message, problem.field);
      return;
    }
    const paymentData = {
      seq: editingPaymentSeq === null ? state.nextSeq || 1 : editingPaymentSeq,
      from: paymentFrom.value,
      to: paymentTo.value,
      amountPaise: amount.paise,
      date: paymentDate.value,
    };
    let updated;
    if (editingPaymentSeq === null) {
      updated = addPayment(state, paymentData);
    } else {
      updated = Core.updatePayment(state, editingPaymentSeq, paymentData);
    }
    if (!updated) {
      showPaymentError("This payment could not be saved. Check the details and try again.", null);
      return;
    }
    if (!saveState(updated)) {
      showPaymentError(lastSaveError, null);
      return;
    }
    paymentDialog.close();
    renderWorkspace();
  }

  function paiseToInputValue(paise, currency) {
    const known = Core.currencyDigits(currency);
    const digits = known === null ? 2 : known;
    const factor = Math.pow(10, digits);
    const whole = Math.floor(paise / factor);
    const fraction = paise % factor;
    if (digits === 0 || fraction === 0) {
      return String(whole);
    }
    return whole + "." + String(fraction).padStart(digits, "0");
  }

  function enterEditMode(expense) {
    editingSeq = expense.seq;
    descriptionInput.value = expense.description;
    amountInput.value = paiseToInputValue(expense.amountPaise, state.currency);
    payerSelect.value = expense.payer;
    dateInput.value = expense.date;
    clearAllErrors();
    clearDialogSaveError();
    renderParticipants(expense.participants);
    updateSplitPreview();
    expenseFormTitle.textContent = "Edit expense";
    saveExpenseBtn.textContent = "Save changes";
    deleteExpenseDialogBtn.hidden = false;
    dialogOpener = document.getElementById("edit-expense-" + expense.seq);
    expenseDialog.showModal();
    document.body.classList.add("dialog-open");
    activeDialog = "edit";
    markEditingRow(expense.seq);
    // Amount first, the same as the add sheet.
    amountInput.focus();
  }

  // Highlight the row being edited without rebuilding the whole history.
  function markEditingRow(seq) {
    expenseListEl.querySelectorAll(".expense-row.editing").forEach((row) => {
      row.classList.remove("editing");
      row.removeAttribute("aria-current");
    });
    const row = seq === null ? null : document.getElementById("edit-expense-" + seq);
    if (row) {
      row.classList.add("editing");
      row.setAttribute("aria-current", "true");
    }
  }

  function exitEditMode() {
    const opener = dialogOpener;
    editingSeq = null;
    expenseFormTitle.textContent = "Add expense";
    saveExpenseBtn.textContent = "Add expense";
    deleteExpenseDialogBtn.hidden = true;
    activeDialog = null;
    dialogOpener = null;
    if (expenseDialog.open) {
      expenseDialog.close();
    }
    markEditingRow(null);
    if (opener) {
      restoreFocus(opener);
    }
  }

  function cancelEdit() {
    const targetSeq = editingSeq;
    exitEditMode();
    resetExpenseForm();
    if (targetSeq !== null) {
      focusEditButton(targetSeq);
    }
  }

  function openExpenseDialog() {
    if (!expenseDialog.open) {
      exitEditMode();
      resetExpenseForm();
      clearDialogSaveError();
      dialogOpener = toggleExpenseBtn;
      expenseDialog.showModal();
      document.body.classList.add("dialog-open");
      activeDialog = "add";
    }
  }

  function clearUndoBar() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    pendingUndo = null;
    appToast.hidden = true;
    appToastUndo.hidden = true;
  }

  function deleteExpense(expense) {
    clearUndoBar();
    if (editingSeq === expense.seq) {
      exitEditMode();
      resetExpenseForm();
    }
    const updated = removeExpense(state, expense.seq);
    if (!updated) {
      return;
    }
    if (!saveState(updated)) {
      return;
    }
    renderWorkspace();
    pendingUndo = { expense: expense };
    showToast(expense.description + " deleted.", true);
  }

  function undoDelete() {
    if (!pendingUndo) {
      return;
    }
    if (pendingUndo.previousTrip) {
      undoImport(pendingUndo.previousTrip);
      return;
    }
    if (pendingUndo.payment) {
      const payment = pendingUndo.payment;
      const recorded = pendingUndo.paymentRecorded;
      const restored = recorded
        ? removePayment(state, payment.seq)
        : addPayment(state, payment, false);
      if (!restored || !saveState(restored)) {
        return;
      }
      clearUndoBar();
      renderWorkspace();
      announce(recorded ? "Payment undone" : "Payment restored");
      restoreFocus(
        recorded ? null : document.getElementById("edit-payment-" + payment.seq),
        document.getElementById(recorded ? "view-settle-title" : "view-expenses-title"),
      );
      return;
    }
    const expense = pendingUndo.expense;
    const restored = restoreExpense(state, expense);
    if (!restored || !saveState(restored)) {
      return;
    }
    clearUndoBar();
    renderWorkspace();
    announce(expense.description + " restored");
    focusEditButton(expense.seq);
  }

  function focusEditButton(seq) {
    const button = document.getElementById("edit-expense-" + seq);
    if (button) {
      button.focus();
    }
  }

  function collectExpenseInputs() {
    clearAllErrors();
    clearDialogSaveError();
    const description = descriptionInput.value.trim();
    const parsedAmount = parseAmount(amountInput.value, state.currency);
    const payer = payerSelect.value;
    const date = dateInput.value;
    const participants = getSelectedParticipants();
    let valid = true;

    if (!parsedAmount.ok) {
      showError(amountError, parsedAmount.message);
      valid = false;
      amountInput.focus();
    }
    if (valid && description === "") {
      showError(descriptionError, "Enter a description.");
      valid = false;
      descriptionInput.focus();
    }
    if (valid && (payer === "" || state.members.indexOf(payer) === -1)) {
      showError(payerError, "Select who paid.");
      valid = false;
      payerSelect.focus();
    }
    const dateErrorMessage = getDateValidationError(date);
    if (valid && dateErrorMessage) {
      showError(dateError, dateErrorMessage);
      valid = false;
      dateInput.focus();
    }
    if (valid && participants.length === 0) {
      showError(participantsError, "Select at least one participant.");
      valid = false;
      participantsField.focus();
    }

    if (!valid) {
      return null;
    }
    return {
      description: description,
      amountPaise: parsedAmount.paise,
      payer: payer,
      date: date,
      participants: participants,
    };
  }

  function submitExpense(event) {
    event.preventDefault();
    clearUndoBar();
    const inputs = collectExpenseInputs();
    if (!inputs) {
      return;
    }

    if (editingSeq !== null) {
      const targetSeq = editingSeq;
      const updated = updateExpense(state, targetSeq, {
        description: inputs.description,
        amountPaise: inputs.amountPaise,
        payer: inputs.payer,
        date: inputs.date,
        participants: inputs.participants,
      });
      if (!updated) {
        showError(amountError, "This expense could not be updated.");
        return;
      }
      if (!saveState(updated)) {
        return;
      }
      exitEditMode();
      renderWorkspace();
      switchView(getViewFromHash());
      focusEditButton(targetSeq);
      return;
    }

    const newExpense = {
      seq: state.nextSeq,
      description: inputs.description,
      amountPaise: inputs.amountPaise,
      payer: inputs.payer,
      date: inputs.date,
      participants: inputs.participants,
    };
    const usedSeqs = state.expenses.map((item) => item.seq).concat(state.payments.map((item) => item.seq));
    if (!validateExpenseFields(newExpense, state.members, usedSeqs)) {
      showDialogSaveError("This expense could not be added. Reload the page and try again.");
      return;
    }
    const nextSeq = state.nextSeq + 1;
    const newState = Object.assign({}, state, {
      expenses: state.expenses.concat([newExpense]),
      nextSeq: nextSeq,
    });
    if (!Core.withinTripLimits(newState)) {
      showDialogSaveError("This expense would make the trip total too large to track. Start a new trip for more expenses.");
      return;
    }
    if (!saveState(newState)) {
      return;
    }
    exitEditMode();
    resetExpenseForm();
    renderWorkspace();
    toggleExpenseBtn.focus();
  }

  dismissRecoveryBtn.addEventListener("click", () => {
    recoveryNotice.hidden = true;
  });
  dismissStorageWarningBtn.addEventListener("click", () => {
    storageWarning.hidden = true;
  });
  dismissConflictBtn.addEventListener("click", () => {
    location.reload();
  });
  reloadFailureBtn.addEventListener("click", () => {
    location.reload();
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !state || !conflictNotice.hidden) {
      return;
    }
    if (event.newValue === null) {
      conflictNoticeText.textContent =
        "This trip was removed in another tab. Please reload to continue.";
      conflictNotice.hidden = false;
      return;
    }
    try {
      if (isDifferentTrip(JSON.parse(event.newValue))) {
        conflictNoticeText.textContent =
          "This trip was changed in another tab. Please reload to see the latest changes.";
        conflictNotice.hidden = false;
      }
    } catch {
      // Unparseable data is caught by the conflict check on the next save.
    }
  });
  appToastUndo.addEventListener("click", undoDelete);

  addMemberBtn.addEventListener("click", addMember);
  memberNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addMember();
    }
  });
  tripNameInput.addEventListener("input", () => {
    clearError(tripNameError);
  });
  memberNameInput.addEventListener("input", () => {
    clearError(memberError);
  });
  createTripBtn.addEventListener("click", createTrip);
  recordPaymentBtn.addEventListener("click", () => {
    openPaymentSheet(null, recordPaymentBtn);
  });
  recordPaymentMenu.addEventListener("click", () => {
    closeTripMenu(false);
    openPaymentSheet(null, tripOptionsBtn);
  });
  paymentForm.addEventListener("submit", savePayment);
  paymentDialogCancel.addEventListener("click", () => {
    paymentDialog.close();
  });
  deletePaymentBtn.addEventListener("click", () => {
    const removed = state.payments.find(
      (item) => item.seq === editingPaymentSeq,
    );
    const updated = removePayment(state, editingPaymentSeq);
    if (!updated || !saveState(updated)) {
      showPaymentError(lastSaveError || "This payment could not be deleted.", null);
      return;
    }
    paymentDialogOpener = null;
    paymentDialog.close();
    renderWorkspace();
    pendingUndo = { payment: removed, paymentRecorded: false };
    showToast("Payment deleted", true);
  });
  paymentDialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    if (paymentDialogOpener) {
      restoreFocus(paymentDialogOpener);
    }
    paymentDialogOpener = null;
  });
  paymentDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    paymentDialog.close();
  });
  tripCurrencySelect.addEventListener("change", updateAmountCurrency);
  participantsToggle.addEventListener("click", toggleParticipants);
  heroStartBtn.addEventListener("click", focusTripName);
  trySampleBtn.addEventListener("click", createSampleTrip);
  renderCurrencyOptions();
  renderPreviewAmounts();

  toggleExpenseBtn.addEventListener("click", openExpenseDialog);
  emptyAddExpenseBtn.addEventListener("click", () => {
    openExpenseDialog();
    dialogOpener = emptyAddExpenseBtn;
  });
  expenseForm.addEventListener("submit", submitExpense);
  cancelExpenseDialogBtn.addEventListener("click", () => {
    if (activeDialog === "edit") {
      cancelEdit();
    } else {
      expenseDialog.close();
      restoreFocus(dialogOpener || toggleExpenseBtn);
    }
  });
  deleteExpenseDialogBtn.addEventListener("click", () => {
    if (editingSeq === null) {
      return;
    }
    const expense = state.expenses.find((item) => item.seq === editingSeq);
    if (expense) {
      deleteExpense(expense);
    }
  });
  expenseDialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    if (activeDialog === "edit") {
      cancelEdit();
    } else if (activeDialog === "add") {
      restoreFocus(dialogOpener || toggleExpenseBtn);
    }
    activeDialog = null;
  });
  expenseDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    expenseDialog.close();
  });
  expenseDialog.addEventListener("click", (event) => {
    if (!isBackdropClick(expenseDialog, event)) {
      return;
    }
    if (activeDialog === "edit") {
      cancelEdit();
    } else {
      expenseDialog.close();
      activeDialog = null;
      restoreFocus(dialogOpener || toggleExpenseBtn);
    }
  });

  descriptionInput.addEventListener("input", () => {
    clearError(descriptionError);
  });
  amountInput.addEventListener("input", () => {
    clearError(amountError);
    updateSplitPreview();
  });
  payerSelect.addEventListener("change", () => {
    clearError(payerError);
  });
  dateInput.addEventListener("input", () => {
    clearError(dateError);
  });

  copySettleBtn.addEventListener("click", () => {
    copySummary();
  });

  function exportTrip() {
    try {
      const result = buildExport(state, new Date().toISOString());
      const blob = new Blob([JSON.stringify(result.object, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      a.hidden = true;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Trip exported");
      return true;
    } catch {
      showToast("Could not export the trip.");
      return false;
    }
  }

  exportTripBtn.addEventListener("click", exportTrip);

  function closeTripMenu(shouldFocusButton) {
    tripMenu.hidden = true;
    tripOptionsBtn.setAttribute("aria-expanded", "false");
    if (shouldFocusButton) {
      tripOptionsBtn.focus();
    }
  }

  function openTripMenu() {
    tripMenu.hidden = false;
    tripOptionsBtn.setAttribute("aria-expanded", "true");
    tripMenuItems[0].focus();
  }

  tripOptionsBtn.addEventListener("click", () => {
    if (tripMenu.hidden) {
      openTripMenu();
    } else {
      closeTripMenu(true);
    }
  });

  tripMenuItems.forEach((item, index) => {
    item.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        tripMenuItems[
          (index + direction + tripMenuItems.length) % tripMenuItems.length
        ].focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        tripMenuItems[event.key === "Home" ? 0 : tripMenuItems.length - 1].focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeTripMenu(true);
      } else if (event.key === "Enter") {
        event.preventDefault();
        item.click();
      }
    });
    item.addEventListener("click", () => {
      closeTripMenu(true);
    });
  });

  document.addEventListener("click", (event) => {
    if (!tripMenu.hidden && !event.target.closest(".trip-menu-wrap")) {
      closeTripMenu(false);
    }
  });


  function refuseNewTrip(message) {
    newTripDialogError.textContent = message;
    newTripDialogError.hidden = false;
    return false;
  }

  function readStoredForReset() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return { ok: true, raw: raw, changed: raw !== null && isDifferentTrip(JSON.parse(raw)) };
    } catch {
      return { ok: false };
    }
  }

  // Returns true once the saved trip is cleared; otherwise explains why inside the dialog.
  function startNewTrip(exportFirst) {
    newTripDialogError.hidden = true;
    const stored = readStoredForReset();
    if (!stored.ok) {
      return refuseNewTrip("Could not read the saved trip on this device. The current trip was kept.");
    }
    if (stored.changed) {
      return refuseNewTrip("This trip changed in another tab. Reload before starting a new trip.");
    }
    if (exportFirst && !exportTrip()) {
      return refuseNewTrip("Could not export the trip. The current trip was kept.");
    }
    try {
      if (stored.raw) {
        // A recovery copy, in case the export download was blocked.
        localStorage.setItem(LAST_REMOVED_KEY, stored.raw);
      }
    } catch {
      if (exportFirst) {
        return refuseNewTrip(
          "Could not keep a recovery copy on this device. Check that the export downloaded, then choose Start new without exporting.",
        );
      }
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      return refuseNewTrip("Could not clear the saved trip on this device.");
    }
    resetToSetup();
    pendingAnnouncement = exportFirst ? "Trip exported. Start a new trip." : "Trip cleared. Start a new trip.";
    return true;
  }

  function resetToSetup() {
    state = null;
    setupMembers.length = 0;
    editingSeq = null;
    clearUndoBar();
    workspaceScreen.hidden = true;
    setupScreen.hidden = false;
    tripNameInput.value = "";
    memberNameInput.value = "";
    tripNameError.hidden = true;
    memberError.hidden = true;
    memberMinError.hidden = true;
    createError.hidden = true;
    renderMemberList();
    tripNameInput.focus();
  }

  newTripBtn.addEventListener("click", () => {
    newTripDialogOpener = tripOptionsBtn;
    newTripDialogText.textContent =
      "This removes " +
      state.name +
      " from this device. Export a copy first if you might need it; the last cleared trip is also kept as a recovery copy.";
    newTripDialogError.hidden = true;
    newTripDialog.showModal();
    confirmCancel.focus();
  });

  confirmCancel.addEventListener("click", () => {
    newTripDialog.close();
  });

  confirmStartNew.addEventListener("click", () => {
    if (startNewTrip(false)) {
      newTripDialog.close();
    }
  });

  confirmExportStart.addEventListener("click", () => {
    if (startNewTrip(true)) {
      newTripDialog.close();
    }
  });

  newTripDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    newTripDialog.close();
  });
  newTripDialog.addEventListener("click", (event) => {
    if (isBackdropClick(newTripDialog, event)) {
      newTripDialog.close();
    }
  });
  newTripDialog.addEventListener("close", () => {
    newTripDialogError.hidden = true;
    if (workspaceScreen.hidden) {
      tripNameInput.focus();
      if (pendingAnnouncement) {
        announce(pendingAnnouncement);
      }
    } else if (newTripDialogOpener) {
      restoreFocus(newTripDialogOpener);
    }
    newTripDialogOpener = null;
    pendingAnnouncement = null;
  });

  function chooseImportFile(opener) {
    importOpener = opener;
    // Cleared first so choosing the same file again still fires "change".
    importFileInput.value = "";
    importFileInput.click();
  }

  function readFileText(file) {
    if (typeof file.text === "function") {
      return file.text();
    }
    return new Promise((resolve, reject) => {
      const reader = new window.FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(reader.error));
      reader.readAsText(file);
    });
  }

  function showImportError(message) {
    importErrorText.textContent = message;
    importError.hidden = false;
    dismissImportErrorBtn.focus();
  }

  function hideImportError() {
    importError.hidden = true;
    importErrorText.textContent = "";
  }

  function handleImportFile() {
    const file = importFileInput.files && importFileInput.files[0];
    if (!file) {
      return;
    }
    hideImportError();
    if (file.size > Core.MAX_IMPORT_SIZE) {
      showImportError(Core.IMPORT_ERRORS.tooLarge);
      return;
    }
    readFileText(file)
      .then(Core.parseImport, () => ({ ok: false, error: Core.IMPORT_ERRORS.unreadable }))
      .then(receiveImport);
  }

  function receiveImport(result) {
    if (!result.ok) {
      showImportError(result.error);
      return;
    }
    if (state) {
      openImportDialog(result.trip);
      return;
    }
    if (!saveState(result.trip)) {
      // The storage or conflict notice above says why.
      showImportError("The trip could not be imported.");
      return;
    }
    showImportedTrip(null);
  }

  function openImportDialog(trip) {
    pendingImport = trip;
    importDialogOpener = importOpener;
    importDialogText.textContent =
      "Importing " +
      trip.name +
      " replaces " +
      state.name +
      " on this device. Export a copy first if you might need it; you can also undo the import.";
    importDialogError.hidden = true;
    importDialog.showModal();
    importCancelBtn.focus();
  }

  function refuseImport(message) {
    importDialogError.textContent = message;
    importDialogError.hidden = false;
    return false;
  }

  // Returns true once the imported trip is saved; otherwise explains why inside the dialog.
  function replaceWithImport(exportFirst) {
    importDialogError.hidden = true;
    const stored = readStoredForReset();
    if (!stored.ok) {
      return refuseImport("Could not read the saved trip on this device. The current trip was kept.");
    }
    if (stored.changed) {
      return refuseImport("This trip changed in another tab. Reload before importing.");
    }
    if (exportFirst && !exportTrip()) {
      return refuseImport("Could not export the trip. The current trip was kept.");
    }
    try {
      if (stored.raw) {
        // The same recovery copy "New trip" keeps, for when Undo is no longer offered.
        localStorage.setItem(LAST_REMOVED_KEY, stored.raw);
      }
    } catch {
      return refuseImport("Could not keep a recovery copy on this device. The current trip was kept.");
    }
    if (!saveState(pendingImport)) {
      return refuseImport(lastSaveError);
    }
    return true;
  }

  function confirmImport(exportFirst) {
    const previousTrip = JSON.parse(JSON.stringify(state));
    if (!replaceWithImport(exportFirst)) {
      return;
    }
    importDialogOpener = null;
    importDialog.close();
    showImportedTrip(previousTrip);
  }

  function showTripWorkspace() {
    selectCurrency(state.currency);
    workspaceScreen.hidden = false;
    setupScreen.hidden = true;
    exitEditMode();
    resetExpenseForm();
    renderWorkspace();
    switchView("expenses");
  }

  function showImportedTrip(previousTrip) {
    clearUndoBar();
    hideImportError();
    showTripWorkspace();
    if (previousTrip) {
      pendingUndo = { previousTrip: previousTrip };
    }
    showToast("Imported " + state.name, Boolean(previousTrip));
  }

  // Saved like any other change, so a trip changed in another tab is never overwritten.
  function undoImport(previousTrip) {
    if (!saveState(previousTrip)) {
      return;
    }
    clearUndoBar();
    showTripWorkspace();
    tripTitleEl.focus();
    announce("Import undone. " + previousTrip.name + " is back.");
  }

  importTripBtn.addEventListener("click", () => {
    chooseImportFile(tripOptionsBtn);
  });
  importTripSetupBtn.addEventListener("click", () => {
    chooseImportFile(importTripSetupBtn);
  });
  importFileInput.addEventListener("change", handleImportFile);
  dismissImportErrorBtn.addEventListener("click", () => {
    hideImportError();
    restoreFocus(importOpener);
  });
  importExportReplaceBtn.addEventListener("click", () => {
    confirmImport(true);
  });
  importReplaceBtn.addEventListener("click", () => {
    confirmImport(false);
  });
  importCancelBtn.addEventListener("click", () => {
    importDialog.close();
  });
  importDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    importDialog.close();
  });
  importDialog.addEventListener("click", (event) => {
    if (isBackdropClick(importDialog, event)) {
      importDialog.close();
    }
  });
  importDialog.addEventListener("close", () => {
    importDialogError.hidden = true;
    pendingImport = null;
    if (importDialogOpener) {
      restoreFocus(importDialogOpener);
    }
    importDialogOpener = null;
  });

  settleConfirmBtn.addEventListener("click", () => {
    const settlement = pendingSettlement;
    const opener = settleDialogOpener;
    settleDialogOpener = null;
    closeSettleDialog();
    if (settlement) {
      foldPaidRow(opener, settlement, () =>
        recordSuggestedPayment(settlement.from, settlement.to, settlement.amountPaise),
      );
    }
  });
  settleCancelBtn.addEventListener("click", closeSettleDialog);
  settleDialog.addEventListener("click", (event) => {
    if (isBackdropClick(settleDialog, event)) {
      closeSettleDialog();
    }
  });
  settleDialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    pendingSettlement = null;
    if (settleDialogOpener) {
      restoreFocus(settleDialogOpener);
    }
    settleDialogOpener = null;
  });

  function applyViewVisibility(view) {
    const views = [viewExpenses, viewBalances, viewSettle];
    const tabs = [tabExpenses, tabBalances, tabSettle];
    for (let i = 0; i < views.length; i += 1) {
      const active = views[i].id === "view-" + view;
      views[i].hidden = !active && !isDesktopLayout();
      if (active) {
        tabs[i].setAttribute("aria-current", "page");
      } else {
        tabs[i].removeAttribute("aria-current");
      }
    }
  }

  function switchView(view) {
    const views = [viewExpenses, viewBalances, viewSettle];
    const titles = [viewExpensesTitle, viewBalancesTitle, viewSettleTitle];
    applyViewVisibility(view);
    const idx = views.findIndex(function (v) {
      return v.id === "view-" + view;
    });
    if (idx >= 0) {
      titles[idx].focus();
    }
    history.replaceState(null, "", "#" + view);
  }

  function getViewFromHash() {
    const h = location.hash.replace(/^#/, "");
    if (h === "balances" || h === "settle") {
      return h;
    }
    return "expenses";
  }

  function isDesktopLayout() {
    return window.matchMedia && window.matchMedia("(min-width: 900px)").matches;
  }

  if (window.matchMedia) {
    const desktopQuery = window.matchMedia("(min-width: 900px)");
    const syncLayout = () => {
      if (state) {
        applyViewVisibility(getViewFromHash());
      }
    };
    if (typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", syncLayout);
    }
  }

  tripMenu.addEventListener("focusout", (event) => {
    // Pointer dismissal is handled by the document click listener; Safari does not
    // focus clicked buttons, so a null relatedTarget must not close the menu here.
    const next = event.relatedTarget;
    if (!tripMenu.hidden && next && !event.currentTarget.parentElement.contains(next)) {
      closeTripMenu(false);
    }
  });

  // Phone: once the trip band scrolls away, a slim bar with the trip name and
  // total slides in over the top. It is fixed, so nothing below it moves.
  function watchTripHeader() {
    if (typeof window.IntersectionObserver !== "function") {
      return;
    }
    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          tripMini.classList.toggle("is-shown", !entry.isIntersecting && entry.boundingClientRect.top < 0);
        });
      },
      { rootMargin: "-72px 0px 0px 0px" },
    );
    observer.observe(tripHeader);
  }
  watchTripHeader();

  tabExpenses.addEventListener("click", function () {
    switchView("expenses");
  });
  tabBalances.addEventListener("click", function () {
    switchView("balances");
  });
  tabSettle.addEventListener("click", function () {
    switchView("settle");
  });
  window.addEventListener("hashchange", function () {
    switchView(getViewFromHash());
  });

  renderMemberList();

  migrateLegacyStorage();
  const loaded = readStoredTrip();
  if (loaded.trip) {
    state = loaded.trip;
    selectCurrency(state.currency);
    workspaceScreen.hidden = false;
    setupScreen.hidden = true;
    exitEditMode();
    resetExpenseForm();
    if (loaded.migrated) {
      saveState(state);
    }
    renderWorkspace();
    switchView(getViewFromHash());
  } else {
    workspaceScreen.hidden = true;
    setupScreen.hidden = false;
    if (loaded.corrupted) {
      showRecoveryNotice(loaded.backupFailed);
    }
  }
})();
