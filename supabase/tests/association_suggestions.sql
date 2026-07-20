-- Run after applying migrations:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--   -f supabase/tests/association_suggestions.sql
begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.get_association_based_card_suggestions(text,uuid[],date,date,text,integer,integer,integer,integer,numeric,numeric,integer,integer)'::regprocedure
  ) into definition;

  if position('deck.parsing_status = ''complete''' in definition) = 0 then
    raise exception 'suggestion evidence must use complete Decks only';
  end if;
  if position('canonical.oracle_id is not null' in definition) = 0 then
    raise exception 'suggestion evidence must use Oracle identities';
  end if;
  if position('count(distinct thresholded.source_card_id)' in definition) = 0
  then
    raise exception 'suggestions must require distinct supporting cards';
  end if;

  -- The suggestion RPC deliberately retains the v0.4 formulas.
  if 42::numeric / 100 <> 0.42 then
    raise exception 'support formula regression';
  end if;
  if 42::numeric / 60 <> 0.7 then
    raise exception 'confidence formula regression';
  end if;
  if (42::numeric / 60) / (50::numeric / 100) <> 1.4 then
    raise exception 'lift formula regression';
  end if;
end;
$$;

rollback;
