# CogAR Local Project Aria Backend

This backend runs on the laptop that has access to the Meta Project Aria glasses
and local `.vrs` files. The GitHub Pages annotation app queries it at:

```text
http://localhost:8765/api/sessions
```

## Start

From `CogARReliance`:

```bash
scripts/start_aria_backend.sh
```

Then open:

```text
http://localhost:8765/api/health
```

## Query Existing VRS Files

The backend scans:

```text
../data/raw
```

For each `.vrs` file, it creates an RGB MP4 in:

```text
../data/processed/rgb
```

The annotation app can then query sessions using its default backend endpoint.

## Connected Project Aria Gen 1 Glasses

Connect the Gen 1 glasses by USB, then verify that ADB sees an authorized
device:

```bash
/opt/homebrew/bin/adb devices -l
```

Start the local backend:

```bash
scripts/start_aria_backend.sh --adb /opt/homebrew/bin/adb
```

The annotation page's **Query sessions** button only lists VRS files in
`/sdcard/recording`; it does not transfer anything. Select one recording and
click **Download selected** to copy only that VRS file and its JSON metadata,
convert RGB stream `214-1` to MP4, and load it into the annotator. The backend
never deletes recordings from the glasses.

If `adb devices -l` has no `device` row, reconnect the glasses directly (not
through a hub), confirm the data cable and USB mode, and wait for the device to
finish charging/authorizing before querying again.

## Custom Paths

```bash
scripts/start_aria_backend.sh \
  --data-root /path/to/raw/vrs/files \
  --output-root /path/to/processed/rgb
```
