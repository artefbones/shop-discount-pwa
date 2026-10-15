(() => {
  "use strict";

  const STORAGE_KEY = "shop-discount-cashback-settings-v2";
  const LEGACY_STORAGE_KEY = "shop-discount-cashback-settings-v1";
  const THEME_KEY = "shop-discount-cashback-theme-v1";
  const DEFAULTS = { price: "100", discount: "10", cashback: "1", currency: "RUB" };
  const CURRENCY_SYMBOLS = { EUR: "€", USD: "$", RUB: "₽", GBP: "£", PLN: "zł" };
  const inputs = {
    price: document.getElementById("price"),
    discount: document.getElementById("discount"),
    cashback: document.getElementById("cashback"),
    currency: document.getElementById("currency")
  };
  const outputs = {
    effectiveCost: document.getElementById("effective-cost"),
    payable: document.getElementById("payable"),
    cashbackAmount: document.getElementById("cashback-amount"),
    totalSavings: document.getElementById("total-savings"),
    savingsPercentPill: document.getElementById("savings-percent-pill"),
    priceCurrency: document.getElementById("price-currency")
  };

  function validStoredNumber(value, fallback, min, max) {
    if (value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return String(Math.min(max, Math.max(min, number)));
  }

  function readSavedSettings() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) {
        const saved = JSON.parse(current);
        if (!saved || typeof saved !== "object") return { ...DEFAULTS };
        return {
          price: validStoredNumber(saved.price, DEFAULTS.price, 0, 1000000000),
          discount: validStoredNumber(saved.discount, DEFAULTS.discount, 0, 100),
          cashback: validStoredNumber(saved.cashback, DEFAULTS.cashback, 0, 99),
          currency: Object.prototype.hasOwnProperty.call(CURRENCY_SYMBOLS, saved.currency) ? saved.currency : DEFAULTS.currency
        };
      }

      // One-time migration: keep the user's numbers, but use RUB as the new default currency.
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacy) return { ...DEFAULTS };
      const saved = JSON.parse(legacy);
      const migrated = {
        price: validStoredNumber(saved.price, DEFAULTS.price, 0, 1000000000),
        discount: validStoredNumber(saved.discount, DEFAULTS.discount, 0, 100),
        cashback: validStoredNumber(saved.cashback, DEFAULTS.cashback, 0, 99),
        currency: DEFAULTS.currency
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function storeSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        price: inputs.price.value,
        discount: inputs.discount.value,
        cashback: inputs.cashback.value,
        currency: inputs.currency.value
      }));
    } catch (_) {
      // The calculator remains usable even if browser storage is unavailable.
    }
  }

  function safeNumber(input) {
    const value = input.value.trim();
    if (value === "") return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function roundedMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(value) {
    const currency = inputs.currency.value;
    try {
      return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    } catch (_) {
      return `${value.toFixed(2)} ${CURRENCY_SYMBOLS[currency] || currency}`;
    }
  }

  function formatPercent(value) {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  function recalculate() {
    const price = safeNumber(inputs.price);
    const discountRate = Math.min(100, Math.max(0, safeNumber(inputs.discount)));
    const cashbackRate = Math.min(99, Math.max(0, safeNumber(inputs.cashback)));

    const payable = roundedMoney(price * (1 - discountRate / 100));
    const cashback = roundedMoney(payable * cashbackRate / 100);
    const effectiveCost = roundedMoney(Math.max(0, payable - cashback));
    const savings = roundedMoney(Math.max(0, price - effectiveCost));
    const savingsRate = price > 0 ? Math.min(100, Math.max(0, savings / price * 100)) : 0;

    outputs.effectiveCost.textContent = formatMoney(effectiveCost);
    outputs.payable.textContent = formatMoney(payable);
    outputs.cashbackAmount.textContent = formatMoney(cashback);
    outputs.totalSavings.textContent = formatMoney(savings);
    outputs.savingsPercentPill.textContent = `${formatPercent(savingsRate)}%`;
    outputs.priceCurrency.textContent = CURRENCY_SYMBOLS[inputs.currency.value] || inputs.currency.value;
    storeSettings();
  }

  function enforceBounds(input) {
    if (input.value.trim() === "") return;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    const minimum = input.min === "" ? 0 : Number(input.min);
    const maximum = input.max === "" ? Number.MAX_SAFE_INTEGER : Number(input.max);
    const bounded = Math.min(maximum, Math.max(minimum, value));
    if (bounded !== value) input.value = String(bounded);
  }

  function setTheme(theme, persist = true) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    const button = document.getElementById("theme-toggle");
    const nextLabel = next === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему";
    button.setAttribute("aria-label", nextLabel);
    button.setAttribute("title", nextLabel);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", next === "dark" ? "#0b1220" : "#f4f7fb");
    if (persist) {
      try { localStorage.setItem(THEME_KEY, next); } catch (_) { /* Theme works for this session. */ }
    }
  }

  try {
    const storedTheme = localStorage.getItem(THEME_KEY);
    setTheme(storedTheme === "light" ? "light" : "dark", false);
  } catch (_) {
    setTheme("dark", false);
  }

  const restored = readSavedSettings();
  Object.keys(inputs).forEach((key) => { inputs[key].value = restored[key]; });

  [inputs.price, inputs.discount, inputs.cashback].forEach((input) => {
    input.addEventListener("input", () => {
      enforceBounds(input);
      recalculate();
    });
    input.addEventListener("change", () => {
      enforceBounds(input);
      recalculate();
    });
  });
  inputs.currency.addEventListener("change", recalculate);

  document.getElementById("theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "dark" ? "light" : "dark");
  });

  document.getElementById("reset-button").addEventListener("click", () => {
    Object.keys(inputs).forEach((key) => { inputs[key].value = DEFAULTS[key]; });
    recalculate();
    inputs.price.focus();
  });

  function registerOfflineSupport() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
        // Offline support is optional; calculator features continue to work online.
      });
    }, { once: true });
  }

  recalculate();
  registerOfflineSupport();
})();
