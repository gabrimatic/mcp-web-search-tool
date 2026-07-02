import { afterEach, describe, expect, it, vi } from 'vitest';

describe('config', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.BRAVE_API_KEY;
    delete process.env.ALLOW_KEYLESS;
  });

  it('loads dotenv quietly so MCP stdio remains JSON-only', async () => {
    const dotenvConfig = vi.fn();
    vi.doMock('dotenv', () => ({ config: dotenvConfig }));
    process.env.ALLOW_KEYLESS = 'true';

    await import('../src/config.js');

    expect(dotenvConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        quiet: true
      })
    );
  });
});
