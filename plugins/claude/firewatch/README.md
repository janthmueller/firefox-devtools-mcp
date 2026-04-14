# Firewatch Plugin for Claude Code

Firefox browser automation via WebDriver BiDi. Navigate pages, fill forms, click elements, take screenshots, and monitor console/network activity.

## What's Included

This plugin provides:

- **MCP Server** - Connects Claude Code to Firefox automation
- **Skills** - Auto-triggers for browser automation, testing, and scraping tasks
- **Agents** - Dedicated `e2e-tester` and `web-scraper` agents for focused tasks
- **Commands** - `/firewatch:navigate`, `/firewatch:screenshot`, `/firewatch:debug`

## Installation

```bash
claude plugin install firewatch
```

## Commands

### /firewatch:navigate

Navigate to a URL and take a DOM snapshot:

```
/firewatch:navigate https://example.com
/firewatch:navigate https://github.com/login
```

### /firewatch:screenshot

Capture the current page or a specific element:

```
/firewatch:screenshot
/firewatch:screenshot e15
```

### /firewatch:debug

Show console errors and failed network requests:

```
/firewatch:debug
/firewatch:debug console
/firewatch:debug network
```

## Agents

Spawn agents to keep your main context clean:

```
spawn e2e-tester to test the login flow on https://app.example.com
spawn web-scraper to extract product prices from https://shop.example.com
```

## Usage Examples

The plugin works automatically when you ask about browser tasks:

- "Navigate to example.com and take a screenshot"
- "Fill out the login form and submit"
- "Check for JavaScript errors on this page"
- "Scrape all product prices from this page"

## Key Workflow

1. `take_snapshot` - Creates DOM snapshot with UIDs (e.g., `e42`)
2. Interact using UIDs - `click_by_uid`, `fill_by_uid`, etc.
3. Re-snapshot after DOM changes

## Requirements

- Firefox 120+
- Node.js 20.19.0+

## Links

- [Repository](https://github.com/janthmueller/firefox-devtools-mcp)
- [npm](https://www.npmjs.com/package/firewatch-mcp)
