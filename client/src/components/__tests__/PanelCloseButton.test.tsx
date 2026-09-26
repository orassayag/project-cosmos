import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PanelCloseButton } from '../PanelCloseButton';

describe('PanelCloseButton', () => {
  it('renders an accessible close button that calls onClose without bubbling the click', () => {
    const onClose = vi.fn();
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <PanelCloseButton onClose={onClose} label="Close ownership" />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close ownership' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
