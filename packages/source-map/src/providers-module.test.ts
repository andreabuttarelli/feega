import { describe, expect, it } from 'vitest';
import { providersOf } from './providers-module.ts';

const MAIN = `
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './theme';
import { App } from './App';
import './index.css';

const queryClient = new QueryClient();
const root = createRoot(document.getElementById('root')!);
console.log('boot');

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider mode="dark">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
`;

describe('providersOf', () => {
  it('wraps the children in every provider around the app, in order', () => {
    const code = providersOf(MAIN)!;

    expect(code).toMatch(/export function Providers\(\{ children \}\)/);
    expect(code.indexOf('<StrictMode>')).toBeLessThan(code.indexOf('<QueryClientProvider'));
    expect(code.indexOf('<ThemeProvider')).toBeLessThan(code.indexOf('<BrowserRouter>'));
    expect(code).toContain('{children}');
    expect(code).not.toContain('<App');
  });

  it('keeps the imports the providers need, and the stylesheets', () => {
    const code = providersOf(MAIN)!;

    expect(code).toContain("import { BrowserRouter } from 'react-router-dom';");
    expect(code).toContain("import './index.css';");
    expect(code).toContain("import { ThemeProvider } from './theme';");
  });

  it('drops the import of the app itself and the code that boots React', () => {
    const code = providersOf(MAIN)!;

    expect(code).not.toContain("from './App'");
    expect(code).not.toContain('createRoot');
    expect(code).not.toContain('console.log');
    expect(code).not.toContain('root.render');
  });

  it('keeps a top-level value a provider receives, and nothing else', () => {
    const code = providersOf(MAIN)!;

    expect(code).toContain('const queryClient = new QueryClient();');
    expect(code).not.toContain('getElementById');
  });

  it('keeps the other specifiers of an import that also brought the app', () => {
    const code = providersOf("import { Shell, App } from './shell';\nimport { createRoot } from 'react-dom/client';\ncreateRoot(document.body).render(<Shell><App /></Shell>);")!;

    expect(code).toContain("import { Shell } from './shell';");
  });

  it('understands ReactDOM.render and hydrateRoot style calls', () => {
    const code = providersOf("import { Theme } from './t';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')).render(<Theme><App /></Theme>);")!;

    expect(code).toContain('<Theme>');
  });

  it('is a plain pass-through when the app is rendered bare', () => {
    const code = providersOf("import App from './App';\nimport './index.css';\ncreateRoot(el).render(<App />);")!;

    expect(code).toContain("import './index.css';");
    expect(code).toContain('return children');
  });

  it('returns null when nothing is rendered', () => {
    expect(providersOf('export const a = 1;')).toBeNull();
  });

  it('returns null for source it cannot parse', () => {
    expect(providersOf('render(<A>')).toBeNull();
  });
});
