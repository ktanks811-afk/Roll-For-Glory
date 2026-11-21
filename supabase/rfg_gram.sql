-- Gossip posts (the 3D game's Gossip app, 2026-11-21): pictures and captions
-- players post, their likes, comments and follows, so a post stays up for
-- every server and for players who weren't online when it went up.
-- Run after rfg_servers.sql. Safe to run again.
-- Same rules as the other rfg tables: RLS on, no policies, everything goes
-- through these functions, and you prove who you are with your career id and
-- private key (rfg_srv_me), so you need a home server to post.

create table if not exists public.rfg_gram_posts (
  id text primary key,                 -- <uid>_<base36 time>
  uid text not null,
  name text not null default 'Racer',
  handle text not null,
  cap text not null default '',
  loc text not null default '',
  img text,                            -- small jpeg data URL (about 40 KB)
  at timestamptz not null default now()
);
create index if not exists rfg_gram_posts_at on public.rfg_gram_posts(at desc);
create index if not exists rfg_gram_posts_uid on public.rfg_gram_posts(uid);

create table if not exists public.rfg_gram_likes (
  post_id text not null references public.rfg_gram_posts(id) on delete cascade,
  uid text not null,
  handle text not null,
  at timestamptz not null default now(),
  primary key (post_id, uid)
);

create table if not exists public.rfg_gram_comments (
  id text primary key,                 -- <uid>_<base36 time>
  post_id text not null references public.rfg_gram_posts(id) on delete cascade,
  uid text not null,
  handle text not null,
  body text not null,
  at timestamptz not null default now()
);
create index if not exists rfg_gram_comments_post on public.rfg_gram_comments(post_id, at);

create table if not exists public.rfg_gram_follows (
  uid text not null,                   -- the follower
  who text not null,                   -- who they follow
  handle text not null,
  at timestamptz not null default now(),
  primary key (uid, who)
);
create index if not exists rfg_gram_follows_who on public.rfg_gram_follows(who);

alter table public.rfg_gram_posts enable row level security;
alter table public.rfg_gram_likes enable row level security;
alter table public.rfg_gram_comments enable row level security;
alter table public.rfg_gram_follows enable row level security;
revoke all on public.rfg_gram_posts, public.rfg_gram_likes, public.rfg_gram_comments, public.rfg_gram_follows from anon, authenticated;

create or replace function public.rfg_gram_clean(p text, n int) returns text language sql immutable as $$
  select left(btrim(regexp_replace(coalesce(p, ''), '[[:cntrl:]<>]', '', 'g')), n)
$$;

-- post (or re-send) one of yours
create or replace function public.rfg_gram_post(p_uid text, p_tok text, p_id text, p_handle text, p_cap text, p_loc text, p_img text) returns boolean
language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then raise exception 'Pick a home server first'; end if;
  if p_id !~ ('^' || m.uid || '_[a-z0-9]{6,10}$') then raise exception 'Bad post id'; end if;
  if p_img is not null and (length(p_img) > 160000 or p_img !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then raise exception 'Bad picture'; end if;
  if (select count(*) from public.rfg_gram_posts where uid = m.uid and at > now() - interval '1 hour') >= 20 then raise exception 'Slow down, you posted a lot this hour'; end if;
  insert into public.rfg_gram_posts(id, uid, name, handle, cap, loc, img)
    values (p_id, m.uid, m.name, coalesce(nullif(public.rfg_gram_clean(lower(p_handle), 24), ''), 'racer'), public.rfg_gram_clean(p_cap, 300), public.rfg_gram_clean(p_loc, 60), p_img)
    on conflict (id) do nothing;
  return true;
end $$;

create or replace function public.rfg_gram_delete(p_uid text, p_tok text, p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then raise exception 'Pick a home server first'; end if;
  delete from public.rfg_gram_posts where id = p_id and uid = m.uid;
  return found;
end $$;

-- the newest posts from everybody (no pictures: fetch those one at a time with rfg_gram_img)
create or replace function public.rfg_gram_feed(p_uid text, p_limit int default 40)
returns table(id text, uid text, name text, handle text, cap text, loc text, has_img boolean, at timestamptz, likes int, comments int, liked boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.uid, p.name, p.handle, p.cap, p.loc, p.img is not null, p.at,
    (select count(*)::int from public.rfg_gram_likes l where l.post_id = p.id),
    (select count(*)::int from public.rfg_gram_comments c where c.post_id = p.id),
    exists(select 1 from public.rfg_gram_likes l where l.post_id = p.id and l.uid = p_uid)
  from public.rfg_gram_posts p
  where p.at > now() - interval '14 days'
  order by p.at desc limit greatest(1, least(coalesce(p_limit, 40), 60))
$$;

create or replace function public.rfg_gram_img(p_id text) returns text
language sql stable security definer set search_path = public as $$
  select img from public.rfg_gram_posts where id = p_id
$$;

create or replace function public.rfg_gram_like(p_uid text, p_tok text, p_id text, p_handle text, p_on boolean) returns int
language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members; n int;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then raise exception 'Pick a home server first'; end if;
  if p_on then
    insert into public.rfg_gram_likes(post_id, uid, handle) select p_id, m.uid, coalesce(nullif(public.rfg_gram_clean(lower(p_handle), 24), ''), 'racer')
      where exists(select 1 from public.rfg_gram_posts where id = p_id) on conflict do nothing;
  else
    delete from public.rfg_gram_likes where post_id = p_id and uid = m.uid;
  end if;
  select count(*)::int into n from public.rfg_gram_likes where post_id = p_id;
  return n;
end $$;

create or replace function public.rfg_gram_comment(p_uid text, p_tok text, p_cid text, p_id text, p_handle text, p_body text) returns boolean
language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members; b text := public.rfg_gram_clean(p_body, 240);
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then raise exception 'Pick a home server first'; end if;
  if b = '' then raise exception 'Type something first'; end if;
  if p_cid !~ ('^' || m.uid || '_[a-z0-9]{6,10}$') then raise exception 'Bad comment id'; end if;
  if (select count(*) from public.rfg_gram_comments where uid = m.uid and at > now() - interval '1 minute') >= 12 then raise exception 'Slow down'; end if;
  insert into public.rfg_gram_comments(id, post_id, uid, handle, body)
    select p_cid, p_id, m.uid, coalesce(nullif(public.rfg_gram_clean(lower(p_handle), 24), ''), 'racer'), b
    where exists(select 1 from public.rfg_gram_posts where id = p_id) on conflict do nothing;
  return found;
end $$;

create or replace function public.rfg_gram_comments(p_id text) returns table(id text, uid text, handle text, body text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select id, uid, handle, body, at from (
    select id, uid, handle, body, at from public.rfg_gram_comments where post_id = p_id order by at desc limit 60) c
  order by at
$$;

create or replace function public.rfg_gram_follow(p_uid text, p_tok text, p_who text, p_handle text, p_on boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then raise exception 'Pick a home server first'; end if;
  if p_who = m.uid or p_who !~ '^[a-z0-9]{6,16}$' then return false; end if;
  if p_on then insert into public.rfg_gram_follows(uid, who, handle) values (m.uid, p_who, coalesce(nullif(public.rfg_gram_clean(lower(p_handle), 24), ''), 'racer')) on conflict do nothing;
  else delete from public.rfg_gram_follows where uid = m.uid and who = p_who; end if;
  return true;
end $$;

-- what happened to you since p_since: likes and comments on your posts, new followers
create or replace function public.rfg_gram_inbox(p_uid text, p_tok text, p_since timestamptz)
returns table(kind text, uid text, handle text, post_id text, cid text, body text, at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare m public.rfg_server_members;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then raise exception 'Pick a home server first'; end if;
  return query
    select 'like'::text, l.uid, l.handle, l.post_id, null::text, null::text, l.at from public.rfg_gram_likes l join public.rfg_gram_posts p on p.id = l.post_id
      where p.uid = m.uid and l.uid <> m.uid and l.at > p_since
    union all
    select 'comment', c.uid, c.handle, c.post_id, c.id, c.body, c.at from public.rfg_gram_comments c join public.rfg_gram_posts p on p.id = c.post_id
      where p.uid = m.uid and c.uid <> m.uid and c.at > p_since
    union all
    select 'follow', f.uid, f.handle, null, null, null, f.at from public.rfg_gram_follows f where f.who = m.uid and f.at > p_since
    order by 7 limit 200;
end $$;

grant execute on function public.rfg_gram_post(text, text, text, text, text, text, text), public.rfg_gram_delete(text, text, text),
  public.rfg_gram_feed(text, int), public.rfg_gram_img(text), public.rfg_gram_like(text, text, text, text, boolean),
  public.rfg_gram_comment(text, text, text, text, text, text), public.rfg_gram_comments(text),
  public.rfg_gram_follow(text, text, text, text, boolean), public.rfg_gram_inbox(text, text, timestamptz) to anon, authenticated;
