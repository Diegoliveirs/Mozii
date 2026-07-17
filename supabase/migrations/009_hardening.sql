-- v9: hardening de segurança (pré-requisito para cobrar)
-- O client fala direto com o Postgres, então todo gating de plano depende de
-- RLS íntegra. Quatro frentes:
--   1. WITH CHECK explícito nos UPDATEs que não tinham;
--   2. profiles.couple_id imutável por escrita direta (só RPCs definer);
--   3. movies deixa de aceitar INSERT/UPDATE direto — upsert via RPC validada;
--   4. rate-limit de tentativas de invite code no join_couple.

-- ---------------------------------------------------------------------------
-- 1a) profiles: UPDATE ganha WITH CHECK (antes o USING sozinho deixava a
--     linha ser reescrita para valores arbitrários sem checagem da linha nova)
drop policy if exists "profiles: atualizo o meu" on profiles;
create policy "profiles: atualizo o meu" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- 1b) posts: WITH CHECK fixa autor E couple_id — sem isso um post podia ser
--     "movido" para outro espaço via PATCH
drop policy if exists "posts: atualizo os meus" on posts;
create policy "posts: atualizo os meus" on posts
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid() and couple_id = my_couple_id());

-- ---------------------------------------------------------------------------
-- 2) profiles.couple_id só muda pelas RPCs security definer
--    (create_couple / join_couple / leave_couple, que rodam como owner e
--    ignoram grants de authenticated). Subtileza do Postgres: não existe
--    REVOKE de uma coluna sobre um GRANT de tabela inteira — é preciso
--    revogar o UPDATE da tabela e devolver coluna a coluna.
revoke update on profiles from anon, authenticated;
grant update (display_name, avatar_url) on profiles to authenticated;
-- deletion_requested_at fica de fora: só via request/cancel_account_deletion.

-- ---------------------------------------------------------------------------
-- 3) movies: o cache era INSERT/UPDATE aberto a qualquer autenticado
--    (002_lists.sql) — qualquer conta podia vandalizar título/poster de
--    filmes vistos por todos os casais. Como o client usa .upsert()
--    (insert-on-conflict-update), trocamos as duas policies por uma RPC
--    security definer que valida os campos e faz o upsert. SELECT segue
--    aberto (cache compartilhado, dados públicos do TMDB).
drop policy if exists "movies: upsert autenticado" on movies;
drop policy if exists "movies: update autenticado" on movies;
revoke insert, update, delete on movies from anon, authenticated;

create or replace function upsert_movie(
  p_tmdb_id integer,
  p_title text,
  p_poster_path text default null,
  p_release_year integer default null,
  p_overview text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if p_tmdb_id is null or p_tmdb_id <= 0 then
    raise exception 'tmdb_id inválido';
  end if;
  if p_title is null or btrim(p_title) = '' or length(p_title) > 500 then
    raise exception 'Título inválido';
  end if;
  -- poster_path do TMDB tem a forma "/abc123.jpg"
  if p_poster_path is not null
     and (length(p_poster_path) > 200 or p_poster_path !~ '^/[A-Za-z0-9._-]+$') then
    raise exception 'Poster inválido';
  end if;
  if p_release_year is not null
     and (p_release_year < 1870 or p_release_year > extract(year from now())::int + 5) then
    raise exception 'Ano inválido';
  end if;
  if p_overview is not null and length(p_overview) > 5000 then
    raise exception 'Sinopse inválida';
  end if;

  insert into movies (tmdb_id, title, poster_path, release_year, overview, updated_at)
  values (p_tmdb_id, p_title, p_poster_path, p_release_year, p_overview, now())
  on conflict (tmdb_id) do update set
    title = excluded.title,
    poster_path = excluded.poster_path,
    release_year = excluded.release_year,
    overview = excluded.overview,
    updated_at = now();
end;
$$;

revoke execute on function upsert_movie(integer, text, text, integer, text) from public, anon;
grant execute on function upsert_movie(integer, text, text, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) rate-limit de invite code: 6 chars hex = ~24 bits, sem expiração —
--    força bruta era ilimitada. Tabela de tentativas falhas + checagem na
--    própria RPC. RLS ligada SEM policies: só funções definer tocam nela.
create table if not exists join_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists join_attempts_user_time_idx
  on join_attempts (user_id, attempted_at);
alter table join_attempts enable row level security;
revoke all on join_attempts from anon, authenticated;

-- Nuance transacional: um RAISE EXCEPTION desfaz a transação INTEIRA da
-- request, inclusive o INSERT da tentativa — com exception o contador nunca
-- acumularia. Por isso código inválido passa a devolver NULL (a transação
-- commita e a tentativa persiste) e o client traduz NULL para a mesma
-- mensagem 'Código inválido' de antes. Os demais erros seguem como exception.
create or replace function join_couple(code text) returns couples
language plpgsql security definer set search_path = public as $$
declare
  c couples;
  member_count int;
  recent_failures int;
begin
  if my_couple_id() is not null then
    raise exception 'Você já está em um espaço';
  end if;
  select count(*) into recent_failures from join_attempts
    where user_id = auth.uid()
      and attempted_at > now() - interval '15 minutes';
  if recent_failures >= 5 then
    raise exception 'Muitas tentativas, aguarde alguns minutos';
  end if;
  select * into c from couples where invite_code = upper(code);
  if c.id is null then
    insert into join_attempts (user_id) values (auth.uid());
    return null; -- client traduz para 'Código inválido'
  end if;
  select count(*) into member_count from profiles where couple_id = c.id;
  if member_count >= 2 then
    raise exception 'Este espaço já está completo';
  end if;
  update profiles set couple_id = c.id where id = auth.uid();
  return c;
end;
$$;

-- higiene: tentativas antigas não servem para nada depois da janela
select cron.schedule(
  'purge-join-attempts',
  '0 * * * *',
  $$delete from join_attempts where attempted_at < now() - interval '1 day'$$
);
