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
  mana_cost: '{2}{U}',
  type_line: 'Artifact',
  color_identity: [],
}

afterEach(() => {
  vi.mocked(searchCards).mockReset()
  vi.mocked(searchCanonicalCards).mockReset()
})

function mountSearch(
  props: {
    commanderOnly?: boolean
    retainSelectedName?: boolean
    resultFilter?: (card: ScryfallCard) => boolean
    selectedCard?: ScryfallCard | null
    selectedCards?: ScryfallCard[]
  } = {},
) {
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
    expect(wrapper.find('.search-results').isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('does not show an empty dropdown while a query is debouncing', async () => {
    vi.useFakeTimers()
    const wrapper = mountSearch()

    await wrapper.find('input').setValue('test')

    expect(wrapper.find('.search-results').isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('shows a clear control for standard card searches', async () => {
    const wrapper = mountSearch()

    await wrapper.find('input').setValue('test')

    expect(wrapper.find('.v-field__clearable').exists()).toBe(true)
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
    expect(wrapper.find('.card-result-name').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Mana cost {2}{U}"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Artifact')
    expect(wrapper.text()).not.toContain('Color identity')
    wrapper.unmount()
  })

  it('closes card results when clicking outside the search', async () => {
    vi.useFakeTimers()
    vi.mocked(searchCards).mockResolvedValue([card])
    const wrapper = mount(CardSearch, {
      attachTo: document.body,
      global: { plugins: [vuetify] },
    })

    await wrapper.find('input').setValue('test')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    expect(wrapper.find('.card-result').exists()).toBe(true)

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    )
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.search-results').isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('reopens existing results when the search input regains focus', async () => {
    vi.useFakeTimers()
    vi.mocked(searchCards).mockResolvedValue([card])
    const wrapper = mount(CardSearch, {
      attachTo: document.body,
      global: { plugins: [vuetify] },
    })

    const input = wrapper.find('input')
    await input.setValue('test')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    )
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.search-results').isVisible()).toBe(false)

    await input.trigger('focus')

    expect(wrapper.find('.search-results').isVisible()).toBe(true)
    expect(wrapper.find('.card-result').exists()).toBe(true)
    expect(searchCards).toHaveBeenCalledTimes(1)
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

  it('only displays results accepted by the compatibility filter', async () => {
    vi.useFakeTimers()
    const incompatible = { ...card, id: 'other', name: 'Other Card' }
    vi.mocked(searchCards).mockResolvedValue([card, incompatible])
    const wrapper = mountSearch({
      resultFilter: (result) => result.id === card.id,
    })

    await wrapper.find('input').setValue('card')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    expect(wrapper.text()).toContain('Test Card')
    expect(wrapper.text()).not.toContain('Other Card')
    wrapper.unmount()
  })

  it('keeps a selected card name in the input without leaving results open', async () => {
    vi.useFakeTimers()
    vi.mocked(searchCards).mockResolvedValue([card])
    const wrapper = mountSearch({ retainSelectedName: true })

    await wrapper.find('input').setValue('test')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    await wrapper.find('.card-result').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('input').element.value).toBe('Test Card')
    expect(wrapper.find('.card-result').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows and clears a selected card chip inside the input', async () => {
    const wrapper = mountSearch({ selectedCard: card })

    const chip = wrapper.find('.selected-card-chip')
    const chipLabel = wrapper.find('.selected-card-chip__label')
    expect(chipLabel.text()).toBe('Test')
    expect(chipLabel.element.textContent).toBe('Test')
    expect(chip.text()).not.toContain('Test Card')
    expect(wrapper.find('input').attributes('placeholder')).toBeUndefined()
    expect(wrapper.text()).not.toContain('Search for a Magic card')
    const closeButton = chip.find('.selected-card-chip__close')
    expect(closeButton.text()).toBe('×')
    expect(closeButton.attributes('aria-label')).toBe('Clear Test Card')
    await closeButton.trigger('click')

    expect(wrapper.emitted('cleared')).toHaveLength(1)
    wrapper.unmount()
  })

  it('renders multiple selected cards as removable input chips', async () => {
    const secondCard = { ...card, id: 'second-printing', name: 'Other Card' }
    const wrapper = mountSearch({ selectedCards: [card, secondCard] })

    expect(wrapper.findAll('.selected-card-chip')).toHaveLength(2)
    expect(wrapper.find('input').attributes('placeholder')).toBeUndefined()
    await wrapper
      .findAll('.selected-card-chip__close')[1]
      .trigger('click')

    expect(wrapper.emitted('card-removed')?.[0]).toEqual([secondCard])
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
