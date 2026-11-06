/**
 * Mentions in comments are stored inline as `@[Name](user id)`: the name as it
 * was when written, so the text reads the same if the person is renamed.
 */
const MENTION = /@\[([^\]\n]{1,120})\]\(([0-9a-f-]{36})\)/g;

export type TextPart =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; name: string; userId: string };

/** The stored form of a mention. Brackets in a name would end it early, so they're dropped. */
export function mentionToken(name: string, userId: string): string {
  return `@[${name.replace(/[[\]]/g, '')}](${userId})`;
}

/** The ids mentioned in `body`, each once. */
export function mentionedIds(body: string): string[] {
  return [...new Set([...body.matchAll(MENTION)].map((m) => m[2]))];
}

/** `body` with every mention as plain `@Name`, e.g. for an email or a preview. */
export function plainMentions(body: string): string {
  return body.replace(MENTION, (_, name: string) => `@${name}`);
}

/** `body` cut into text and mentions, in order, for display. */
export function splitMentions(body: string): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const m of body.matchAll(MENTION)) {
    const start = m.index ?? 0;
    if (start > at) parts.push({ kind: 'text', text: body.slice(at, start) });
    parts.push({ kind: 'mention', name: m[1], userId: m[2] });
    at = start + m[0].length;
  }
  if (at < body.length) parts.push({ kind: 'text', text: body.slice(at) });
  return parts;
}

/**
 * The stored body for text typed with plain `@Name` mentions: each picked
 * person whose `@Name` is still in the text becomes a token. Longer names go
 * first, so "@Omar Ali" isn't taken for "@Omar".
 */
export function withMentionTokens(
  text: string,
  picked: readonly { id: string; name: string }[],
): string {
  let body = text;
  const byLength = [...picked].sort((a, b) => b.name.length - a.name.length);
  for (const p of byLength) {
    body = body.split(`@${p.name}`).join(mentionToken(p.name, p.id));
  }
  return body;
}
