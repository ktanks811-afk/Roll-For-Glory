-- Home servers and house deeds (applied to the Supabase project as migration
-- `rfg_servers`). A career picks one server as its home; each server holds 15
-- careers. Houses, trap houses and lots are deeded per server: once a real
-- player owns one on your server, nobody else there can buy it.
-- Players are a career id plus a private key (the same pair online crews use);
-- only a sha256 hash of the key is stored. Tables have RLS and no policies:
-- everything goes through these functions.
-- Property deeds are permanent: leaving/changing servers never releases a deed.

create table if not exists public.rfg_server_members (
  uid text primary key,
  tok_hash text not null,
  name text not null default 'Racer',
  server text not null,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create index if not exists rfg_server_members_server on public.rfg_server_members(server);

create table if not exists public.rfg_deeds (
  server text not null,
  prop text not null,
  uid text not null,
  name text not null default 'Racer',
  bought_at timestamptz not null default now(),
  primary key (server, prop)
);
create index if not exists rfg_deeds_uid on public.rfg_deeds(uid);

alter table public.rfg_server_members enable row level security;
alter table public.rfg_deeds enable row level security;
revoke all on public.rfg_server_members, public.rfg_deeds from anon, authenticated;

create or replace function public.rfg_srv_ok(p text) returns boolean language sql immutable set search_path = public as $$
  select p in ('harbor','downtown','eastgate','ironside','dustline','northridge','pier9','glory')
$$;

-- Careers that haven't been online in 30 days give up their server spot; permanent deeds remain.
create or replace function public.rfg_srv_purge() returns void language sql security definer set search_path = public as $$
  -- Permanent property deeds are never purged. Server membership is considered active
  -- by the count/join queries using seen_at instead.
$$;

create or replace function public.rfg_srv_me(p_uid text, p_tok text) returns public.rfg_server_members
language plpgsql stable security definer set search_path = public as $$
declare m public.rfg_server_members;
begin
  select * into m from public.rfg_server_members where uid = p_uid and tok_hash = public.rfg_h(p_tok);
  return m;
end $$;

create or replace function public.rfg_server_counts() returns table(server text, members int)
language sql stable security definer set search_path = public as $$
  select server, count(*)::int from public.rfg_server_members where seen_at > now() - interval '30 days' group by server
$$;

-- Make p_server your home (or check in on it). p_props = everything you own.
-- Moving servers only works when the new one has room and none of your
-- houses is already somebody else's there.
create or replace function public.rfg_server_join(p_uid text, p_tok text, p_name text, p_server text, p_props text[])
returns json language plpgsql security definer set search_path = public as $$
declare
  m public.rfg_server_members;
  n int;
  props text[];
  conflicts json;
begin
  if p_uid !~ '^[A-Za-z0-9]{6,16}$' or length(coalesce(p_tok, '')) < 12 then raise exception 'Bad player id'; end if;
  if not public.rfg_srv_ok(p_server) then raise exception 'No such server'; end if;
  props := array(select distinct x from unnest(coalesce(p_props, '{}')) x where x ~ '^[a-z0-9_]{1,40}$' limit 200);
  perform public.rfg_srv_purge();
  select * into m from public.rfg_server_members where uid = p_uid;
  if m.uid is not null and m.tok_hash <> public.rfg_h(p_tok) then raise exception 'That career belongs to someone else'; end if;
  if m.uid is null or m.server <> p_server then
    select count(*) into n from public.rfg_server_members where server = p_server and uid <> p_uid and seen_at > now() - interval '30 days';
    if n >= 15 then return json_build_object('ok', false, 'full', true); end if;
  end if;
  select coalesce(json_agg(json_build_object('prop', d.prop, 'name', d.name)), '[]'::json) into conflicts
    from public.rfg_deeds d where d.server = p_server and d.uid <> p_uid and d.prop = any(props);
  if json_array_length(conflicts) > 0 and (m.uid is null or m.server <> p_server) then
    return json_build_object('ok', false, 'conflicts', conflicts);
  end if;
  insert into public.rfg_server_members(uid, tok_hash, name, server) values (p_uid, public.rfg_h(p_tok), left(coalesce(p_name, 'Racer'), 16), p_server)
    on conflict (uid) do update set name = excluded.name, server = excluded.server, seen_at = now(),
      joined_at = case when public.rfg_server_members.server = excluded.server then public.rfg_server_members.joined_at else now() end;
  -- Permanent deeds are never deleted or reassigned. Sync any properties
  -- present in the career save that are still unclaimed on this server.
  insert into public.rfg_deeds(server, prop, uid, name) select p_server, x, p_uid, left(coalesce(p_name, 'Racer'), 16) from unnest(props) x
    on conflict (server, prop) do nothing;
  update public.rfg_deeds set name = left(coalesce(p_name, 'Racer'), 16) where uid = p_uid;
  return json_build_object('ok', true, 'server', p_server, 'conflicts', conflicts);
end $$;

create or replace function public.rfg_server_leave(p_uid text, p_tok text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then return; end if;
  -- Leaving the server does not release property ownership.
  delete from public.rfg_server_members where uid = p_uid;
end $$;

create or replace function public.rfg_deeds_get(p_server text) returns table(prop text, uid text, name text)
language sql stable security definer set search_path = public as $$
  select prop, uid, name from public.rfg_deeds where server = p_server
$$;

create or replace function public.rfg_deed_claim(p_uid text, p_tok text, p_prop text) returns json
language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members; d public.rfg_deeds;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then raise exception 'Pick a home server first'; end if;
  if p_prop !~ '^[a-z0-9_]{1,40}$' then raise exception 'Bad property'; end if;
  insert into public.rfg_deeds(server, prop, uid, name) values (m.server, p_prop, m.uid, m.name) on conflict (server, prop) do nothing;
  select * into d from public.rfg_deeds where server = m.server and prop = p_prop;
  update public.rfg_server_members set seen_at = now() where uid = m.uid;
  return json_build_object('ok', d.uid = m.uid, 'name', d.name);
end $$;

create or replace function public.rfg_deed_release(p_uid text, p_tok text, p_prop text) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Permanent deed. Kept for backwards compatibility with older clients.
  perform public.rfg_srv_me(p_uid, p_tok);
end $;

revoke execute on function public.rfg_srv_purge(), public.rfg_srv_me(text, text) from public, anon, authenticated;
grant execute on function public.rfg_server_counts(), public.rfg_server_join(text, text, text, text, text[]), public.rfg_server_leave(text, text),
  public.rfg_deeds_get(text), public.rfg_deed_claim(text, text, text), public.rfg_deed_release(text, text, text) to anon, authenticated;
