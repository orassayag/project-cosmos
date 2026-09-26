import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DemoEndCard, GITHUB_URL, LINKEDIN_URL, toRepositoryWebUrl } from '../DemoEndCard';
import { OVERLAY, OverlayProvider, useOverlayManager } from '../../overlays/OverlayManager';

function Harness() {
  const overlay = useOverlayManager();
  return (
    <OverlayProvider value={overlay}>
      <output data-testid="active-overlay">{overlay.active ?? 'none'}</output>
      <button type="button" onClick={() => overlay.open(OVERLAY.demoEndCard)}>Open end card</button>
      <DemoEndCard />
    </OverlayProvider>
  );
}

function renderOpenCard() {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Open end card' }));
}

describe('DemoEndCard', () => {
  it('renders nothing until the overlay manager opens it', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('credits the author with GitHub and LinkedIn links that open safely in a new tab', () => {
    renderOpenCard();

    expect(screen.getByRole('dialog').textContent).toContain('Built by Or Assayag');
    const github = screen.getByRole('link', { name: 'GitHub' });
    const linkedin = screen.getByRole('link', { name: 'LinkedIn' });
    expect(github.getAttribute('href')).toBe('https://github.com/orassayag/project-cosmos');
    expect(github.getAttribute('href')).toBe(GITHUB_URL);
    expect(linkedin.getAttribute('href')).toBe(LINKEDIN_URL);
    for (const link of [github, linkedin]) {
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
    }
  });

  it('closes through the overlay manager from its corner close button', () => {
    renderOpenCard();
    expect(screen.getByTestId('active-overlay').textContent).toBe(OVERLAY.demoEndCard);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByTestId('active-overlay').textContent).toBe('none');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape', () => {
    renderOpenCard();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByTestId('active-overlay').textContent).toBe('none');
  });

  it('turns a package.json git URL into the repo web page', () => {
    expect(toRepositoryWebUrl('git+https://github.com/owner/repo.git')).toBe('https://github.com/owner/repo');
    expect(toRepositoryWebUrl('https://github.com/owner/repo')).toBe('https://github.com/owner/repo');
  });
});
