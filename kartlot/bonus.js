/* Kartlot – po zápase: „2× mince" za dobrovolnou reklamu s odměnou */
(function () {
  var P = window.KL_PORTAL, ok = window.CRAZY || P === 'playgama' || P === 'gamepix' || P === 'gamedistribution';
  if (!ok) return;
  var K = function () { return window.__KL; }, $ = function (s) { return document.querySelector(s); };
  var c0 = null, wasRes = false, busy = false;
  var css = document.createElement('style');
  css.textContent = '#bonus2x{margin:0 0 0 8px;padding:4px 12px;min-height:0;display:inline-block;vertical-align:middle;border-radius:999px;background:linear-gradient(180deg,#ffd34d,#e89a00);color:#3a2200;font-size:15px;line-height:1.3;animation:b2x 1.2s infinite}@keyframes b2x{50%{transform:scale(1.06)}}#bonus2x[disabled]{animation:none;opacity:.6}';
  document.head.appendChild(css);
  function on(id) { var e = $('#' + id); return e && e.classList.contains('on'); }
  setInterval(function () {
    if (!K()) return;
    var Z; try { Z = K().Z(); } catch (e) { return; }
    if (on('hud')) { if (c0 === null) c0 = Z.coins; wasRes = false; return; }
    var res = on('results');
    if (res && !wasRes) {
      wasRes = true;
      var got = c0 === null ? 0 : Z.coins - c0; c0 = null;
      var rb = $('#resReward b'), d = rb ? parseInt((rb.textContent.match(/\d+/) || [0])[0], 10) : 0;
      if (!(got > 0)) d = 0; d = Math.min(d, got);
      var old = $('#bonus2x'); if (old) old.remove();
      if (d <= 0) return;
      var cs = K().cs(), b = document.createElement('button');
      b.className = 'btn'; b.id = 'bonus2x';
      b.textContent = '📺 ' + (cs ? '2× (+' : '2× (+') + d + ')';
      b.title = cs ? 'Zhlédni reklamu a získej mince znovu' : 'Watch an ad to get the coins again';
      rb.parentNode.insertBefore(b, rb.nextSibling);
      b.onclick = function () {
        if (busy) return; busy = true; b.disabled = true;
        var done = function (g) {
          busy = false; try { K().mute(false); } catch (e) {}
          if (g) { var Z2 = K().Z(); Z2.coins += d; K().save(); try { K().refresh(); K().snd('buy'); K().fx('+' + d + ' 🪙', '#ffd34d'); } catch (e) {} b.remove(); }
          else { b.textContent = cs ? 'Reklama teď není k dispozici' : 'No ad available right now'; setTimeout(function () { b.remove(); }, 1800); }
        };
        try {
          window.CrazyGames.SDK.ad.requestAd('rewarded', {
            adStarted: function () { try { K().mute(true); } catch (e) {} },
            adFinished: function () { done(true); }, adError: function () { done(false); }
          });
        } catch (e) { done(false); }
      };
    } else if (!res) { wasRes = false; var o = $('#bonus2x'); if (o && !busy) o.remove(); }
  }, 300);
})();
