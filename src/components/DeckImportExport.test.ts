import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import DeckImportExport from './DeckImportExport.vue'
import vuetify from '../plugins/vuetify'
import { prepareDeckImport } from '../services/deckImport'
import { useDeckStore } from '../stores/deck'
import type { ScryfallCard } from '../types/card'

vi.mock('../services/deckImport', () => ({
  prepareDeckImport: vi.fn(),
}))

const commander: ScryfallCard = {
  id: 'commander-printing',
  name: 'Commander',
  type_line: 'Legendary Creature',
  color_identity: ['U'],
}
const solRing: ScryfallCard = {
  id: 'sol-ring-printing',
  name: 'Sol Ring',
  type_line: 'Artifact',
  color_identity: [],
}

beforeEach(() => {
  setActivePinia(createPinia())
  useDeckStore().createDeck()
  vi.mocked(prepareDeckImport).mockReset()
})

function mountComponent() {
  return mount(DeckImportExport, {
    global: {
      plugins: [vuetify],
      stubs: {
        VDialog: {
          props: ['modelValue'],
          template: '<div v-if="modelValue"><slot /></div>',
        },
      },
    },
  })
}

function findButton(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper
    .findAll('button')
    .find((button) => button.text().includes(label))
}

describe('DeckImportExport', () => {
  it('opens the import dialog', async () => {
    const wrapper = mountComponent()

    await findButton(wrapper, 'Import Decklist')?.trigger('click')

    expect(wrapper.text()).toContain('Plaintext decklist')
    expect(wrapper.text()).toContain('replaces every tracked board')
    wrapper.unmount()
  })

  it('opens export and shows formatted plaintext', async () => {
    const store = useDeckStore()
    store.deck.commander = commander
    store.deck.cards = [{ card: solRing, quantity: 1 }]
    const wrapper = mountComponent()

    await findButton(wrapper, 'Export Decklist')?.trigger('click')

    expect(wrapper.find('textarea').element.value).toContain('Commander')
    expect(wrapper.find('textarea').element.value).toContain('1 Sol Ring')
    wrapper.unmount()
  })

  it('shows issues and commits only after proceeding', async () => {
    const store = useDeckStore()
    vi.mocked(prepareDeckImport).mockResolvedValue({
      deck: {
        id: store.deck.id,
        createdAt: store.deck.createdAt,
        updatedAt: store.deck.updatedAt,
        name: 'Imported Deck',
        commander,
        cards: [{ card: solRing, quantity: 1 }],
        sideboard: [],
        maybeboard: [],
        considering: [],
      },
      result: {
        format: 'generic',
        importedCards: 2,
        skippedCards: 1,
        ignoredSections: [],
        informationalIssues: [],
        commanderSource: 'imported',
        issues: [
          {
            lineNumber: 3,
            input: 'Missing Card',
            message: 'No matching Scryfall card was found.',
          },
        ],
      },
    })
    const wrapper = mountComponent()

    await findButton(wrapper, 'Import Decklist')?.trigger('click')
    await wrapper.find('textarea').setValue('Deck\n1 Sol Ring')
    await findButton(wrapper, 'Process Import')?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Detected format: Generic plaintext')
    expect(wrapper.text()).toContain('Commander imported')
    expect(wrapper.text()).toContain('Mainboard: 1 cards ready')
    expect(wrapper.text()).toContain('No matching Scryfall card was found.')
    expect(store.deck.cards).toHaveLength(0)

    expect(wrapper.text()).toContain('Proceed Anyway')

    await findButton(wrapper, 'Proceed Anyway')?.trigger('click')
    expect(store.deck.cards[0]?.card.name).toBe('Sol Ring')
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.unmount()
  })

  it('automatically imports and closes when there are no errors', async () => {
    const store = useDeckStore()
    vi.mocked(prepareDeckImport).mockResolvedValue({
      deck: {
        id: store.deck.id,
        createdAt: store.deck.createdAt,
        updatedAt: store.deck.updatedAt,
        name: 'Clean Import',
        commander,
        cards: [{ card: solRing, quantity: 1 }],
        sideboard: [],
        maybeboard: [],
        considering: [],
      },
      result: {
        format: 'generic',
        importedCards: 2,
        skippedCards: 0,
        ignoredSections: [],
        informationalIssues: [],
        commanderSource: 'imported',
        issues: [],
      },
    })
    const wrapper = mountComponent()

    await findButton(wrapper, 'Import Decklist')?.trigger('click')
    await wrapper.find('textarea').setValue('Deck\n1 Sol Ring')
    await findButton(wrapper, 'Process Import')?.trigger('click')
    await flushPromises()

    expect(store.deck.name).toBe('Clean Import')
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.unmount()
  })

  it('cancels an import with errors without replacing the deck', async () => {
    const store = useDeckStore()
    vi.mocked(prepareDeckImport).mockResolvedValue({
      deck: {
        id: store.deck.id,
        createdAt: store.deck.createdAt,
        updatedAt: store.deck.updatedAt,
        name: 'Should Not Import',
        commander,
        cards: [],
        sideboard: [],
        maybeboard: [],
        considering: [],
      },
      result: {
        format: 'generic',
        importedCards: 0,
        skippedCards: 1,
        ignoredSections: [],
        informationalIssues: [],
        commanderSource: 'retained',
        issues: [{ message: 'Unknown card.' }],
      },
    })
    const wrapper = mountComponent()

    await findButton(wrapper, 'Import Decklist')?.trigger('click')
    await wrapper.find('textarea').setValue('1 Unknown Card')
    await findButton(wrapper, 'Process Import')?.trigger('click')
    await flushPromises()
    await findButton(wrapper, 'Cancel')?.trigger('click')

    expect(store.deck.name).toBe('Untitled Deck')
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.unmount()
  })

  it('disables repeated submissions while loading', async () => {
    vi.mocked(prepareDeckImport).mockImplementation(
      () => new Promise(() => undefined),
    )
    const wrapper = mountComponent()

    await findButton(wrapper, 'Import Decklist')?.trigger('click')
    await wrapper.find('textarea').setValue('Deck\n1 Sol Ring')
    await findButton(wrapper, 'Process Import')?.trigger('click')

    expect(
      findButton(wrapper, 'Process Import')?.attributes('disabled'),
    ).toBeDefined()
    wrapper.unmount()
  })

  it('aborts an active import when the component unmounts', async () => {
    let receivedSignal: AbortSignal | undefined
    vi.mocked(prepareDeckImport).mockImplementation(
      (_text, _deck, signal) => {
        receivedSignal = signal
        return new Promise(() => undefined)
      },
    )
    const wrapper = mountComponent()

    await findButton(wrapper, 'Import Decklist')?.trigger('click')
    await wrapper.find('textarea').setValue('Deck\n1 Sol Ring')
    await findButton(wrapper, 'Process Import')?.trigger('click')
    wrapper.unmount()

    expect(receivedSignal?.aborted).toBe(true)
  })

  it('copies export text and reports clipboard failure', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    })
    const store = useDeckStore()
    store.deck.cards = [{ card: solRing, quantity: 1 }]
    const wrapper = mountComponent()

    await findButton(wrapper, 'Export Decklist')?.trigger('click')
    await findButton(wrapper, 'Copy to Clipboard')?.trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('Mainboard\n1 Sol Ring')
    expect(wrapper.text()).toContain('Decklist copied')

    writeText.mockRejectedValue(new Error('Denied'))
    await findButton(wrapper, 'Copy to Clipboard')?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to copy automatically')
    wrapper.unmount()
  })
})
