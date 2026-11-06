/** Diacritics (tashkeel), the superscript alef and the tatweel: never typed in a search. */
const IGNORED = /[ً-ٰٟـ]/g;

/**
 * Letters typed interchangeably, mapped to one form. Keep in step with the
 * `search_normalize` SQL function (migration `20261106090000_search_normalize`),
 * which fills `User.nameSearch` the same way.
 */
const FOLD: Record<string, string> = {
  // Alef with hamza above or below, madda, wasla.
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ٱ: 'ا',
  // Alef maqsura and the Persian yeh read as yeh.
  ى: 'ي',
  ی: 'ي',
  // Taa marbuta written as haa.
  ة: 'ه',
  // Hamza on waw or yeh.
  ؤ: 'و',
  ئ: 'ي',
  // Persian kaf.
  ک: 'ك',
  // Arabic-Indic digits, so phone numbers match either way.
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};
const FOLDED = new RegExp(`[${Object.keys(FOLD).join('')}]`, 'g');

/**
 * Text as search compares it (BR-USR-6): lower case, Arabic diacritics dropped
 * and letter variants folded, so "احمد" finds "أَحْمد" and "مصطفي" finds "مصطفى".
 */
export function normalizeSearch(text: string): string {
  return text
    .replace(IGNORED, '')
    .replace(FOLDED, (c) => FOLD[c])
    .toLowerCase()
    .trim();
}

/** True when `query` (normalised or not) appears in any of `texts`. */
export function matchesSearch(
  query: string,
  ...texts: (string | null | undefined)[]
): boolean {
  const q = normalizeSearch(query);
  return (
    !q || texts.some((text) => !!text && normalizeSearch(text).includes(q))
  );
}
