"""Package genuine browser recordings as a captioned 2560 x 1440 MP4.

Requires ffmpeg/ffprobe with libass. Keeps the complete desktop recording at
normal speed. Optional narrow mobile recording follows in a separate scene.
No OCR results or application states are manufactured by this renderer.
"""
import argparse
import json
import shutil
import subprocess
import textwrap
from pathlib import Path


def stamp(seconds, srt=False):
    units = round(seconds * (1000 if srt else 100))
    scale = 1000 if srt else 100
    hours, units = divmod(units, 3600 * scale)
    minutes, units = divmod(units, 60 * scale)
    sec, sub = divmod(units, scale)
    return f"{hours:02}:{minutes:02}:{sec:02}" + (f",{sub:03}" if srt else f".{sub:02}")


def safe(text):
    return text.replace("\\", " ").replace("{", "(").replace("}", ")").replace("\n", " ")


def duration(source):
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(source)
    ], text=True).strip())


def run(args, folder):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "warning", "-n", *args], cwd=folder, check=True)


parser = argparse.ArgumentParser()
parser.add_argument("evidence", type=Path)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
folder = args.output.resolve()
folder.mkdir(parents=True, exist_ok=True)
source = args.evidence.resolve()
desktop = source / "archive-walkthrough-1440p.webm"
seconds = duration(desktop)
chapters = json.loads((source / "chapters.json").read_text(encoding="utf-8"))
header = """[Script Info]
ScriptType: v4.00+
PlayResX: 2560
PlayResY: 1440
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,31,&H00F6F5ED,&H00F6F5ED,&H001C3B30,&H001C3B30,0,0,0,0,100,100,0,0,1,0,0,2,120,120,35,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
events, subtitles = [], []
for index, chapter in enumerate(chapters):
    start = 0 if index == 0 else chapter["start"]
    end = min(seconds, chapters[index + 1]["start"]) if index + 1 < len(chapters) else seconds
    title, message = safe(chapter["title"]), safe(chapter["message"])
    lines = r"\N".join(textwrap.wrap(message, width=135))
    content = r"{\b1\fs40}" + title + r"{\b0\fs31}\N" + lines
    events.append(f"Dialogue: 0,{stamp(start)},{stamp(end)},Caption,,0,0,0,,{content}")
    subtitles.append(f"{index + 1}\n{stamp(start, True)} --> {stamp(end, True)}\n{title}\n{message}\n")
(folder / "desktop-captions.ass").write_text(header + "\n".join(events) + "\n", encoding="utf-8")
codec = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "25", "-an", "-movflags", "+faststart"]
run(["-i", str(desktop), "-vf", "scale=2222:1250,pad=2560:1440:(ow-iw)/2:0:color=0x173d30,ass=desktop-captions.ass", *codec, "desktop-captioned.mp4"], folder)
segments = ["desktop-captioned.mp4"]
mobile = source / "mobile-photo-draft.webm"
if mobile.exists():
    mobile_seconds = duration(mobile)
    mobile_title = "Mobile: photograph the item before accession"
    mobile_message = "Check or replace the photo, then complete the card. Browser demonstration uses a fictional image; a physical phone camera has not been tested."
    content = r"{\b1\fs40}" + mobile_title + r"{\b0\fs31}\N" + r"\N".join(textwrap.wrap(mobile_message, width=135))
    (folder / "mobile-captions.ass").write_text(header + f"Dialogue: 0,0:00:00.00,{stamp(mobile_seconds)},Caption,,0,0,0,,{content}\n", encoding="utf-8")
    run(["-i", str(mobile), "-vf", "scale=-2:1250,pad=2560:1440:(ow-iw)/2:0:color=0x173d30,ass=mobile-captions.ass", *codec, "mobile-captioned.mp4"], folder)
    segments.append("mobile-captioned.mp4")
    subtitles.append(f"{len(subtitles) + 1}\n{stamp(seconds, True)} --> {stamp(seconds + mobile_seconds, True)}\n{mobile_title}\n{mobile_message}\n")
(folder / "segments.txt").write_text("\n".join(f"file '{name}'" for name in segments) + "\n", encoding="utf-8")
run(["-f", "concat", "-safe", "0", "-i", "segments.txt", "-c", "copy", "-movflags", "+faststart", "collingham-archive-walkthrough-1440p.mp4"], folder)
(folder / "collingham-archive-walkthrough.srt").write_text("\n".join(subtitles), encoding="utf-8")
shutil.copyfile(source / "chapters.json", folder / "desktop-chapters.json")
print(folder / "collingham-archive-walkthrough-1440p.mp4")
