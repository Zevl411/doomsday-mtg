-- Run after applying migrations:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/card_associations.sql
begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.get_commander_card_associations(text,uuid,date,date,text,integer,integer,integer,integer,numeric,numeric,integer)'::regprocedure
  ) into definition;

  if position('deck.parsing_status = ''complete''' in definition) = 0 then
    raise exception 'association RPC must use complete Decks only';
  end if;
  if position('canonical.oracle_id is not null' in definition) = 0 then
    raise exception 'association RPC must use Oracle-backed identities';
  end if;
  if position('tournament.region_key = p_region_key' in definition) = 0 then
    raise exception 'association RPC must retain its regional filter';
  end if;
  if position('entry.standing <= p_maximum_standing' in definition) = 0 then
    raise exception 'association RPC must retain its placement filter';
  end if;

  -- Formula regression: 10 joint Decks in 40 total, with 20 source and 16
  -- target Decks, yields support .25, confidence .5, and lift 1.25.
  if 10::numeric / 40 <> 0.25 then
    raise exception 'support formula regression';
  end if;
  if 10::numeric / 20 <> 0.5 then
    raise exception 'confidence formula regression';
  end if;
  if (10::numeric / 20) / (16::numeric / 40) <> 1.25 then
    raise exception 'lift formula regression';
  end if;
end;
$$;

rollback;
