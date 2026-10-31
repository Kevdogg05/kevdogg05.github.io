export default {
  id: "presence",
  title: "Command the Room",
  subtitle: "Calm, credible confidence and presence at work",
  tags: ["work", "confidence", "speaking"],
  lessons: [
    {
      id: "presence-1",
      title: "First impressions that stick",
      minutes: 6,
      intro: "People size you up quickly. Learn to lead with warmth, follow with competence, and make your first minute with someone work for you.",
      steps: [
        { text: "People form a first read of you within moments of meeting, and that read tends to color how they hear everything you say next. Two questions sit underneath it: are you on my side, and can you get things done? We call these [[warmth]] and [[competence]]. You need both, but the order matters." },
        { text: "Lead with warmth. People tend to judge warmth first, and it shapes how they receive your skill. Expertise without warmth can come across as cold or even threatening, while expertise with warmth feels like something that will help them. In practice, warmth is simple: look up from your phone, let a real smile reach your eyes, and use the person’s name once you hear it." },
        { text: "Then show competence with a short, clear introduction. Instead of a bare job title, say what you do in terms that matter to the other person. For example: “Hi, I’m Dana. I run the onboarding program, so I’m your person if anything in your first month feels confusing. It’s great to meet you.” That line gives your name, your role, and a reason to come back to you." },
        { text: "Two common mistakes pull in opposite directions. One is trying to impress: listing achievements or jumping straight into strong opinions, which makes people work harder to like you. The other is shrinking: mumbling your name and looking away. Aim for friendly and clear. And if a first meeting goes badly, relax. Consistent behavior over the next few conversations can reshape how people see you." }
      ],
      glossary: {
        "warmth": "The sense that you are friendly, trustworthy and on the other person’s side.",
        "competence": "The sense that you are capable and can actually get things done."
      },
      takeaway: "Lead with warmth, follow with a clear line about what you do, and let steady, consistent behavior do the rest.",
      tryIt: "Write a one-line introduction: your name, what you do, and why it matters to the listener. Say it out loud three times, then use it the next time you meet someone new.",
      quiz: [
        { type: "tf", statement: "People usually judge your warmth before your competence when forming a first impression.", answer: true,
          explain: "Warmth tends to be read first, and it shapes how people interpret your skills afterward. Friendly first, capable second." },
        { type: "blank", before: "Expertise without", after: "can come across as cold or even threatening.",
          answer: "warmth", options: ["evidence", "warmth", "practice"],
          explain: "Skill can feel like a threat when people aren’t sure you’re on their side. Warmth turns your expertise into something that feels helpful." },
        { type: "match", prompt: "Match each behavior to the impression it creates",
          pairs: [["Using their name warmly", "Signals you’re on their side"], ["A clear one-line introduction", "Signals you can get things done"], ["Leading with your achievements", "Can come across as cold"], ["Mumbling and looking away", "Reads as shrinking back"]] },
        { type: "mcq", question: "You’re meeting a new client for the first time. Which opening best balances warmth and competence?",
          options: ["“I’ve led twelve projects just like yours, so you’re in very good hands.”", "“Hi, I’m Sam. I’ll be your main contact, so call me first if anything feels stuck. Great to meet you.”", "“Oh, hi, I’m just Sam. I sort of help out with accounts, I guess.”"], answer: 1,
          explain: "It’s friendly, states a clear role, and links that role to the client’s needs, without boasting or downplaying what you do." }
      ],
      flashcards: [
        { front: "What two questions sit under every first impression?", back: "Are you on my side, which is warmth, and can you get things done, which is competence." },
        { front: "What goes into a strong one-line introduction?", back: "Your name, what you do, and why it matters to the person you’re meeting." },
        { front: "What if a first impression goes badly?", back: "Impressions can shift. Friendly, capable, consistent behavior over the next few conversations can reshape how people see you." }
      ]
    },
    {
      id: "presence-2",
      title: "Sound credible from the first sentence",
      minutes: 6,
      intro: "Credibility isn’t a booming voice or big words. Learn how your first sentence can show that you know your stuff and can be trusted.",
      steps: [
        { text: "When you start talking, listeners are quietly weighing two things: does this person know what they’re talking about, and will they be straight with me? Your first sentence is the first evidence they get. Credibility rarely comes from big words or a booming voice. It comes from being concrete, taking a clear position, and being honest about your limits." },
        { text: "Start concrete. Vague claims make people wonder; specific ones show you’ve done the homework. Instead of “I feel like customers really want this,” try “Customers asked for this eleven times last month.” If your experience is relevant, add a short [[credibility line]]: “I’ve handled the support inbox for two years, and this is the top complaint.” One line is enough. Then get to the point." },
        { text: "Next, take a position in your own voice. “Maybe someone could possibly look into onboarding at some point” leaves listeners unsure what you think. “My view is that we fix onboarding before we add features” gives them something to agree with, question or build on. Owning your view with phrases like “I recommend” or “my view is” signals that you’ve thought it through." },
        { text: "Credible doesn’t mean certain about everything. Say clearly what you know and what you don’t: “I’m confident about the cost. The timeline is my best guess, and I’ll confirm it by Friday.” This [[calibrated confidence]] helps people trust your firm statements, because they know you’ll flag the shaky ones. “I don’t know yet, but I’ll find out” is a credible sentence too." },
        { text: "A common trap is trying to sound impressive. Stacks of jargon or sweeping claims like “this will change everything” often make listeners more skeptical, not less, and overclaims collapse the first time you’re wrong. When you catch yourself reaching for a buzzword, ask what you actually mean, and say that instead." }
      ],
      glossary: {
        "credibility line": "One short sentence about relevant experience that shows why your view is worth hearing, said without boasting.",
        "calibrated confidence": "Sounding exactly as sure as you really are: firm where you know, and open about what you don’t."
      },
      takeaway: "Open with something specific, take a clear position in your own voice, and be honest about what you don’t know yet.",
      tryIt: "Before your next meeting, write the first sentence you’ll say on your main topic. Make it specific and make it take a position, then say it aloud twice.",
      quiz: [
        { type: "mcq", question: "Your manager asks whether a new vendor is a good idea. Which first sentence sounds most credible?",
          options: ["“I mean, it’s hard to say, there are a lot of factors.”", "“Honestly, this vendor is the best in the entire industry, no question.”", "“I recommend them. Their pilot fixed our two biggest delays, though pricing is still unclear.”"], answer: 2,
          explain: "It takes a clear position, backs it with a specific result, and honestly flags the one open question. The others are either vague or overconfident." },
        { type: "tf", statement: "Using plenty of jargon is a reliable way to sound more credible.", answer: false,
          explain: "Jargon used to impress often makes listeners more skeptical. Plain, specific words show you understand the topic well enough to explain it simply." },
        { type: "match", prompt: "Match each credibility move to an example",
          pairs: [["Credibility line", "“I’ve run support for two years”"], ["Specific evidence", "“Eleven requests last month”"], ["Clear position", "“My view is we fix onboarding first”"], ["Calibrated confidence", "“The timeline is my best guess”"]] },
        { type: "blank", before: "“Customers asked for this eleven times last month” sounds more credible than “people want this” because it is", after: "and checkable.",
          answer: "specific", options: ["longer", "specific", "polite"],
          explain: "Specific, checkable details show you’ve done the homework, while vague claims leave listeners wondering whether you have." }
      ],
      flashcards: [
        { front: "What is a credibility line?", back: "One short sentence about relevant experience, like “I’ve handled the support inbox for two years,” said once, without boasting, before your point." },
        { front: "What is calibrated confidence?", back: "Sounding exactly as sure as you are: firm where you know, honest where you don’t, with a plan to find out." },
        { front: "How do you take a clear position?", back: "Use your own voice: “I recommend” or “My view is.” It gives people something clear to agree with, question or build on." }
      ]
    },
    {
      id: "presence-3",
      title: "When your mind goes blank",
      minutes: 7,
      intro: "Blanking mid-sentence feels like a disaster, but it’s common and recoverable. Here’s a calm, simple routine to find your way back.",
      steps: [
        { text: "Almost everyone blanks at some point. Stress narrows your attention and makes it harder to pull words and ideas from memory, so a racing heart and an empty mind often arrive together. This is a normal stress response, not proof that you’re bad at speaking. The goal isn’t to never blank. It’s to recover smoothly." },
        { text: "First, know that the moment looks much smaller from the outside. Because of the [[illusion of transparency]], people tend to overestimate how visible their nerves are to others. A three-second silence that feels endless to you often just looks like thinking. So don’t rush to fill it or apologize. Stand still, breathe out slowly, and give yourself the pause." },
        { text: "Next, use a [[recovery phrase]] to buy a few seconds while you reconnect. Repeat your last point: “So, the key thing is that the budget is tight.” Or be honest about it: “Let me gather my thoughts for a second.” Or turn to your listeners: “Before I go on, any questions so far?” Each one sounds deliberate, not lost." },
        { text: "Then lean on a simple fallback structure. If you lose your place entirely, rebuild with point, reason, example: state what you believe, say why, and give one example. You can also prepare keyword notes, three or four words per section rather than full sentences, so a single glance gets you moving again." },
        { text: "A common trap is memorizing every word. A script has only one path, so losing a single line can derail everything. Know your points, not your sentences. To practice, open the Speech Analyzer, start a sixty-second answer, and deliberately stop halfway. Breathe, use a recovery phrase, and finish. Recovery is a skill you can rehearse." }
      ],
      glossary: {
        "illusion of transparency": "The tendency to overestimate how clearly other people can see your inner feelings, such as nervousness.",
        "recovery phrase": "A short, prepared line that buys you a few seconds and sounds deliberate while you find your next thought."
      },
      takeaway: "When you blank, pause and breathe, use a calm recovery phrase, then rebuild with point, reason, example.",
      tryIt: "Write down two recovery phrases that sound like you. Then record a sixty-second answer in the Speech Analyzer, stop on purpose halfway, and use one to recover.",
      quiz: [
        { type: "tf", statement: "A pause that feels endless to you often looks like ordinary thinking to your audience.", answer: true,
          explain: "People overestimate how visible their nerves are. From the outside, a short silence usually reads as a speaker collecting their thoughts." },
        { type: "blank", before: "Prepare", after: "notes, three or four words per section, instead of full sentences.",
          answer: "keyword", options: ["keyword", "detailed", "word-for-word"],
          explain: "A few keywords let one glance restart your thinking, while full sentences tempt you to read or recite, which makes losing your place more likely." },
        { type: "match", prompt: "Match each recovery move to its purpose",
          pairs: [["Breathe out slowly", "Settles your body first"], ["Repeat your last point", "Reconnects you to your thread"], ["Ask for questions", "Hands the floor over briefly"], ["Point, reason, example", "Rebuilds your answer from scratch"]] },
        { type: "mcq", question: "Mid-presentation, your mind goes completely blank. What’s the best first move?",
          options: ["Pause, breathe out slowly, and repeat your last point.", "Apologize and explain that you’re very nervous today.", "Speed up and say whatever comes to mind to fill the silence."], answer: 0,
          explain: "A calm pause looks like thinking, and repeating your last point often reconnects you to what comes next. Apologizing or rushing draws attention to the blank." }
      ],
      flashcards: [
        { front: "What is the illusion of transparency?", back: "Our tendency to overestimate how visible our nerves are. Your blank moment usually looks like a thoughtful pause from the outside." },
        { front: "Name three recovery phrases.", back: "Repeat your last point, say “Let me gather my thoughts for a second,” or ask “Any questions so far?”" },
        { front: "Why avoid memorizing a talk word for word?", back: "A script has one path, so losing one line can derail everything. Know your points, not your sentences." }
      ]
    },
    {
      id: "presence-4",
      title: "Speak up in any meeting",
      minutes: 6,
      intro: "Have ideas but struggle to get a word in? Learn small, low-risk ways to contribute early and make your point land.",
      steps: [
        { text: "In many meetings, the people who speak are assumed to be the people who are engaged, even when quieter colleagues have better ideas. That’s not fair, but it’s common. The good news is that speaking up is less about having a brilliant point and more about having a plan for when and how you’ll get in." },
        { text: "Speak early. The longer you wait, the bigger the moment feels, and the harder it gets. Aim to say something in the first few minutes, even something small. That [[early contribution]] breaks the ice for you and makes it easier to speak again later. Before the meeting, glance at the agenda and prepare one question or point in advance." },
        { text: "You don’t need a big idea to contribute. Ask a clarifying question: “When you say soon, do you mean this quarter?” [[Build on]] someone’s point: “Building on what Priya said, we could test that with one team first.” Or summarize: “So it sounds like we agree on the goal but not the timeline.” Each of these adds real value." },
        { text: "When you’re ready to jump in, make a [[clean entry]]. Lean forward or lift a hand slightly, then link to what was just said: “Sam, on that budget question, I have one idea.” Make your point in a sentence or two and stop. Short contributions are easier to follow and harder to talk over. On video calls, use the raise hand button or the chat." },
        { text: "A common mistake is waiting for the perfect point. By the time it’s polished, the discussion has moved on, and the moment feels even bigger. A useful point said now beats a brilliant one never said. If nerves hit, write your first sentence down, then say it the moment there’s a gap." }
      ],
      glossary: {
        "early contribution": "A small comment or question you make in the first few minutes of a meeting, so speaking later feels easier.",
        "build on": "To add to someone else’s idea, credit them, and move it forward, instead of starting a new topic.",
        "clean entry": "A deliberate way to join a discussion: a small physical cue, a link to what was just said, then a short point."
      },
      takeaway: "Speak early, contribute with a question, a build or a summary, and make a clean entry with a short, clear point.",
      tryIt: "In your next meeting, speak within the first ten minutes. Use one prepared move: a clarifying question, a build on someone’s point, or a quick summary.",
      quiz: [
        { type: "tf", statement: "To speak up well in meetings, you should wait until your idea is fully polished.", answer: false,
          explain: "Discussions move fast. A useful point said in time beats a perfect one that arrives too late, or never arrives at all." },
        { type: "blank", before: "Saying “Building on what Priya said” is a way to", after: "someone’s point.",
          answer: "build on", options: ["interrupt", "repeat", "build on"],
          explain: "Building on a point credits the other person and moves the idea forward, which makes it an easy, low-risk way to contribute." },
        { type: "match", prompt: "Match each move to an example line",
          pairs: [["Clarifying question", "“Do you mean this quarter?”"], ["Building on a point", "“Adding to Priya’s point, let’s pilot it”"], ["Summarizing", "“So we agree on the goal”"], ["Clean entry", "“Sam, on that budget question”"]] },
        { type: "mcq", question: "You’re usually quiet in meetings and want to start contributing. Which plan is most likely to work?",
          options: ["Wait until you have a truly original idea, then share it.", "Stay quiet for a month and study how others speak.", "Share every thought you have so people notice you.", "Prepare one question from the agenda and ask it in the first ten minutes."], answer: 3,
          explain: "Speaking early with something prepared breaks the ice before nerves build, and it makes contributing again later much easier." }
      ],
      flashcards: [
        { front: "Why speak early in a meeting?", back: "The longer you wait, the bigger the moment feels. A small early contribution breaks the ice and makes speaking again easier." },
        { front: "Three ways to contribute without a big idea", back: "Ask a clarifying question, build on someone’s point, or summarize where the group has landed." },
        { front: "How do you make a clean entry?", back: "Give a small cue like leaning forward, link to what was just said, make your point in a sentence or two, then stop." }
      ]
    },
    {
      id: "presence-5",
      title: "Body language that backs your words",
      minutes: 7,
      intro: "Your body can support your message or quietly argue with it. Learn a few honest, practical habits that help people trust what you say.",
      steps: [
        { text: "Body language matters, but it’s often oversold, and no single gesture has a fixed meaning. What people do notice is [[congruence]]: whether your face, voice and posture match your words. Saying “I’m excited about this” while staring at the floor creates a mismatch, and listeners start to doubt the words." },
        { text: "Start with your base. Stand or sit with your weight even and your feet planted, shoulders relaxed rather than pulled back. Claims that a pose can rewire your hormones haven’t held up, but an [[open posture]] does let you breathe freely and helps people read you as engaged. Keep your hands visible, out of your pockets and away from your face." },
        { text: "Next, use your eyes and hands on purpose. In a group, hold eye contact with one person for a full thought, then move to someone else, rather than scanning or staring. Let your hands move naturally between waist and chest height. Gestures that show size, sequence or contrast, like counting “first, second” on your fingers, can make ideas easier to follow." },
        { text: "Then trade fidgeting for stillness. Clicking pens, swaying, or touching your hair pulls attention away from your message. You don’t need to freeze. Just let movement have a purpose, and return to a relaxed [[resting position]] in between, hands loosely together or at your sides. Stillness between gestures tends to read as calm, even when you don’t feel it." },
        { text: "A common mistake is copying rehearsed gestures that don’t fit you. Mechanical moves break congruence just as much as nervous ones. Another is reading too much into other people’s single signals. A colleague with crossed arms may be cold, tired or simply comfortable. Look for clusters of signals and changes over time, and when in doubt, ask." }
      ],
      glossary: {
        "congruence": "When your words, face, voice and posture all tell the same story, so listeners have no reason to doubt you.",
        "open posture": "A relaxed, upright stance with your weight balanced, shoulders loose and hands visible, rather than hunched or closed off.",
        "resting position": "A neutral, relaxed place your hands return to between gestures, such as loosely together at your waist or at your sides."
      },
      takeaway: "Make your body match your message: a steady base, purposeful eye contact and gestures, and calm stillness in between.",
      tryIt: "Record a one-minute video of yourself explaining something you care about. Watch it with the sound off, then pick one habit to keep and one distraction to drop.",
      quiz: [
        { type: "tf", statement: "Holding a strong pose for two minutes reliably changes your hormone levels.", answer: false,
          explain: "Those hormone claims haven’t held up. An open posture can help you breathe and look engaged, but it isn’t a chemical switch." },
        { type: "blank", before: "Listeners start to doubt your words when your body", after: "them.",
          answer: "contradicts", options: ["supports", "mirrors", "contradicts"],
          explain: "When body and words send different messages, the mismatch stands out. Congruence, where everything tells the same story, helps people trust what you say." },
        { type: "match", prompt: "Match each habit to its effect",
          pairs: [["Eye contact for a thought", "Each listener feels spoken to"], ["Gestures showing sequence", "Ideas become easier to follow"], ["Clicking a pen", "Pulls attention from your message"], ["Hands at rest between gestures", "Reads as calm and settled"]] },
        { type: "mcq", question: "A colleague crosses their arms while you present. What’s the most sensible interpretation?",
          options: ["They definitely disagree, so you should change course right away.", "It could mean many things, so look for other signals or ask.", "They are bored, so you should wrap up early."], answer: 1,
          explain: "Single gestures don’t have fixed meanings. Crossed arms might mean cold, comfortable or skeptical, so look for clusters of signals and check in if it matters." }
      ],
      flashcards: [
        { front: "What is congruence?", back: "When your words, face, voice and posture all match. A mismatch makes listeners doubt what you’re saying." },
        { front: "How long should you hold eye contact in a group?", back: "About one full thought with one person, then move to someone else, rather than scanning the room or staring." },
        { front: "Do power poses change your hormones?", back: "Those claims haven’t held up. An open posture still helps you breathe and look engaged, which is reason enough to use it." }
      ]
    },
    {
      id: "presence-6",
      title: "The power of the pause",
      minutes: 6,
      intro: "Silence can feel risky, yet a well-placed pause makes you sound composed and helps your point land. Here’s how to use it on purpose.",
      steps: [
        { text: "Nervous speakers often rush to fill every gap, because silence feels like a spotlight. But a deliberate pause is one of the clearest signals of composure. It shows you aren’t afraid of the room, gives listeners time to absorb what you just said, and lets you breathe and choose your next words." },
        { text: "Use a [[strategic pause]] in three places. Before a key point, to build attention: “Here’s what matters most.” Then pause. After a key point, to let it sink in. And after you ask a question, to give people real time to answer. It’s tempting to cut that last silence short, so count slowly to five in your head before you say anything else." },
        { text: "Pausing also helps with hard questions. Instead of answering instantly, take a breath and let a moment pass. A short [[thinking pause]] tells people you’re taking the question seriously, and it stops you from blurting a defensive answer. If the silence feels awkward, name it: “That’s a fair question. Let me think for a moment.”" },
        { text: "Remember that pauses usually feel longer to you than to your listeners. A two-second silence that feels huge from the front of the room usually sounds natural from a chair. The mistake to avoid is pausing at random, in the middle of phrases, which sounds hesitant. Place pauses at the ends of ideas, where a period or paragraph break would go." },
        { text: "To practice, open the Speech Analyzer and talk for sixty seconds about a decision you made recently. Pause on purpose before your most important sentence, and again right after it. Then look at how it scored your pauses, and ask yourself whether that key line would stand out to a listener." }
      ],
      glossary: {
        "strategic pause": "A deliberate silence placed before or after an important point, or after a question, to focus attention.",
        "thinking pause": "A brief, visible moment of reflection before you answer, showing you’re taking the question seriously."
      },
      takeaway: "Pause before and after key points and after questions, place pauses at the ends of ideas, and trust that they sound shorter than they feel.",
      tryIt: "In your next meeting or conversation, ask one real question, then stay quiet while you count slowly to five. Notice what people share when you give them room.",
      quiz: [
        { type: "tf", statement: "A pause usually feels longer to the speaker than it sounds to the audience.", answer: true,
          explain: "From the front of the room, a couple of seconds can feel huge. Listeners usually hear the same silence as natural, even confident." },
        { type: "blank", before: "Place your pauses at the", after: "of ideas, not in the middle of phrases.",
          answer: "ends", options: ["beginnings", "ends", "peaks"],
          explain: "Pauses at natural breaks, where a period would go, sound deliberate. Pauses in the middle of a phrase tend to sound hesitant." },
        { type: "match", prompt: "Match each pause to what it does",
          pairs: [["Before a key point", "Builds attention"], ["After a key point", "Lets the idea sink in"], ["After asking a question", "Gives people time to answer"], ["Before a hard answer", "Shows you take it seriously"]] },
        { type: "mcq", question: "You’ve just asked your team, “What concerns do you have about this plan?” What should you do next?",
          options: ["Stay quiet and count slowly to five before saying anything.", "Immediately suggest a few possible concerns to get things going.", "Move on quickly if nobody speaks within a second."], answer: 0,
          explain: "People need time to think before they answer. A patient silence signals you really want input, and it often draws out more honest replies." }
      ],
      flashcards: [
        { front: "Where do strategic pauses go?", back: "Before a key point, after a key point, and after you ask a question." },
        { front: "Why pause before answering a hard question?", back: "It shows you’re taking the question seriously, and it stops you from blurting a defensive answer." },
        { front: "Why do pauses feel so risky?", back: "They feel much longer to you than to listeners. A couple of seconds that feels huge usually sounds natural to the audience." }
      ]
    }
  ]
};
