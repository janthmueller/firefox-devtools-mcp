---
description: Navigate Firefox to a URL and take a snapshot
argument-hint: <url>
---

# /firewatch:navigate

Opens a URL in Firefox and takes a DOM snapshot for interaction.

## Usage

```
/firewatch:navigate <url>
```

## Examples

```
/firewatch:navigate https://example.com
/firewatch:navigate https://github.com/login
/firewatch:navigate file:///path/to/local.html
```

## What Happens

1. Calls `navigate_page` with the URL
2. Waits for page load
3. Calls `take_snapshot` to create UID mappings
4. Returns the DOM snapshot with interactive elements marked

After navigating, you can interact with elements using their UIDs (e.g., `e42`).
