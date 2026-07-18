import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataHealthReport, DataHealthSummary } from '../models/dataHealth'
import vuetify from '../plugins/vuetify'
import DataHealthView from './DataHealthView.vue'

const { isCurrentUserAdmin, load } = vi.hoisted(() => ({
  isCurrentUserAdmin: vi.fn(),
  load: vi.fn(),
}))

vi.mock('../repositories/dataHealthRepository', () => ({
  dataHealthRepository: {
    isCurrentUserAdmin,
    load,
    runSmokeTest: vi.fn(),
  },
}))

const summary: DataHealthSummary = {
  tournamentCount: 1,
  entryCount: 1,
  topdeckTournamentCount: 1,
  edhtop16TournamentCount: 0,
  topdeckEntryCount: 1,
  edhtop16EntryCount: 0,
  tournamentWithLocationCount: 1,
  tournamentWithoutLocationCount: 0,
  tournamentMissingDateCount: 0,
  excludedCasualEventCount: 0,
  structuredEntryCount: 1,
  plaintextEntryCount: 0,
  urlOnlyEntryCount: 0,
  missingDecklistEntryCount: 0,
  normalizedDeckCount: 1,
  completeDeckCount: 1,
  partialDeckCount: 0,
  unavailableDeckCount: 0,
  invalidDeckCount: 0,
  canonicalCardCount: 1,
  canonicalAliasCount: 1,
  canonicalWithOracleCount: 1,
  fallbackIdentityCount: 0,
  unresolvedCardRowCount: 1,
  tournamentCardCount: 1,
  tournamentCardWithoutCanonicalCount: 0,
  suspiciousAliasCount: 0,
  commanderWithOneCompleteCount: 1,
  commanderWithFiveCompleteCount: 1,
  commanderWithTwentyCompleteCount: 0,
  commanderWithFiftyCompleteCount: 0,
  commanderWithoutCompleteCount: 0,
  pairedCommanderSampleCount: 1,
  regionalCompleteDeckCount: 1,
  possibleMatchCount: 0,
  linkedEventCount: 0,
  pendingJobCount: 0,
  runningJobCount: 1,
  failedJobCount: 0,
  pausedJobCount: 0,
  completedJobCount: 0,
  staleJobCount: 0,
}

const report: DataHealthReport = {
  summary,
  commanders: [{
    commanderKey: 'a // b',
    commanderName: 'A // B',
    completeDeckCount: 5,
    partialDeckCount: 0,
    unavailableDeckCount: 0,
    tournamentCount: 1,
    entryCount: 5,
    countryCount: 1,
    stateRegionCount: 1,
    pairedCommander: true,
    inclusionReady: true,
    comparisonReady: true,
    sampleStatus: 'limited',
    top16SampleCount: 2,
    firstPlaceSampleCount: 1,
    regionalSampleCount: 1,
    unresolvedCardRate: 0,
    aliasMismatchCount: 0,
    oneSidedExtractionFailureCount: 0,
  }],
  unresolvedCards: [{
    normalizedName: 'mystery',
    displayName: 'Mystery Card',
    occurrenceCount: 2,
    affectedDeckCount: 1,
    affectedCommanderCount: 1,
    sampleIssueCode: 'unknown_card',
    providerBreakdown: { topdeck: 2 },
    currentAliasMatch: false,
  }],
  jobs: [{
    jobId: 'job',
    provider: 'topdeck',
    jobStatus: 'running',
    stage: 'decks',
    startDate: '2026-07-01',
    endDate: '2026-07-02',
    attempts: 1,
    updatedAt: '2026-07-18T00:00:00Z',
    stale: false,
  }],
  regions: [{
    regionKey: 'country:US/state:MN',
    tournamentCount: 1,
    entryCount: 5,
    completeDeckCount: 5,
  }],
  consistencyChecks: [{
    label: 'Sample warning',
    status: 'warning',
    message: 'Counts differ.',
  }],
}

beforeEach(() => {
  isCurrentUserAdmin.mockReset()
  load.mockReset()
})

describe('DataHealthView', () => {
  it('denies non-admin users without loading diagnostics', async () => {
    isCurrentUserAdmin.mockResolvedValue(false)
    const wrapper = mount(DataHealthView, {
      global: { plugins: [vuetify] },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('do not have permission')
    expect(load).not.toHaveBeenCalled()
  })

  it('renders bounded health sections and refreshes through the repository', async () => {
    isCurrentUserAdmin.mockResolvedValue(true)
    load.mockResolvedValue(report)
    const wrapper = mount(DataHealthView, {
      global: {
        plugins: [vuetify],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Commander analytics readiness')
    expect(wrapper.text()).toContain('A // B')
    expect(wrapper.text()).toContain('Mystery Card')
    expect(wrapper.text()).toContain('topdeck · decks · running')
    expect(wrapper.text()).toContain('Counts differ.')

    const refresh = wrapper.findAll('button')
      .find((button) => button.text().includes('Refresh'))
    expect(refresh).toBeDefined()
    await refresh!.trigger('click')
    await flushPromises()
    expect(load).toHaveBeenCalledTimes(2)
  })
})
