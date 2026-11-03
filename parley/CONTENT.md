# Parley content format

Everything Parley teaches lives in `js/content/` as plain ES modules, so you can
add or edit lessons without touching the app code. After any change, run:

```bash
node parley/tools/validate-content.mjs            # every content file
node parley/tools/validate-content.mjs parley/js/content/courses/presence.js
```

The validator prints each problem with its location and exits non-zero if any
are found.

## Writing style

- Plain, warm, practical English (US spelling). Second person ("you").
- Concrete: every idea should come with something the reader can say or do.
- Evidence-informed, never pseudo-science. No "studies show 93% of
  communication is nonverbal" myths, no invented statistics.
- Respectful and consent-aware, especially in dating content: no manipulation,
  "negging", pressure or pickup tactics.
- Original wording. Do not copy text from other apps, books or courses.
- Use the typographic apostrophe `’` and quotes `“ ”` inside strings, and wrap
  strings in plain double quotes `"..."`, so nothing needs escaping.

## Avatars (used by small talk partners and scenario cast)

```js
avatar: {
  skin: "porcelain" | "light" | "tan" | "olive" | "brown" | "deep",
  hair: "short" | "side-part" | "curly" | "wavy" | "long" | "bun" | "ponytail" | "afro" | "buzz" | "bald" | "bob" | "locs",
  hairColor: "black" | "dark-brown" | "brown" | "auburn" | "blonde" | "gray" | "red",
  outfit: "blazer" | "shirt" | "tee" | "sweater" | "hoodie" | "dress" | "polo",
  outfitColor: "navy" | "blue" | "teal" | "green" | "maroon" | "purple" | "gray" | "black" | "white" | "mustard" | "coral",
  beard: "none" | "stubble" | "full" | "mustache",   // optional, default "none"
  glasses: true | false,                              // optional, default false
  voice: "m" | "f"                                    // which synthetic voice reads their lines
}
```

Scenes (backdrops): `"office" | "cafe" | "party" | "gala" | "park" | "restaurant" | "meeting" | "street"`.

Moods (facial expression on a line): `"neutral" | "smile" | "laugh" | "think" | "worried" | "annoyed" | "surprised"`.

## Courses: `js/content/courses/<course-id>.js`

```js
export default {
  id: "presence",                          // kebab-case, matches the file name
  title: "Command the Room",               // <= 40 chars
  subtitle: "Confidence and presence at work",  // <= 70 chars
  tags: ["work", "confidence"],            // from: work, smalltalk, dating, leadership, confidence, speaking
  lessons: [                               // exactly 6
    {
      id: "presence-1",                    // <course id>-<1..6>
      title: "First impressions that stick",   // <= 48 chars
      minutes: 6,                          // 4..15
      intro: "One-sentence hook shown before the lesson starts.",   // <= 30 words
      steps: [                             // 3..5 steps, 12..70 words each
        { text: "Mark glossary words with double brackets, like [[warmth]]." }
      ],
      glossary: {                          // 1..3 terms; every [[term]] needs an entry
        "warmth": "Signals that you are friendly and on the other person’s side."   // <= 30 words
      },
      takeaway: "One-sentence summary.",   // <= 30 words
      tryIt: "A tiny real-world challenge to do today.",   // <= 35 words
      quiz: [                              // exactly 4: one of each type, any order
        { type: "tf", statement: "…", answer: true, explain: "…" },
        { type: "blank", before: "Text before the gap", after: "text after (may be empty).",
          answer: "approval", options: ["approval", "attention", "power"], explain: "…" },
        { type: "match", prompt: "Match each signal to its message",
          pairs: [["Warmth", "You’re on my side"], ["Competence", "You can get it done"], ["Calm", "You’re in control"]] },
        { type: "mcq", question: "…?", options: ["…", "…", "…"], answer: 0, explain: "…" }
      ],
      flashcards: [                        // 2..3
        { front: "Question or term (<= 15 words)", back: "Answer (<= 35 words)" }
      ]
    }
  ]
};
```

Quiz rules: `blank` has exactly 3 options (each 1–3 words) and `answer` is one
of them; `match` has 3–4 pairs (left <= 5 words, right <= 8 words); `mcq` has
3–4 options and `answer` is the index of the correct one. `explain` is <= 35
words and says *why*.

## Small talk game: `js/content/smalltalk.js`

```js
export default [
  {
    id: "after-the-launch",
    title: "After the big launch",          // <= 40 chars
    category: "work",                       // work | social | dating | networking | neighbors
    level: 1,                               // 1 easy, 2 medium, 3 hard
    scene: "office",
    partner: { name: "Jake", role: "Product manager on your floor", avatar: { … } },
    goal: "Celebrate Jake’s win and keep the chat going.",   // <= 25 words
    turns: [                                // 4..6
      {
        say: "What the partner says.",      // <= 40 words
        options: [                          // exactly 3: one positive, one neutral, one negative
          { text: "Your reply", rating: "positive", feedback: "Why it works", reply: "Partner’s reaction" },
          { text: "…", rating: "neutral",  feedback: "…", reply: "…" },
          { text: "…", rating: "negative", feedback: "…", reply: "…" }
        ]
      }
    ],
    takeaway: "One-sentence lesson."        // <= 30 words
  }
];
```

Options are shuffled when shown. `text` <= 35 words, `feedback` <= 35, `reply`
<= 30. The next turn’s `say` must follow naturally after *any* of the three
replies.

## Video scenarios: `js/content/scenarios.js`

Animated scenes with two characters, spoken lines, captions and branching
choices (“Choose how to continue · autoplays in 10s”).

```js
export default [
  {
    id: "gala-stairs",
    title: "Read before you lead",          // <= 40 chars
    skill: "Reading the room",              // <= 4 words
    summary: "One sentence describing the situation.",   // <= 30 words
    scene: "gala",
    cast: {
      A: { name: "Daniel", avatar: { … } },  // shown on the left
      B: { name: "Maya", avatar: { … } }     // shown on the right
    },
    start: "intro",
    nodes: {
      intro: {
        beats: [                            // 1..8 lines, each <= 35 words
          { who: "N", line: "Narrator voice-over." },
          { who: "A", line: "…", mood: "smile" },
          { who: "B", line: "…", mood: "think" }
        ],
        choices: [                          // 2..3; the first one autoplays
          { label: "Ask a follow-up question", next: "ask" },   // label <= 7 words
          { label: "Read before you lead", next: "read" }
        ]
      },
      ask:  { beats: [ … ], next: "wrap" },  // or continue straight on
      read: { beats: [ … ], end: { outcome: "good", title: "Connection made", takeaway: "…" } },
      wrap: { beats: [ … ], end: { outcome: "mixed", title: "…", takeaway: "…" } }
    },
    quiz: { question: "…?", options: ["…", "…", "…"], answer: 1, explain: "…" }
  }
];
```

Each node has exactly one of `choices`, `next` or `end`. `end.outcome` is
`good`, `mixed` or `poor`; at least one ending must be `good`. Every node must
be reachable, there must be no loops, and the longest path should stay under
about 400 spoken words (~2.5 minutes).

## Speech practice: `js/content/prompts.js`

```js
export default {
  prompts: [   // >= 20 speaking prompts for the Speech Analyzer
    { id: "intro-new-team", category: "intro", seconds: 60,   // intro | story | work | opinion | explain | toast
      text: "Introduce yourself to a team you’re joining today.",   // <= 30 words
      tips: ["Lead with what you’ll help with.", "End with a question."] }   // 1..3 tips, <= 20 words each
  ],
  passages: [  // >= 8 read-aloud texts (clarity is scored against the text)
    { id: "morning-market", kind: "passage", title: "The morning market", text: "40–110 words…" },
    { id: "red-leather", kind: "twister", title: "Red leather", text: "<= 30 words" }
  ],
  sparks: [    // >= 30 conversation starters
    { context: "anywhere", text: "What’s been the best part of your week so far?" }   // work | party | date | anywhere; <= 25 words
  ]
};
```
