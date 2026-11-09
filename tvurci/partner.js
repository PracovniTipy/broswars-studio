/* BrosWars Partner – sdílené pomocníky (RPC, kopírování, animace). */
(function(){
  "use strict";
  var BASE = "https://smjplqxwqyraphfeqsyk.supabase.co/rest/v1/rpc/";
  /* veřejný anon klíč projektu (stejný jako ve veřejném repu hry) – práva hlídá databáze */
  var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtanBscXh3cXlyYXBoZmVxc3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MjA3NzMsImV4cCI6MjEwODQ5Njc3M30.X6VUO5NSdJFG4E00aAALSDkW39JqANjQmk0dees_Q78";

  /* vrací {ok:true,data} | {ok:false,kind:'offline'|'unavailable'|'server', status} */
  function rpc(name, body){
    var ctl = "AbortController" in window ? new AbortController() : null;
    var timer = ctl ? setTimeout(function(){ ctl.abort(); }, 15000) : 0;
    return fetch(BASE + name, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY },
      body: JSON.stringify(body || {}),
      signal: ctl ? ctl.signal : undefined,
      cache: "no-store",
      referrerPolicy: "no-referrer"
    }).then(function(r){
      clearTimeout(timer);
      return r.text().then(function(t){
        var d = null; try{ d = t ? JSON.parse(t) : null; }catch(e){}
        if (r.ok) return { ok: true, data: d };
        /* funkce ještě neexistuje (migrace nenasazená) / schéma se načítá */
        if (r.status === 404 || (d && /PGRST202|PGRST002/.test(d.code || ""))) return { ok: false, kind: "unavailable", status: r.status };
        return { ok: false, kind: "server", status: r.status };
      });
    }, function(){ clearTimeout(timer); return { ok: false, kind: "offline" }; });
  }

  function copy(text, btn){
    function done(ok){
      if (!btn) return;
      var l = btn.getAttribute("data-label") || btn.textContent;
      btn.setAttribute("data-label", l);
      btn.textContent = ok ? "Zkopírováno ✓" : "Označ a zkopíruj";
      btn.classList.toggle("copied", ok);
      clearTimeout(btn._t); btn._t = setTimeout(function(){ btn.textContent = l; btn.classList.remove("copied"); }, 1800);
    }
    if (navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(fallback(text)); });
    } else done(fallback(text));
  }
  function fallback(text){
    var t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(t); t.select();
    var ok = false; try{ ok = document.execCommand("copy"); }catch(e){}
    t.remove(); return ok;
  }

  function reveal(){
    var els = document.querySelectorAll(".rv");
    if (!("IntersectionObserver" in window)){ els.forEach(function(e){ e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function(e){ io.observe(e); });
  }

  var nf = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });
  function money(v, cur){
    cur = (cur || "CZK").toUpperCase();
    try{ return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: cur, maximumFractionDigits: cur === "CZK" ? 0 : 2, minimumFractionDigits: cur === "CZK" ? 0 : 2 }).format(+v || 0); }
    catch(e){ return (Math.round((+v || 0) * 100) / 100) + " " + cur; }
  }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("[data-copy]");
    if (b){ e.preventDefault(); var src = document.getElementById(b.getAttribute("data-copy")); copy(src ? (src.value || src.textContent).trim() : b.getAttribute("data-text") || "", b); }
  });

  window.BWP = { rpc: rpc, copy: copy, reveal: reveal, money: money, num: function(v){ return nf.format(v); }, esc: esc };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", reveal); else reveal();
})();
