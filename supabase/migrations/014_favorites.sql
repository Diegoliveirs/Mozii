-- v14: Favoritos por membro — a fileira de filmes favoritos do perfil (estilo
-- Letterboxd). Por PESSOA (profile_id), não por espaço. Máx. 5 por membro.
-- Membros do mesmo espaço leem os favoritos uns dos outros (perfil do par).
--
-- Fonte da verdade = Postgres (anon key no client). O cap de 5 é RLS, não JS.

create table favorites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  couple_id uuid not null references couples (id) on delete cascade,
  tmdb_id integer not null references movies (tmdb_id),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, tmdb_id)
);

create index favorites_profile_idx on favorites (profile_id, position);

alter table favorites enable row level security;

-- leio os favoritos de quem está no meu espaço (perfil próprio e do par)
create policy "favorites: leio do meu espaço" on favorites
  for select using (couple_id = my_couple_id());

-- crio só os meus, no meu espaço, com teto de 5
create policy "favorites: crio os meus (máx 5)" on favorites
  for insert with check (
    profile_id = auth.uid()
    and couple_id = my_couple_id()
    and (select count(*) from favorites f where f.profile_id = auth.uid()) < 5
  );

-- reordenar (position) só os meus
create policy "favorites: edito os meus" on favorites
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "favorites: removo os meus" on favorites
  for delete using (profile_id = auth.uid());

-- eventos realtime do espaço (padrão de 009_realtime.sql)
alter publication supabase_realtime add table favorites;
alter table favorites replica identity full;
