# Native selection motion — authored, not executed

`main.mjs` builds the ten-slide native deck. Slides 3–5 also work as progressive builds without animations. `add_motion.py` is a separately gated, original Python-standard-library postprocessor for **a new copy** of that generated PPTX. It adds native OOXML motion paths, not videos/GIFs or rasterized slides:

- Slide 4: the result's **on** text moves horizontally from the theirs column to the result column over 900ms.
- Slide 5: the result's **off** text moves from the ours column to the result column over 900ms after the changed base has reversed the selection.
- Each motion is click-driven. The text remains a native editable shape; all other native objects are preserved.

This helper has **not been run**, syntax-tested, schema-validated or opened in PowerPoint. The exact timing tree and path interpretation must be checked in the target application after approval; support is not claimed from reading XML. The initial result remains a visible comparison result; clicking then demonstrates its selection path.

The parent must separately review/approve the helper's filesystem capabilities before execution. It reads the approved generated PPTX (64 MiB compressed / 128 MiB expanded limits), parses two slide XML entries, and writes a fresh PPTX and a hash audit sidecar outside the project. It never extracts archive paths, invokes a process, contacts a network, overwrites existing timing, edits the original input or calls an external library. It rejects duplicate entries and signed packages.

Example **for later approval only**:

```powershell
python "<absolute-project>\pptx\add_motion.py" "<approved-generated.pptx>" "<fresh-motion-candidate.pptx>"
```

The original Aha receipt belongs to the unmodified generated file. The helper's `.motion-review.json` is an actual-byte postprocessing audit, **not** an Aha receipt and not visual QA. Never attach the old render receipt to the modified file or hand-edit its output hash. Preserve both candidates and document the animation pipeline in final delivery. Inspect slides 4/5 during actual slide-show playback, then render every page and test representative text/table/shape edits on a separate copy.
