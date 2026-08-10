# CogAR Analysis Platform Design

## Goal

Add `/analysis` as a client-side review page that reuses the existing CogAR task plans and lets researchers play synchronized step segments across multiple uploaded streams.

## User Flow

Researchers choose the same participant and task plan used by the annotation console. They upload up to four sources: RGB third-person video, eye camera video, estimated gaze video, and a heart-rate CSV. Each source has its own recording start ISO timestamp because streams may begin at different times. The page renders the participant-specific step list from `planForParticipant`, with editable start and end ISO fields per step. Clicking a step’s play button seeks each uploaded video to that step’s ISO-relative offset, plays only that segment, and filters the heart-rate chart to the same ISO window.

## Architecture

The page will live at `app/analysis/page.tsx`, following the existing app-router pattern and using the global visual system in `app/globals.css`. Shared analysis utilities will live in `app/analysis-model.ts` so ISO offset math and heart-rate CSV parsing are testable without the browser. The page stores participant, plan, stream start ISOs, and step ranges in `localStorage`; uploaded file object URLs are session-only.

## Data Handling

Step definitions come from `app/task-plans.ts`. Video synchronization uses `secondsBetweenIso(streamStartIso, stepStartIso)`, clamped by the browser’s media behavior. Heart-rate CSV parsing accepts common timestamp and heart-rate column names, then filters rows between the selected step start and end ISO.

## Error Handling

The UI marks missing source start ISOs, invalid step ranges, and unuploaded streams without blocking the rest of the page. A step can play when it has a valid ISO start/end range; each available stream participates independently.

## Testing

Unit tests cover ISO offset calculation, valid range detection, heart-rate CSV parsing, and range filtering. The full app build verifies the new route compiles.
