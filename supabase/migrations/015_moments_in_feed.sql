-- Memórias no feed: cada memória vira também um post do tipo 'moment', que reusa
-- reações, comentários e realtime dos posts. A tabela moments segue como fonte de
-- verdade do álbum/linha do tempo em /momentos; o post é a presença social no Mural.

-- 1) libera o novo tipo de post
alter table posts drop constraint if exists posts_type_check;
alter table posts add constraint posts_type_check
  check (type in ('post', 'review', 'activity', 'moment'));

-- 2) backfill idempotente: cria o post-companheiro das memórias já existentes,
--    preservando author, casal e a data original (created_at).
insert into posts (couple_id, author_id, type, body, activity_meta, created_at)
select m.couple_id,
       m.author_id,
       'moment',
       m.caption,
       jsonb_build_object('moment_id', m.id, 'photo_paths', to_jsonb(m.photo_paths)),
       m.created_at
from moments m
where not exists (
  select 1 from posts p
  where p.type = 'moment' and p.activity_meta->>'moment_id' = m.id::text
);
