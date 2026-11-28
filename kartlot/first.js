/* Kartlot – první minuta: nový hráč jede hned (1 klik), návod v prvním zápase, denní odměna až po prvním zápase */
(function () {
  var K = function () { return window.__KL; }, C = function () { return window.__ck; };
  var $ = function (s) { return document.querySelector(s); };
  var mob = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  function fresh() { try { return !(K().Z().games > 0); } catch (e) { return false; } }
  function cs() { try { return K().cs(); } catch (e) { return false; } }

  /* 1) PLAY u nového hráče = rovnou bitva (bez výběru režimu a arény) */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#playBtn');
    if (!b || !K() || !C() || !fresh()) return;
    e.stopImmediatePropagation(); e.preventDefault();
    try { var Z = K().Z(), n = $('#nameIn'); if (n && n.value.trim()) Z.name = n.value.trim().slice(0, 14); K().save(); } catch (x) {}
    try { K().snd('click'); } catch (x) {}
    C().startMatch();
  }, true);

  /* 2) denní odměna se novému hráči ukáže až po prvním zápase */
  setInterval(function () {
    var d = $('#daily');
    if (d && d.classList.contains('on') && K() && fresh() && $('#menu.on')) d.classList.remove('on');
  }, 150);

  /* 3) nápověda v prvních dvou zápasech */
  var css = document.createElement('style');
  css.textContent = '#tipX{position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:40;pointer-events:none;text-align:center;' +
    'background:rgba(20,14,50,.82);border:3px solid #ffd34d;border-radius:18px;padding:12px 20px;color:#fff;font:600 17px/1.35 Nunito,system-ui,sans-serif;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.5);max-width:min(88vw,520px);transition:opacity .5s}' +
    '#tipX b{display:block;font-family:"Lilita One",sans-serif;font-weight:400;font-size:24px;color:#ffd34d;margin-bottom:4px}' +
    '#tipX.off{opacity:0}@media (max-height:500px){#tipX{top:12%;font-size:14px;padding:8px 14px}#tipX b{font-size:19px}}';
  document.head.appendChild(css);
  var shown = 0, lastState = '', tEl = null, timers = [];
  function tip(h, t, ms) {
    if (!tEl) { tEl = document.createElement('div'); tEl.id = 'tipX'; document.body.appendChild(tEl); }
    tEl.innerHTML = '<b>' + h + '</b>' + t; tEl.classList.remove('off');
    timers.push(setTimeout(function () { tEl && tEl.classList.add('off'); }, ms));
  }
  function clear() { timers.forEach(clearTimeout); timers = []; if (tEl) tEl.classList.add('off'); }
  setInterval(function () {
    if (!C()) return;
    var st = C().state();
    if (st !== lastState) {
      if (st === 'play' && shown < 2) {
        var g = 0; try { g = K().Z().games; } catch (e) {}
        if (g < 2) {
          shown++; var c = cs();
          var ctrl = mob ? (c ? 'Joystick vlevo = jízda · tlačítko vpravo = střelba' : 'Left joystick = drive · right button = fire')
                         : (c ? 'W A S D / šipky = jízda · MEZERNÍK = střelba' : 'W A S D / arrows = drive · SPACE = fire');
          timers.push(setTimeout(function () { tip(c ? 'Ovládání' : 'Controls', ctrl, 5500); }, 300));
        }
      } else if (st !== 'play') clear();
      lastState = st;
    }
  }, 250);
})();
