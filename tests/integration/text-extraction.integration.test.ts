/**
 * Integration tests for text extraction
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { FirefoxClient } from '@/firefox/index.js';
import {
  closeFirefox,
  createTestFirefox,
  waitForElementInSnapshot,
  waitForPageLoad,
} from '../helpers/firefox.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesPath = resolve(__dirname, '../fixtures');

describe('Text Extraction Integration Tests', () => {
  let firefox: FirefoxClient;

  beforeAll(async () => {
    firefox = await createTestFirefox();
  }, 60000);

  afterAll(async () => {
    await closeFirefox(firefox);
  });

  it('should extract rendered text from the current page', async () => {
    const fixturePath = `file://${fixturesPath}/simple.html`;
    await firefox.navigate(fixturePath);
    await waitForPageLoad();

    const text = await firefox.extractText();

    expect(text).toContain('Simple Test Page');
    expect(text).toContain('This is a simple test page for Firefox DevTools MCP.');
    expect(text).toContain('Click Me');
  }, 10000);

  it('should extract text from a selector-scoped region', async () => {
    const fixturePath = `file://${fixturesPath}/simple.html`;
    await firefox.navigate(fixturePath);
    await waitForPageLoad();

    const text = await firefox.extractText({
      scope: 'selector',
      selector: '#description',
    });

    expect(text).toBe('This is a simple test page for Firefox DevTools MCP.');
  }, 10000);

  it('should extract text from a UID-scoped region', async () => {
    const fixturePath = `file://${fixturesPath}/simple.html`;
    await firefox.navigate(fixturePath);
    await waitForPageLoad();

    const titleUid = await waitForElementInSnapshot(
      firefox,
      (entry) => entry.css.includes('#title') || entry.css.includes('id="title"'),
      10000
    );

    const text = await firefox.extractText({
      scope: 'uid',
      uid: titleUid.uid,
    });

    expect(text).toBe('Simple Test Page');
  }, 10000);

  it('should extract DOM text including hidden content when source is dom', async () => {
    const fixturePath = `file://${fixturesPath}/visibility.html`;
    await firefox.navigate(fixturePath);
    await waitForPageLoad();

    const text = await firefox.extractText({
      source: 'dom',
    });

    expect(text).toContain('Hidden Text');
    expect(text).toContain('Visible Text');
  }, 10000);

  it('should reject invalid selector syntax', async () => {
    const fixturePath = `file://${fixturesPath}/simple.html`;
    await firefox.navigate(fixturePath);
    await waitForPageLoad();

    await expect(
      firefox.extractText({
        scope: 'selector',
        selector: '#description:has(',
      })
    ).rejects.toThrow(/Invalid selector syntax/);
  }, 10000);

  it('should reject stale UIDs after navigation', async () => {
    const fixturePath = `file://${fixturesPath}/simple.html`;
    await firefox.navigate(fixturePath);
    await waitForPageLoad();

    const snapshot = await firefox.takeSnapshot();
    const titleUid = snapshot.json.uidMap.find(
      (entry) => entry.css.includes('#title') || entry.css.includes('id="title"')
    );

    expect(titleUid).toBeDefined();

    await firefox.navigate(`file://${fixturesPath}/visibility.html`);
    await waitForPageLoad();

    await expect(
      firefox.extractText({
        scope: 'uid',
        uid: titleUid!.uid,
      })
    ).rejects.toThrow(/stale snapshot|UID not found/);
  }, 10000);
});
