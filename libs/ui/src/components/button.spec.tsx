import { render, screen } from '@testing-library/react';
import { Button } from './button.js';

describe('Button', () => {
  it('renders a primary button by default', () => {
    render(<Button>حفظ</Button>);
    expect(screen.getByRole('button', { name: 'حفظ' }).className).toContain(
      'bg-primary',
    );
  });

  it('renders its child element with asChild', () => {
    render(
      <Button asChild variant="outline">
        <a href="/x">رابط</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'رابط' }).className).toContain(
      'border',
    );
  });
});
