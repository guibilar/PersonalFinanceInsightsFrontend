import { AppModule, MAIN_MENU, MODULES, activeModules } from './module-registry';

describe('module registry', () => {
  it('has Money and Documents active and the planned modules coming soon', () => {
    expect(MODULES.map((module) => [module.name, module.status])).toEqual([
      ['Money', 'active'],
      ['Documents', 'active'],
      ['Home', 'coming-soon'],
      ['People', 'coming-soon'],
      ['Journal', 'coming-soon'],
      ['Tasks', 'coming-soon'],
    ]);
  });

  it('gives each module its own id and its own absolute route', () => {
    const ids = MODULES.map((module) => module.id);
    const routes = MODULES.map((module) => module.route);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(routes).size).toBe(routes.length);
    for (const route of routes) expect(route).toMatch(/^\/[a-z-]+$/);
  });

  it('opens Money at /money and Documents at /documents', () => {
    expect(activeModules().map((module) => module.route)).toEqual(['/money', '/documents']);
  });

  it('lists only the active modules', () => {
    const modules: AppModule[] = [
      { id: 'a', name: 'A', description: '', icon: 'note', route: '/a', status: 'coming-soon' },
      { id: 'b', name: 'B', description: '', icon: 'note', route: '/b', status: 'active' },
    ];

    expect(activeModules(modules).map((module) => module.id)).toEqual(['b']);
  });

  it('has the main menu of D11, with Capture as the centre action', () => {
    expect(MAIN_MENU.map((item) => [item.label, item.route, item.primary ?? false])).toEqual([
      ['Today', '/today', false],
      ['Timeline', '/timeline', false],
      ['Capture', '/capture', true],
      ['Modules', '/modules', false],
      ['Search', '/search', false],
    ]);
  });
});
