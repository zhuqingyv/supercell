---
name: takeover-context
description: project-specific takeover mission, roadmap, code roots, and operating rules
---

# Takeover Context

## Project

- Repo root: `/Users/zhuqingyu/project/supercell/.wanman/worktree`
- Stack: gagent | react, express, vite | typescript, javascript
- Summary: Maintain and advance gagent

## Long-Running Mission

Continuously take over and advance gagent (react / typescript). Project summary: Maintain and advance gagent Operating principles: Prioritize advancing incomplete roadmap / plan / backlog items closest to user value; Keep README, docs, and changelog consistent with current implementation and release state; Continuously keep tests, CI, build, and release pipelines operational - not just surface fixes; Continuously review core code directories src for structural issues blocking the roadmap; Continuously absorb signals from issues / feedback / discussions and convert external problems into actionable tasks; After any single metric reaches a local optimum, return to the global mission and find the next batch of high-value tasks

## Canonical Files To Read First

- `/Users/zhuqingyu/project/supercell/.wanman/worktree/README.md` - Supercell 🚀
- `/Users/zhuqingyu/project/supercell/.wanman/worktree/docs/PRD-modules.md` - PRD-modules: 功能模块详细设计
- `/Users/zhuqingyu/project/supercell/.wanman/worktree/docs/PRD-overview.md` - PRD-overview: 产品总览
- `/Users/zhuqingyu/project/supercell/.wanman/worktree/docs/PRD-prompts.md` - PRD-prompts: 提示词工程需求
- `/Users/zhuqingyu/project/supercell/.wanman/worktree/docs/PRD-roles.md` - PRD-roles: 角色系统详细设计
- `/Users/zhuqingyu/project/supercell/.wanman/worktree/docs/PRD-tech.md` - PRD-tech: 技术选型与难点分析
- `/Users/zhuqingyu/project/supercell/.wanman/worktree/docs/PRD-visual.md` - PRD-visual: 视觉与交互需求
- `/Users/zhuqingyu/project/supercell/.wanman/worktree/docs/PRD-workspace.md` - PRD-workspace: 工作空间与记忆系统
- `/Users/zhuqingyu/project/supercell/.wanman/worktree/package.json` - package.json
- `/Users/zhuqingyu/project/supercell/.wanman/worktree/docs/ARCH-tech-evaluation.md` - 虚拟办公室 - 技术可行性评估

## Roadmap Signals

- PRD-modules: 功能模块详细设计
- 1. 模块系统架构
- 模块数据模型
- 2. 程序员模块
- 2.1 Git 操作 Tools
- PRD-overview: 产品总览
- 1. 产品定义
- 2. 产品目标

## Code Roots

- `/Users/zhuqingyu/project/supercell/.wanman/worktree/src`

## Useful Scripts

- `dev`
- `dev:server`
- `test`
- `test:run`
- `test:ui`
- `server`
- `dev:server:vite`
- `build`
- `build:server`
- `lint`
- `preview`

## Operating Rules

1. Do not collapse the mission into a single static metric. Test coverage, lint, or fixing one bug does not mean the project is "done."
2. Keep 1-3 active initiatives on the mission board at all times. Use `wanman initiative list` / `wanman initiative create` / `wanman initiative update` to keep them fresh.
3. Every loop, re-ask: is the current backlog advancing real product goals, the roadmap, release readiness, or user value?
4. When all current tasks are complete, immediately refresh initiatives and generate the next batch from roadmap, README/docs, code structure, TODOs, build pipelines, and release gaps.
5. If external issues/PRs are not directly accessible, use local docs, scripts, and code gaps as backlog signal sources.
6. Prefer creating tasks with file scope: use `wanman task create ... --path <path>` or `--pattern <prefix>`.
7. Every PR-sized code change should be represented as a change capsule before branch work expands: use `wanman capsule create --task <id> --initiative <id> --paths <...>`.
8. Tasks may be reassigned freely. Code changes may not leave the capsule boundary; if you discover out-of-scope work, report it and create a follow-up task/capsule.
9. All agents should write analysis results to their own `output/`, but actual code/doc changes should happen at the repo root.

## Git Workflow

You have full `git` and `gh` (GitHub CLI) access in this environment.

- Dev: create a feature branch -> write code + tests -> push -> open PR -> notify CTO
- CEO: maintain initiative board and create capsules for code work before branches sprawl
- CTO: review PR (coverage >= 95% gate) -> approve + merge, or request changes
- CEO: task decomposition and monitoring only - does NOT merge PRs
- Branch naming: `wanman/<task-slug>`
- Always run tests with coverage before pushing
