import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supplying `any` preserves the flexible table names used by this server-only
// admin client. Without it, Deno can infer every table operation as `never`.
// The generated database schema is not available inside this standalone Edge
// Function, so the admin client intentionally retains Supabase's dynamic row type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = ReturnType<typeof createClient<any>>;

const jsonHeaders = { 'Content-Type': 'application/json' };

/**
 * Cron calls this small worker repeatedly. Tournament metadata and card-level
 * Deck normalization are separate stages of the same durable batch, keeping
 * each Edge Function invocation below the platform memory limit.
 */
Deno.serve(async (request) => {
  const secret = Deno.env.get('INGESTION_WORKER_SECRET');
  if (!secret || request.headers.get('x-ingestion-worker-secret') !== secret) {
    return response({ error: 'Worker authentication failed.' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return response({ error: 'Worker configuration is incomplete.' }, 500);
  }
  const admin = createClient(url, serviceKey);
  const { data: batch, error: claimError } = await admin.rpc('claim_tournament_ingestion_batch');
  if (claimError) return response({ error: claimError.message }, 500);
  if (!batch?.id) return response({ message: 'No pending batches.' });

  const { data: job, error: jobError } = await admin
    .from('tournament_ingestion_jobs')
    .select('*')
    .eq('id', batch.job_id)
    .single();
  if (jobError) {
    await failBatch(admin, batch, jobError.message);
    return response({ error: jobError.message }, 500);
  }

  try {
    if (batch.stage === 'decks') {
      return await processDeckStage(admin, url, serviceKey, secret, batch, job);
    }

    const ingestionResponse = await fetch(`${url}/functions/v1/ingest-tournaments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'x-ingestion-worker-secret': secret,
      },
      body: JSON.stringify({
        provider: job.provider,
        startDate: batch.start_date,
        endDate: batch.end_date,
        minimumPlayers: job.minimum_players,
        includeRounds: job.include_rounds,
        enrichLocation: job.enrich_location,
        excludeCasualEvents: job.exclude_casual_events !== false,
        dryRun: false,
      }),
    });
    const report: unknown = await ingestionResponse.json();
    if (
      !ingestionResponse.ok ||
      !isRecord(report) ||
      !Array.isArray(report.providerErrors) ||
      report.providerErrors.length
    ) {
      const message =
        readReportError(report) ?? `Ingestion returned HTTP ${ingestionResponse.status}.`;
      await failBatch(admin, batch, message);
      return response({ batchId: batch.id, error: message }, 500);
    }

    const { error: updateError } = await admin
      .from('tournament_ingestion_batches')
      .update({
        // Cron will claim this same date window again for its bounded Deck
        // stage. This checkpoints metadata before any Scryfall work begins.
        status: 'pending',
        stage: 'decks',
        attempts: 0,
        last_error: null,
        tournaments_fetched: numberValue(report.tournamentsFetched),
        tournaments_inserted: numberValue(report.tournamentsInserted),
        tournaments_updated: numberValue(report.tournamentsUpdated),
        entries_fetched: numberValue(report.entriesFetched),
        entries_inserted: numberValue(report.entriesInserted),
        entries_updated: numberValue(report.entriesUpdated),
        tournaments_excluded: numberValue(report.tournamentsExcluded),
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batch.id);
    if (updateError) throw updateError;
    await refreshJob(admin, batch.job_id);
    return response({
      batchId: batch.id,
      stage: 'tournaments',
      nextStage: 'decks',
      report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Worker failed.';
    await failBatch(admin, batch, message);
    return response({ batchId: batch.id, error: message }, 500);
  }
});

async function processDeckStage(
  admin: AdminClient,
  url: string,
  serviceKey: string,
  secret: string,
  batch: Record<string, unknown>,
  job: Record<string, unknown>,
) {
  const ingestionResponse = await fetch(`${url}/functions/v1/ingest-tournament-decks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'x-ingestion-worker-secret': secret,
    },
    body: JSON.stringify({
      provider: job.provider,
      startDate: batch.start_date,
      endDate: batch.end_date,
      onlyMissing: true,
      retryPartial: false,
      dryRun: false,
    }),
  });
  const report: unknown = await ingestionResponse.json();
  if (
    !ingestionResponse.ok ||
    !isRecord(report) ||
    !Array.isArray(report.errors) ||
    report.errors.length
  ) {
    const message =
      readDeckReportError(report) ?? `Deck ingestion returned HTTP ${ingestionResponse.status}.`;
    await failBatch(admin, batch, message);
    return response({ batchId: batch.id, stage: 'decks', error: message }, 500);
  }

  const hasMore = report.hasMore === true;
  const { error: updateError } = await admin
    .from('tournament_ingestion_batches')
    .update({
      // Twenty-five source Decks are normalized per invocation. A pending batch is
      // picked up by the next cron tick until the date window is exhausted.
      status: hasMore ? 'pending' : 'completed',
      stage: 'decks',
      attempts: 0,
      last_error: null,
      deck_entries_considered:
        numberValue(batch.deck_entries_considered) + numberValue(report.entriesConsidered),
      decks_inserted: numberValue(batch.decks_inserted) + numberValue(report.decksInserted),
      decks_updated: numberValue(batch.decks_updated) + numberValue(report.decksUpdated),
      decks_completed: numberValue(batch.decks_completed) + numberValue(report.decksCompleted),
      decks_partial: numberValue(batch.decks_partial) + numberValue(report.decksPartial),
      decks_unavailable:
        numberValue(batch.decks_unavailable) + numberValue(report.decksUnavailable),
      completed_at: hasMore ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(batch.id));
  if (updateError) throw updateError;
  await refreshJob(admin, String(batch.job_id));
  return response({
    batchId: batch.id,
    stage: 'decks',
    hasMore,
    report,
  });
}

async function failBatch(admin: AdminClient, batch: Record<string, unknown>, message: string) {
  await admin
    .from('tournament_ingestion_batches')
    .update({
      status: Number(batch.attempts) >= 3 ? 'failed' : 'pending',
      last_error: message.slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq('id', String(batch.id));
  await refreshJob(admin, String(batch.job_id));
}

async function refreshJob(admin: AdminClient, jobId: string) {
  await admin.rpc('refresh_tournament_ingestion_job', {
    target_job_id: jobId,
  });
}

function readReportError(value: unknown) {
  if (!isRecord(value)) return null;
  if (typeof value.error === 'string') return value.error;
  if (Array.isArray(value.providerErrors)) {
    return value.providerErrors
      .filter((item): item is string => typeof item === 'string')
      .join(' ');
  }
  return null;
}

function readDeckReportError(value: unknown) {
  if (!isRecord(value)) return null;
  if (typeof value.error === 'string') return value.error;
  if (Array.isArray(value.errors)) {
    return value.errors.filter((item): item is string => typeof item === 'string').join(' ');
  }
  return null;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: jsonHeaders,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
