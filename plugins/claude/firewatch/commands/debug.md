---
description: Show console errors and failed network requests
argument-hint: [console|network|all]
---

# /firewatch:debug

Displays debugging information from the current page.

## Usage

```
/firewatch:debug              # Show all (console errors + failed requests)
/firewatch:debug console      # Console messages only
/firewatch:debug network      # Network requests only
```

## Examples

```
/firewatch:debug
/firewatch:debug console
/firewatch:debug network
```

## What Happens

- `console`: Calls `list_console_messages` with `level="error"`
- `network`: Calls `list_network_requests` with `status="failed"`
- `all` (default): Shows both console errors and failed network requests

Useful for debugging page issues, JavaScript errors, and API failures.
