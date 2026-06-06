import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Container } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { DeleteConfirm } from './DeleteConfirm';

// B-008: the delete confirmation rendered the i18n string's literal <b> tags as text
// (the <Trans> lacked the components map). The name must show as bold markup, not tags.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

const CONTAINER: Container = {
  id: 'x',
  name: 'Assiette creuse',
  empty_weight_g: 300,
  is_builtin: false,
};

describe('DeleteConfirm name escaping (B-008)', () => {
  it('renders the name inside a <b> element, never as literal tags', () => {
    render(<DeleteConfirm container={CONTAINER} onCancel={() => {}} onConfirm={() => {}} />);
    // The raw markup must not appear as visible text.
    expect(document.body.textContent).not.toContain('<b>');
    // The name is wrapped in a real <b> element.
    const bold = [...document.body.querySelectorAll('b')].find(
      (el) => el.textContent === 'Assiette creuse',
    );
    expect(bold).toBeTruthy();
  });
});
