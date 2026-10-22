// 이미지 포맷 길잡이: 논문 원자료(paper-results.js)만으로 추천과 예상 용량을 계산한다.
(function () {
  'use strict';
  var P = window.PAPER;
  var $ = function (id) { return document.getElementById(id); };
  var FORMATS = ['webp', 'avif'];
  var NAME = { jpeg: 'JPEG', webp: 'WebP', avif: 'AVIF' };
  var KIND = { screen: '화면 캡처', photo: '사진' };
  var KIND_OBJ = { screen: '화면 캡처를', photo: '사진을' };
  var MAX_FILE = 30 * 1024 * 1024; // 30MB
  var CROP_W = 640, CROP_H = 400;   // 논문과 같은 가운데 영역
  var state = { kind: 'screen', q: '0.95', bytes: null, measured: null };

  function pct(x) { return Math.round(x * 100) + '%'; }
  function pct1(x) { return (Math.round(x * 1000) / 10) + '%'; }
  function cond(kind, fmt, q) { return P.conditions[kind + '|' + fmt + '|' + q]; }
  function fmtBytes(b) {
    if (!isFinite(b)) return '-';
    if (b >= 1048576) return (b / 1048576).toFixed(b >= 10485760 ? 1 : 2) + ' MB';
    if (b >= 1024) return Math.round(b / 1024).toLocaleString('ko-KR') + ' KB';
    return Math.round(b) + ' B';
  }
  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- 결과 그리기 ----------
  function render() {
    var k = state.kind, q = state.q;
    var c = { webp: cond(k, 'webp', q), avif: cond(k, 'avif', q) };
    var best = c.avif.median >= c.webp.median ? 'avif' : 'webp';
    var other = best === 'avif' ? 'webp' : 'avif';

    $('pick').textContent = NAME[best];
    $('headline').textContent = KIND_OBJ[k] + ' SSIM ' + q + ' 화질로 저장하면, 같은 화질의 JPEG보다 ' +
      NAME[best] + '가 약 ' + pct(c[best].median) + ', ' + NAME[other] + '가 약 ' + pct(c[other].median) + ' 작습니다.';
    $('range').textContent = '논문 ' + KIND[k] + ' ' + c[best].n + '장의 중앙값입니다. 가운데 절반은 ' +
      NAME[best] + ' ' + pct(c[best].p25) + '~' + pct(c[best].p75) + ' 사이였습니다.';

    // JPEG를 100으로 둔 남는 크기 막대
    var bars = $('bars'); bars.textContent = '';
    [['jpeg', 1], ['webp', 1 - c.webp.median], ['avif', 1 - c.avif.median]].forEach(function (r) {
      var row = el('div', { 'class': 'bar' + (r[0] === best ? ' best' : '') });
      row.appendChild(el('b', null, NAME[r[0]]));
      var track = el('div', { 'class': 'track', 'aria-hidden': 'true' });
      var fill = el('div', { 'class': 'fill' }); fill.style.width = Math.max(0, Math.min(1, r[1])) * 100 + '%';
      track.appendChild(fill); row.appendChild(track);
      row.appendChild(el('span', { 'class': 'v' }, r[0] === 'jpeg' ? '100 기준' : Math.round(r[1] * 100) + ' 남음'));
      bars.appendChild(row);
    });

    // 예상 용량
    var est = $('est');
    if (state.bytes) {
      est.hidden = false; est.textContent = '';
      est.appendChild(el('p', null, 'JPEG ' + fmtBytes(state.bytes) + '일 때 예상 용량 (중앙값, 가운데 절반 범위)'));
      FORMATS.forEach(function (f) {
        var p = el('p');
        p.appendChild(document.createTextNode(NAME[f] + ': '));
        p.appendChild(el('span', { 'class': 'v' }, '약 ' + fmtBytes(state.bytes * (1 - c[f].median))));
        p.appendChild(document.createTextNode(' (' + fmtBytes(state.bytes * (1 - c[f].p75)) + '~' + fmtBytes(state.bytes * (1 - c[f].p25)) + ')'));
        est.appendChild(p);
      });
    } else { est.hidden = true; }

    // 내 화면 캡처와 '한 색 비율'이 비슷한 논문 이미지 5장
    var near = $('near');
    if (state.measured && k === 'screen') {
      var d = state.measured.dominant;
      var pool = P.screenImages.slice().sort(function (a, b) { return Math.abs(a.dominant - d) - Math.abs(b.dominant - d); }).slice(0, 5);
      var m = median(pool.map(function (x) { return x.saving[best + '|' + q]; }));
      var lo = Math.min.apply(null, pool.map(function (x) { return x.dominant; }));
      var hi = Math.max.apply(null, pool.map(function (x) { return x.dominant; }));
      near.hidden = false; near.textContent = '';
      var p1 = el('p', { style: 'margin:0 0 4px' });
      p1.appendChild(document.createTextNode('내 이미지와 가장 많은 한 색 비율이 비슷한(' + pct(lo) + '~' + pct(hi) + ') 논문 화면 캡처 5장에서는 ' + NAME[best] + '가 '));
      p1.appendChild(el('b', null, '약 ' + pct(m)));
      p1.appendChild(document.createTextNode(' 작았습니다.'));
      near.appendChild(p1);
      near.appendChild(el('p', { style: 'margin:0;color:var(--sub);font-size:13.5px' },
        '논문에서 화면 캡처의 AVIF 절감률은 한 색 비율이 높을수록 컸습니다(상관계수 0.68~0.77).'));
    } else { near.hidden = true; }

    // 논문에서 나온 주의점
    var notes = $('notes'); notes.textContent = '';
    if (c.webp.negative > 0) {
      notes.appendChild(el('li', { 'class': 'warn' }, '이 조건에서 WebP는 ' + c.webp.n + '장 중 ' + c.webp.negative + '장이 오히려 JPEG보다 컸습니다. WebP를 쓴다면 저장 후 크기를 꼭 비교하세요.'));
    }
    if (c[best].floor > 0) {
      notes.appendChild(el('li', null, c[best].n + '장 중 ' + c[best].floor + '장은 품질 1에서도 목표 화질을 넘어 실제 절감률을 정확히 재지 못했습니다.'));
    }
    if (best === 'avif') {
      notes.appendChild(el('li', null, 'AVIF는 저장(인코딩)이 JPEG보다 약 ' + P.paper.avifSlower + '배 느렸습니다. 이미지가 아주 많다면 WebP도 함께 고려하세요.'));
    }
    if (k === 'photo') {
      notes.appendChild(el('li', null, '사진은 화질을 바꿔도 절감률 차이가 2%p 안팎이었습니다.'));
    } else {
      notes.appendChild(el('li', null, '화면 캡처는 화질을 높일수록 절감률이 커졌습니다(SSIM 0.90 → 0.98).'));
    }
  }

  function renderTable() {
    var t = $('table');
    var head = el('tr');
    ['조건', 'WebP', 'AVIF'].forEach(function (h) { head.appendChild(el('th', { scope: 'col' }, h)); });
    var thead = el('thead'); thead.appendChild(head); t.appendChild(thead);
    var tb = el('tbody');
    ['screen', 'photo'].forEach(function (k) {
      ['0.90', '0.95', '0.98'].forEach(function (q) {
        var r = el('tr');
        r.appendChild(el('td', null, KIND[k] + ' · SSIM ' + q));
        r.appendChild(el('td', null, pct(cond(k, 'webp', q).median)));
        r.appendChild(el('td', null, pct(cond(k, 'avif', q).median)));
        tb.appendChild(r);
      });
    });
    t.appendChild(tb);
  }

  // ---------- 1단계: 종류 / 이미지 분석 ----------
  function setKind(k) {
    state.kind = k;
    $('k-' + k).checked = true;
    render();
  }

  function analyzeCanvas(src) {
    // 논문 select_screens.py와 같은 계산: 가운데 640x400, 가장 많은 한 색 비율, 가로 밝기 차 > 40 비율
    var w = src.width, h = src.height;
    var cw = Math.min(CROP_W, w), ch = Math.min(CROP_H, h);
    var cx = Math.floor((w - cw) / 2), cy = Math.floor((h - ch) / 2);
    var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    var g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); // 투명 부분은 흰색으로
    g.drawImage(src, cx, cy, cw, ch, 0, 0, cw, ch);
    var px = g.getImageData(0, 0, cw, ch).data;
    var counts = new Map(), top = 0, edges = 0, total = cw * ch, i, key, n, x, y, L, prev;
    for (i = 0; i < px.length; i += 4) {
      key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      n = (counts.get(key) || 0) + 1; counts.set(key, n);
      if (n > top) top = n;
    }
    for (y = 0; y < ch; y++) {
      prev = -1;
      for (x = 0; x < cw; x++) {
        i = (y * cw + x) * 4;
        L = (px[i] * 19595 + px[i + 1] * 38470 + px[i + 2] * 7471 + 0x8000) >> 16; // ITU-R 601-2 밝기
        if (prev >= 0 && Math.abs(L - prev) > 40) edges++;
        prev = L;
      }
    }
    return { dominant: top / total, edge: cw > 1 ? edges / (ch * (cw - 1)) : 0, w: w, h: h, cropped: w >= CROP_W && h >= CROP_H };
  }

  function showAnalysis(src, label) {
    var r = analyzeCanvas(src), R = P.screenRule;
    state.measured = r;
    var t = $('thumb').getContext('2d');
    t.fillStyle = '#fff'; t.fillRect(0, 0, 144, 90);
    var s = Math.min(144 / r.w, 90 / r.h);
    t.drawImage(src, (144 - r.w * s) / 2, (90 - r.h * s) / 2, r.w * s, r.h * s);

    var kind, lines = [];
    // 논문의 빈 화면 규칙(R2)은 화면 캡처 후보에 쓴 규칙이므로, 한 색 비율이 화면 캡처 범위일 때만 적용한다
    var blank = r.dominant >= R.blankDominant || (r.dominant >= R.dominantMin && r.edge < R.blankEdge);
    if (blank) {
      kind = 'screen';
      lines.push('가장 많은 한 색이 ' + pct1(r.dominant) + '로 거의 빈 화면입니다. 논문은 이런 화면을 실험에서 뺐기 때문에 결과가 맞지 않을 수 있습니다. 일단 ');
    } else if (r.dominant > R.dominantMax) {
      kind = 'screen';
      lines.push('가장 많은 한 색이 ' + pct1(r.dominant) + '로, 논문 화면 캡처 ' + R.n + '장의 최댓값(' + pct1(R.dominantMax) + ')보다 조금 높습니다. 가장 가까운 ');
    } else if (r.dominant >= R.dominantMin) {
      kind = 'screen';
      lines.push('가장 많은 한 색이 ' + pct1(r.dominant) + '를 차지합니다. 논문 화면 캡처 ' + R.n + '장(' + pct1(R.dominantMin) + '~' + pct1(R.dominantMax) + ')과 같은 범위라 ');
    } else {
      kind = 'photo';
      lines.push('가장 많은 한 색이 ' + pct1(r.dominant) + '입니다. 논문 화면 캡처 ' + R.n + '장은 모두 ' + pct1(R.dominantMin) + ' 이상이었으므로 ');
    }
    var v = $('verdict'); v.textContent = '';
    v.appendChild(document.createTextNode((label ? label + ': ' : '') + lines[0]));
    v.appendChild(el('b', null, KIND[kind] + ' 기준'));
    v.appendChild(document.createTextNode('으로 보여 드립니다. 다르다면 위에서 직접 바꾸세요.'));
    var m = '글자 윤곽 밀도 ' + (r.edge * 100).toFixed(1) + '%' + (r.cropped ? ' · 가운데 640×400 기준' : ' · 640×400보다 작아 전체 기준');
    $('metric').textContent = m;
    $('analysis').hidden = false;
    $('file-err').hidden = true;
    setKind(kind);
  }

  function fileError(msg) {
    var e = $('file-err'); e.textContent = msg; e.hidden = false;
  }

  function handleFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) { fileError('이미지 파일이 아닙니다. PNG·JPEG·WebP 같은 이미지 파일을 골라 주세요.'); return; }
    if (file.size > MAX_FILE) { fileError('30MB보다 큰 파일은 분석하지 않습니다. 더 작은 이미지를 골라 주세요.'); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth || !img.naturalHeight) { fileError('이미지 크기를 읽지 못했습니다. 다른 파일로 해 보세요.'); return; }
      try { showAnalysis(img, file.name); } catch (e) { fileError('이 이미지는 분석하지 못했습니다. 다른 파일로 해 보세요.'); }
    };
    img.onerror = function () { URL.revokeObjectURL(url); fileError('이미지를 열지 못했습니다. 파일이 손상됐거나 이 브라우저가 지원하지 않는 형식입니다.'); };
    img.src = url;
  }

  // 예시 이미지: 직접 그린 그림이며 실제 사람이나 시스템 정보가 없다
  function exampleScreen() {
    var c = document.createElement('canvas'); c.width = 900; c.height = 520;
    var g = c.getContext('2d');
    g.fillStyle = '#0f1720'; g.fillRect(0, 0, 900, 520);
    g.fillStyle = '#1b2633'; g.fillRect(0, 0, 900, 34);
    ['#ff5f57', '#febc2e', '#28c840'].forEach(function (col, i) { g.fillStyle = col; g.beginPath(); g.arc(22 + i * 22, 17, 6, 0, 7); g.fill(); });
    g.font = 'bold 15px monospace';
    var rows = [
      ['#7ee787', '$ sudo ss -tulpn | head -n 12'],
      ['#c9d1d9', 'Netid State  Recv-Q Send-Q  Local Address:Port   Peer Address:Port  Process'],
      ['#c9d1d9', 'udp   UNCONN 0      0       127.0.0.53%lo:53         0.0.0.0:*      users:(("resolved",pid=411))'],
      ['#c9d1d9', 'tcp   LISTEN 0      4096    127.0.0.53%lo:53         0.0.0.0:*      users:(("resolved",pid=411))'],
      ['#c9d1d9', 'tcp   LISTEN 0      128           0.0.0.0:22         0.0.0.0:*      users:(("sshd",pid=702))'],
      ['#c9d1d9', 'tcp   LISTEN 0      511           0.0.0.0:80         0.0.0.0:*      users:(("nginx",pid=815))'],
      ['#c9d1d9', 'tcp   LISTEN 0      70          127.0.0.1:3306       0.0.0.0:*      users:(("mysqld",pid=930))'],
      ['#7ee787', '$ sudo tail -n 6 /var/log/example/auth.log'],
      ['#ffa657', 'Oct 14 09:12:01 lab sshd[1203]: Failed password for invalid user test from 203.0.113.7'],
      ['#ffa657', 'Oct 14 09:12:04 lab sshd[1203]: Failed password for invalid user test from 203.0.113.7'],
      ['#c9d1d9', 'Oct 14 09:13:22 lab sshd[1210]: Accepted publickey for student from 198.51.100.4'],
      ['#c9d1d9', 'Oct 14 09:13:22 lab sshd[1210]: pam_unix(sshd:session): session opened for user student'],
      ['#79c0ff', 'Oct 14 09:15:40 lab sudo: student : TTY=pts/0 ; PWD=/home/student ; COMMAND=/usr/bin/ss'],
      ['#c9d1d9', 'Oct 14 09:16:02 lab CRON[1288]: (root) CMD (/usr/local/bin/check-disk.sh)'],
      ['#7ee787', '$ _']
    ];
    rows.forEach(function (l, i) { g.fillStyle = l[0]; g.fillText(l[1], 18, 66 + i * 29); });
    return c;
  }
  function examplePhoto() {
    var c = document.createElement('canvas'); c.width = 900; c.height = 520;
    var g = c.getContext('2d');
    var sky = g.createLinearGradient(0, 0, 0, 300); sky.addColorStop(0, '#5d8fc9'); sky.addColorStop(1, '#f2c48d');
    g.fillStyle = sky; g.fillRect(0, 0, 900, 300);
    var land = g.createLinearGradient(0, 300, 0, 520); land.addColorStop(0, '#4d6b3a'); land.addColorStop(1, '#2b3d22');
    g.fillStyle = land; g.fillRect(0, 300, 900, 220);
    var img = g.getImageData(0, 0, 900, 520), d = img.data, seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < d.length; i += 4) { var n = (rnd() - 0.5) * 36; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
    return c;
  }

  // ---------- 3단계: 용량 입력 ----------
  function readSize() {
    var typed = $('size').value.trim(), raw = typed.replace(/,/g, '');
    var err = $('size-err');
    if (typed === '') { state.bytes = null; err.hidden = true; render(); return; }
    var v = Number(raw);
    if (!/^\d*\.?\d+$/.test(raw) || !isFinite(v) || v <= 0) {
      state.bytes = null; err.textContent = '0보다 큰 숫자만 넣어 주세요. 예: 850 또는 1.5'; err.hidden = false; render(); return;
    }
    var bytes = v * Number($('unit').value);
    if (bytes > 100 * 1073741824) {
      state.bytes = null; err.textContent = '100GB보다 큰 값은 계산하지 않습니다. 단위를 확인해 주세요.'; err.hidden = false; render(); return;
    }
    err.hidden = true; state.bytes = bytes; render();
  }

  // ---------- 연결 ----------
  document.querySelectorAll('input[name=kind]').forEach(function (r) { r.addEventListener('change', function () { setKind(r.value); }); });
  document.querySelectorAll('input[name=q]').forEach(function (r) { r.addEventListener('change', function () { state.q = r.value; render(); }); });
  $('file').addEventListener('change', function (e) { handleFile(e.target.files && e.target.files[0]); e.target.value = ''; });
  $('ex-screen').addEventListener('click', function () { showAnalysis(exampleScreen(), '예시 터미널 화면'); });
  $('ex-photo').addEventListener('click', function () { showAnalysis(examplePhoto(), '예시 사진 같은 이미지'); });
  $('size').addEventListener('input', readSize);
  $('unit').addEventListener('change', readSize);
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('drag'); }); });
  ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('drag'); }); });
  drop.addEventListener('drop', function (e) { handleFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });

  renderTable();
  render();
})();
