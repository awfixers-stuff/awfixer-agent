---
name: idea-todo-to-readme
description: Converts IDEA.md and TODO.md project files into structured README.md files. Use this skill when asked to generate documentation, create a README, or describe a project — especially when you notice IDEA.md or TODO.md files exist in the project root but no meaningful README. Also use when the user explicitly asks to synthesize planning files into a README or to "bootstrap" documentation from existing notes.
---

# idea-todo-to-readme

Converts ad-hoc planning files (`IDEA.md`, `TODO.md`) into a polished `README.md`.

## When to use

You have a project directory that contains `IDEA.md` and/or `TODO.md` but lacks a proper README. These files typically capture rough project ideas, brainstorming notes, and task checklists. This skill synthesizes them into a coherent, reader-facing README.

## Input sources

| File      | Content you'll find                                                 |
| --------- | ------------------------------------------------------------------- |
| `IDEA.md` | Project vision, brainstorming, architecture sketches, feature ideas |
| `TODO.md` | Task lists, implementation status, known issues, next steps         |

Either file may be absent — work with what exists.

## Process

1. **Read both files** if they exist. `IDEA.md` tells you _why_ the project exists and _what_ it aims to do. `TODO.md` tells you _how far along_ it is.
2. **Synthesize** into a README with these sections (order may vary by project):
   - **Title and one-liner** — what the project is, in one sentence
   - **Problem / motivation** — why this project exists (from `IDEA.md`)
   - **Current state** — what's implemented vs. still prototype (from `TODO.md` completed vs. pending items)
   - **Architecture** — how the pieces fit together (extract from `IDEA.md` technical notes)
   - **Getting started** — build/run instructions (infer from project tooling if not spelled out; look at `build.zig`, `Makefile`, `package.json`, `flake.nix`, etc.)
   - **Roadmap** — upcoming work, extracted directly from `TODO.md` pending items
3. **Write** the result to `README.md` in the project root.

## Rules

- Preserve the original `IDEA.md` and `TODO.md` untouched — don't delete or rename them.
- Mark synthesized sections clearly. If something is inferred rather than found in the source files, say so.
- If the project already has a `README.md`, **read it first** and merge content rather than overwriting. Keep anything useful from the existing README, add what the planning files contribute.
- For the "Getting started" section, inspect the project's build files (`build.zig`, `Makefile`, `Cargo.toml`, `package.json`, `flake.nix`, `CMakeLists.txt`, etc.) to derive accurate commands rather than guessing generic instructions.
- The README is for a human reader — write clearly, avoid jargon unless the project is inherently technical.
