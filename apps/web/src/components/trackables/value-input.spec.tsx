import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { TrackableType } from '@tarbya/api-client';
import { initI18n } from '@tarbya/i18n';
import { ValueInput } from './format';

function Harness({
  type,
  target = null,
  points = [],
  onValue = () => undefined,
}: {
  type: TrackableType;
  target?: number | null;
  points?: number[];
  onValue?: (v: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <ValueInput
      trackable={{ type, target, points }}
      label="Pages"
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    />
  );
}

beforeAll(async () => {
  await initI18n('en');
});

describe('ValueInput', () => {
  it('offers a button per number up to a small target', () => {
    const onValue = vi.fn();
    render(<Harness type="COUNT" target={5} onValue={onValue} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    fireEvent.click(buttons[3]);
    expect(onValue).toHaveBeenLastCalledWith('3');
    expect(buttons[3].getAttribute('aria-pressed')).toBe('true');
    expect(
      (screen.getByLabelText('Pages · Exact value') as HTMLInputElement).value,
    ).toBe('3');
  });

  it('scales the buttons to the highest value without a target', () => {
    render(<Harness type="COUNT" points={[2, 8, 4]} />);
    expect(screen.getAllByRole('button')).toHaveLength(9);
  });

  it('falls back to a number for counts of 20 and more', () => {
    render(<Harness type="COUNT" target={20} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByLabelText('Pages')).toHaveProperty('type', 'number');
  });

  it('slides a percentage, kept in step with the number', () => {
    const onValue = vi.fn();
    render(<Harness type="PERCENTAGE" onValue={onValue} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '65' } });
    expect(onValue).toHaveBeenLastCalledWith('65');
    expect((screen.getByLabelText('Pages') as HTMLInputElement).value).toBe(
      '65',
    );
  });
});
