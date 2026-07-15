-- Fase 3: feed (posts, reviews, atividade), comentários e reações

create table posts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  author_id uuid not null references profiles (id),
  type text not null check (type in ('post', 'review', 'activity')),
  body text,
  photo_path text,
  tmdb_id integer references movies (tmdb_id),
  rating numeric(2, 1) check (rating between 0.5 and 5),
  activity_meta jsonb,
  created_at timestamptz not null default now(),
  check (type <> 'review' or (tmdb_id is not null and rating is not null)),
  check (type <> 'activity' or activity_meta is not null),
  check (type <> 'post' or (body is not null or photo_path is not null))
);

create index posts_feed_idx on posts (couple_id, created_at desc);

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  author_id uuid not null references profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  author_id uuid not null references profiles (id),
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (post_id, author_id, emoji)
);

alter table posts enable row level security;
alter table comments enable row level security;
alter table reactions enable row level security;

create policy "posts: leio do meu casal" on posts
  for select using (couple_id = my_couple_id());
create policy "posts: crio como autor" on posts
  for insert with check (couple_id = my_couple_id() and author_id = auth.uid());
create policy "posts: excluo os meus" on posts
  for delete using (author_id = auth.uid());

create policy "comments: via post do casal" on comments
  for select using (post_id in (select id from posts where couple_id = my_couple_id()));
create policy "comments: crio como autor" on comments
  for insert with check (
    author_id = auth.uid()
    and post_id in (select id from posts where couple_id = my_couple_id())
  );
create policy "comments: excluo os meus" on comments
  for delete using (author_id = auth.uid());

create policy "reactions: via post do casal" on reactions
  for select using (post_id in (select id from posts where couple_id = my_couple_id()));
create policy "reactions: crio como autor" on reactions
  for insert with check (
    author_id = auth.uid()
    and post_id in (select id from posts where couple_id = my_couple_id())
  );
create policy "reactions: removo as minhas" on reactions
  for delete using (author_id = auth.uid());
