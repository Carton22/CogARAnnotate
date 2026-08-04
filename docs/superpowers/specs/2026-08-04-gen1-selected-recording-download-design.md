# Gen 1 Selected Recording Download Design

## Purpose

Enable the hosted CogAR annotation page to discover recordings on a connected
Project Aria Gen 1 device, then download and prepare only the recording the
researcher chooses.

## Architecture

The GitHub Pages UI continues to call a local backend at
`http://localhost:8765`. The backend uses Android Debug Bridge (ADB), which is
the supported Gen 1 transfer path. The browser never receives a raw VRS file
and the backend is bound to loopback only.

## API

* `GET /api/device-sessions` lists `.vrs` recordings in
  `/sdcard/recording` without transferring them. It returns a lightweight list
  of selectable device sessions.
* `POST /api/device-sessions/<id>/download` downloads only that session's VRS
  and optional sibling JSON file into the configured raw-data directory,
  converts RGB stream `214-1` to an MP4, and returns the normal annotation
  session response.
* Existing `GET /api/sessions` continues to list already-prepared local
  sessions.

## UI Flow

1. The researcher enters the participant ID and selects a task plan.
2. **Query sessions** lists device recordings without downloading them.
3. The researcher selects one device recording.
4. **Download selected** is enabled and prepares only that recording.
5. The returned MP4 automatically loads in the RGB player for annotation.

## Error Handling

The backend reports an actionable error when ADB is unavailable, no authorized
device is connected, a selected recording no longer exists, a transfer fails,
or RGB conversion fails. Querying does not mutate device or local recording
data; downloading only creates local copies and never deletes glasses data.

## Testing

Test device-recording discovery with a fake ADB command, verify the selected
session download issues a pull for only the selected VRS/JSON pair, and retain
the existing VRS-to-MP4 conversion test. Add UI model tests for device-session
normalization and selection state.
