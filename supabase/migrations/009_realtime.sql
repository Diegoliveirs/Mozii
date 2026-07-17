-- eventos realtime para o casal: feed, comentários, reações e listas.
-- sem isso a subscription postgres_changes nunca dispara.
alter publication supabase_realtime add table posts, comments, reactions, lists, list_items;

-- filtros de canal (couple_id=eq.X) precisam da linha antiga em DELETE/UPDATE
alter table posts replica identity full;
alter table lists replica identity full;
