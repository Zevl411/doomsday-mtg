-- PostgreSQL views otherwise run with the view owner's permissions. Security
-- invoker makes the underlying tournament-table RLS and grants apply to the
-- caller, resolving Supabase's Security Definer View advisor warning.
alter view public.possible_tournament_matches
set (security_invoker = true);

alter view public.linked_tournament_events
set (security_invoker = true);
