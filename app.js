(function () {
  'use strict';

  var DAY = 86400, WEEK = 604800, MONTH = 2592000, YEAR = 31536000;
  var FETCH_TIMEOUT = 12000;
  var CACHE_MAX_AGE = 3600000; // 1 hour

  var COINS = {
    BTC: {
      name: 'Bitcoin', symbol: 'BTC', blockTime: 600,
      units: { 'TH/s': 1e12, 'PH/s': 1e15, 'EH/s': 1e18 },
      defaultUnit: 'TH/s',
      geckoId: 'bitcoin',
      formatNetHash: function (h) { return (h / 1e18).toFixed(2) + ' EH/s'; },
      rewardFn: function (h) {
        if (h === null) return null;
        var halvings = Math.floor(h / 210000);
        return halvings >= 64 ? 0 : 50 / Math.pow(2, halvings);
      },
      deriveHashrate: function (diff, bt) { return diff * 4294967296 / bt; }
    },
    XMR: {
      name: 'Monero', symbol: 'XMR', blockTime: 120,
      units: { 'H/s': 1, 'KH/s': 1e3, 'MH/s': 1e6, 'GH/s': 1e9 },
      defaultUnit: 'KH/s',
      geckoId: 'monero',
      formatNetHash: function (h) { return (h / 1e9).toFixed(2) + ' GH/s'; },
      rewardFn: function () { return 0.6; },
      deriveHashrate: function (diff, bt) { return diff / bt; }
    },
    DGB: {
      name: 'DigiByte', symbol: 'DGB', blockTime: 75, algoNote: 'SHA-256d algorithm',
      units: { 'GH/s': 1e9, 'TH/s': 1e12, 'PH/s': 1e15 },
      defaultUnit: 'TH/s',
      geckoId: 'digibyte',
      formatNetHash: function (h) {
        if (h >= 1e15) return (h / 1e15).toFixed(2) + ' PH/s';
        return (h / 1e12).toFixed(2) + ' TH/s';
      },
      rewardFn: null,
      deriveHashrate: function (diff, bt) { return diff * 4294967296 / bt; }
    },
    BCH: {
      name: 'Bitcoin Cash', symbol: 'BCH', blockTime: 600,
      units: { 'TH/s': 1e12, 'PH/s': 1e15, 'EH/s': 1e18 },
      defaultUnit: 'TH/s',
      geckoId: 'bitcoin-cash',
      formatNetHash: function (h) { return (h / 1e18).toFixed(2) + ' EH/s'; },
      rewardFn: function (h) {
        if (h === null) return null;
        var halvings = Math.floor(h / 210000);
        return halvings >= 64 ? 0 : 50 / Math.pow(2, halvings);
      },
      deriveHashrate: function (diff, bt) { return diff * 4294967296 / bt; }
    }
  };

  var state = {
    coin: '',
    networkHashrate: 0,
    difficulty: 0,
    blockHeight: null,
    blockReward: null,
    price: null,
    hasPrice: false,
    userHashrate: 1,
    unit: 'TH/s'
  };

  /* ---------- Utilities ---------- */

  function debounce(fn, ms) {
    var timer;
    return function () { clearTimeout(timer); timer = setTimeout(fn, ms); };
  }

  function fmt(n) {
    if (!isFinite(n)) return 'N/A';
    var rounded = Math.round(n);
    var s = rounded < 1e20 ? String(rounded) : rounded.toFixed(0);
    var out = '';
    for (var i = s.length - 1, c = 0; i >= 0; i--, c++) {
      if (c > 0 && c % 3 === 0) out = '\u2005' + out;
      out = s[i] + out;
    }
    return out;
  }

  function coinConf() { return COINS[state.coin]; }

  function userHs() {
    var conf = coinConf();
    return state.userHashrate * (conf.units[state.unit] || 1);
  }

  function isFiniteNum(n) {
    return typeof n === 'number' && isFinite(n);
  }

  function share() {
    return state.networkHashrate > 0 ? userHs() / state.networkHashrate : 0;
  }

  function probability(seconds) {
    var conf = coinConf();
    var lam = (seconds / conf.blockTime) * share();
    if (lam < 1e-10) return lam;
    return 1 - Math.exp(-lam);
  }

  function getReward() {
    if (state.blockReward !== null) return state.blockReward;
    var conf = coinConf();
    if (conf.rewardFn) return conf.rewardFn(state.blockHeight);
    return null;
  }

  function formatProb(p) {
    if (p <= 0) return '0%';
    if (p >= 0.9999) return '> 99.99%';
    var pct = p * 100;
    if (pct >= 1) return pct.toFixed(2) + '%';
    if (pct >= 0.01) return pct.toFixed(4) + '%';
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
    if (d >= 1e6) return (d / 1e6).toFixed(2) + ' M';
    return fmt(d);
  }

  function $(id) { return document.getElementById(id); }

  function set(id, txt) {
    var el = $(id);
    if (el) el.textContent = txt;
  }

  /* ---------- Render ---------- */

  function render() {
    var conf = coinConf();
    if (!conf) return;
    var s = share();

    set('label-price', conf.symbol + ' Price');
    set('tagline', 'What are your chances of mining a ' + conf.name + ' block?');

    if (s === 0 || state.networkHashrate === 0) {
      set('odds-value', 'Waiting for network data\u2026');
      set('expected-time', '');
      ['prob-1d', 'prob-1w', 'prob-1m', 'prob-1y'].forEach(function (id) { set(id, '--'); });
      set('stat-hashrate', state.networkHashrate > 0 ? conf.formatNetHash(state.networkHashrate) : '--');
      set('stat-difficulty', state.difficulty > 0 ? formatDiff(state.difficulty) : '--');
      set('stat-blockheight', state.blockHeight !== null ? fmt(state.blockHeight) : '--');
      var rw = getReward();
      set('stat-reward', rw !== null ? rw + ' ' + conf.symbol : '--');
      set('stat-price', state.hasPrice ? '$' + fmt(state.price) : '--');
      set('stat-revenue', '--');
      return;
    }

    set('odds-value', '1 in ' + fmt(1 / s));
    set('expected-time', formatTime(conf.blockTime / s));

    set('prob-1d', formatProb(probability(DAY)));
    set('prob-1w', formatProb(probability(WEEK)));
    set('prob-1m', formatProb(probability(MONTH)));
    set('prob-1y', formatProb(probability(YEAR)));

    var reward = getReward();
    set('stat-hashrate', conf.formatNetHash(state.networkHashrate));
    set('stat-difficulty', formatDiff(state.difficulty));
    set('stat-blockheight', state.blockHeight !== null ? fmt(state.blockHeight) : 'N/A');
    set('stat-reward', reward !== null ? reward + ' ' + conf.symbol : 'N/A');
    set('stat-price', state.hasPrice ? '$' + fmt(state.price) : 'N/A');
    set('stat-revenue', (reward !== null && state.hasPrice) ? '$' + fmt(reward * state.price) : 'N/A');
  }

  function showPulse(on) {
    var el = $('refresh-indicator');
    if (el) el.style.display = on ? '' : 'none';
  }

  /* ---------- Fetch helpers ---------- */

  function fetchWithTimeout(url, ms) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, ms || FETCH_TIMEOUT);
    return fetch(url, { signal: controller.signal }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('http-' + r.status);
      return r;
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  function fetchJson(url) {
    return fetchWithTimeout(url).then(function (r) { return r.json(); });
  }

  function fetchText(url) {
    return fetchWithTimeout(url).then(function (r) { return r.text(); });
  }

  // Run an array of fetcher functions in order; stop at the first that succeeds
  function tryInOrder(fns) {
    var i = 0;
    function next() {
      if (i >= fns.length) return Promise.resolve(false);
      var fn = fns[i++];
      return fn().then(function () { return true; }, function () { return next(); });
    }
    return next();
  }

  /* ---------- Network state cache ---------- */

  function cacheNetworkState() {
    try {
      localStorage.setItem('sm_net_' + state.coin, JSON.stringify({
        networkHashrate: state.networkHashrate,
        difficulty: state.difficulty,
        blockHeight: state.blockHeight,
        blockReward: state.blockReward,
        price: state.price,
        ts: Date.now()
      }));
    } catch (e) {}
  }

  function loadCachedNetworkState(coin) {
    try {
      var raw = localStorage.getItem('sm_net_' + coin);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (Date.now() - d.ts > CACHE_MAX_AGE) return;
      if (isFiniteNum(d.networkHashrate) && d.networkHashrate > 0) state.networkHashrate = d.networkHashrate;
      if (isFiniteNum(d.difficulty) && d.difficulty > 0) state.difficulty = d.difficulty;
      if (isFiniteNum(d.blockHeight)) state.blockHeight = d.blockHeight;
      if (isFiniteNum(d.blockReward)) state.blockReward = d.blockReward;
      if (isFiniteNum(d.price) && d.price > 0) { state.price = d.price; state.hasPrice = true; }
    } catch (e) {}
  }

  /* ---------- Shared fetcher: Minerstat ---------- */

  function applyMinerstat(data, algoFilter) {
    if (!Array.isArray(data) || data.length === 0) throw new Error('empty minerstat');
    var coin = data[0];
    if (algoFilter) {
      for (var i = 0; i < data.length; i++) {
        if (data[i].algorithm === algoFilter) { coin = data[i]; break; }
      }
    }
    var got = false;
    if (isFiniteNum(coin.network_hashrate) && coin.network_hashrate > 0) {
      state.networkHashrate = coin.network_hashrate; got = true;
    }
    if (isFiniteNum(coin.difficulty) && coin.difficulty > 0) state.difficulty = coin.difficulty;
    if (isFiniteNum(coin.reward) && coin.reward > 0) state.blockReward = coin.reward;
    // Stash Minerstat price as localStorage fallback
    if (isFiniteNum(coin.price) && coin.price > 0) {
      try { localStorage.setItem('cached_' + state.coin + '_price', String(coin.price)); } catch (e) {}
    }
    if (!got) throw new Error('no hashrate from minerstat');
  }

  function fetchMinerstat(coinId, algoFilter) {
    return fetchJson('https://api.minerstat.com/v2/coins?list=' + coinId).then(function (data) {
      applyMinerstat(data, algoFilter);
    });
  }

  /* ---------- Shared fetcher: Blockchair ---------- */

  function applyBlockchair(data) {
    if (!data || !data.data) throw new Error('bad blockchair');
    var d = data.data;
    var conf = coinConf();
    var got = false;
    if (isFiniteNum(d.difficulty) && d.difficulty > 0) state.difficulty = d.difficulty;
    if (d.hashrate_24h) {
      var hr = parseFloat(d.hashrate_24h);
      if (isFiniteNum(hr) && hr > 0) { state.networkHashrate = hr; got = true; }
    }
    // Derive hashrate from difficulty if API didn't give one
    if (!got && state.difficulty > 0 && conf.deriveHashrate) {
      state.networkHashrate = conf.deriveHashrate(state.difficulty, conf.blockTime);
      got = true;
    }
    if (isFiniteNum(d.best_block_height)) state.blockHeight = d.best_block_height;
    if (isFiniteNum(d.reward_per_block)) state.blockReward = d.reward_per_block;
    if (!got) throw new Error('no hashrate from blockchair');
  }

  function fetchBlockchair(slug) {
    return fetchJson('https://api.blockchair.com/' + slug + '/stats').then(applyBlockchair);
  }

  /* ---------- BTC network (mempool → Blockchair → Minerstat) ---------- */

  function fetchBTC_mempool() {
    return Promise.allSettled([
      fetchJson('https://mempool.space/api/v1/mining/hashrate/1m'),
      fetchText('https://mempool.space/api/blocks/tip/height')
    ]).then(function (res) {
      var got = false;
      if (res[0].status === 'fulfilled') {
        var v = res[0].value;
        if (isFiniteNum(v.currentHashrate) && v.currentHashrate > 0) { state.networkHashrate = v.currentHashrate; got = true; }
        if (isFiniteNum(v.currentDifficulty)) state.difficulty = v.currentDifficulty;
      }
      if (res[1].status === 'fulfilled') {
        var h = parseInt(res[1].value, 10);
        if (isFiniteNum(h) && h >= 0) state.blockHeight = h;
      }
      if (!got) throw new Error('no BTC data from mempool');
    });
  }

  function fetchNetworkBTC() {
    return tryInOrder([
      fetchBTC_mempool,
      function () { return fetchBlockchair('bitcoin'); },
      function () { return fetchMinerstat('BTC'); }
    ]);
  }

  /* ---------- XMR network (Minerstat → Blockchair) ---------- */

  function fetchNetworkXMR() {
    return tryInOrder([
      function () { return fetchMinerstat('XMR'); },
      function () { return fetchBlockchair('monero'); }
    ]);
  }

  /* ---------- DGB network (Minerstat → Blockchair) ---------- */

  function fetchNetworkDGB() {
    return tryInOrder([
      function () { return fetchMinerstat('DGB', 'SHA-256d'); },
      function () { return fetchBlockchair('digibyte'); }
    ]);
  }

  /* ---------- BCH network (Minerstat → Blockchair) ---------- */

  function fetchNetworkBCH() {
    return tryInOrder([
      function () { return fetchMinerstat('BCH'); },
      function () { return fetchBlockchair('bitcoin-cash'); }
    ]);
  }

  var NETWORK_FNS = {
    BTC: fetchNetworkBTC,
    XMR: fetchNetworkXMR,
    DGB: fetchNetworkDGB,
    BCH: fetchNetworkBCH
  };

  /* ---------- Price (CoinGecko → CoinCap → cache) ---------- */

  function fetchPrice() {
    var conf = coinConf();
    if (!conf) return Promise.resolve();
    var cacheKey = 'cached_' + state.coin + '_price';

    function applyPrice(p) {
      state.price = p;
      state.hasPrice = true;
      try { localStorage.setItem(cacheKey, String(p)); } catch (e) {}
    }

    return fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=' + conf.geckoId + '&vs_currencies=usd')
      .then(function (data) {
        var p = data && data[conf.geckoId] && data[conf.geckoId].usd;
        if (isFiniteNum(p) && p > 0) { applyPrice(p); return; }
        throw new Error('no gecko price');
      })
      .catch(function () {
        return fetchJson('https://api.coincap.io/v2/assets/' + conf.geckoId)
          .then(function (data) {
            var p = data && data.data && parseFloat(data.data.priceUsd);
            if (isFiniteNum(p) && p > 0) { applyPrice(p); return; }
            throw new Error('no coincap price');
          });
      })
      .catch(function () {
        // Final fallback: localStorage (may have been set by Minerstat or a prior session)
        try {
          var c = parseFloat(localStorage.getItem(cacheKey));
          if (isFiniteNum(c) && c > 0) { state.price = c; state.hasPrice = true; }
        } catch (e) {}
      });
  }

  /* ---------- Fetch orchestrator ---------- */

  function fetchData() {
    showPulse(true);
    var fn = NETWORK_FNS[state.coin] || function () { return Promise.resolve(); };
    return Promise.allSettled([fn(), fetchPrice()]).then(function () {
      cacheNetworkState();
      showPulse(false);
    });
  }

  /* ---------- Persistence ---------- */

  function save() {
    try {
      localStorage.setItem('sm_hashrate_' + state.coin, String(state.userHashrate));
      localStorage.setItem('sm_unit_' + state.coin, state.unit);
      localStorage.setItem('sm_coin', state.coin);
    } catch (e) {}
  }

  /* ---------- Coin switching ---------- */

  function switchCoin(coin) {
    if (!COINS[coin] || coin === state.coin) return;
    state.coin = coin;
    state.networkHashrate = 0;
    state.difficulty = 0;
    state.blockHeight = null;
    state.blockReward = null;
    state.price = null;
    state.hasPrice = false;

    var conf = COINS[coin];

    // Restore per-coin user prefs
    try {
      var h = localStorage.getItem('sm_hashrate_' + coin);
      state.userHashrate = h ? (parseFloat(h) || 1) : 1;
      var u = localStorage.getItem('sm_unit_' + coin);
      state.unit = (u && conf.units[u]) ? u : conf.defaultUnit;
    } catch (e) {
      state.userHashrate = 1;
      state.unit = conf.defaultUnit;
    }

    // Load cached network state for instant display
    loadCachedNetworkState(coin);

    // Update input
    var input = $('hashrate-input');
    var select = $('unit-select');
    if (input) input.value = state.userHashrate;

    // Rebuild unit dropdown
    if (select) {
      select.innerHTML = '';
      var units = Object.keys(conf.units);
      for (var i = 0; i < units.length; i++) {
        var opt = document.createElement('option');
        opt.value = units[i];
        opt.textContent = units[i];
        select.appendChild(opt);
      }
      select.value = state.unit;
    }

    // Update tabs
    document.querySelectorAll('.coin-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.coin === coin);
    });

    // Algo note
    var noteEl = $('algo-note');
    if (noteEl) {
      noteEl.textContent = conf.algoNote || '';
      noteEl.style.display = conf.algoNote ? '' : 'none';
    }

    save();
    render(); // Render immediately with cached data
    fetchData().then(render); // Then refresh with live data
  }

  /* ---------- Init ---------- */

  function init() {
    var savedCoin = 'BTC';
    try { savedCoin = localStorage.getItem('sm_coin') || 'BTC'; } catch (e) {}
    if (!COINS[savedCoin]) savedCoin = 'BTC';

    var input = $('hashrate-input');
    var select = $('unit-select');

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

    document.querySelectorAll('.coin-tab').forEach(function (t) {
      t.addEventListener('click', function () { switchCoin(t.dataset.coin); });
    });

    switchCoin(savedCoin);
    setInterval(function () { fetchData().then(render); }, 300000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
