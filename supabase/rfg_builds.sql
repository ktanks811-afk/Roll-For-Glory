-- What players have built on their property, saved on their deeds so the
-- rest of their server sees their place even after they log off
-- (js/net/builds.js). Run after rfg_servers.sql. Safe to run again.
-- A build is the house design, garage plan, fence, livestock, dogs and the
-- cars in the garage bays; the game checks every field before using it.

alter table public.rfg_deeds add column if not exists build jsonb;
alter table public.rfg_deeds add column if not exists build_at timestamptz;

-- p_builds = { prop: build | null } for the deeds you hold on your server.
-- Anything that isn't yours is skipped. Returns how many were saved.
create or replace function public.rfg_build_save(p_uid text, p_tok text, p_builds json) returns int
language plpgsql security definer set search_path = public as $$
declare m public.rfg_server_members; k text; v json; n int := 0;
begin
  m := public.rfg_srv_me(p_uid, p_tok);
  if m.uid is null then raise exception 'Pick a home server first'; end if;
  if p_builds is null or json_typeof(p_builds) <> 'object' then raise exception 'Bad builds'; end if;
  if length(p_builds::text) > 400000 then raise exception 'Too much to save'; end if;
  for k, v in select key, value from json_each(p_builds) loop
    if k !~ '^[a-z0-9_]{1,40}$' then continue; end if;
    if json_typeof(v) not in ('object', 'null') or length(v::text) > 100000 then continue; end if;
    update public.rfg_deeds set build = case when json_typeof(v) = 'null' then null else v::jsonb end, build_at = now()
      where server = m.server and prop = k and uid = m.uid;
    if found then n := n + 1; end if;
  end loop;
  update public.rfg_server_members set seen_at = now() where uid = m.uid;
  return n;
end $$;

create or replace function public.rfg_builds_get(p_server text) returns table(prop text, uid text, name text, build jsonb)
language sql stable security definer set search_path = public as $$
  select prop, uid, name, build from public.rfg_deeds where server = p_server and build is not null
$$;

grant execute on function public.rfg_build_save(text, text, json), public.rfg_builds_get(text) to anon, authenticated;
