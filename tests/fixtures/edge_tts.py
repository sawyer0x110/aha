"""Offline API double: never connects to a speech service."""
import json
from pathlib import Path


class Communicate:
    def __init__(self, text, voice, **options):
        self.payload = {"text": text, "voice": voice, "options": options}

    async def save(self, output):
        Path(output).write_text(json.dumps(self.payload), encoding="utf-8")
