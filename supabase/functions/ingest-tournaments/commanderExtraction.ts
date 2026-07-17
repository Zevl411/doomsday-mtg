interface CommanderExtraction {
  names: string[]
  status: 'extracted' | 'missing' | 'invalid'
}

/** Uses the same Commander-heading convention as the browser decklist parser. */
export function extractCommanders(
  decklist: unknown,
  deckObject: unknown,
): CommanderExtraction {
  const structured = structuredCommanders(deckObject)
  if (structured.length) return { names: structured, status: 'extracted' }
  if (typeof decklist !== 'string' || !decklist.trim()) {
    return { names: [], status: 'missing' }
  }

  const lines = decklist.split(/\r?\n/)
  const names: string[] = []
  let inCommanderSection = false
  for (const line of lines) {
    const clean = line.trim()
    const heading = normalizeHeading(clean)
    if (/^(?:commanders?|command zone)$/i.test(heading)) {
      inCommanderSection = true
      continue
    }
    if (
      inCommanderSection &&
      heading &&
      /^[a-z][\w /'-]+$/i.test(heading) &&
      !/^\d/.test(clean)
    ) {
      break
    }
    if (inCommanderSection) {
      const match = clean.match(/^(?:\d+\s*[x×]?\s+)?(.+?)(?:\s+\([A-Z0-9]+\).*)?$/)
      if (match?.[1]) names.push(match[1].trim())
    }
  }
  return {
    names: names.slice(0, 2),
    status: names.length ? 'extracted' : 'invalid',
  }
}

function normalizeHeading(value: string) {
  return value
    .replace(/^[#>*_~\-\s]+|[#>*_~\-\s:]+$/g, '')
    .trim()
}

function structuredCommanders(value: unknown): string[] {
  if (!isRecord(value)) return []
  const section = value.Commanders ?? value.commanders ?? value.Commander
  if (Array.isArray(section)) {
    return section.flatMap(readStructuredName).filter(Boolean).slice(0, 2)
  }
  if (isRecord(section)) return Object.keys(section).filter(Boolean).slice(0, 2)
  return []
}

function readStructuredName(value: unknown): string[] {
  if (typeof value === 'string') return [value.trim()]
  if (isRecord(value) && typeof value.name === 'string') return [value.name.trim()]
  return []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
