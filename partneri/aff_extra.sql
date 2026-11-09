-- Doplňkové funkce pro edge funkci `aff` (service role) a pro klienty (anon).
create or replace function public.aff_click(p_code text, p_target text, p_via text, p_ip text) returns text
language plpgsql security definer set search_path = aff, public, extensions as $$
declare pid uuid; cid text; alphabet text := 'abcdefghijklmnopqrstuvwxyz0123456789'; b bytea; i int;
begin
  select id into pid from aff.partners where code = upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g')) and status = 'approved';
  if pid is null then return null; end if;
  if p_target not in ('chatnelo','nacti','castlewars','studio') then p_target := 'studio'; end if;
  b := gen_random_bytes(20); cid := 'bw_';
  for i in 0..19 loop cid := cid || substr(alphabet, (get_byte(b, i) % 36) + 1, 1); end loop;
  insert into aff.clicks (id, partner_id, target, via, ip_hash) values (cid, pid, p_target, coalesce(p_via,'link'), left(p_ip, 80));
  return cid;
end $$;

create or replace function public.aff_check(p_id text) returns jsonb
language sql security definer set search_path = aff, public as $$
  select coalesce((select jsonb_build_object('valid', k.created_at + interval '365 days' > now() and p.status = 'approved',
                                             'code', p.code, 'expires_at', k.created_at + interval '365 days')
                   from aff.clicks k join aff.partners p on p.id = k.partner_id where k.id = p_id),
                  jsonb_build_object('valid', false));
$$;

create or replace function public.aff_record(p_source text, p_external_id text, p_click_id text, p_amount numeric,
  p_currency text, p_paid_at timestamptz, p_description text) returns text
language sql security definer set search_path = aff, public as $$
  select aff.record_conversion(p_source, p_external_id, p_click_id, p_amount, p_currency, p_paid_at, p_description);
$$;

create or replace function public.aff_sync_get(p_source text) returns jsonb
language sql security definer set search_path = aff, public as $$
  select coalesce((select to_jsonb(s) from aff.sync_state s where source = p_source), jsonb_build_object('source', p_source));
$$;

create or replace function public.aff_sync_set(p_source text, p_last_paid_at timestamptz, p_error text) returns void
language sql security definer set search_path = aff, public as $$
  insert into aff.sync_state (source, last_paid_at, last_run, last_error) values (p_source, p_last_paid_at, now(), p_error)
  on conflict (source) do update set last_paid_at = coalesce(greatest(aff.sync_state.last_paid_at, excluded.last_paid_at), aff.sync_state.last_paid_at),
    last_run = now(), last_error = excluded.last_error;
$$;

revoke all on function public.aff_click(text,text,text,text) from public, anon, authenticated;
revoke all on function public.aff_record(text,text,text,numeric,text,timestamptz,text) from public, anon, authenticated;
revoke all on function public.aff_sync_get(text) from public, anon, authenticated;
revoke all on function public.aff_sync_set(text,timestamptz,text) from public, anon, authenticated;
revoke all on function public.aff_check(text) from public;
grant execute on function public.aff_click(text,text,text,text) to service_role;
grant execute on function public.aff_record(text,text,text,numeric,text,timestamptz,text) to service_role;
grant execute on function public.aff_sync_get(text) to service_role;
grant execute on function public.aff_sync_set(text,timestamptz,text) to service_role;
grant execute on function public.aff_check(text) to anon, authenticated, service_role;

-- Každou hodinu: čekající provize → k výplatě (po 30 dnech) a stažení plateb (pg_net → edge funkce /sync).
create extension if not exists pg_net;
select cron.unschedule('aff-hourly') where exists (select 1 from cron.job where jobname = 'aff-hourly');
select cron.schedule('aff-hourly', '17 * * * *', $c$
  select aff.mark_payable();
  select net.http_get('https://smjplqxwqyraphfeqsyk.supabase.co/functions/v1/aff/sync');
$c$);
