/* BrosWars Partner – přenos kliknutí (?bw=) na weby produktů. Pravidla: partneri/KONTRAKT.md */
(function(){
  "use strict";
  var KEY = "bw_click", RE = /^bw_[a-z0-9]{20}$/, WINDOW = 365 * 864e5;
  function save(id){ try{ localStorage.setItem(KEY, JSON.stringify({ id: id, at: Date.now() })); }catch(e){} }
  function valid(){
    try{
      var v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v && RE.test(v.id) && typeof v.at === "number" && Date.now() - v.at <= WINDOW) return v.id;
    }catch(e){}
    return null;
  }
  /* 1) příchod s ?bw= → uložit (poslední klik vyhrává) a odstranit z adresy */
  try{
    var u = new URL(location.href), q = u.searchParams.get("bw");
    if (q !== null){
      if (RE.test(q)) save(q);
      u.searchParams.delete("bw");
      history.replaceState(history.state, "", u.pathname + (u.search || "") + u.hash);
    }
  }catch(e){}
  /* 2) odchozí odkazy na produkty dostanou ?bw=<id> */
  function target(h){
    if (h.protocol !== "https:" && h.protocol !== "http:") return false;
    var host = h.hostname.toLowerCase();
    if (host === "chatnelo.com" || host === "www.chatnelo.com") return true;
    if (host === "nacti.me" || host === "www.nacti.me") return true;
    if (host === "pracovnitipy.github.io" && /^\/hrad-proti-hradu(\/|$)/.test(h.pathname)) return true;
    return false;
  }
  function tag(a){
    var id = valid(); if (!id || !a || !a.href) return;
    try{
      var h = new URL(a.href, location.href);
      if (!target(h) || /\/studio\/chat/.test(h.pathname)) return;
      if (h.searchParams.get("bw") === id) return;
      h.searchParams.set("bw", id); a.href = h.toString();
    }catch(e){}
  }
  function all(){ if (!valid()) return; var l = document.querySelectorAll("a[href]"); for (var i = 0; i < l.length; i++) tag(l[i]); }
  function onEv(e){ var a = e.target && e.target.closest ? e.target.closest("a[href]") : null; if (a) tag(a); }
  ["click","auxclick","contextmenu","keydown"].forEach(function(t){ document.addEventListener(t, onEv, true); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", all); else all();
  window.bwClick = valid;
})();
