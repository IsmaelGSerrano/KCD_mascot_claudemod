# Claude Code mods

This repo holds Claude Code **mods**: plugins whose behaviour lives in a function-hooks module (`register(on, options)`), not in shell hooks. Each top-level folder (e.g. `medieval-bar/`) is one self-contained mod.

Before writing or changing a mod, load the `plugin-authoring` skill. It is the authoritative guide to the mod API; this file only records what it leaves out.

## Source of truth for the API

`<mod>/.claude-plugin/types/claude-code/index.d.ts` is written by Claude Code itself each time it loads the mod, and its first line names the Claude Code version. Read its header comment and the declarations for any hook, event or `$` call before using it. It is git-ignored (`.claude-plugin/types/.gitignore`): it is regenerated, never edited or committed. If it is missing, load the mod once with `claude --plugin-dir <mod>` to create it.

The API is early access and changes between releases. When code that typechecked before now fails, compare against the regenerated `index.d.ts` before anything else.

## Layout of a mod

```
<mod>/
├── .claude-plugin/plugin.json   manifest; userConfig options live here
├── hooks/hooks.json             { "modules": ["./register.tsx"] }
├── hooks/register.tsx           export const register: Register = (on, options) => { ... }
├── types/index.d.ts             declares the mod's saved state on PluginState
├── tests/*.test.tsx             run by `claude plugin test`
└── tsconfig.json                extends ./.claude-plugin/types/tsconfig.json
```

## The hooks module's environment

- No Node and no DOM: no `fs`, `process`, `require` or `window`. Web APIs (URL, TextEncoder, crypto.subtle, ...) are available.
- Every file is an ES module named `.ts`/`.tsx`/`.js`/`.mjs`. Import plugin files with static, relative `import` declarations; a module containing `import()` does not load.
- Import only types from `'claude-code'` (`import type { Register, EngineInterface } from 'claude-code'`), plus the runtime helpers it documents (`atom`, `read`, `update`).
- JSX compiles against the globals `h` and `Fragment`; keep those names free. Get UI elements per render from `$.ui.resolve(e)` (`const { Box, Text } = $.ui.resolve(e)`).
- `atom({ plugin, key })` takes string literals, so `claude plugin validate` can read them. Declare every atom's shape in `types/index.d.ts` under `PluginState['<mod>']`.
- Middleware: call and return `next(e)` to pass the event on. To refuse, return `{ deny: reason }` without calling `next`. A deny after `next(e)` has resolved fails the hook.
- A render can land on `terminal`, `desktop`, `vscode` or `mobile`. Check `e.surface` before using terminal-only elements such as `Raster`, and give the other surfaces a text fallback.

## Checking a change

Run both after every change, from the repo root:

```
claude plugin validate <mod>   # manifest + hooks module, read the way the engine reads them
claude plugin test <mod>       # runs tests/*.test.tsx
```

A change is done when both pass. Tests mount the UI with `$.ui.mount({ ..., surface })`: cover every surface the mod renders on, not only `terminal`.

To try it live: `claude --plugin-dir <mod>`. In an interactive session the folder is watched and the mod reloads on save.

## When a mod shows nothing

Check in this order:

1. `claude plugin validate <mod>` reports an error.
2. The mod isn't loaded: wrong `--plugin-dir` path, or Claude Code wasn't restarted.
3. The project folder isn't trusted. `claude -p` never shows the trust prompt, so a headless run in a fresh folder never loads a project mod.
4. Claude Code is older than 2.1.287 and `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` isn't set (builds 2.1.259–2.1.286 need it).
5. The hook ran and failed: start with `--debug`. The debug log names the failed hook and why. `$.ui.log` lines always reach the debug log too; pass `{ to: 'debug' }` to keep a trace out of the transcript.

## Repo conventions

- The user-facing docs live in the root `README.md`; their images live in `<mod>/docs/` and are linked as `<mod>/docs/<file>`.
- Commits go through the `commit` skill.
