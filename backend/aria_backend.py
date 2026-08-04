#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import mimetypes
import os
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, unquote, urlparse


RGB_STREAM_ID = "214-1"


@dataclass(frozen=True)
class AriaSession:
    id: str
    participant_id: str
    task_plan_id: str
    recorded_at: str
    source_vrs_name: str
    rgb_video_url: str
    duration_seconds: int | None
    rgb_camera_score: float | None
    rgb_frames_processed: int | None
    rgb_frames_expected: int | None

    def to_response(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "participantId": self.participant_id,
            "taskPlanId": self.task_plan_id,
            "recordedAt": self.recorded_at,
            "sourceVrsName": self.source_vrs_name,
            "rgbVideoUrl": self.rgb_video_url,
            "durationSeconds": self.duration_seconds,
            "quality": {
                "rgbCameraScore": self.rgb_camera_score,
                "rgbFramesProcessed": self.rgb_frames_processed,
                "rgbFramesExpected": self.rgb_frames_expected,
            },
        }


def slugify(value: str) -> str:
    normalized = []
    for char in value.strip():
        if char.isalnum():
            normalized.append(char)
        elif normalized and normalized[-1] != "-":
            normalized.append("-")
    return "".join(normalized).strip("-") or "recording"


def read_metadata(vrs_path: Path) -> dict[str, Any]:
    metadata_path = vrs_path.with_suffix(vrs_path.suffix + ".json")
    if not metadata_path.exists():
        return {}
    try:
        return json.loads(metadata_path.read_text())
    except json.JSONDecodeError:
        return {}


def recorded_at_from_metadata(metadata: dict[str, Any], vrs_path: Path) -> str:
    start_time = metadata.get("start_time")
    if isinstance(start_time, int | float):
        return datetime.fromtimestamp(start_time, timezone.utc).isoformat()
    return datetime.fromtimestamp(vrs_path.stat().st_mtime, timezone.utc).isoformat()


def duration_from_metadata(metadata: dict[str, Any]) -> int | None:
    start_time = metadata.get("start_time")
    end_time = metadata.get("end_time")
    if isinstance(start_time, int | float) and isinstance(end_time, int | float):
        return max(0, int(end_time - start_time))
    return None


def rgb_quality(metadata: dict[str, Any]) -> tuple[float | None, int | None, int | None]:
    stats = metadata.get("data_quality_stats")
    if not isinstance(stats, dict):
        return None, None, None
    rgb = stats.get("rgb_camera")
    if not isinstance(rgb, dict):
        return None, None, None
    return (
        rgb.get("score") if isinstance(rgb.get("score"), int | float) else None,
        rgb.get("processed") if isinstance(rgb.get("processed"), int) else None,
        rgb.get("expected") if isinstance(rgb.get("expected"), int) else None,
    )


def discover_vrs_files(data_root: Path) -> list[Path]:
    if not data_root.exists():
        return []
    return sorted(data_root.rglob("*.vrs"))


def convert_rgb_video(
    vrs_path: Path,
    output_video: Path,
    *,
    converter: str = "vrs_to_mp4",
) -> None:
    if output_video.exists() and output_video.stat().st_size > 0:
        return

    output_video.parent.mkdir(parents=True, exist_ok=True)
    log_folder = output_video.parent / "logs"
    log_folder.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            converter,
            "--vrs",
            str(vrs_path),
            "--stream_id",
            RGB_STREAM_ID,
            "--output_video",
            str(output_video),
            "--log_folder",
            str(log_folder),
        ],
        check=True,
    )


def build_sessions(
    *,
    data_root: Path,
    output_root: Path,
    request_origin: str,
    participant_id: str,
    task_plan_id: str,
    converter: str = "vrs_to_mp4",
) -> list[AriaSession]:
    sessions: list[AriaSession] = []
    for vrs_path in discover_vrs_files(data_root):
        session_id = slugify(vrs_path.stem)
        output_video = output_root / session_id / "rgb.mp4"
        convert_rgb_video(vrs_path, output_video, converter=converter)
        metadata = read_metadata(vrs_path)
        score, processed, expected = rgb_quality(metadata)
        sessions.append(
            AriaSession(
                id=session_id,
                participant_id=participant_id or vrs_path.parent.name,
                task_plan_id=task_plan_id or "sandwich",
                recorded_at=recorded_at_from_metadata(metadata, vrs_path),
                source_vrs_name=vrs_path.name,
                rgb_video_url=f"{request_origin}/recordings/{quote(session_id)}/rgb.mp4",
                duration_seconds=duration_from_metadata(metadata),
                rgb_camera_score=score,
                rgb_frames_processed=processed,
                rgb_frames_expected=expected,
            )
        )
    return sessions


def sync_from_glasses(data_root: Path, *, aria_cli: str = "aria_gen2") -> None:
    data_root.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [aria_cli, "recording", "download-all", "-o", str(data_root)],
        check=True,
    )


class AriaBackendHandler(BaseHTTPRequestHandler):
    data_root: Path
    output_root: Path
    sync_on_query: bool
    converter: str
    aria_cli: str

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Range")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.write_json(
                {
                    "ok": True,
                    "dataRoot": str(self.data_root),
                    "outputRoot": str(self.output_root),
                    "vrsToMp4": shutil.which(self.converter),
                    "ariaGen2": shutil.which(self.aria_cli),
                }
            )
            return

        if parsed.path == "/api/sessions":
            self.handle_sessions(parsed.query)
            return

        if parsed.path.startswith("/recordings/"):
            self.handle_recording(parsed.path)
            return

        self.write_json({"error": "Not found"}, status=404)

    def handle_sessions(self, query: str) -> None:
        params = parse_qs(query)
        participant_id = params.get("participantId", [""])[0].strip()
        task_plan_id = params.get("taskPlanId", [""])[0].strip()
        sync_requested = params.get("sync", [""])[0] in {"1", "true", "yes"}

        try:
            if self.sync_on_query or sync_requested:
                sync_from_glasses(self.data_root, aria_cli=self.aria_cli)
            sessions = build_sessions(
                data_root=self.data_root,
                output_root=self.output_root,
                request_origin=self.request_origin(),
                participant_id=participant_id,
                task_plan_id=task_plan_id,
                converter=self.converter,
            )
            self.write_json({"sessions": [session.to_response() for session in sessions]})
        except subprocess.CalledProcessError as error:
            self.write_json(
                {
                    "error": "Project Aria command failed",
                    "detail": " ".join(str(part) for part in error.cmd),
                    "sessions": [],
                },
                status=500,
            )

    def handle_recording(self, path: str) -> None:
        parts = [unquote(part) for part in path.split("/") if part]
        if len(parts) != 3 or parts[0] != "recordings" or parts[2] != "rgb.mp4":
            self.write_json({"error": "Recording not found"}, status=404)
            return
        video_path = (self.output_root / parts[1] / "rgb.mp4").resolve()
        if not video_path.is_file() or self.output_root.resolve() not in video_path.parents:
            self.write_json({"error": "Recording not found"}, status=404)
            return
        self.send_file(video_path)

    def send_file(self, path: Path) -> None:
        file_size = path.stat().st_size
        range_header = self.headers.get("Range")
        start = 0
        end = file_size - 1
        status = 200

        if range_header and range_header.startswith("bytes="):
            requested = range_header.removeprefix("bytes=").split("-", 1)
            if requested[0]:
                start = int(requested[0])
            if len(requested) > 1 and requested[1]:
                end = int(requested[1])
            end = min(end, file_size - 1)
            status = 206

        length = max(0, end - start + 1)
        self.send_response(status)
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "video/mp4")
        self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.end_headers()

        with path.open("rb") as file:
            file.seek(start)
            remaining = length
            while remaining > 0:
                chunk = file.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def request_origin(self) -> str:
        host = self.headers.get("Host") or f"localhost:{self.server.server_port}"
        return f"http://{host}"

    def write_json(self, payload: dict[str, Any], *, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def default_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def make_server(args: argparse.Namespace) -> ThreadingHTTPServer:
    handler = type(
        "ConfiguredAriaBackendHandler",
        (AriaBackendHandler,),
        {
            "data_root": Path(args.data_root).resolve(),
            "output_root": Path(args.output_root).resolve(),
            "sync_on_query": args.sync_on_query,
            "converter": args.converter,
            "aria_cli": args.aria_cli,
        },
    )
    return ThreadingHTTPServer((args.host, args.port), handler)


def parse_args() -> argparse.Namespace:
    project_root = default_project_root()
    parser = argparse.ArgumentParser(description="Serve CogAR Project Aria RGB sessions.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--data-root", default=str(project_root / "data" / "raw"))
    parser.add_argument(
        "--output-root",
        default=str(project_root / "data" / "processed" / "rgb"),
    )
    parser.add_argument("--sync-on-query", action="store_true")
    parser.add_argument("--converter", default=os.environ.get("VRS_TO_MP4", "vrs_to_mp4"))
    parser.add_argument("--aria-cli", default=os.environ.get("ARIA_GEN2", "aria_gen2"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    server = make_server(args)
    print(f"CogAR Aria backend listening at http://{args.host}:{args.port}")
    print(f"Serving VRS files from {Path(args.data_root).resolve()}")
    print(f"Serving RGB MP4 files from {Path(args.output_root).resolve()}")
    if args.sync_on_query:
        print("Sync-on-query enabled: connected glasses will be downloaded before each query.")
    server.serve_forever()


if __name__ == "__main__":
    main()
