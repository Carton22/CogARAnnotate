# Analysis Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/analysis` for synchronized multi-view step review using existing CogAR task plans.

**Architecture:** Add testable analysis helpers in `app/analysis-model.ts`, a client page in `app/analysis/page.tsx`, and route-specific styling in `app/globals.css`. Reuse `planForParticipant` for participant-specific steps.

**Tech Stack:** Next app router, React client components, TypeScript, native HTML video/canvas, Node test runner.

---

### Task 1: Analysis Helpers

**Files:**
- Create: `app/analysis-model.ts`
- Test: `tests/analysis-model.test.mjs`

- [x] Write failing tests for ISO offset, range validation, CSV parsing, and filtering.
- [x] Implement helper functions.
- [x] Run the helper tests.

### Task 2: Analysis Page

**Files:**
- Create: `app/analysis/page.tsx`
- Modify: `app/globals.css`

- [x] Build upload controls, stream start ISO fields, step range table, synchronized video playback, and heart-rate canvas rendering.
- [x] Keep local persistence for ranges and stream metadata.
- [x] Run the full build.
