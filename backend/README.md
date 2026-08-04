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

## Sync From Connected Glasses

Connect the Project Aria glasses to the laptop, then start the backend with:

```bash
scripts/start_aria_backend.sh --sync-on-query
```

Each session query will run:

```bash
aria_gen2 recording download-all -o ../data/raw
```

After download, the backend scans the `.vrs` files and runs:

```bash
vrs_to_mp4 --stream_id 214-1
```

The frontend receives browser-playable RGB video URLs.

## Custom Paths

```bash
scripts/start_aria_backend.sh \
  --data-root /path/to/raw/vrs/files \
  --output-root /path/to/processed/rgb
```
