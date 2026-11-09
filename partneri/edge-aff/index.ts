// BrosWars Partner – hub affiliate programu (kliknutí, kódy, stahování plateb).
// Pravidla viz partneri/KONTRAKT.md v repu broswars-studio.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const TARGETS: Record<string, string> = {
  chatnelo: "https://chatnelo.com/",
  nacti: "https://nacti.me/",
  castlewars: "https://pracovnitipy.github.io/hrad-proti-hradu/",
  studio: "https://broswarsstudio.chatnelo.com/",
};
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function ipHash(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  if (!ip) return null;
  const day = new Date().toISOString().slice(0, 10);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`bw:${day}:${ip}`));
  return Array.from(new Uint8Array(buf)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function withClick(target: string, clickId: string | null) {
  const url = new URL(TARGETS[target] || TARGETS.studio);
  if (clickId) url.searchParams.set("bw", clickId);
  return url.toString();
}

// Jednoduchá ochrana proti botům: stejná IP + kód max 20 kliknutí za den se zapíše, další jen přesměruje.
const seen = new Map<string, number>();

async function makeClick(code: string, target: string, via: string, req: Request) {
  const ih = await ipHash(req);
  const key = `${ih}:${code}`;
  const n = (seen.get(key) || 0) + 1;
  seen.set(key, n);
  if (seen.size > 50000) seen.clear();
  if (n > 20) return null;
  const { data, error } = await db.rpc("aff_click", { p_code: code, p_target: target, p_via: via, p_ip: ih });
  if (error) { console.error("aff_click", error.message); return null; }
  return (data as string) || null;
}

type Conv = { external_id: string; click_id: string; amount: number; currency: string; paid_at: string; description?: string };

async function syncSource(source: string, endpoint: (since: string) => Promise<string>) {
  const state = (await db.rpc("aff_sync_get", { p_source: source })).data as { last_paid_at?: string; last_run?: string } | null;
  if (state?.last_run && Date.now() - new Date(state.last_run).getTime() < 10 * 60 * 1000) return { source, skipped: true };
  // 2 dny překryv kvůli zpožděným zápisům; duplicity hub zahodí (unique source+external_id).
  const since = state?.last_paid_at
    ? new Date(new Date(state.last_paid_at).getTime() - 2 * 864e5).toISOString()
    : "2026-01-01T00:00:00Z";
  let maxPaid: string | null = null;
  const results: Record<string, number> = {};
  try {
    const url = await endpoint(since);
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = await r.json();
    const list: Conv[] = Array.isArray(body?.conversions) ? body.conversions : [];
    for (const c of list.slice(0, 2000)) {
      if (!c?.external_id || !/^bw_[a-z0-9]{20}$/.test(String(c.click_id || ""))) continue;
      const { data, error } = await db.rpc("aff_record", {
        p_source: source, p_external_id: String(c.external_id).slice(0, 200), p_click_id: c.click_id,
        p_amount: Number(c.amount), p_currency: String(c.currency || "CZK").slice(0, 3), p_paid_at: c.paid_at,
        p_description: c.description ? String(c.description).slice(0, 200) : null,
      });
      const k = error ? "error" : String(data);
      results[k] = (results[k] || 0) + 1;
      if (!maxPaid || c.paid_at > maxPaid) maxPaid = c.paid_at;
    }
    await db.rpc("aff_sync_set", { p_source: source, p_last_paid_at: maxPaid, p_error: null });
    return { source, count: list.length, results };
  } catch (e) {
    await db.rpc("aff_sync_set", { p_source: source, p_last_paid_at: null, p_error: String((e as Error).message || e).slice(0, 300) });
    return { source, error: String((e as Error).message || e) };
  }
}

async function nactiApi() {
  const r = await fetch("https://nacti.me/config.js");
  const m = (await r.text()).match(/apiUrl:\s*'([^']+)'/);
  if (!m) throw new Error("nacti apiUrl not configured");
  return m[1].replace(/\/$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/aff/, "") || "/";

  if (route === "/go") {
    const code = (url.searchParams.get("c") || "").slice(0, 40);
    const target = TARGETS[url.searchParams.get("to") || ""] ? url.searchParams.get("to")! : "studio";
    const id = code ? await makeClick(code, target, "link", req) : null;
    return new Response(null, { status: 302, headers: { ...CORS, Location: withClick(target, id), "Cache-Control": "no-store" } });
  }

  if (route === "/code" && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || "").slice(0, 40);
    const target = TARGETS[body?.to] ? body.to : "studio";
    const id = code ? await makeClick(code, target, "code", req) : null;
    return id ? json({ click_id: id }) : json({ error: "unknown_code" }, 404);
  }

  if (route === "/check") {
    const id = url.searchParams.get("id") || "";
    if (!/^bw_[a-z0-9]{20}$/.test(id)) return json({ valid: false });
    const { data } = await db.rpc("aff_check", { p_id: id });
    return json(data || { valid: false });
  }

  if (route === "/sync") {
    const out = await Promise.all([
      syncSource("chatnelo", async (since) => `https://chatnelo.com/api/aff/conversions?since=${encodeURIComponent(since)}`),
      syncSource("nacti", async (since) => `${await nactiApi()}/aff/conversions?since=${encodeURIComponent(since)}`),
    ]);
    return json({ ok: true, out });
  }

  return json({ ok: true, service: "BrosWars Partner" });
});
