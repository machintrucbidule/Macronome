import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n/config';
import { BottomNav } from './BottomNav';
import { NAV_ITEMS } from './nav-items';

// B-311/B-312: the phone bar carries the SAME seven routes, in the same order, as the desktop top
// nav — both now map `nav-items.ts`, where they used to be two hand-kept JSX lists. Conseils is
// last; before B-311 it had no tab at all and lived on the appbar as a lightbulb.

function renderBar(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('BottomNav — the primary routes', () => {
  it('renders the seven nav items in order, Conseils last', () => {
    const { container } = renderBar('/');
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/history',
      '/weight',
      '/foods',
      '/recipes',
      '/stats',
      '/advices',
    ]);
    expect(links.map((a) => a.textContent)).toEqual(NAV_ITEMS.map((item) => i18n.t(item.labelKey)));
    expect(links.at(-1)?.textContent).toBe(i18n.t('advices.title'));
  });

  it('draws a glyph for every item, including the new Conseils one', () => {
    const { container } = renderBar('/');
    expect(container.querySelectorAll('a svg').length).toBe(NAV_ITEMS.length);
  });
});

describe('BottomNav — active tab', () => {
  const classAt = (pathname: string, href: string): string => {
    const { container, unmount } = renderBar(pathname);
    const link = [...container.querySelectorAll('a')].find((a) => a.getAttribute('href') === href);
    if (!link) throw new Error(`no link for ${href}`);
    const cls = link.className;
    unmount();
    return cls;
  };

  it('lights Conseils on /advices and nothing else', () => {
    const lit = classAt('/advices', '/advices');
    expect(lit.trim().length).toBeGreaterThan(0);
    expect(classAt('/advices', '/stats').trim()).toBe('');
    expect(classAt('/stats', '/advices').trim()).toBe('');
  });

  it('keeps Repas lit on /day/:date as on the home route (B-014)', () => {
    const home = classAt('/', '/');
    expect(classAt('/day/2026-06-06', '/')).toBe(home);
    expect(home.trim().length).toBeGreaterThan(0);
    expect(classAt('/foods', '/').trim()).toBe('');
  });
});
