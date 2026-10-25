-- Friends and texts between real players (applied to the Supabase project as
-- migration `rfg_friends`). Needs rfg_servers.sql first: a player is anyone in
-- the server registry, on any server.
--
-- Friend lists and conversations live in each player's own save, so the
-- server is only a mailbox, like Cowtown Pay: your game drops a note here
-- (a text, a friend request, an accept, an unfriend) and theirs picks it up
-- the next time it checks. Notes nobody picks up in 30 days are dropped.
-- Same identity as the server registry (career id + private key, only a hash
-- stored); RLS on, no policies, everything goes through these functions.

create table if not exists public.rfg_dms (
  id bigserial primary key,
  from_uid text not null,
  from_name text not null,
  to_uid text not null,
  kind text not null default 'text' check (kind in ('text', 'req', 'ok', 'bye')),
  body text not null default '',
  status text not null default 'sent',   -- sent | claimed
  created_at timestamptz not null default now()
);
create index if not exists rfg_dms_to on public.rfg_dms(to_uid) where status = 'sent';
create index if not exists rfg_dms_from on public.rfg_dms(from_uid, created_at);

alter table public.rfg_dms enable row level security;
revoke all on public.rfg_dms from anon, authenticated;

-- Look a player up by their friend code (their career id).
create or replace function public.rfg_player_find(p_code text) returns table(uid text, name text, server text)
language sql stable security definer set search_path = public as $$
  select uid, name, server from public.rfg_server_members where uid = lower(p_code) limit 1
$$;

-- Send a note to another player.
create or replace function public.rfg_dm_send(p_uid text, p_tok text, p_to text, p_kind text, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members; r public.rfg_server_members; n int;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then raise exception 'Pick a home server first'; end if;
  if p_to = m.uid then raise exception 'That''s you'; end if;
  if p_kind not in ('text', 'req', 'ok', 'bye') then raise exception 'Bad message'; end if;
  select * into r from public.rfg_server_members where uid = p_to;
  if r.uid is null then raise exception 'No player with that code'; end if;
  select count(*) into n from public.rfg_dms where from_uid = m.uid and created_at > now() - interval '1 hour';
  if n >= 120 then raise exception 'Too many texts. Slow down a little.'; end if;
  insert into public.rfg_dms(from_uid, from_name, to_uid, kind, body)
    values (m.uid, m.name, r.uid, p_kind, left(regexp_replace(coalesce(p_body, ''), '[<>[:cntrl:]]', '', 'g'), 240));
  update public.rfg_server_members set seen_at = now() where uid = m.uid;
  return json_build_object('ok', true, 'to', r.name);
end $$;

-- Pick up your notes. Each one is handed out exactly once.
create or replace function public.rfg_dm_inbox(p_uid text, p_tok text)
returns json language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members; got json;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then return '[]'::json; end if;
  delete from public.rfg_dms where created_at < now() - interval '30 days';
  with x as (
    update public.rfg_dms set status = 'claimed'
    where to_uid = m.uid and status = 'sent'
    returning id, from_uid, from_name, kind, body, created_at
  ) select coalesce(json_agg(x order by x.id), '[]'::json) into got from x;
  delete from public.rfg_dms where to_uid = m.uid and status = 'claimed';
  return got;
end $$;

grant execute on function public.rfg_player_find(text) to anon, authenticated;
grant execute on function public.rfg_dm_send(text, text, text, text, text) to anon, authenticated;
grant execute on function public.rfg_dm_inbox(text, text) to anon, authenticated;
