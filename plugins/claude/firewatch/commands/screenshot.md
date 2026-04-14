---
description: Take a screenshot of the current page or element
argument-hint: [uid]
---

# /firewatch:screenshot

Captures a screenshot of the page or a specific element.

## Usage

```
/firewatch:screenshot          # Full page
/firewatch:screenshot <uid>    # Specific element
```

## Examples

```
/firewatch:screenshot
/firewatch:screenshot e15
/firewatch:screenshot e42
```

## What Happens

- Without UID: Calls `screenshot_page` for full page capture
- With UID: Calls `screenshot_by_uid` for element-specific capture

Screenshots are saved and displayed in the conversation.
