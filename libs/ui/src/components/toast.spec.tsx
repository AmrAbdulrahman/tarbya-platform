import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from './toast.js';

function Save() {
  const toast = useToast();
  return <button onClick={() => toast('تم الحفظ')}>حفظ</button>;
}

describe('Toast', () => {
  it('announces a message and removes it after a while', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider duration={1000}>
        <Save />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(screen.getByRole('status').textContent).toBe('تم الحفظ');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status').textContent).toBe('');
    vi.useRealTimers();
  });
});
