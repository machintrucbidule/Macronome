import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// B-266: the route table must keep holding **lazy factories**. It previously held built elements
// (`['/history', <JournalPage />]`), which imported all 20 pages at module scope and put the whole
// app in one ~1 MB chunk — and would silently defeat a React.lazy added later. A source guard
// because the failure mode is a build-shape regression, not a runtime one.
const HERE = dirname(fileURLToPath(import.meta.url));
const routes = readFileSync(join(HERE, 'routes.tsx'), 'utf8');
const router = readFileSync(join(HERE, 'router.tsx'), 'utf8');

describe('route shape (B-266)', () => {
  it('declares every page through a lazy factory', () => {
    const pages = routes.match(/^const \w+ = page\(/gm) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(17);
  });

  it('never imports a page statically — that is what defeats the split', () => {
    const staticFeatureImports = routes.match(/^import .*from '\.\.\/features\//gm) ?? [];
    expect(staticFeatureImports).toEqual([]);
  });

  it('keeps only the cold-start screens eager in the router', () => {
    const eager = (router.match(/^import \{ (\w+) \} from '\.\.\/features\/\w+/gm) ?? []).map((l) =>
      l.replace(/^import \{ (\w+) \}.*/, '$1'),
    );
    expect(eager.sort()).toEqual(['InvitePage', 'LoginPage', 'ResetPage', 'SetupWizard']);
  });
});

// B-274: the chrome is mounted by a layout route, so no page may wrap itself in AppShell again.
describe('shell shape (B-274)', () => {
  it('mounts AppShell once, as a layout route', () => {
    expect(router).toContain('<AppShell />');
    const appShellImports =
      readFileSync(join(HERE, '..', 'features', 'meals', 'MealsPage.tsx'), 'utf8').match(
        /AppShell/g,
      ) ?? [];
    expect(appShellImports).toEqual([]);
  });
});
