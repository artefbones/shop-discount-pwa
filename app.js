(() => {
  "use strict";

  const STORAGE_KEY = "shop-discount-cashback-settings-v2";
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
    savingsMeterFill: document.getElementById("savings-meter-fill"),
    priceCurrency: document.getElementById("price-currency")
  };

  function readSavedSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return { ...DEFAULTS };
      const currency = Object.prototype.hasOwnProperty.call(CURRENCY_SYMBOLS, saved.currency) ? saved.currency : DEFAULTS.currency;
      return {
        price: validStoredNumber(saved.price, DEFAULTS.price, 0, 1000000000),
        discount: validStoredNumber(saved.discount, DEFAULTS.discount, 0, 100),
        cashback: validStoredNumber(saved.cashback, DEFAULTS.cashback, 0, 99),
        currency
      };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function validStoredNumber(value, fallback, min, max) {
    if (value === "") return "";
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return String(Math.min(max, Math.max(min, number)));
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
    outputs.savingsMeterFill.style.width = `${savingsRate}%`;
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

  document.getElementById("reset-button").addEventListener("click", () => {
    Object.keys(inputs).forEach((key) => { inputs[key].value = DEFAULTS[key]; });
    recalculate();
    inputs.price.focus();
  });

  function updateNetworkStatus() {
    const badge = document.getElementById("offline-badge");
    const label = document.getElementById("offline-label");
    if (!navigator.onLine) {
      badge.classList.add("offline");
      label.textContent = "Работаем офлайн";
    } else {
      badge.classList.remove("offline");
      label.textContent = "Офлайн-режим готов";
    }
  }

  function registerOfflineSupport() {
    const badge = document.getElementById("offline-badge");
    const label = document.getElementById("offline-label");
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      label.textContent = "Офлайн включится после публикации HTTPS";
      badge.classList.remove("ready");
      return;
    }
    navigator.serviceWorker.register("./sw.js", { scope: "./" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        badge.classList.add("ready");
        updateNetworkStatus();
      })
      .catch(() => {
        label.textContent = "Не удалось включить офлайн-кеш";
        badge.classList.remove("ready");
      });
  }

  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  recalculate();
  registerOfflineSupport();
})();
