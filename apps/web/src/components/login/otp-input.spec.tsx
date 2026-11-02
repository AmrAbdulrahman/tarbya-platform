import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { initI18n } from '@tarbya/i18n';
import { OtpInput } from './otp-input';

function Harness({ onComplete }: { onComplete: (v: string) => void }) {
  const [value, setValue] = useState('');
  return <OtpInput value={value} onChange={setValue} onComplete={onComplete} />;
}

beforeAll(async () => {
  await initI18n('en');
});

describe('OtpInput', () => {
  it('fills from a paste and reports the full code', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(screen.getByLabelText('Digit 1'), {
      clipboardData: { getData: () => '12 34 56' },
    });
    expect(onComplete).toHaveBeenCalledWith('123456');
    expect(
      screen
        .getAllByRole('textbox')
        .map((el) => (el as HTMLInputElement).value),
    ).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('moves to the next box as digits are typed and ignores letters', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.change(screen.getByLabelText('Digit 1'), {
      target: { value: 'a' },
    });
    expect((screen.getByLabelText('Digit 1') as HTMLInputElement).value).toBe(
      '',
    );
    for (const [i, d] of ['9', '8', '7', '6', '5', '4'].entries()) {
      fireEvent.change(screen.getByLabelText(`Digit ${i + 1}`), {
        target: { value: d },
      });
    }
    expect(onComplete).toHaveBeenCalledWith('987654');
  });
});
