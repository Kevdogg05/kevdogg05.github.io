# Parley: communication coach

Practice the conversations that matter. Parley is a free, installable web app
that teaches communication skills with bite-sized lessons, quizzes, flashcards,
a small talk game, branching "video" scenarios and a speech analyzer that scores
how you speak.

Live: https://kevdogg05.github.io/parley/ (scan `qr-code.png` to open it on a phone)

Everything is static HTML, CSS and JavaScript with no build step, no server and
no account. Progress and recordings stay on the device.

## What's inside

| Feature | What it does |
| --- | --- |
| **Lessons** (`Learn`) | 6 courses × 6 lessons: Command the Room, Never Run Out of Things to Say, Building Self-Esteem, Speak Clearly, Lead and Influence, Dates and Deeper Connection. Each lesson has 3–5 reading steps with tappable glossary terms, a key takeaway and a "try it today" challenge. |
| **Listen mode** | The headphones toggle reads a lesson aloud (browser text-to-speech) with back / play-pause / forward and 0.75–1.5× speed. |
| **Quizzes** | Four per lesson: True or False, Fill in the Blank, Match Pairs and multiple choice, with an explanation after every answer. |
| **Flashcards** | 2–3 cards per lesson, spaced repetition (Leitner boxes), a "Review due" deck and a deck per course. Swipe or tap Again / Got it. |
| **Small Talk game** | 10 situations (coworker after a launch, coffee line, new neighbor, networking mixer, first date, wedding table, elevator with the CEO…). An illustrated character speaks, you pick a reply and get a Positive / Neutral / Awkward reaction with coaching. **Say it my way** lets you type or dictate your own reply and get feedback on it. |
| **Conversation sparks** | 40 openers and questions for work, parties, dates and anywhere, plus the FORD prompt. |
| **Scenarios** | 6 branching scenes acted out by animated characters with voices and captions. ±15 s skip, speed, fullscreen, a progress bar, and "Choose how to continue · autoplays in 10 s" at each decision. 4 endings each, then a question. |
| **Speech Analyzer** | Record a free-talk answer to a prompt (24 prompts) or read a passage or tongue twister aloud (10 texts). You get a speech score out of 100, a headline ("Focused but rushed"), scores for pace, filler words, pauses, pitch variety, volume and energy, and clarity, plus numbered moments on the waveform ("Try This · Listen at 0:08") that play your recording from that spot. History keeps your last 30 scores and 15 recordings. |
| **Progress** | XP, levels, a daily goal, streaks, a weekly chart and 13 badges. |

### How the speech analysis works

All analysis runs in the browser (`js/speech/analysis.js`):

- **Pauses**: frame loudness against an adaptive noise floor finds speech and silence.
- **Pace**: words per minute from the live transcript when available, otherwise
  estimated from syllable nuclei (loudness peaks in voiced speech). Rushed
  stretches are flagged from 4-second windows.
- **Pitch variety**: a YIN pitch tracker; the spread of your pitch in semitones.
- **Volume & energy**: the spread of loudness across syllables, and overall level.
- **Filler words**: "um", "uh", filler "like", "you know", "I mean" and hedges in
  the transcript, plus sustained flat-pitched hesitation sounds found in the audio
  (speech recognizers often drop "um").
- **Clarity**: in read-aloud mode, word accuracy against the passage; otherwise the
  recognizer's confidence, or (with transcription off) an estimate from how crisp
  the syllables are.

These are coaching heuristics, not a clinical speech assessment.

## Browser notes

- **Microphone** needs https (GitHub Pages is fine) and permission.
- **Live transcription** uses the browser's Web Speech API (Chrome, Edge, Safari;
  not Firefox). In Chrome the audio for recognition goes to the browser's speech
  service; turn off "Transcribe as I speak" to keep everything on the device. The
  analyzer still scores pace, pauses, pitch, energy and hesitations without it.
- **Voices** come from the device's text-to-speech voices. With no voices
  installed, lessons and scenes still work with captions only.
- **Install**: "Add to Home screen" (or Install from the profile page) makes it a
  full-screen app that works offline.

## Run it locally

```bash
python3 -m http.server 8000      # from the repository root
# open http://localhost:8000/parley/
```

## Editing content

Lessons, small talk chats, scenarios and prompts are plain data files in
`js/content/`. The format and style guide are in [CONTENT.md](CONTENT.md).
After editing, check everything with:

```bash
node parley/tools/validate-content.mjs
node parley/tools/test-analysis.mjs     # speech analysis tests (synthetic audio)
```

When you add or rename a file, add it to the `ASSETS` list in `sw.js` and bump
`VERSION` so installed copies update.

## Layout

```
parley/
├── index.html, manifest.webmanifest, sw.js, icon*.png, icon.svg, qr-code.*
├── css/app.css
├── js/
│   ├── app.js            router, onboarding, home, learn, practice, profile
│   ├── lesson.js, quiz.js, flashcards.js, smalltalk.js, scenes.js
│   ├── avatar.js, backdrops.js     illustrated characters and scenes (SVG)
│   ├── store.js, tts.js, sfx.js, ui.js, icons.js, rewards.js
│   ├── speech/           analyzer.js (screens), analysis.js (DSP and scoring),
│   │                     recorder.js, capture-worklet.js, db.js (IndexedDB)
│   └── content/          courses/*.js, smalltalk.js, scenarios.js, prompts.js
└── tools/                validate-content.mjs, test-analysis.mjs
```
