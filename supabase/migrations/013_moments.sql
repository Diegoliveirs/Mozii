-- v13: Momentos / Diário — linha do tempo de memórias do espaço.
-- Cada momento = 1+ fotos (bucket post-photos, já com RLS por pasta de casal)
-- + legenda + data escolhida (happened_on, distinta de created_at para o casal
-- registrar memórias antigas). Reformulação: o app deixa de ser só filmes.
--
-- Fonte da verdade = Postgres. O client fala direto com o banco (anon key),
-- então o gate free/premium é RLS server-side; o client só decide o que MOSTRAR.

create table moments (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples (id) on delete cascade,
  author_id uuid not null references profiles (id),
  caption text,
  happened_on date not null default current_date,
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (caption is not null or array_length(photo_paths, 1) >= 1)
);

-- ordenação da timeline: pela data do acontecido, desempate pela criação
create index moments_timeline_idx on moments (couple_id, happened_on desc, created_at desc);

alter table moments enable row level security;

create policy "moments: leio do meu espaço" on moments
  for select using (couple_id = my_couple_id());

-- Gate free: até 5 momentos/mês por espaço; premium = ilimitado.
-- Espelha o gate de listas (011_subscriptions §4): has_premium é SECURITY
-- DEFINER e enxerga couples/subscriptions sem depender da RLS do chamador.
create policy "moments: crio como autor" on moments
  for insert with check (
    couple_id = my_couple_id()
    and author_id = auth.uid()
    and (
      has_premium(couple_id)
      or (
        select count(*) from moments m
        where m.couple_id = my_couple_id()
          and m.created_at >= date_trunc('month', now())
      ) < 5
    )
  );

create policy "moments: excluo os meus" on moments
  for delete using (author_id = auth.uid());

-- eventos realtime do espaço (padrão de 009_realtime.sql)
alter publication supabase_realtime add table moments;
alter table moments replica identity full;
