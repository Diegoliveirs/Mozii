-- Fase 2: cache de filmes TMDB, listas e itens

create table movies (
  tmdb_id integer primary key,
  title text not null,
  poster_path text,
  release_year integer,
  overview text,
  updated_at timestamptz not null default now()
);

create table lists (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  name text not null,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists (id) on delete cascade,
  tmdb_id integer not null references movies (tmdb_id),
  added_by uuid not null references profiles (id),
  watched boolean not null default false,
  created_at timestamptz not null default now(),
  unique (list_id, tmdb_id)
);

alter table movies enable row level security;
alter table lists enable row level security;
alter table list_items enable row level security;

-- cache compartilhado: qualquer usuário autenticado lê/escreve (app pessoal)
create policy "movies: leitura autenticada" on movies
  for select to authenticated using (true);
create policy "movies: upsert autenticado" on movies
  for insert to authenticated with check (true);
create policy "movies: update autenticado" on movies
  for update to authenticated using (true);

create policy "lists: tudo do meu casal" on lists
  for all using (couple_id = my_couple_id()) with check (couple_id = my_couple_id());

create policy "list_items: via lista do casal" on list_items
  for all using (list_id in (select id from lists where couple_id = my_couple_id()))
  with check (list_id in (select id from lists where couple_id = my_couple_id()));
