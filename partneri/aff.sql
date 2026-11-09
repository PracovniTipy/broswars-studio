create schema if not exists aff;
revoke all on schema aff from anon, authenticated;

create table if not exists aff.partners (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  token text unique not null,
  name text not null,
  email text not null,
  channels text,
  audience text,
  how text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','paused')),
  payout_info text,
  note text,
  ip_hash text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create unique index if not exists partners_email_uq on aff.partners (lower(email));

create table if not exists aff.rates (
  source text primary key,
  rate numeric not null,
  label text not null
);
insert into aff.rates (source, rate, label) values
  ('chatnelo', 0.30, 'Chatnelo'),
  ('nacti', 0.30, 'Načti.me Pro'),
  ('castlewars', 0.20, 'Castle WARS')
on conflict (source) do nothing;

create table if not exists aff.clicks (
  id text primary key,
  partner_id uuid not null references aff.partners(id),
  target text not null,
  via text not null default 'link',
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists clicks_partner_idx on aff.clicks (partner_id, created_at desc);

create table if not exists aff.conversions (
  id bigserial primary key,
  source text not null references aff.rates(source),
  external_id text not null,
  click_id text not null references aff.clicks(id),
  partner_id uuid not null references aff.partners(id),
  amount numeric not null,
  currency text not null,
  commission numeric not null,
  paid_at timestamptz not null,
  payable_after timestamptz not null,
  status text not null default 'pending' check (status in ('pending','payable','paid','rejected')),
  description text,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

create table if not exists aff.sync_state (
  source text primary key,
  last_paid_at timestamptz,
  last_run timestamptz,
  last_error text
);

alter table aff.partners enable row level security;
alter table aff.rates enable row level security;
alter table aff.clicks enable row level security;
alter table aff.conversions enable row level security;
alter table aff.sync_state enable row level security;

create or replace function aff.touch_approved() returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then new.approved_at := now(); end if;
  return new;
end $$;
drop trigger if exists partners_approved on aff.partners;
create trigger partners_approved before update on aff.partners for each row execute function aff.touch_approved();

create or replace function aff.record_conversion(
  p_source text, p_external_id text, p_click_id text, p_amount numeric, p_currency text, p_paid_at timestamptz, p_description text
) returns text language plpgsql security definer set search_path = aff, public as $$
declare c record; r numeric;
begin
  select k.id, k.created_at, k.partner_id, p.status into c from aff.clicks k join aff.partners p on p.id = k.partner_id where k.id = p_click_id;
  if c.id is null then return 'unknown_click'; end if;
  if p_paid_at < c.created_at or p_paid_at > c.created_at + interval '365 days' then return 'outside_window'; end if;
  if c.status not in ('approved','paused') then return 'partner_not_approved'; end if;
  select rate into r from aff.rates where source = p_source;
  if r is null then return 'unknown_source'; end if;
  if p_amount is null or p_amount <= 0 then return 'no_amount'; end if;
  insert into aff.conversions (source, external_id, click_id, partner_id, amount, currency, commission, paid_at, payable_after, description)
  values (p_source, p_external_id, p_click_id, c.partner_id, p_amount, upper(p_currency), round(p_amount * r, 2), p_paid_at, p_paid_at + interval '30 days', p_description)
  on conflict (source, external_id) do nothing;
  return 'ok';
end $$;
revoke all on function aff.record_conversion(text,text,text,numeric,text,timestamptz,text) from public, anon, authenticated;

create or replace function aff.mark_payable() returns void language sql security definer set search_path = aff as $$
  update aff.conversions set status = 'payable' where status = 'pending' and payable_after <= now();
$$;

create or replace function public.aff_apply(p jsonb) returns jsonb language plpgsql security definer set search_path = aff, public, extensions as $$
declare v_name text := left(trim(coalesce(p->>'name','')), 120);
        v_email text := lower(left(trim(coalesce(p->>'email','')), 200));
        v_base text; v_code text; v_token text; i int := 0; existing record;
begin
  if length(v_name) < 2 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('error','invalid'); end if;
  if coalesce((p->>'agree')::boolean, false) is not true then return jsonb_build_object('error','agree'); end if;
  select * into existing from aff.partners where lower(email) = v_email;
  if existing.id is not null then return jsonb_build_object('error','exists'); end if;
  if (select count(*) from aff.partners where created_at > now() - interval '1 hour') > 30 then return jsonb_build_object('error','busy'); end if;
  v_base := upper(regexp_replace(translate(v_name, 'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ', 'acdeeinorstuuyzACDEEINORSTUUYZ'), '[^A-Za-z0-9]', '', 'g'));
  v_base := left(coalesce(nullif(v_base,''),'PARTNER'), 10);
  loop
    v_code := v_base || case when i = 0 then '' else (10 + floor(random()*90))::int::text end;
    exit when not exists (select 1 from aff.partners where code = v_code);
    i := i + 1;
  end loop;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into aff.partners (code, token, name, email, channels, audience, how, ip_hash)
  values (v_code, v_token, v_name, v_email, left(p->>'channels', 1000), left(p->>'audience', 300), left(p->>'how', 2000), left(p->>'ip_hash', 80));
  return jsonb_build_object('token', v_token, 'code', v_code);
end $$;

create or replace function public.aff_dashboard(t text) returns jsonb language plpgsql security definer set search_path = aff, public as $$
declare pr record; res jsonb;
begin
  perform aff.mark_payable();
  select * into pr from aff.partners where token = t;
  if pr.id is null then return jsonb_build_object('error','not_found'); end if;
  select jsonb_build_object(
    'name', pr.name, 'code', pr.code, 'status', pr.status, 'created_at', pr.created_at, 'approved_at', pr.approved_at,
    'has_payout', pr.payout_info is not null and length(pr.payout_info) > 0,
    'rates', (select jsonb_object_agg(source, jsonb_build_object('rate', rate, 'label', label)) from aff.rates),
    'clicks', jsonb_build_object(
       'total', (select count(*) from aff.clicks where partner_id = pr.id),
       'd30', (select count(*) from aff.clicks where partner_id = pr.id and created_at > now() - interval '30 days'),
       'by_target', (select coalesce(jsonb_object_agg(target, n), '{}'::jsonb) from (select target, count(*) n from aff.clicks where partner_id = pr.id group by target) s)),
    'conversions', (select coalesce(jsonb_agg(jsonb_build_object('source', source, 'amount', amount, 'currency', currency, 'commission', commission, 'paid_at', paid_at, 'payable_after', payable_after, 'status', status) order by paid_at desc), '[]'::jsonb)
                    from (select * from aff.conversions where partner_id = pr.id order by paid_at desc limit 200) c),
    'totals', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'status', status, 'commission', s)), '[]'::jsonb)
               from (select currency, status, sum(commission) s from aff.conversions where partner_id = pr.id group by currency, status) z)
  ) into res;
  return res;
end $$;

create or replace function public.aff_set_payout(t text, info text) returns jsonb language plpgsql security definer set search_path = aff, public as $$
begin
  update aff.partners set payout_info = left(trim(info), 500) where token = t;
  if not found then return jsonb_build_object('error','not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.aff_apply(jsonb) from public;
revoke all on function public.aff_dashboard(text) from public;
revoke all on function public.aff_set_payout(text,text) from public;
grant execute on function public.aff_apply(jsonb) to anon, authenticated;
grant execute on function public.aff_dashboard(text) to anon, authenticated;
grant execute on function public.aff_set_payout(text,text) to anon, authenticated;
grant usage on schema aff to service_role;
grant all on all tables in schema aff to service_role;
grant all on all sequences in schema aff to service_role;
grant execute on function aff.record_conversion(text,text,text,numeric,text,timestamptz,text) to service_role;