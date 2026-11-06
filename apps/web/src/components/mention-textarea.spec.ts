import { mentionRanges } from './mention-textarea';

const omar = { id: '1', name: 'Omar' };
const omarAli = { id: '2', name: 'Omar Ali' };

describe('mention ranges in the box', () => {
  it('finds each picked @Name, longest name first, in order', () => {
    const text = '@Omar Ali and @Omar, hi @Omar';
    expect(mentionRanges(text, [omar, omarAli])).toEqual([
      [0, 9],
      [14, 19],
      [24, 29],
    ]);
  });

  it('ignores names no longer in the text', () => {
    expect(mentionRanges('hello', [omar])).toEqual([]);
  });
});
