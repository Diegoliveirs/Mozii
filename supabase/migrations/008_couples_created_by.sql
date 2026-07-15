-- fix: couples.created_by referencia auth.users sem cascade e bloqueava
-- a exclusão de conta (e a purga do cron). O casal sobrevive à saída do
-- criador: FK vira ON DELETE SET NULL.

alter table couples alter column created_by drop not null;

alter table couples drop constraint couples_created_by_fkey;
alter table couples add constraint couples_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;
