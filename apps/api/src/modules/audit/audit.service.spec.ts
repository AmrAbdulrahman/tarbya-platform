import { diffOf } from './audit.service';

describe('diffOf', () => {
  it('keeps only changed fields, as [before, after]', () => {
    expect(
      diffOf(
        { name: 'A', phone: '1', locale: 'ar' },
        { name: 'B', phone: '1', locale: undefined },
      ),
    ).toEqual({ name: ['A', 'B'] });
  });

  it('records missing values as null and skips null-to-null', () => {
    expect(
      diffOf({} as Record<string, unknown>, {
        email: 'x@y.z',
        managerId: null,
      }),
    ).toEqual({
      email: [null, 'x@y.z'],
    });
  });
});
