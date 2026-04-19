// Vitest setup file
//
// Important: do not perform global Firefox/geckodriver cleanup from here.
// Vitest may execute files in parallel workers, and worker-global cleanup can
// kill another worker's active browser session, causing spurious ECONNREFUSED
// failures. Integration suites are responsible for closing their own Firefox
// instances via tests/helpers/firefox.ts.
