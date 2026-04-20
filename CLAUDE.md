# Project Instructions

## Preview

Never use preview_* tools or mention the preview panel unless the user explicitly asks to preview something. Do not start dev servers, take screenshots, or run any verification workflow automatically after edits.

## Task Management — Two-Tier System

### Tier 1: .tasks.md (granular dev tasks)
Claude manages this file fully and autonomously:
- Add tasks as they are identified during work
- Mark tasks complete as soon as they are done (use `[x]`)
- Remove completed tasks when the list gets long (keep it tidy)
- Never ask Will for permission to update this file

Format:
```
## In Progress
- [ ] task description

## To Do
- [ ] task description

## Done (recent)
- [x] task description
```

### Tier 2: Notion (milestones and external-action tasks)
Will adds these himself. Claude only marks them done:
- When Will says a task is finished, or it becomes clear a task has been completed, mark it done in Notion immediately
- Use the notion-update-page tool to set the Checkbox property to "Done"
- Never create new Notion tasks unless Will explicitly asks

**The boundary:** if a task requires someone outside this editor (Will, the L2F team, Bruce, external parties), it belongs in Notion. Everything else goes in `.tasks.md`.
