(function () {
  'use strict';

  var DAY = 86400, WEEK = 604800, MONTH = 2592000, YEAR = 31536000;
  var UNITS = { 'TH/s': 1e12, 'PH/s': 1e15, 'EH/s': 1e18 };

  var state = {
    networkHashrate: 0,
    difficulty: 0,
    blockHeight: null,
    btcPrice: null,
    hasBtcPrice: false,
    userHashrate: 1,
    unit: 'TH/s'
  };

  function debounce(fn, ms) {
    var timer;
    return function () { clearTimeout(timer); timer = setTimeout(fn, ms); };
  }

  // Thin-space thousand separator (no commas, no apostrophes)
  function fmt(n) {
    if (!isFinite(n)) return 'N/A';
    var rounded = Math.round(n);
    // toFixed(0) avoids scientific notation for large numbers
    var s = rounded < 1e20 ? String(rounded) : rounded.toFixed(0);
    var out = '';
    for (var i = s.length - 1, c = 0; i >= 0; i--, c++) {
      if (c > 0 && c % 3 === 0) out = '\u2005' + out;
      out = s[i] + out;
    }
    return out;
  }

  function userHs() {
    return state.userHashrate * (UNITS[state.unit] || 1e12);
  }

  function isFiniteNum(n) {
    return typeof n === 'number' && isFinite(n);
  }

  function blockReward(h) {
    var halvings = Math.floor(h / 210000);
    return halvings >= 64 ? 0 : 50 / Math.pow(2, halvings);
  }

  function share() {
    return state.networkHashrate > 0 ? userHs() / state.networkHashrate : 0;
  }

  function probability(seconds) {
    var lam = (seconds / 600) * share();
    if (lam < 1e-10) return lam;
    return 1 - Math.exp(-lam);
  }

  function formatProb(p) {
    if (p <= 0) return '0%';
    if (p >= 0.9999) return '> 99.99%';
    var pct = p * 100;
    if (pct >= 1) return pct.toFixed(2) + '%';
    if (pct >= 0.01) return pct.toFixed(4) + '%';
    if (pct >= 0.0001) return pct.toFixed(6) + '%';
    return '1 in ' + fmt(1 / p);
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec <= 0) return 'Never';
    var tiers = [
      { l: 'year', v: YEAR }, { l: 'month', v: MONTH },
      { l: 'week', v: WEEK }, { l: 'day', v: DAY },
      { l: 'hour', v: 3600 }, { l: 'minute', v: 60 }
    ];
    var parts = [], rem = sec;
    for (var i = 0; i < tiers.length && parts.length < 2; i++) {
      if (rem >= tiers[i].v) {
        var n = Math.floor(rem / tiers[i].v);
        rem %= tiers[i].v;
        parts.push(n + ' ' + tiers[i].l + (n !== 1 ? 's' : ''));
      }
    }
    return parts.length > 0 ? parts.join(', ') : '< 1 minute';
  }

  function formatDiff(d) {
    if (d >= 1e15) return (d / 1e15).toFixed(2) + ' P';
    if (d >= 1e12) return (d / 1e12).toFixed(2) + ' T';
    if (d >= 1e9) return (d / 1e9).toFixed(2) + ' G';
    return fmt(d);
  }

  function $(id) { return document.getElementById(id); }

  function set(id, txt) {
    var el = $(id);
    if (el) el.textContent = txt;
  }

  function render() {
    var s = share();
    if (s === 0 || state.networkHashrate === 0) {
      set('odds-value', 'Waiting for network data...');
      set('expected-time', '');
      ['prob-1d','prob-1w','prob-1m','prob-1y'].forEach(function(id) { set(id, '--'); });
      return;
    }

    set('odds-value', '1 in ' + fmt(1 / s));
    set('expected-time', formatTime(600 / s));

    set('prob-1d', formatProb(probability(DAY)));
    set('prob-1w', formatProb(probability(WEEK)));
    set('prob-1m', formatProb(probability(MONTH)));
    set('prob-1y', formatProb(probability(YEAR)));

    var hasHeight = isFiniteNum(state.blockHeight) && state.blockHeight >= 0;
    var reward = hasHeight ? blockReward(state.blockHeight) : null;
    set('stat-hashrate', (state.networkHashrate / 1e18).toFixed(2) + ' EH/s');
    set('stat-difficulty', formatDiff(state.difficulty));
    set('stat-blockheight', hasHeight ? fmt(state.blockHeight) : 'N/A');
    set('stat-reward', reward === null ? 'N/A' : reward + ' BTC');
    set('stat-price', state.hasBtcPrice ? '$' + fmt(state.btcPrice) : 'N/A');
    set('stat-revenue', (reward !== null && state.hasBtcPrice) ? '$' + fmt(reward * state.btcPrice) : 'N/A');
  }

  function showPulse(on) {
    var el = $('refresh-indicator');
    if (el) el.style.display = on ? '' : 'none';
  }

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('http-' + r.status);
      return r.json();
    });
  }

  function fetchText(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('http-' + r.status);
      return r.text();
    });
  }

  function fetchData() {
    showPulse(true);
    return Promise.allSettled([
      fetchJson('https://mempool.space/api/v1/mining/hashrate/1m'),
      fetchText('https://mempool.space/api/blocks/tip/height'),
      fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
    ]).then(function (res) {
      if (res[0].status === 'fulfilled') {
        if (isFiniteNum(res[0].value.currentHashrate)) state.networkHashrate = res[0].value.currentHashrate;
        if (isFiniteNum(res[0].value.currentDifficulty)) state.difficulty = res[0].value.currentDifficulty;
      }
      if (res[1].status === 'fulfilled') {
        var parsedHeight = parseInt(res[1].value, 10);
        if (isFiniteNum(parsedHeight) && parsedHeight >= 0) state.blockHeight = parsedHeight;
      }
      if (
        res[2].status === 'fulfilled' &&
        res[2].value.bitcoin &&
        isFiniteNum(res[2].value.bitcoin.usd) &&
        res[2].value.bitcoin.usd > 0
      ) {
        state.btcPrice = res[2].value.bitcoin.usd;
        state.hasBtcPrice = true;
        try { localStorage.setItem('cachedBtcPrice', String(state.btcPrice)); } catch (e) {}
      } else {
        state.btcPrice = null;
        state.hasBtcPrice = false;
        try {
          var c = localStorage.getItem('cachedBtcPrice');
          var cached = parseFloat(c);
          if (isFiniteNum(cached) && cached > 0) {
            state.btcPrice = cached;
            state.hasBtcPrice = true;
          }
        } catch (e) {}
      }
      showPulse(false);
    });
  }

  function save() {
    try {
      localStorage.setItem('sm_hashrate', String(state.userHashrate));
      localStorage.setItem('sm_unit', state.unit);
    } catch (e) {}
  }

  function load() {
    try {
      var h = localStorage.getItem('sm_hashrate');
      if (h) state.userHashrate = parseFloat(h) || 1;
      var u = localStorage.getItem('sm_unit');
      if (u && UNITS[u]) state.unit = u;
      var c = localStorage.getItem('cachedBtcPrice');
      var cached = parseFloat(c);
      if (isFiniteNum(cached) && cached > 0) {
        state.btcPrice = cached;
        state.hasBtcPrice = true;
      }
    } catch (e) {}
  }

  function init() {
    load();

    var input = $('hashrate-input');
    var select = $('unit-select');

    if (input) input.value = state.userHashrate;
    if (select) select.value = state.unit;

    var update = debounce(function () {
      var v = parseFloat(input.value);
      if (v > 0 && isFinite(v)) {
        state.userHashrate = v;
        save();
        render();
      }
    }, 300);

    if (input) input.addEventListener('input', update);
    if (select) select.addEventListener('change', function () {
      state.unit = select.value;
      save();
      render();
    });
    fetchData().then(render);
    setInterval(function () { fetchData().then(render); }, 300000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
