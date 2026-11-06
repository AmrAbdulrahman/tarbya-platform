import {
  mentionedIds,
  plainMentions,
  splitMentions,
  withMentionTokens,
} from './mentions.js';

const omar = { id: '11111111-1111-4111-8111-111111111111', name: 'Omar' };
const omarAli = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Omar Ali',
};

describe('mentions', () => {
  it('turns typed @names into tokens, longest name first', () => {
    const body = withMentionTokens('Hi @Omar Ali and @Omar!', [omar, omarAli]);
    expect(body).toBe(`Hi @[Omar Ali](${omarAli.id}) and @[Omar](${omar.id})!`);
    expect(mentionedIds(body)).toEqual([omarAli.id, omar.id]);
    expect(plainMentions(body)).toBe('Hi @Omar Ali and @Omar!');
  });

  it('drops people whose @name was deleted from the text', () => {
    expect(mentionedIds(withMentionTokens('Hi all', [omar]))).toEqual([]);
  });

  it('splits a body for display', () => {
    expect(splitMentions(`@[Omar](${omar.id}), see this`)).toEqual([
      { kind: 'mention', name: 'Omar', userId: omar.id },
      { kind: 'text', text: ', see this' },
    ]);
  });
});
