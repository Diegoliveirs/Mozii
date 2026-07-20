-- Álbum premium: limite de fotos por memória. Free = 5 fotos, Premium = 20.
-- Fonte da verdade = RLS (o client fala direto com o banco). Recria a policy de
-- insert de moments (013) somando a checagem de nº de fotos ao gate de 5/mês.

drop policy if exists "moments: crio como autor" on moments;

create policy "moments: crio como autor" on moments
  for insert with check (
    couple_id = my_couple_id()
    and author_id = auth.uid()
    -- gate free/premium de quantidade mensal (mantido do 013)
    and (
      has_premium(couple_id)
      or (
        select count(*) from moments m
        where m.couple_id = my_couple_id()
          and m.created_at >= date_trunc('month', now())
      ) < 5
    )
    -- gate de fotos por memória (álbum): free 5, premium 20
    and coalesce(array_length(photo_paths, 1), 0)
        <= case when has_premium(couple_id) then 20 else 5 end
  );
