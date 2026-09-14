import path from 'node:path';
import type { Pack } from '../core/schema.js';

export const DEPENDENCIES = {
  remotion: '4.0.507', '@remotion/bundler': '4.0.507', '@remotion/renderer': '4.0.507',
  react: '19.0.0', 'react-dom': '19.0.0', pptxgenjs: '4.0.1',
} as const;

const theme = `
:root {
  color-scheme: light;
  --cp-bg: #f7f4ef;
  --cp-bg-elevated: #fcfbf8;
  --cp-surface: #ffffff;
  --cp-surface-soft: #f5f5f5;
  --cp-border: #dedede;
  --cp-border-strong: #919191;
  --cp-text: #242424;
  --cp-text-muted: #5c5c5c;
  --cp-text-soft: #6f6f6f;
  --cp-accent: #b11f4b;
  --cp-accent-hover: #9a1a41;
  --cp-accent-soft: rgba(177, 31, 75, 0.08);
  --cp-accent-fg: #ffffff;
  --cp-success: #16a34a;
  --cp-danger: #dc2626;
  --cp-warning: #f59e0b;
  --cp-link: #0078d4;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.12);
  --cp-overlay: rgba(255, 255, 255, 0.8);
  --cp-panel: rgba(255, 255, 255, 0.86);
  --cp-panel-strong: rgba(255, 255, 255, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.55);
  --cp-highlight: rgba(177, 31, 75, 0.12);
}
html[data-theme="dark"] {
  color-scheme: dark;
  --cp-bg: #3d3b3a;
  --cp-bg-elevated: #343231;
  --cp-surface: #292929;
  --cp-surface-soft: #2e2e2e;
  --cp-border: #474747;
  --cp-border-strong: #5f5f5f;
  --cp-text: #dedede;
  --cp-text-muted: #919191;
  --cp-text-soft: #b0b0b0;
  --cp-accent: #fd8ea1;
  --cp-accent-hover: #fb7b91;
  --cp-accent-soft: rgba(253, 142, 161, 0.14);
  --cp-accent-fg: #1a1a1a;
  --cp-success: #4ade80;
  --cp-danger: #f87171;
  --cp-warning: #fbbf24;
  --cp-link: #4da6ff;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
  --cp-overlay: rgba(41, 41, 41, 0.88);
  --cp-panel: rgba(41, 41, 41, 0.72);
  --cp-panel-strong: rgba(41, 41, 41, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.04);
  --cp-highlight: rgba(253, 142, 161, 0.12);
}`;

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const escape = (value: string): string => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function html(pack: Pack, poster: boolean): string {
  return `<!doctype html>
<html lang="${pack.brief.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="aha-offline" content="true">
<meta name="aha-pack-hash" content="${pack.manifest.contentHash}">
<title>${escape(pack.brief.topic)}</title>
<script>
  (() => {
    const param = new URLSearchParams(window.location.search).get("scoutTheme");
    const theme =
      param || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  })();
</script>
<style>${theme}
* { box-sizing: border-box; }
body { margin: 0; background: var(--cp-bg); color: var(--cp-text); font-family: "Segoe UI", Aptos, Calibri, -apple-system, BlinkMacSystemFont, sans-serif; }
main { ${poster ? 'width: 1080px; min-height: 720px;' : 'max-width: 960px; margin: 0 auto;'} padding: 48px; }
h1 { color: var(--cp-accent); }
p { line-height: 1.6; }
</style>
</head>
<body><main${poster ? ' id="aha-poster"' : ''}>
<!-- AHA_STUDIO_DRAFT: Replace this entire placeholder with your original composition. -->
<h1>Original ${poster ? 'poster' : 'article'} — not yet authored</h1>
<p>${escape(pack.brief.question)}</p>
<p>Use source-data.json to build an original explanation. Preserve evidence, limitations and full content. Declare covered Claim IDs in studio.json.</p>
</main></body></html>
`;
}

export function scaffoldFiles(pack: Pack): Record<string, string> {
  return {
    'studio.json': json({
      schemaVersion: '0.3.0', packHash: pack.manifest.contentHash, title: pack.brief.topic,
      status: 'draft', coverage: { html: [], image: [], pptx: [], video: [] },
    }),
    'source-data.json': json(pack),
    'timeline.json': json({ fps: 30, totalFrames: 0, segments: [] }),
    'package.json': json({
      name: 'aha-original-project', version: '0.1.0', private: true, type: 'module',
      engines: { node: '>=22' }, dependencies: DEPENDENCIES,
    }),
    'article.html': html(pack, false),
    'poster.html': html(pack, true),
    'deck.mjs': `// AHA_STUDIO_DRAFT: Author an original editable slide composition.
export default async function createDeck({pptxgen}, pack) {
  const deck = new pptxgen();
  deck.layout = 'LAYOUT_WIDE';
  deck.title = pack.brief.topic;
  throw new Error('Original deck is not yet authored. Add slides, then return deck.');
}
`,
    [path.join('src', 'Video.tsx')]: `import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import timeline from '../timeline.json';
import pack from '../source-data.json';

// AHA_STUDIO_DRAFT: Replace with an original, frame-driven visual explanation.
export default function Video() {
  const frame = useCurrentFrame();
  return <AbsoluteFill>
    <h1>{pack.brief.topic}</h1>
    <p>Original motion design not yet authored — frame {frame}</p>
    {timeline.segments.map(segment => <Sequence key={segment.id} from={segment.from} durationInFrames={segment.frames}>
      <Audio src={staticFile(segment.audioFile)} />
    </Sequence>)}
  </AbsoluteFill>;
}
`,
    [path.join('src', 'Root.tsx')]: `import React from 'react';
import {Composition} from 'remotion';
import Video from './Video';
import timeline from '../timeline.json';

export const Root = () => {
  if (timeline.fps !== 30 || timeline.totalFrames <= 0) {
    throw new Error('Import validated narration with studio-audio before rendering. Draft has no voice.');
  }
  return <Composition id="AhaVideo" component={Video} durationInFrames={timeline.totalFrames} fps={30} width={1280} height={720} />;
};
`,
    [path.join('src', 'index.tsx')]: `import {registerRoot} from 'remotion';
import {Root} from './Root';
registerRoot(Root);
`,
    'README.md': `# Original Aha production project

This is an editable creative workspace, not a rendered template. No output is publishable until you author it.

1. Keep source.aha immutable and source-data.json an exact JSON snapshot. Read all evidence and limitations.
2. Author article.html, poster.html (#aha-poster), deck.mjs and/or src/Video.tsx from the content. No universal layout is imposed. Replace AHA_STUDIO_DRAFT placeholders, set studio.json status to authored, and declare Claim IDs actually covered per medium. Omitted Claims are reported, not silently assumed covered.
3. Run aha studio-check PROJECT (static only; no authored code is executed).
4. For PPT/video run npm install explicitly **in this project**. Dependencies are pinned; Aha never installs them or falls back to global/root modules.
5. For video, review/approve narration with the existing prepare-video / import-audio or synthesize workflow. Then run aha studio-audio PROJECT VIDEO-PLAN.json VALIDATED-AUDIO-DIRECTORY. This copies and verifies existing WAVs only; it never calls TTS or the network. It refuses to replace imported audio.
6. Run aha studio-render PROJECT NEW-OUTPUT --formats html,image,pptx,video --trust-local-code (select only the formats you authored).

## Authoring contract

- HTML is a standalone offline document: lang, viewport width, Pack hash and <meta name="aha-offline" content="true"> are required. Inline all assets/scripts/styles. No remote or relative resource dependencies. Interactive JavaScript is permitted only after explicit trust.
- poster.html contains exactly one #aha-poster with positive, whole-pixel width/height (maximum 8192 each). All content must fit visibly; clipped/scrolling/unsupported layouts fail rather than truncate.
- deck.mjs exports default async function({pptxgen}, pack), returning an instance of that project-local PptxGenJS constructor. Aha writes story.pptx; do not write the artifact yourself. Do not use network images or external relationships. Author full editable content and inspect text fit yourself; structural checks do not certify visual layout.
- src/Video.tsx exports a React component. Use Remotion hooks, timeline.json and source-data.json; reference narration with staticFile(segment.audioFile) inside Sequence from/frames. Root registers AhaVideo at 1280x720, 30fps, timeline.totalFrames.
- timeline.json is {fps:30,totalFrames,segments:[{id,slideId,text,from,frames,audioFile}]}. audioFile is relative to public/, e.g. audio/segment-001.wav. studio-audio writes audio-provenance.json bound to the exact plan, audio hashes and timeline hash. Do not edit imported audio/timing. Empty timeline is explicitly unrenderable; no silence fallback exists.
- Only project-local pinned rendering dependencies are accepted. Set AHA_BROWSER_EXECUTABLE to installed Edge/Chrome if automatic local detection fails; AHA_FFMPEG/AHA_FFPROBE override local tools. No browser downloads.
- studio-render produces explainer.html, card.png, story.pptx and/or story.mp4 plus receipt.json. The receipt records actual source/output hashes, timing, selected renderer modes and measured checks, not semantic/visual approval. An error leaves a failed receipt, never a successful fallback.

## Trust and review

--trust-local-code permits authored HTML/JS/TS **and installed dependencies** to execute with your account privileges. This is NOT a sandbox. Review sources and dependencies first. Static offline checks are hygiene, not a security guarantee against malicious trusted code. Keep all sources and assets self-contained; network-dependent productions are unsupported. No commands publish artifacts automatically. Existing render-* commands remain opt-in quick compatibility renderers.
`,
  };
}
