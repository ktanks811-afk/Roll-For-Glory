-- Cowtown Pay: players send each other money through the bank (applied to the
-- Supabase project as migration `rfg_bank`). Needs rfg_servers.sql first: you
-- can pay anyone on your home server.
--
-- Money lives in each player's save, so the server is only a mailbox: the
-- sender's game takes the money out of checking and drops a transfer here; the
-- receiver's game picks it up and puts it in their checking. A transfer nobody
-- picks up in 7 days goes back to the sender. Same identity as the server
-- registry (career id + private key, only a hash stored); RLS on, no policies,
-- everything goes through these functions.

create table if not exists public.rfg_transfers (
  id bigserial primary key,
  server text not null,
  from_uid text not null,
  from_name text not null,
  to_uid text not null,
  to_name text not null,
  amount int not null check (amount between 1 and 1000000),
  memo text not null default '',
  status text not null default 'sent',   -- sent | claimed | returned
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists rfg_transfers_to on public.rfg_transfers(to_uid) where status = 'sent';
create index if not exists rfg_transfers_from on public.rfg_transfers(from_uid, created_at);

alter table public.rfg_transfers enable row level security;
revoke all on public.rfg_transfers from anon, authenticated;

-- Everyone on a server you can pay (active in the last 30 days).
create or replace function public.rfg_server_roster(p_server text) returns table(uid text, name text)
language sql stable security definer set search_path = public as $$
  select uid, name from public.rfg_server_members
  where server = p_server and seen_at > now() - interval '30 days'
  order by seen_at desc limit 40
$$;

-- Send money to another player on your server.
create or replace function public.rfg_pay_send(p_uid text, p_tok text, p_to text, p_amount int, p_memo text)
returns json language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members; r public.rfg_server_members; n int; t public.rfg_transfers;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then raise exception 'Pick a home server first'; end if;
  if p_to = m.uid then raise exception 'You can''t send money to yourself'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then raise exception 'Send between $1 and $1,000,000'; end if;
  select * into r from public.rfg_server_members where uid = p_to;
  if r.uid is null or r.server <> m.server then raise exception 'That player isn''t on your server'; end if;
  select count(*) into n from public.rfg_transfers where from_uid = m.uid and created_at > now() - interval '1 hour';
  if n >= 30 then raise exception 'Too many transfers. Try again later.'; end if;
  insert into public.rfg_transfers(server, from_uid, from_name, to_uid, to_name, amount, memo)
    values (m.server, m.uid, m.name, r.uid, r.name, p_amount, left(regexp_replace(coalesce(p_memo, ''), '[<>[:cntrl:]]', '', 'g'), 60))
    returning * into t;
  update public.rfg_server_members set seen_at = now() where uid = m.uid;
  return json_build_object('ok', true, 'id', t.id, 'to', r.name);
end $$;

-- Pick up your mail: money sent to you, and your own transfers nobody picked
-- up in 7 days (returned). Each one is handed out exactly once.
create or replace function public.rfg_pay_inbox(p_uid text, p_tok text)
returns json language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members; got json; back json;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then return json_build_object('in', '[]'::json, 'back', '[]'::json); end if;
  with x as (
    update public.rfg_transfers set status = 'claimed', done_at = now()
    where to_uid = m.uid and status = 'sent'
    returning id, from_uid, from_name, amount, memo, created_at
  ) select coalesce(json_agg(x order by x.id), '[]'::json) into got from x;
  with y as (
    update public.rfg_transfers set status = 'returned', done_at = now()
    where from_uid = m.uid and status = 'sent' and created_at < now() - interval '7 days'
    returning id, to_name, amount, memo
  ) select coalesce(json_agg(y order by y.id), '[]'::json) into back from y;
  update public.rfg_server_members set seen_at = now() where uid = m.uid;
  return json_build_object('in', got, 'back', back);
end $$;

grant execute on function public.rfg_server_roster(text) to anon, authenticated;
grant execute on function public.rfg_pay_send(text, text, text, int, text) to anon, authenticated;
grant execute on function public.rfg_pay_inbox(text, text) to anon, authenticated;
