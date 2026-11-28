/* Kartlot – Kolo štěstí: 1 točení zdarma každé 4 hodiny */
(function () {
  var CD = 4 * 3600 * 1000;
  var SEG = [ // mince, váha, barva
    [50, 22, '#3d7be0'], [100, 18, '#e0503d'], [75, 20, '#2fb36b'], [200, 11, '#9b5de5'],
    [60, 20, '#3d7be0'], [300, 6, '#e0503d'], [150, 14, '#2fb36b'], [1000, 2, '#ffb400']
  ];
  var N = SEG.length, spinning = false, rot = 0;
  var K = function () { return window.__KL; };
  var cs = function () { try { return K().cs(); } catch (e) { return false; } };
  var left = function () { var Z = K().Z(); return Math.max(0, (Z.wheelT || 0) + CD - Date.now()); };
  var fmt = function (ms) { var s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  var $ = function (s) { return document.querySelector(s); };

  var css = document.createElement('style');
  css.textContent =
    '#menu .row2{grid-template-columns:1.3fr 1fr 1fr .8fr}' +
    '.sbtn.whl{background:linear-gradient(180deg,#ff6fb5,#c2307a);position:relative}' +
    '.sbtn.whl.ready::after{content:"";position:absolute;top:6px;right:8px;width:11px;height:11px;border-radius:50%;background:#ffe14d;box-shadow:0 0 0 2px #fff,0 0 12px #ffe14d;animation:whlP 1s infinite}' +
    '@keyframes whlP{50%{transform:scale(1.35)}}' +
    '#wheelM .wbox{position:relative;width:min(78vw,52vh,320px);aspect-ratio:1;margin:4px auto 2px;max-width:100%}' +
    '#wheelM svg{width:100%;height:100%;display:block;transition:transform 4.2s cubic-bezier(.12,.8,.18,1);filter:drop-shadow(0 8px 18px rgba(0,0,0,.5))}' +
    '#wheelM .ptr{position:absolute;left:50%;top:-6px;transform:translateX(-50%);width:0;height:0;border-left:16px solid transparent;border-right:16px solid transparent;border-top:30px solid #ffd34d;filter:drop-shadow(0 3px 2px rgba(0,0,0,.6));z-index:2}' +
    '#wheelM .hub{position:absolute;left:50%;top:50%;width:18%;height:18%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(#fff6c0,#e8a800);border:3px solid #8a6200;display:flex;align-items:center;justify-content:center;font-size:min(6vw,24px)}' +
    '#wheelM .wt{font-size:15px;opacity:.85;min-height:20px}' +
    '@media (max-height:500px){#wheelM .card{padding:10px;gap:4px}#wheelM #whT{font-size:22px!important;line-height:1.1}}' +
    '#wheelM .row{display:flex;gap:10px;justify-content:center}';
  document.head.appendChild(css);

  function svg() {
    var r = 100, a = 2 * Math.PI / N, h = '<svg viewBox="-104 -104 208 208"><circle r="103" fill="#ffd34d"/><circle r="100" fill="#1a1338"/>';
    for (var i = 0; i < N; i++) {
      var a0 = i * a - Math.PI / 2 - a / 2, a1 = a0 + a;
      h += '<path d="M0 0L' + (r * Math.cos(a0)).toFixed(2) + ' ' + (r * Math.sin(a0)).toFixed(2) + 'A' + r + ' ' + r + ' 0 0 1 ' +
        (r * Math.cos(a1)).toFixed(2) + ' ' + (r * Math.sin(a1)).toFixed(2) + 'Z" fill="' + SEG[i][2] + '" stroke="#ffd34d" stroke-width="1.5"/>';
      var deg = i * 360 / N;
      var flip = deg > 90 && deg < 270, ty = function (y) { return flip ? '<g transform="translate(0,' + y + ') rotate(180)">' : '<g transform="translate(0,' + y + ')">'; };
      h += '<g transform="rotate(' + deg + ')">' + ty(-62) + '<text x="0" y="' + (flip ? 7 : 0) + '" text-anchor="middle" font-family="Lilita One,sans-serif" font-size="' +
        (SEG[i][0] >= 1000 ? 17 : 20) + '" fill="#fff" stroke="rgba(0,0,0,.45)" stroke-width="3" paint-order="stroke">' + SEG[i][0] +
        '</text></g>' + ty(-40) + '<text x="0" y="' + (flip ? 5 : 0) + '" text-anchor="middle" font-size="15">🪙</text></g></g>';
    }
    return h + '</svg>';
  }

  function build() {
    if ($('#wheelM')) return;
    var m = document.createElement('div');
    m.id = 'wheelM'; m.className = 'modal';
    m.innerHTML = '<div class="card"><div class="t" id="whT" style="font-size:30px;color:#ffd34d"></div><div class="wbox"><div class="ptr"></div><div id="whS">' + svg() +
      '</div><div class="hub">🏰</div></div><div class="wt" id="whInfo"></div><div class="row"><button class="btn gold" id="whGo"></button><button class="btn gray" id="whX">✖</button></div></div>';
    document.body.appendChild(m);
    $('#whX').onclick = function () { if (!spinning) m.classList.remove('on'); };
    m.addEventListener('click', function (e) { if (e.target === m && !spinning) m.classList.remove('on'); });
    $('#whGo').onclick = spin;
  }

  function pick() {
    var tot = 0, i; for (i = 0; i < N; i++) tot += SEG[i][1];
    var x = Math.random() * tot; for (i = 0; i < N; i++) { x -= SEG[i][1]; if (x < 0) return i; } return 0;
  }

  function spin() {
    if (spinning || left() > 0) return;
    var Z = K().Z(), i = pick(), win = SEG[i][0];
    spinning = true;
    Z.wheelT = Date.now(); Z.coins += win; K().save(); /* uloženo hned – zavření nic nezkazí */
    try { K().snd('open'); } catch (e) {}
    var base = rot - (rot % 360) + 360 * 6, target = base + (360 - i * 360 / N) + (Math.random() * 30 - 15);
    rot = target;
    $('#whS svg').style.transform = 'rotate(' + rot + 'deg)';
    render();
    setTimeout(function () {
      spinning = false;
      try { K().snd('buy'); K().refresh(); K().fx('+' + win + ' 🪙', '#ffd34d'); } catch (e) {}
      $('#whInfo').textContent = (cs() ? 'Vyhrál jsi ' : 'You won ') + win + ' 🪙!';
      render(true);
    }, 4300);
  }

  function render(keepInfo) {
    if (!$('#wheelM')) return;
    var l = left(), c = cs();
    $('#whT').textContent = c ? 'Kolo štěstí' : 'Lucky Wheel';
    var b = $('#whGo');
    b.disabled = spinning || l > 0;
    b.style.opacity = b.disabled ? .55 : 1;
    b.textContent = spinning ? '…' : l > 0 ? (c ? 'ZA ' : 'IN ') + fmt(l) : (c ? 'ROZTOČIT ZDARMA' : 'FREE SPIN');
    if (!keepInfo && !spinning) $('#whInfo').textContent = l > 0 ? (c ? 'Další točení zdarma každé 4 hodiny' : 'Free spin every 4 hours') : (c ? 'Až 1000 🪙 zdarma!' : 'Win up to 1000 🪙 free!');
  }

  function tick() {
    if (!K()) return;
    var btn = $('#whlBtn');
    if (!btn) {
      var row = $('#menu .row2'); if (!row) return;
      btn = document.createElement('button'); btn.className = 'sbtn whl'; btn.id = 'whlBtn';
      btn.innerHTML = '<b>🎡</b><span id="whlTxt"></span><small id="whlCnt"></small>';
      row.insertBefore(btn, $('#credBtn'));
      btn.onclick = function () { build(); render(); $('#wheelM').classList.add('on'); try { K().snd('open'); } catch (e) {} };
    }
    var l = left(), c = cs();
    $('#whlTxt').textContent = c ? 'KOLO' : 'SPIN';
    $('#whlCnt').textContent = l > 0 ? fmt(l) : (c ? 'ZDARMA!' : 'FREE!');
    btn.classList.toggle('ready', l <= 0);
    var wm = $('#wheelM');
    if (wm && wm.classList.contains('on')) { var mn = $('#menu'); if (mn && !mn.classList.contains('on') && !spinning) wm.classList.remove('on'); else render(true); }
  }
  setInterval(tick, 1000);
})();
