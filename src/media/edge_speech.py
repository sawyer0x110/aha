"""Send only an explicitly approved narration request to the Edge online service."""
import argparse
import asyncio
import json
from pathlib import Path

import edge_tts


async def synthesize(request_path: str, output: str) -> None:
    request = json.loads(Path(request_path).read_text(encoding="utf-8"))
    # This file is written by the validated Node caller, not loaded from a Pack.
    communicator = edge_tts.Communicate(
        text=request["text"],
        voice=request["voice"],
        rate=request["rate"],
        connect_timeout=15,
        receive_timeout=45,
    )
    await communicator.save(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("request")
    parser.add_argument("output")
    arguments = parser.parse_args()
    asyncio.run(synthesize(arguments.request, arguments.output))
