export const DEFAULT_EXCLUDED_TITLE_KEYWORDS = [
  'budget',
  'casual',
  'precon',
  'pre-con',
  'beginner',
  'learn to play',
  'low power',
  'mid power',
  'battlecruiser',
  'commander party',
  // Spanish
  'presupuesto',
  'economico',
  'preconstruido',
  'principiante',
  'principiantes',
  'baja potencia',
  // Portuguese
  'orcamento',
  'pre construido',
  'iniciante',
  'iniciantes',
  'baixa potencia',
  // French
  'petit budget',
  'preconstruit',
  'debutant',
  'debutants',
  'faible puissance',
  // German
  'einsteiger',
  'vorkonstruiert',
  'niedrige spielstarke',
  // Italian
  'economico',
  'precostruito',
  'principianti',
  'bassa potenza',
  // Russian
  'казуальный',
  'казуальная',
  'бюджетный',
  'бюджетная',
  'прекон',
  'предсобранная колода',
  'для новичков',
  'низкая мощность',
  // Simplified and traditional Chinese
  '休闲',
  '休閒',
  '预算',
  '預算',
  '预组',
  '預組',
  '预构筑',
  '預構築',
  '新手',
  '初学者',
  '初學者',
  '低强度',
  '低強度',
  // Japanese
  'カジュアル',
  '低予算',
  '構築済み',
  '初心者',
  '低パワー',
  // Korean
  '캐주얼',
  '저예산',
  '프리콘',
  '초보',
  '저파워',
];

/**
 * Language-specific secrets let operators add regional terminology without
 * editing or redeploying the classifier.
 */
export const EXCLUDED_TITLE_KEYWORD_CONFIG_KEYS = [
  'TOURNAMENT_EXCLUDED_TITLE_KEYWORDS',
  'TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_EN',
  'TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_ES',
  'TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_PT',
  'TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_FR',
  'TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_DE',
  'TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_IT',
  'TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_RU',
  'TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_ZH',
  'TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_JA',
  'TOURNAMENT_EXCLUDED_TITLE_KEYWORDS_KO',
];

/** Custom comma-separated terms extend the safe defaults rather than replace them. */
export function buildExcludedTitleKeywords(configuredValues: Array<string | undefined>): string[] {
  const configuredKeywords = configuredValues.flatMap(
    (value) =>
      value
        ?.split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean) ?? [],
  );
  return [...new Set([...DEFAULT_EXCLUDED_TITLE_KEYWORDS, ...configuredKeywords])];
}

export interface TournamentRelevance {
  included: boolean;
  matchedKeyword?: string;
}

/**
 * TopDeck identifies Commander as EDH but does not provide a competitive tag.
 * Reject only explicit negative signals; never require cEDH in the title.
 */
export function evaluateTournamentTitle(
  title: string,
  excludedKeywords = DEFAULT_EXCLUDED_TITLE_KEYWORDS,
): TournamentRelevance {
  const normalizedTitle = normalize(title);
  const bracketSignal = findNonCompetitiveBracket(normalizedTitle);
  if (bracketSignal) {
    return { included: false, matchedKeyword: bracketSignal };
  }
  const matchedKeyword = excludedKeywords.find((keyword) =>
    containsPhrase(normalizedTitle, normalize(keyword)),
  );
  return matchedKeyword ? { included: false, matchedKeyword } : { included: true };
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function containsPhrase(title: string, phrase: string) {
  if (!phrase) return false;

  // Chinese, Japanese, and Korean titles do not consistently separate words
  // with spaces, so requiring Latin-style word boundaries misses valid terms.
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(phrase)) {
    return title.includes(phrase);
  }

  return ` ${title} `.includes(` ${phrase} `);
}

/**
 * Commander Brackets 1–4 describe non-cEDH through optimized play,
 * rather than the cEDH-focused data set. Providers commonly abbreviate these
 * labels in event titles, including compact forms such as "[CoBr4]".
 */
function findNonCompetitiveBracket(title: string): string | undefined {
  const words = ` ${title} `;
  if (/\bco\s*br\s*[1234]\b/.test(words)) return 'Commander Bracket 1–4';
  if (/\bcommander\s+bracket\s+[1234]\b/.test(words)) {
    return 'Commander Bracket 1–4';
  }
  if (/\bbracket\s+[1234]\b/.test(words)) return 'Commander Bracket 1–4';
  return undefined;
}
