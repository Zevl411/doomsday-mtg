import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CardSearch from './CardSearch.vue'
import { searchCards } from '../api/scryfall'
import { searchCanonicalCards } from '../repositories/canonicalCardRepository'
import vuetify from '../plugins/vuetify'
import type { ScryfallCard } from '../types/card'

vi.mock('../api/scryfall', () => ({
  searchCards: vi.fn(),
}))
vi.mock('../repositories/canonicalCardRepository', () => ({
  searchCanonicalCards: vi.fn(),
}))

const card: ScryfallCard = {
  id: 'card-printing',
  name: 'Test Card',
  type_line: 'Artifact',
  color_identity: [],
}

afterEach(() => {
  vi.mocked(searchCards).mockReset()
  vi.mocked(searchCanonicalCards).mockReset()
})

function mountSearch(props: { commanderOnly?: boolean } = {}) {
  return mount(CardSearch, {
    props,
    global: {
      plugins: [vuetify],
    },
  })
}

describe('CardSearch', () => {
  it('renders a search input', () => {
    const wrapper = mountSearch()

    expect(wrapper.find('input[type="search"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not search for an empty query', async () => {
    vi.useFakeTimers()
    const wrapper = mountSearch()

    await wrapper.find('input').setValue('   ')
    await vi.advanceTimersByTimeAsync(300)

    expect(searchCards).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('waits for the debounce and then searches', async () => {
    vi.useFakeTimers()
    vi.mocked(searchCards).mockResolvedValue([card])
    const wrapper = mountSearch()

    await wrapper.find('input').setValue('test')
    await vi.advanceTimersByTimeAsync(249)
    expect(searchCards).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()

    expect(searchCards).toHaveBeenCalledWith(
      'test',
      expect.any(AbortSignal),
    )
    expect(wrapper.text()).toContain('Test Card')
    wrapper.unmount()
  })

  it('adds Commander filters when requested', async () => {
    vi.useFakeTimers()
    vi.mocked(searchCards).mockResolvedValue([])
    const wrapper = mountSearch({ commanderOnly: true })

    await wrapper.find('input').setValue('atraxa')
    await vi.advanceTimersByTimeAsync(250)

    expect(searchCards).toHaveBeenCalledWith(
      'atraxa is:commander legal:commander',
      expect.any(AbortSignal),
    )
    wrapper.unmount()
  })

  it('emits card-selected when a result is selected', async () => {
    vi.useFakeTimers()
    vi.mocked(searchCards).mockResolvedValue([card])
    const wrapper = mountSearch()

    await wrapper.find('input').setValue('test')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    await wrapper.find('.card-result').trigger('click')

    expect(wrapper.emitted('card-selected')?.[0]).toEqual([card])
    wrapper.unmount()
  })

  it('shows loading and friendly API errors', async () => {
    vi.useFakeTimers()
    let rejectSearch: ((reason: Error) => void) | undefined
    vi.mocked(searchCards).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectSearch = reject
        }),
    )
    const wrapper = mountSearch()

    await wrapper.find('input').setValue('missing')
    await vi.advanceTimersByTimeAsync(250)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Searching')

    rejectSearch?.(new Error('No matching cards found.'))
    await flushPromises()
    expect(wrapper.text()).toContain('No matching cards found.')
    wrapper.unmount()
  })

  it('falls back to cached canonical cards during a Scryfall outage', async () => {
    vi.useFakeTimers()
    const unavailable = new Error('Unable to reach Scryfall.')
    unavailable.name = 'ScryfallUnavailableError'
    vi.mocked(searchCards).mockRejectedValue(unavailable)
    vi.mocked(searchCanonicalCards).mockResolvedValue([card])
    const wrapper = mountSearch()

    await wrapper.find('input').setValue('test')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    expect(searchCanonicalCards).toHaveBeenCalledWith('test', {
      commanderOnly: false,
      allowedColorIdentity: undefined,
    })
    expect(wrapper.text()).toContain(
      'Scryfall is unavailable. Showing cached tournament cards.',
    )
    expect(wrapper.text()).toContain('Test Card')
    wrapper.unmount()
  })

  it('does not show an error for an intentionally aborted request', async () => {
    vi.useFakeTimers()
    vi.mocked(searchCards).mockImplementation((_query, signal) => {
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })
    const wrapper = mountSearch()

    await wrapper.find('input').setValue('first')
    await vi.advanceTimersByTimeAsync(250)
    await wrapper.find('input').setValue('second')
    await flushPromises()

    expect(wrapper.text()).not.toContain('AbortError')
    expect(wrapper.find('[type="error"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('aborts an active request when unmounted', async () => {
    vi.useFakeTimers()
    let requestSignal: AbortSignal | undefined
    vi.mocked(searchCards).mockImplementation((_query, signal) => {
      requestSignal = signal
      return new Promise(() => undefined)
    })
    const wrapper = mountSearch()

    await wrapper.find('input').setValue('test')
    await vi.advanceTimersByTimeAsync(250)
    wrapper.unmount()

    expect(requestSignal?.aborted).toBe(true)
  })
})
