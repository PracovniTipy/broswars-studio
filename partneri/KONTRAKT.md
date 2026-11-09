# BrosWars Partner (affiliate pro tvůrce) – technický kontrakt

Jeden partnerský program pro všechny projekty studia. Centrální evidence („hub“) běží v Supabase
projektu `smjplqxwqyraphfeqsyk` (schéma `aff`, edge funkce `aff`).

## Pravidlo provize (od Petra)
- Tvůrce má unikátní odkaz. Kliknutí zákazníka na odkaz otevře okno **365 dní**.
- Provize se počítá z každé platby zákazníka, která proběhne **do 365 dní od jeho POSLEDNÍHO kliknutí**
  na odkaz tvůrce. Po uplynutí okna provize není, dokud zákazník znovu neklikne (nové kliknutí okno obnoví).
- Platí poslední kliknutí (last click). Nové kliknutí na odkaz jiného tvůrce převezme zákazníka.
- Sazby: Chatnelo 30 %, Načti.me Pro 30 %, Castle WARS 20 % z ceny zaplacené zákazníkem.
- Provize je 30 dní „čekající“ (vrácení peněz), pak „k výplatě“. Vyplácí ručně Petr.
- Pracovní tipy (HeroHero) nejdou sledovat – v programu nejsou.

## Odkaz tvůrce
`https://broswarsstudio.chatnelo.com/go/<KOD>/<cil>`  (cil = chatnelo | nacti | castlewars; bez cíle = web studia)
→ přesměruje na `https://smjplqxwqyraphfeqsyk.supabase.co/functions/v1/aff/go?c=<KOD>&to=<cil>`
→ hub uloží kliknutí a přesměruje na cíl s parametrem `bw=<clickId>`:

| cil | adresa |
| --- | --- |
| chatnelo | https://chatnelo.com/?bw=ID |
| nacti | https://nacti.me/?bw=ID |
| castlewars | https://pracovnitipy.github.io/hrad-proti-hradu/?bw=ID |
| studio (výchozí) | https://broswarsstudio.chatnelo.com/?bw=ID |

Neschválený nebo neznámý kód = přesměrování na cíl BEZ `bw`.
`clickId` = `bw_` + 20 znaků `[a-z0-9]`.

## Klient (každý web/hra, vlastní doména)
- Při načtení s `?bw=` (formát `^bw_[a-z0-9]{20}$`) ulož `localStorage['bw_click'] = JSON {id, at: Date.now()}`
  – VŽDY přepsat (poslední klik vyhrává) a parametr odstraň z URL (`history.replaceState`).
- Platný klik = existuje a `Date.now() - at <= 365 dní`. Při platbě předej `id` (server okno ověří znovu
  podle času kliknutí v hubu, klientskému `at` nevěří).
- Zákazník může místo odkazu zadat **kód tvůrce**: `POST .../aff/code` JSON `{code, to}` → `{click_id}`
  (vytvoří kliknutí v tu chvíli), pak ulož jako výše.
- `GET .../aff/check?id=<clickId>` → `{valid, code, expires_at}` (volitelné, pro zobrazení „Doporučil vás …“).
- Všechny odpovědi edge funkce mají CORS `*`.

## Konverze (platby)
Hub si je stahuje sám (každou hodinu) z veřejných endpointů – bez sdílených tajných klíčů:
- Chatnelo backend: `GET https://chatnelo.com/api/aff/conversions?since=<ISO>`
- Načti.me worker: `GET <apiUrl>/aff/conversions?since=<ISO>` (apiUrl z https://nacti.me/config.js)

Odpověď obou: `{"conversions":[{"external_id":"…","click_id":"bw_…","amount":16.99,"currency":"USD","paid_at":"ISO","description":"…"}]}`
- Jen SKUTEČNĚ zaplacené platby (ne zkušební verze, ne testovací/development obchody, ne vrácené), jen ty s click_id.
- `external_id` unikátní a stabilní pro jednu platbu (stejná platba = stejné id, hub deduplikuje).
- `paid_at` >= `since`. Žádné osobní údaje (e-maily, jména, domény obchodů) – jen hash/ID.
- Castle WARS: edge funkce `itch` (stejný Supabase projekt) po ověřeném nákupu volá
  `rpc('aff_record', {p_source:'castlewars', p_external_id, p_click_id, p_amount, p_currency:'USD', p_paid_at, p_description})`
  se service role klientem.

## Partneři
Přihláška: RPC `aff_apply(p jsonb)` (anon) → `{token, code}` nebo `{error}`; panel: `aff_dashboard(t)`;
výplatní údaje: `aff_set_payout(t, info)`. Schvaluje Petr v Supabase (tabulka `aff.partners`, status → `approved`).
