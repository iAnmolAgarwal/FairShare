(function (global, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    global.FairShareCore = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const SCHEMA_VERSION = 4;
  const MIN_MEMBERS = 2;
  const MAX_MEMBERS = 10;
  // Amount limits are in major units (dollars, yen, dinars), so they mean the same in
  // every currency: 1e9 JPY, 1e11 minor units for USD, 1e12 for KWD.
  const MAX_AMOUNT_MAJOR = 1000000000;
  // Limit for a payment typed by hand. Stored and suggested payments may be larger;
  // what keeps the arithmetic exact is that a trip's total volume stays a safe integer.
  const MAX_PAYMENT_MAJOR = MAX_AMOUNT_MAJOR * 1000;
  // No accepted currency has more than 3 minor digits, so no single expense in any
  // currency exceeds this; the per-currency limit is checked against the trip.
  const MAX_AMOUNT_MINOR_ANY = MAX_AMOUNT_MAJOR * 1000;
  // Sequence numbers stay far below MAX_SAFE_INTEGER so the next one is always exact.
  const MAX_SEQ = 2147483647;
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  // Used when the engine cannot list currencies (no Intl.supportedValuesOf). These
  // codes are always supported, so trips saved before the full list still load.
  const FALLBACK_CURRENCY_NAMES = {
    INR: "Indian rupee",
    USD: "US dollar",
    EUR: "Euro",
    GBP: "British pound",
    AED: "UAE dirham",
    SGD: "Singapore dollar",
    THB: "Thai baht",
    JPY: "Japanese yen",
    AUD: "Australian dollar",
    CAD: "Canadian dollar",
    IDR: "Indonesian rupiah",
    LKR: "Sri Lankan rupee",
  };
  // X-prefixed codes are mostly metals, test, fund and accounting units; these are the
  // ones that circulate as cash.
  const CIRCULATING_X_CODES = ["XAF", "XCD", "XCG", "XOF", "XPF"];
  // Fund codes: never a trip currency.
  const FUND_CURRENCIES = ["BOV", "CHE", "CHW", "CLF", "COU", "MXV", "USN", "USS", "UYI", "UYW"];
  // Replaced currencies that some engines still list. They are left out of the picker
  // but stay valid, so an older trip in one of them still loads.
  const RETIRED_CURRENCIES = ["ANG", "BGN", "CUC", "HRK", "SLL", "ZWL"];
  const COMMON_CURRENCY_CODES = [
    "USD", "EUR", "GBP", "INR", "JPY", "CNY", "AUD", "CAD",
    "CHF", "SGD", "AED", "HKD", "THB", "IDR", "MXN", "NZD",
  ];
  const EURO_REGIONS = [
    "AT", "BE", "BG", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU",
    "LV", "MT", "NL", "PT", "SI", "SK", "AD", "MC", "SM", "VA", "ME", "XK",
  ];
  const REGION_CURRENCY = {
    US: "USD", GB: "GBP", IN: "INR", JP: "JPY", CN: "CNY", AU: "AUD", CA: "CAD", CH: "CHF",
    LI: "CHF", SG: "SGD", AE: "AED", HK: "HKD", TH: "THB", ID: "IDR", MX: "MXN", BR: "BRL",
    ZA: "ZAR", NZ: "NZD", KR: "KRW", SA: "SAR", LK: "LKR", SE: "SEK", DK: "DKK", NO: "NOK",
    IS: "ISK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", TR: "TRY", IL: "ILS", EG: "EGP",
    NG: "NGN", KE: "KES", MA: "MAD", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", JO: "JOD",
    PK: "PKR", BD: "BDT", NP: "NPR", MY: "MYR", PH: "PHP", VN: "VND", TW: "TWD", AR: "ARS",
    CL: "CLP", CO: "COP", PE: "PEN", UA: "UAH", PR: "USD", EC: "USD", SV: "USD", PA: "USD",
  };
  EURO_REGIONS.forEach((region) => {
    REGION_CURRENCY[region] = "EUR";
  });
  const DEFAULT_CURRENCY = "USD";

  // A well-formed code that is not a metal, test, fund or accounting unit.
  function isCurrencyShaped(code) {
    if (typeof code !== "string" || !/^[A-Z]{3}$/.test(code) || FUND_CURRENCIES.indexOf(code) !== -1) {
      return false;
    }
    return code.charAt(0) !== "X" || CIRCULATING_X_CODES.indexOf(code) !== -1;
  }

  function isListedCurrency(code) {
    return isCurrencyShaped(code) && RETIRED_CURRENCIES.indexOf(code) === -1;
  }

  function engineCurrencyCodes() {
    try {
      if (typeof Intl.supportedValuesOf === "function") {
        return Intl.supportedValuesOf("currency");
      }
    } catch {
      // Fall through to the built-in list.
    }
    return [];
  }

  function currencyDisplayNames() {
    try {
      if (typeof Intl.DisplayNames === "function") {
        return new Intl.DisplayNames(["en"], { type: "currency", fallback: "none" });
      }
    } catch {
      // Names fall back to the built-in list or the code.
    }
    return null;
  }

  const CURRENCY_DISPLAY = currencyDisplayNames();

  // English name from Intl, or null when the engine does not know the code.
  function displayName(code) {
    try {
      return CURRENCY_DISPLAY ? CURRENCY_DISPLAY.of(code) || null : null;
    } catch {
      return null;
    }
  }

  function buildCurrencyNames() {
    const codes = engineCurrencyCodes().filter(isListedCurrency).concat(Object.keys(FALLBACK_CURRENCY_NAMES));
    const names = Object.create(null);
    codes.forEach((code) => {
      names[code] = displayName(code) || FALLBACK_CURRENCY_NAMES[code] || code;
    });
    return names;
  }

  // The picker list. Validation accepts more than this; see isSupportedCurrency.
  const CURRENCY_NAMES = buildCurrencyNames();
  const CURRENCY_CODES = Object.keys(CURRENCY_NAMES).sort();
  // Minor-unit digits, filled in on first use so start-up does not build a formatter
  // for every currency.
  const CURRENCY_DIGITS = Object.create(null);
  const OTHER_CURRENCY_CHECKS = new Map();

  function isKnownToIntl(code) {
    try {
      new Intl.NumberFormat("en", { style: "currency", currency: code });
    } catch {
      return false;
    }
    // Intl formats any well-formed code, so where it can name currencies an unnamed
    // code such as "ABC" is not a currency.
    return CURRENCY_DISPLAY === null || displayName(code) !== null;
  }

  /**
   * Whether a code can be a trip's currency. This does not depend on the picker list,
   * so a trip made in another browser, or in a currency since retired, still loads.
   * @param {*} currency
   * @returns {boolean}
   */
  function isSupportedCurrency(currency) {
    if (!isCurrencyShaped(currency)) {
      return false;
    }
    if (CURRENCY_NAMES[currency] !== undefined) {
      return true;
    }
    if (!OTHER_CURRENCY_CHECKS.has(currency)) {
      OTHER_CURRENCY_CHECKS.set(currency, isKnownToIntl(currency));
    }
    return OTHER_CURRENCY_CHECKS.get(currency);
  }

  /**
   * English name of a supported currency, including ones not in the picker list.
   * @param {string} code
   * @returns {string} The name, or the code itself when no name is known.
   */
  function currencyName(code) {
    if (CURRENCY_NAMES[code] !== undefined) {
      return CURRENCY_NAMES[code];
    }
    return displayName(code) || code;
  }

  /**
   * Largest amount in minor units for a currency, from a limit in major units.
   * @param {string} currency
   * @param {number} [maxMajor] - Defaults to the per-expense limit.
   * @returns {number}
   */
  function maxAmountMinor(currency, maxMajor = MAX_AMOUNT_MAJOR) {
    const digits = currencyDigits(currency);
    return maxMajor * Math.pow(10, digits === null ? 2 : digits);
  }

  /**
   * Number of minor-unit digits for a supported currency.
   * @param {string} currency - ISO 4217 code.
   * @returns {number|null} e.g. 2 for USD, 0 for JPY, 3 for KWD, null when unsupported.
   */
  function currencyDigits(currency) {
    if (!isSupportedCurrency(currency)) {
      return null;
    }
    if (CURRENCY_DIGITS[currency] === undefined) {
      CURRENCY_DIGITS[currency] = new Intl.NumberFormat("en", {
        style: "currency",
        currency: currency,
      }).resolvedOptions().maximumFractionDigits;
    }
    return CURRENCY_DIGITS[currency];
  }

  /**
   * Placeholder for an amount field: "0", "0.00" or "0.000" by minor-unit digits.
   * @param {string} currency - ISO 4217 code.
   * @returns {string}
   */
  function amountPlaceholder(currency) {
    const digits = currencyDigits(currency);
    return digits === 0 ? "0" : "0." + "0".repeat(digits === null ? 2 : digits);
  }

  /**
   * Codes for the currency picker: a short common group, then every supported
   * currency sorted by English name.
   * @returns {{common:string[],all:string[]}}
   */
  function currencyPickerGroups() {
    const all = CURRENCY_CODES.slice().sort((a, b) => {
      const byName = CURRENCY_NAMES[a].localeCompare(CURRENCY_NAMES[b], "en");
      return byName === 0 ? a.localeCompare(b) : byName;
    });
    return { common: COMMON_CURRENCY_CODES.filter((code) => CURRENCY_NAMES[code] !== undefined), all: all };
  }

  function localeRegion(locale) {
    try {
      if (typeof Intl.Locale === "function") {
        return new Intl.Locale(locale.replace(/_/g, "-")).maximize().region || "";
      }
    } catch {
      return "";
    }
    const match = /^[A-Za-z]{2,3}(?:[-_][A-Za-z]{4})?[-_]([A-Za-z]{2})(?:$|[-_])/.exec(locale);
    return match ? match[1].toUpperCase() : "";
  }

  /**
   * Suggested currency for a new trip from a BCP 47 locale such as navigator.language.
   * @param {string} locale - e.g. "en-IN", "de", "ja-JP".
   * @returns {string} A code from the picker list; USD when the region is unknown.
   */
  function defaultCurrencyForLocale(locale) {
    if (typeof locale !== "string" || locale === "") {
      return DEFAULT_CURRENCY;
    }
    const region = localeRegion(locale);
    const currency = Object.prototype.hasOwnProperty.call(REGION_CURRENCY, region) ? REGION_CURRENCY[region] : null;
    return currency !== null && CURRENCY_NAMES[currency] !== undefined ? currency : DEFAULT_CURRENCY;
  }

  /**
   * Format an integer minor-unit amount in the given currency, dropping
   * decimals for whole amounts.
   * @param {number} minor - Integer minor units.
   * @param {string} currency - ISO 4217 code (falls back to INR).
   * @returns {string} e.g. "\u20b91,200.50" or "$12"
   */
  function formatMoney(minor, currency) {
    const code = isSupportedCurrency(currency) ? currency : "INR";
    const digits = currencyDigits(code);
    const minimum = Math.abs(minor) % Math.pow(10, digits) === 0 ? 0 : digits;
    return moneyFormatter(code, minimum, digits).format(minor / Math.pow(10, digits));
  }

  const MONEY_FORMATTERS = new Map();

  function moneyFormatter(code, minimum, digits) {
    const key = code + ":" + minimum;
    let formatter = MONEY_FORMATTERS.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(code === "INR" ? "en-IN" : undefined, {
        style: "currency",
        currency: code,
        minimumFractionDigits: minimum,
        maximumFractionDigits: digits,
      });
      MONEY_FORMATTERS.set(key, formatter);
    }
    return formatter;
  }

  function formatPaise(paise) {
    return formatMoney(paise, "INR");
  }

  /**
   * Format an ISO date to an Indian-style string.
   * @param {string} isoDate - "YYYY-MM-DD"
   * @returns {string} e.g. "22 Sep 2026". Returns the input unchanged on failure.
   */
  function formatIndianDate(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!match) {
      return isoDate;
    }
    return (
      Number(match[3]) + " " + MONTHS[Number(match[2]) - 1] + " " + match[1]
    );
  }

  /**
   * Validate that a string is a real calendar date in ISO format.
   * @param {string} value
   * @returns {boolean}
   */
  function isValidDateStr(value) {
    if (typeof value !== "string") {
      return false;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return false;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    return (
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
    );
  }

  function localTodayStr() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate())
    );
  }

  function getDateValidationError(value, today) {
    if (!isValidDateStr(value)) {
      return "Choose a valid date.";
    }
    if (value > (today || localTodayStr())) {
      return "Date can't be in the future.";
    }
    if (value < "2000-01-01") {
      return "Enter a date after 1 Jan 2000.";
    }
    return null;
  }

  /**
   * Validate the digit/decimal format of an amount string after separators are normalised.
   * @param {string} cleaned - Digits and an optional decimal dot.
   * @returns {string|{integerPart:string,fractionPart:string}} Error message or parsed parts.
   */
  function validateAmountFormat(cleaned, digits) {
    if (cleaned === "") {
      return "Enter an amount.";
    }
    if (cleaned.startsWith("-")) {
      return "Amount cannot be negative.";
    }
    if (cleaned.startsWith("+")) {
      return "Enter a plain amount without a sign.";
    }
    if (/^0[xX]/.test(cleaned)) {
      return "Enter a plain amount, not hexadecimal.";
    }
    if (/^0[bB]/.test(cleaned)) {
      return "Enter a plain amount, not binary.";
    }
    if (/[eE]/.test(cleaned)) {
      return "Enter a plain amount, not exponent notation.";
    }
    const match = /^(\d+)(?:\.(\d*))?$/.exec(cleaned);
    if (!match) {
      return "Enter a valid amount, e.g. " + (digits === 0 ? "1200" : "1200." + "5".padEnd(digits, "0")) + ".";
    }
    const fractionPart = match[2] === undefined ? "" : match[2];
    if (fractionPart.length > digits) {
      return digits === 0
        ? "Enter a whole amount; this currency has no decimals."
        : "Use at most " + digits + " decimal places.";
    }
    return { integerPart: match[1], fractionPart: fractionPart };
  }

  // Western (1,234,567) or Indian (12,34,567) grouping, applied consistently,
  // with no leading zero, so "0,001" is not mistaken for one thousand.
  function isGroupedInteger(groups) {
    if (groups.length < 2 || !/^[1-9]\d{0,2}$/.test(groups[0])) {
      return false;
    }
    const middle = groups.slice(1, -1);
    if (!/^\d{3}$/.test(groups[groups.length - 1])) {
      return false;
    }
    const western = middle.every((group) => /^\d{3}$/.test(group));
    const indian =
      middle.length > 0 && /^\d{1,2}$/.test(groups[0]) && middle.every((group) => /^\d{2}$/.test(group));
    return western || indian;
  }

  // Commas are thousands separators (1,200 or 1,00,000) or, when a single comma is
  // followed by one or two digits and there is no dot, a decimal comma (12,50).
  function normalizeSeparators(raw) {
    if (raw.indexOf(",") === -1) {
      return raw;
    }
    const parts = raw.split(".");
    if (parts.length > 2) {
      return null;
    }
    const groups = parts[0].split(",");
    if (isGroupedInteger(groups)) {
      return groups.join("") + (parts.length === 2 ? "." + parts[1] : "");
    }
    if (parts.length === 1 && groups.length === 2 && /^\d+$/.test(groups[0]) && /^\d{1,2}$/.test(groups[1])) {
      return groups[0] + "." + groups[1];
    }
    return null;
  }

  /**
   * Parse a user-typed amount string directly into integer minor units.
   * @param {string} rawValue - User input; grouping commas and a decimal comma are accepted.
   * @param {string} [currency] - ISO 4217 code (defaults to INR).
   * @param {number} [maxMajor] - Upper limit in major units (defaults to MAX_AMOUNT_MAJOR).
   * @returns {{ok:false,message:string}|{ok:true,paise:number}}
   */
  function parseAmount(rawValue, currency, maxMajor = MAX_AMOUNT_MAJOR) {
    const raw = String(rawValue).trim();
    const digits = currencyDigits(currency || "INR");
    if (digits === null) {
      return { ok: false, message: "Unsupported currency." };
    }
    if (/^[-+]/.test(raw)) {
      return { ok: false, message: validateAmountFormat(raw, digits) };
    }
    const cleaned = normalizeSeparators(raw);
    if (cleaned === null) {
      return { ok: false, message: "Check the commas: use 1,200 for thousands or 12.50 for decimals." };
    }
    const formatted = validateAmountFormat(cleaned, digits);
    if (typeof formatted === "string") {
      return { ok: false, message: formatted };
    }
    const maxMinor = maxMajor * Math.pow(10, digits);
    const paise =
      Number(formatted.integerPart) * Math.pow(10, digits) +
      Number(
        (formatted.fractionPart + "0".repeat(digits)).slice(0, digits) || 0,
      );
    if (paise === 0) {
      return { ok: false, message: "Amount must be greater than 0." };
    }
    if (!Number.isSafeInteger(paise) || paise > maxMinor) {
      return {
        ok: false,
        message:
          "Amount cannot exceed " +
          formatMoney(maxMinor, currency || "INR") +
          ".",
      };
    }
    return { ok: true, paise: paise };
  }

  /**
   * Split a paise total among participants, giving leftover paise in member order.
   * @param {number} totalPaise
   * @param {string[]} participants
   * @param {string[]} memberOrder - Full member list (determines leftover priority).
   * @returns {{[key:string]:number}} Map of member to paise.
   */
  function splitPaise(totalPaise, participants, memberOrder) {
    const count = participants.length;
    if (count === 0) {
      return {};
    }
    const base = Math.floor(totalPaise / count);
    const residual = totalPaise - base * count;
    const ordered = memberOrder.filter(
      (member) => participants.indexOf(member) !== -1,
    );
    participants.forEach((participant) => {
      if (ordered.indexOf(participant) === -1) {
        ordered.push(participant);
      }
    });
    const shares = Object.create(null);
    ordered.forEach((member, index) => {
      shares[member] = base + (index < residual ? 1 : 0);
    });
    return shares;
  }

  /**
   * Compute per-member balances for a trip.
   * @param {{members:string[],expenses:{amountPaise:number,payer:string,participants:string[]}[]}} trip
   * @returns {{[key:string]:number}} Balance (positive = gets back, negative = owes).
   */
  function computeBalances(trip) {
    const paid = Object.create(null);
    const share = Object.create(null);
    trip.members.forEach((member) => {
      paid[member] = 0;
      share[member] = 0;
    });
    trip.expenses.forEach((expense) => {
      if (expense.participants.length === 0) {
        return;
      }
      const totalPaise = expense.amountPaise;
      paid[expense.payer] = (paid[expense.payer] || 0) + totalPaise;
      const shares = splitPaise(totalPaise, expense.participants, trip.members);
      Object.keys(shares).forEach((member) => {
        share[member] = (share[member] || 0) + shares[member];
      });
    });
    (trip.payments || []).forEach((payment) => {
      paid[payment.from] = (paid[payment.from] || 0) + payment.amountPaise;
      paid[payment.to] = (paid[payment.to] || 0) - payment.amountPaise;
    });
    const balances = Object.create(null);
    trip.members.forEach((member) => {
      balances[member] = paid[member] - share[member];
    });
    return balances;
  }

  /**
   * Return a copy of expenses sorted newest-first by date then by seq descending.
   * @param {{expenses:{date:string,seq:number}[]}} trip
   * @returns {{date:string,seq:number}[]}
   */
  function sortedExpenses(trip) {
    return trip.expenses.slice().sort((a, b) => {
      if (a.date !== b.date) {
        return a.date < b.date ? 1 : -1;
      }
      return b.seq - a.seq;
    });
  }

  /**
   * Validate and normalise a raw members array.
   * @param {*} rawMembers
   * @returns {string[]|null} Normalised member names or null on failure.
   */
  function validateMembers(rawMembers) {
    if (
      !Array.isArray(rawMembers) ||
      rawMembers.length < MIN_MEMBERS ||
      rawMembers.length > MAX_MEMBERS
    ) {
      return null;
    }
    const members = [];
    const lowered = [];
    for (const member of rawMembers) {
      if (typeof member !== "string" || member.trim() === "") {
        return null;
      }
      const trimmed = member.trim();
      members.push(trimmed);
      lowered.push(trimmed.toLowerCase());
    }
    if (new Set(lowered).size !== lowered.length) {
      return null;
    }
    return members;
  }

  /**
   * Extract amountPaise from an expense object, supporting both old (amount) and new (amountPaise) formats.
   * @param {{amount?:number,amountPaise?:number}} expense
   * @returns {number|null} Integer paise or null on failure.
   */
  function migrateLegacyAmount(expense) {
    if (
      typeof expense.amountPaise === "number" &&
      Number.isInteger(expense.amountPaise) &&
      expense.amountPaise > 0
    ) {
      return expense.amountPaise;
    }
    if (
      typeof expense.amount === "number" &&
      isFinite(expense.amount) &&
      expense.amount > 0 &&
      expense.amount <= 1000000
    ) {
      return Math.round(expense.amount * 100);
    }
    return null;
  }

  /**
   * Validate basic shape of an expense object (object, description, amount).
   * @param {*} expense
   * @returns {{descriptionTrimmed:string,amountPaise:number}|null}
   */
  function validateExpenseBasic(expense) {
    if (!expense) {
      return null;
    }
    if (typeof expense !== "object") {
      return null;
    }
    if (typeof expense.description !== "string") {
      return null;
    }
    if (expense.description.trim() === "") {
      return null;
    }
    const amountPaise = migrateLegacyAmount(expense);
    if (amountPaise === null) {
      return null;
    }
    return {
      descriptionTrimmed: expense.description.trim(),
      amountPaise: amountPaise,
    };
  }

  function validateExpenseFieldsBasic(fields) {
    if (!fields || typeof fields !== "object") {
      return false;
    }
    if (typeof fields.description !== "string") {
      return false;
    }
    if (fields.description.trim() === "") {
      return false;
    }
    if (typeof fields.amountPaise !== "number") {
      return false;
    }
    if (!Number.isInteger(fields.amountPaise)) {
      return false;
    }
    if (fields.amountPaise <= 0) {
      return false;
    }
    if (fields.amountPaise > MAX_AMOUNT_MINOR_ANY) {
      return false;
    }
    return true;
  }

  function validateExpenseFieldsPayerDate(fields, members, enforceDate) {
    if (typeof fields.payer !== "string") {
      return false;
    }
    if (members.indexOf(fields.payer) === -1) {
      return false;
    }
    if (!isValidDateStr(fields.date)) {
      return false;
    }
    if (enforceDate && getDateValidationError(fields.date)) {
      return false;
    }
    return true;
  }

  function validateExpenseFieldsParticipants(fields, members) {
    if (!Array.isArray(fields.participants)) {
      return false;
    }
    if (fields.participants.length === 0) {
      return false;
    }
    for (const p of fields.participants) {
      if (members.indexOf(p) === -1) {
        return false;
      }
    }
    if (new Set(fields.participants).size !== fields.participants.length) {
      return false;
    }
    return true;
  }

  function validateExpenseFieldsSeq(fields, existingSeqs) {
    if (fields.seq === undefined || fields.seq === null) {
      return true;
    }
    if (!isValidSeq(fields.seq)) {
      return false;
    }
    if (hasSeq(existingSeqs, fields.seq)) {
      return false;
    }
    return true;
  }

  /**
   * Validate a set of expense fields (description, amount, payer, date, participants, optional seq).
   * Shared by add, edit and migration paths.
   * @param {{description:string,amountPaise:number,payer:string,date:string,participants:string[],seq?:number}} fields
   * @param {string[]} members
   * @param {number[]} [existingSeqs] - Seq values already in use (for uniqueness check).
   * @returns {boolean}
   */
  function validateExpenseFields(
    fields,
    members,
    existingSeqs,
    enforceDate = true,
  ) {
    if (!validateExpenseFieldsBasic(fields)) {
      return false;
    }
    if (!validateExpenseFieldsPayerDate(fields, members, enforceDate)) {
      return false;
    }
    if (!validateExpenseFieldsParticipants(fields, members)) {
      return false;
    }
    if (!validateExpenseFieldsSeq(fields, existingSeqs)) {
      return false;
    }
    return true;
  }

  function validatePaymentParticipants(payment, members) {
    return (
      typeof payment.from === "string" &&
      typeof payment.to === "string" &&
      payment.from !== payment.to &&
      members.indexOf(payment.from) !== -1 &&
      members.indexOf(payment.to) !== -1
    );
  }

  function validatePaymentAmount(payment) {
    return Number.isSafeInteger(payment.amountPaise) && payment.amountPaise > 0;
  }

  /**
   * Sum of every expense and payment amount. While it is a safe integer, every
   * balance and suggested settlement (each bounded by it) is exact.
   */
  function tripVolume(trip) {
    let total = 0;
    trip.expenses.forEach((expense) => {
      total += expense.amountPaise;
    });
    (trip.payments || []).forEach((payment) => {
      total += payment.amountPaise;
    });
    return total;
  }

  /**
   * Whether a trip stays inside the amount limits: every expense within the per-expense
   * limit for the trip's currency, and the total volume a safe integer. Every change
   * that adds or replaces an amount is checked with this before it is saved.
   * @param {{currency?:string,expenses:{amountPaise:number}[],payments?:{amountPaise:number}[]}} trip
   * @returns {boolean}
   */
  function withinTripLimits(trip) {
    const cap = maxAmountMinor(trip.currency === undefined ? "INR" : trip.currency);
    if (trip.expenses.some((expense) => expense.amountPaise > cap)) {
      return false;
    }
    return Number.isSafeInteger(tripVolume(trip));
  }

  function validatePaymentSequence(payment, existingSeqs) {
    return (
      isValidSeq(payment.seq) &&
      !hasSeq(existingSeqs, payment.seq)
    );
  }

  function validatePayment(payment, members, existingSeqs, enforceDate = true) {
    if (!payment || typeof payment !== "object") {
      return null;
    }
    if (!validatePaymentParticipants(payment, members)) {
      return null;
    }
    if (!validatePaymentAmount(payment)) {
      return null;
    }
    if (!isValidDateStr(payment.date)) {
      return null;
    }
    if (enforceDate && getDateValidationError(payment.date)) {
      return null;
    }
    if (!validatePaymentSequence(payment, existingSeqs)) {
      return null;
    }
    return {
      seq: payment.seq,
      from: payment.from,
      to: payment.to,
      amountPaise: payment.amountPaise,
      date: payment.date,
    };
  }

  /**
   * Validate a single expense object.
   * @param {*} expense
   * @param {string[]} members
   * @param {number[]} [existingSeqs] - Seq values already in use (for duplicate detection).
   * @returns {{seq:number,description:string,amountPaise:number,payer:string,date:string,participants:string[]}|null}
   */
  function validateExpense(expense, members, existingSeqs, enforceDate = true) {
    const basic = validateExpenseBasic(expense);
    if (!basic) {
      return null;
    }
    let seq = 0;
    if (typeof expense.seq === "number") {
      if (isFinite(expense.seq)) {
        seq = expense.seq;
      }
    }
    if (
      !validateExpenseFields(
        {
          description: basic.descriptionTrimmed,
          amountPaise: basic.amountPaise,
          payer: expense.payer,
          date: expense.date,
          participants: expense.participants,
          seq: seq,
        },
        members,
        existingSeqs,
        enforceDate,
      )
    ) {
      return null;
    }
    return {
      seq: seq,
      description: basic.descriptionTrimmed,
      amountPaise: basic.amountPaise,
      payer: expense.payer,
      date: expense.date,
      participants: expense.participants.slice(),
    };
  }

  function isValidSeq(value) {
    return Number.isInteger(value) && value >= 0 && value <= MAX_SEQ;
  }

  // existingSeqs may be an array (callers) or a Set (migration, to stay linear).
  function hasSeq(existingSeqs, seq) {
    if (!existingSeqs) {
      return false;
    }
    return existingSeqs instanceof Set ? existingSeqs.has(seq) : existingSeqs.indexOf(seq) !== -1;
  }

  // Give legacy expenses without a seq one after every seq already in use,
  // including payment seqs, which share the same counter.
  function withSeqs(rawItems, firstFreeSeq) {
    let autoSeq = Math.max(1, firstFreeSeq);
    rawItems.forEach((item) => {
      if (item && isValidSeq(item.seq)) {
        autoSeq = Math.max(autoSeq, item.seq + 1);
      }
    });
    return rawItems.map((item) => {
      if (!item || typeof item !== "object" || isValidSeq(item.seq)) {
        return item;
      }
      // Past MAX_SEQ the assigned seq fails validation and the trip is rejected.
      const assigned = Object.assign({}, item, { seq: autoSeq });
      autoSeq += 1;
      return assigned;
    });
  }

  function migrateExpenses(rawExpenses, members, firstFreeSeq) {
    const items = [];
    const seen = new Set();
    let nextSeq = 1;
    for (const expense of withSeqs(rawExpenses, firstFreeSeq)) {
      const validated = validateExpense(
        expense,
        members,
        seen,
        false,
      );
      if (!validated) {
        return null;
      }
      items.push(validated);
      seen.add(validated.seq);
      nextSeq = Math.max(nextSeq, validated.seq + 1);
    }
    return { items: items, nextSeq: nextSeq };
  }

  function migratePayments(rawPayments, members) {
    const items = [];
    const seen = new Set();
    let nextSeq = 1;
    const source = rawPayments === undefined ? [] : rawPayments;
    if (!Array.isArray(source)) {
      return null;
    }
    for (const payment of source) {
      const validated = validatePayment(
        payment,
        members,
        seen,
        false,
      );
      if (!validated) {
        return null;
      }
      items.push(validated);
      seen.add(validated.seq);
      nextSeq = Math.max(nextSeq, validated.seq + 1);
    }
    return { items: items, nextSeq: nextSeq };
  }

  // Name, members, currency and an expenses array: the parts every trip needs.
  function migrateTripHeader(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    if (typeof raw.name !== "string" || raw.name.trim() === "") {
      return null;
    }
    const members = validateMembers(raw.members);
    if (!members || !Array.isArray(raw.expenses)) {
      return null;
    }
    const currency = raw.currency === undefined ? "INR" : raw.currency;
    return isSupportedCurrency(currency) ? { members: members, currency: currency } : null;
  }

  /**
   * Migrate a raw trip object (old or new format) to the current schema. Returns null on failure.
   * @param {*} raw - Parsed JSON.
   * @returns {object|null} The trip ({schemaVersion, id, name, currency, members, expenses, payments,
   *   nextSeq}) or null when the data is not a valid trip.
   */
  function migrateTrip(raw) {
    const header = migrateTripHeader(raw);
    if (!header) {
      return null;
    }
    const members = header.members;
    const currency = header.currency;
    const paymentData = migratePayments(raw.payments, members);
    if (!paymentData) {
      return null;
    }
    const expenseData = migrateExpenses(raw.expenses, members, paymentData.nextSeq);
    if (!expenseData) {
      return null;
    }
    const storedNextSeq = isValidSeq(raw.nextSeq) ? raw.nextSeq : 1;
    const trip = {
      schemaVersion: SCHEMA_VERSION,
      id: isValidTripId(raw.id) ? raw.id : null,
      name: raw.name.trim(),
      currency: currency,
      members: members,
      expenses: expenseData.items,
      nextSeq: Math.max(expenseData.nextSeq, paymentData.nextSeq, storedNextSeq),
      payments: paymentData.items,
    };
    return withinTripLimits(trip) ? trip : null;
  }

  /**
   * Validate basic fields of a changes object (non-membership checks).
   * @param {*} changes
   * @returns {{descriptionTrimmed:string,amountPaise:number,date:string}|null}
   */
  function validateChangesBasic(changes) {
    if (!changes) {
      return null;
    }
    if (typeof changes !== "object") {
      return null;
    }
    if (typeof changes.description !== "string") {
      return null;
    }
    if (changes.description.trim() === "") {
      return null;
    }
    if (typeof changes.amountPaise !== "number") {
      return null;
    }
    if (!Number.isInteger(changes.amountPaise)) {
      return null;
    }
    if (changes.amountPaise <= 0) {
      return null;
    }
    if (changes.amountPaise > MAX_AMOUNT_MINOR_ANY) {
      return null;
    }
    if (!isValidDateStr(changes.date)) {
      return null;
    }
    return {
      descriptionTrimmed: changes.description.trim(),
      amountPaise: changes.amountPaise,
      date: changes.date,
    };
  }

  /**
   * Validate a changes object provided to updateExpense.
   * @param {*} changes
   * @param {string[]} members
   * @returns {boolean}
   */
  function validateChanges(changes, members) {
    const basic = validateChangesBasic(changes);
    if (!basic) {
      return false;
    }
    return validateExpenseFields(
      {
        description: basic.descriptionTrimmed,
        amountPaise: basic.amountPaise,
        payer: changes.payer,
        date: basic.date,
        participants: changes.participants,
      },
      members,
    );
  }

  /**
   * Update an expense in place (returns a new trip). Returns null on failure.
   * @param {{members:string[],expenses:object[]}} trip
   * @param {number} seq - The expense's seq to update.
   * @param {{description:string,amountPaise:number,payer:string,date:string,participants:string[]}} changes
   * @returns {object|null} New trip or null.
   */
  function updateExpense(trip, seq, changes) {
    if (
      !trip ||
      typeof trip !== "object" ||
      !Array.isArray(trip.members) ||
      !Array.isArray(trip.expenses)
    ) {
      return null;
    }
    if (!validateChanges(changes, trip.members)) {
      return null;
    }
    let index = -1;
    for (let i = 0; i < trip.expenses.length; i += 1) {
      if (trip.expenses[i] && trip.expenses[i].seq === seq) {
        index = i;
        break;
      }
    }
    if (index === -1) {
      return null;
    }
    const updatedExpense = Object.assign({}, trip.expenses[index], {
      description: changes.description.trim(),
      amountPaise: changes.amountPaise,
      payer: changes.payer,
      date: changes.date,
      participants: changes.participants.slice(),
    });
    const expenses = trip.expenses.slice();
    expenses[index] = updatedExpense;
    const updated = Object.assign({}, trip, { expenses: expenses });
    return withinTripLimits(updated) ? updated : null;
  }

  /**
   * Remove an expense by seq. Returns null on failure.
   * @param {{expenses:object[]}} trip
   * @param {number} seq
   * @returns {object|null} New trip or null.
   */
  function removeExpense(trip, seq) {
    if (!trip || typeof trip !== "object" || !Array.isArray(trip.expenses)) {
      return null;
    }
    let index = -1;
    for (let i = 0; i < trip.expenses.length; i += 1) {
      if (trip.expenses[i] && trip.expenses[i].seq === seq) {
        index = i;
        break;
      }
    }
    if (index === -1) {
      return null;
    }
    const expenses = trip.expenses.slice();
    expenses.splice(index, 1);
    return Object.assign({}, trip, { expenses: expenses });
  }

  /**
   * Re-insert a previously removed expense by its seq (restoring original position). Returns null on failure.
   * @param {{expenses:object[]}} trip
   * @param {{seq:number}} expense - The expense object to restore (should have seq).
   * @returns {object|null} New trip or null.
   */
  function restoreExpense(trip, expense) {
    if (!trip) {
      return null;
    }
    if (typeof trip !== "object") {
      return null;
    }
    if (!Array.isArray(trip.expenses)) {
      return null;
    }
    if (!expense) {
      return null;
    }
    if (typeof expense !== "object") {
      return null;
    }
    if (
      trip.expenses.some((existing) => existing && existing.seq === expense.seq)
    ) {
      return null;
    }
    const expenses = trip.expenses.slice();
    let index = expenses.length;
    const found = expenses.findIndex((e) => e && e.seq > expense.seq);
    if (found !== -1) {
      index = found;
    }
    expenses.splice(index, 0, Object.assign({}, expense));
    const restored = Object.assign({}, trip, { expenses: expenses });
    return withinTripLimits(restored) ? restored : null;
  }

  /** Trip ids are random tokens that tell a new trip apart from an older one. */
  function isValidTripId(id) {
    return typeof id === "string" && /^[A-Za-z0-9-]{8,64}$/.test(id);
  }

  // Parse stored JSON that looks like a trip; anything else is treated as empty.
  function parseStoredTrip(storedRaw) {
    if (!storedRaw) {
      return null;
    }
    let stored;
    try {
      stored = JSON.parse(storedRaw);
    } catch {
      return null;
    }
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return null;
    }
    if (typeof stored.name !== "string" || !Array.isArray(stored.members)) {
      return null;
    }
    return stored;
  }

  /**
   * Check whether the stored trip is still the one this tab loaded before saving.
   * @param {number} stateRevision - The revision loaded by this tab.
   * @param {string|null} storedRaw - Raw JSON from localStorage (may be null/empty).
   * @param {string|null} [tripId] - This tab's trip id; compared when given.
   * @returns {{ok:boolean,storedRevision?:number}}
   */
  function checkSaveConflict(stateRevision, storedRaw, tripId) {
    const stored = parseStoredTrip(storedRaw);
    if (!stored) {
      return { ok: true };
    }
    const storedRev =
      typeof stored.revision === "number" && Number.isInteger(stored.revision)
        ? stored.revision
        : 0;
    if (storedRev !== stateRevision) {
      return { ok: false, storedRevision: storedRev };
    }
    const storedId = isValidTripId(stored.id) ? stored.id : null;
    if (tripId !== undefined && storedId !== tripId) {
      return { ok: false, storedRevision: storedRev };
    }
    return { ok: true };
  }

  /**
   * Compute the list of payments needed to settle all balances.
   * Repeatedly pairs the member who owes the most with the member owed the most
   * (ties broken by trip member order) and transfers the smaller of the two
   * amounts. Uses integer paise and produces at most (members - 1) payments.
   * @param {{members:string[],expenses:object[]}} trip
   * @returns {{from:string,to:string,amountPaise:number}[]}
   */
  function computeSettlements(trip) {
    const balances = computeBalances(trip);
    const debtors = [];
    const creditors = [];
    trip.members.forEach((member) => {
      const bal = balances[member] || 0;
      if (bal < 0) {
        debtors.push({ name: member, amount: -bal });
      } else if (bal > 0) {
        creditors.push({ name: member, amount: bal });
      }
    });
    debtors.sort((a, b) => {
      if (a.amount !== b.amount) {
        return b.amount - a.amount;
      }
      return trip.members.indexOf(a.name) - trip.members.indexOf(b.name);
    });
    creditors.sort((a, b) => {
      if (a.amount !== b.amount) {
        return b.amount - a.amount;
      }
      return trip.members.indexOf(a.name) - trip.members.indexOf(b.name);
    });
    const payments = [];
    while (debtors.length > 0 && creditors.length > 0) {
      const d = debtors[0];
      const c = creditors[0];
      const payment = d.amount < c.amount ? d.amount : c.amount;
      payments.push({ from: d.name, to: c.name, amountPaise: payment });
      d.amount -= payment;
      c.amount -= payment;
      if (d.amount === 0) {
        debtors.shift();
      }
      if (c.amount === 0) {
        creditors.shift();
      }
    }
    return payments;
  }

  /**
   * Add a payment to a trip. Undo passes enforceDate=false so a restored payment
   * is not rejected for a date that was valid when it was first saved.
   */
  function addPayment(trip, payment, enforceDate = true) {
    if (!trip || !Array.isArray(trip.payments)) {
      return null;
    }
    const validated = validatePayment(
      payment,
      trip.members,
      trip.payments.map((item) => item.seq),
      enforceDate,
    );
    if (!validated) {
      return null;
    }
    const updated = Object.assign({}, trip, {
      payments: trip.payments.concat([validated]),
      nextSeq: Math.max(trip.nextSeq || 1, validated.seq + 1),
    });
    return withinTripLimits(updated) ? updated : null;
  }

  /** Replace an existing payment, validating it like a new one. */
  function updatePayment(trip, seq, payment) {
    if (!trip || !Array.isArray(trip.payments)) {
      return null;
    }
    const index = trip.payments.findIndex((item) => item.seq === seq);
    if (index === -1) {
      return null;
    }
    const others = trip.payments.filter((item) => item.seq !== seq).map((item) => item.seq);
    const validated = validatePayment(Object.assign({}, payment, { seq: seq }), trip.members, others);
    if (!validated) {
      return null;
    }
    const payments = trip.payments.slice();
    payments[index] = validated;
    const updated = Object.assign({}, trip, { payments: payments });
    return withinTripLimits(updated) ? updated : null;
  }

  function removePayment(trip, seq) {
    if (!trip || !Array.isArray(trip.payments)) {
      return null;
    }
    const payments = trip.payments.filter((payment) => payment.seq !== seq);
    if (payments.length === trip.payments.length) {
      return null;
    }
    return Object.assign({}, trip, { payments: payments });
  }

  /**
   * Prepare a save by checking the stored revision and computing the next revision.
   * Pure function (no IO). Returns ok + nextRevision on success, or ok:false on conflict.
   * @param {number} baseRevision - The revision held by the caller (0 if no trip exists).
   * @param {string|null} storedRaw - Raw JSON from localStorage (may be null/empty).
   * @param {string|null} [tripId] - The caller's trip id; a different stored id is a conflict.
   * @returns {{ok:true,nextRevision:number}|{ok:false,storedRevision?:number}}
   */
  function prepareSave(baseRevision, storedRaw, tripId) {
    const check = checkSaveConflict(baseRevision, storedRaw, tripId);
    return check.ok ? { ok: true, nextRevision: baseRevision + 1 } : check;
  }


  /**
   * Build an export object and a file name from a trip.
   * @param {{name:string}} trip
   * @param {string} [now] - ISO date string for the export timestamp (defaults to current time).
   * @returns {{object:object,fileName:string}}
   */
  function buildExport(trip, now) {
    const exportedAt = now || new Date().toISOString();
    const slug = trip.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const datePart = exportedAt.substring(0, 10);
    return {
      object: {
        app: "FairShare",
        exportVersion: 1,
        schemaVersion: SCHEMA_VERSION,
        exportedAt: exportedAt,
        trip: JSON.parse(JSON.stringify(trip)),
      },
      fileName: "fairshare-" + slug + "-" + datePart + ".json",
    };
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    CURRENCY_NAMES: CURRENCY_NAMES,
    isSupportedCurrency: isSupportedCurrency,
    isValidTripId: isValidTripId,
    CURRENCY_CODES: CURRENCY_CODES,
    COMMON_CURRENCY_CODES: COMMON_CURRENCY_CODES,
    currencyDigits: currencyDigits,
    amountPlaceholder: amountPlaceholder,
    currencyPickerGroups: currencyPickerGroups,
    defaultCurrencyForLocale: defaultCurrencyForLocale,
    MIN_MEMBERS: MIN_MEMBERS,
    MAX_MEMBERS: MAX_MEMBERS,
    MAX_AMOUNT_MAJOR: MAX_AMOUNT_MAJOR,
    MAX_PAYMENT_MAJOR: MAX_PAYMENT_MAJOR,
    maxAmountMinor: maxAmountMinor,
    currencyName: currencyName,
    withinTripLimits: withinTripLimits,
    formatPaise: formatPaise,
    formatMoney: formatMoney,
    formatIndianDate: formatIndianDate,
    isValidDateStr: isValidDateStr,
    getDateValidationError: getDateValidationError,
    parseAmount: parseAmount,
    splitPaise: splitPaise,
    computeBalances: computeBalances,
    sortedExpenses: sortedExpenses,
    migrateTrip: migrateTrip,
    updateExpense: updateExpense,
    removeExpense: removeExpense,
    restoreExpense: restoreExpense,
    validateExpenseFields: validateExpenseFields,
    validatePayment: validatePayment,
    addPayment: addPayment,
    updatePayment: updatePayment,
    removePayment: removePayment,
    checkSaveConflict: checkSaveConflict,
    prepareSave: prepareSave,
    computeSettlements: computeSettlements,
    buildExport: buildExport,
  };
});
