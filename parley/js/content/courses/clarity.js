export default {
  id: "clarity",
  title: "Speak Clearly",
  subtitle: "Articulation, pace and a voice people want to hear",
  tags: ["speaking", "work"],
  lessons: [
    {
      id: "clarity-1",
      title: "Find your ideal pace",
      minutes: 6,
      intro: "Speak too fast and people miss things; too slow and they drift. Find your comfortable range, and learn when to slow down on purpose.",
      steps: [
        { text: "Your [[speaking rate]] is how many words you say per minute. Relaxed conversational speech usually falls somewhere around 130 to 160 words per minute. There’s no single perfect number: a lively story can run a little faster, while explaining something complex calls for slower. What matters is that your listeners can comfortably keep up." },
        { text: "Pace shapes how people hear you. Rushing often creeps in when you’re nervous, and it makes you harder to follow, because listeners get no time to absorb one idea before the next one arrives. A steady, unhurried pace tends to come across as calm and sure of yourself, even when you don’t feel that way inside." },
        { text: "Start by measuring your baseline. Read a passage aloud for exactly one minute and count the words, or record yourself in the Speech Analyzer and check your pace score. Then practice shifting gears: read the same passage once quickly, once slowly, and once in between. Feeling the contrast teaches you where your comfortable range is." },
        { text: "Slow down on purpose for your most important lines. Say the key sentence more deliberately, and leave a short [[strategic pause]] around it: “The deadline is moving.” Pause for a beat. “It’s now Friday.” A common mistake is speeding up at the end of a talk because you’re eager to finish, just when your conclusion needs the most room." }
      ],
      glossary: {
        "speaking rate": "How fast you talk, usually measured in words per minute.",
        "strategic pause": "A deliberate silence, usually a second or two, that lets an important point sink in."
      },
      takeaway: "Aim for a comfortable conversational pace, roughly 130 to 160 words per minute, and slow down deliberately for your most important lines.",
      tryIt: "Record a 60-second answer about your week in the Speech Analyzer and aim for a pace score above 70. Then repeat it, slowing down on your key sentence.",
      quiz: [
        { type: "tf", statement: "The faster you speak, the more confident and competent you sound.", answer: false,
          explain: "Rushing usually makes you harder to follow and can sound nervous. A steady, unhurried pace tends to come across as calm and sure." },
        { type: "blank", before: "Relaxed conversational speech usually runs around 130 to 160", after: "per minute.",
          answer: "words", options: ["words", "syllables", "sentences"],
          explain: "Speaking rate is measured in words per minute, and this range is a comfortable zone for everyday conversation, not a strict rule." },
        { type: "match", prompt: "Match each situation to a good pace",
          pairs: [["Telling a lively story", "A little faster, with energy"], ["Explaining something complex", "Slower, with room to absorb"], ["Your key sentence", "Deliberate, with a pause around it"], ["Everyday conversation", "Around 130 to 160 words per minute"]] },
        { type: "mcq", question: "You notice yourself rushing near the end of a presentation. What helps most?",
          options: ["Cut your conclusion so you finish sooner", "Speed up further to stay within your time", "Slow down and pause before your final key point", "Switch to reading your slides word for word"], answer: 2,
          explain: "Endings carry the message you want people to remember. Slowing down and pausing gives your conclusion room to land instead of getting lost in a rush." }
      ],
      flashcards: [
        { front: "What is a typical conversational speaking rate?", back: "Roughly 130 to 160 words per minute. A bit faster for lively stories, slower for complex explanations, and slower still for your key point." },
        { front: "How do you find your baseline pace?", back: "Read a passage aloud for one minute and count the words, or record yourself in the Speech Analyzer and check your pace score." }
      ]
    },
    {
      id: "clarity-2",
      title: "Drop the filler words",
      minutes: 6,
      intro: "Um, uh, like and you know creep in when your mouth gets ahead of your mind. A simple pause can replace almost all of them.",
      steps: [
        { text: "[[Filler words]] are sounds and phrases like um, uh, like, so, and you know that fill silence while your brain finds the next thought. Everyone uses some, and a few in casual conversation are perfectly normal. The problem starts when they pile up, because listeners begin to notice the fillers more than your message." },
        { text: "Fillers tend to appear at the start of sentences and between ideas, right where you’re deciding what to say next. They can make you sound less prepared than you really are, and in a presentation or interview they dilute your strongest points. The good news is that the fix doesn’t require speaking faster or memorizing a script." },
        { text: "Replace the filler with a pause. When you feel an um coming, close your mouth and take a breath instead. A silent pause of a second or two feels long to you, but listeners usually hear it as thoughtful and composed. Try it now: say “So, the main issue is cost,” then say it again, replacing the so with a breath." },
        { text: "Build [[filler awareness]] first, because you can’t cut what you don’t notice. Record a one-minute answer in the Speech Analyzer and look at where it marks fillers and hesitations on the waveform. Pick one filler to target this week. A common mistake is trying to eliminate every filler at once, which can make you stiff; aim for fewer, not zero." }
      ],
      glossary: {
        "filler words": "Sounds or phrases like um, uh, like and you know that fill silence while you think, without adding meaning.",
        "filler awareness": "Noticing your own filler words as you say them, the first step toward replacing them with pauses."
      },
      takeaway: "When you feel a filler coming, close your mouth and pause instead. A short silence sounds composed, and fewer fillers let your message stand out.",
      tryIt: "Record a 60-second answer in the Speech Analyzer and count the fillers it marks. Record again and try to cut that number in half by pausing instead.",
      quiz: [
        { type: "mcq", question: "What’s the best first step to reducing your filler words?",
          options: ["Record yourself and notice where your fillers cluster", "Speak faster so there’s no room for them", "Memorize every answer word for word", "Ban every filler at once, starting today"], answer: 0,
          explain: "You can’t cut what you don’t notice. Recording yourself shows where fillers cluster, so you can target one at a time and replace it with a pause." },
        { type: "tf", statement: "A silent pause of a second or two usually sounds more composed to listeners than it feels to the speaker.", answer: true,
          explain: "Pauses feel long from the inside, but listeners tend to hear them as thoughtful. That’s why a pause is the best replacement for an um." },
        { type: "blank", before: "When you feel a filler coming, close your mouth and", after: "instead.",
          answer: "pause", options: ["pause", "speed up", "say “so”"],
          explain: "A brief pause gives your brain time to find the next word. Speeding up or swapping in another filler just moves the problem." },
        { type: "match", prompt: "Match each filler habit to its fix",
          pairs: [["Um before each sentence", "Take a breath, then begin"], ["Opening answers with “so”", "Start with your first real word"], ["Ending with “you know?”", "Finish on a firm full stop"], ["Not noticing your fillers", "Record yourself and review the marks"]] }
      ],
      flashcards: [
        { front: "What should replace a filler word?", back: "A short silent pause. Close your mouth, take a breath, then say your next real word. It sounds composed rather than hesitant." },
        { front: "Where do fillers usually show up?", back: "At the start of sentences and between ideas, right where you’re deciding what to say next." }
      ]
    },
    {
      id: "clarity-3",
      title: "Crisp articulation warm-ups",
      minutes: 7,
      intro: "Clear speech is a physical skill. A few minutes of warming up your lips, tongue and jaw makes every word easier to understand.",
      steps: [
        { text: "[[Articulation]] is how precisely you shape sounds with your lips, tongue, teeth and jaw. Mumbling usually isn’t a problem with your voice; it comes from these muscles moving too little. When articulation is crisp, listeners don’t have to work to decode your words, so they can focus on what you mean. It matters even more on video calls and in noisy rooms." },
        { text: "Warm up before an important talk, the way an athlete warms up before a game. Gently open and close your jaw a few times. Blow air through loose lips to make a motorboat sound. Stretch your tongue out, then circle it slowly around your teeth. Finish by saying “ma, may, me, my, mo, moo,” exaggerating each mouth shape." },
        { text: "Next, use tongue twisters to train precision. Start slowly and clearly, then speed up only as long as every sound stays sharp. Try “Red leather, yellow leather” five times, or “Unique New York, unique New York.” Read-aloud mode has twisters ready to go and scores your clarity against the text, so you can track your progress." },
        { text: "Finally, land your [[final consonants]]. Sounds like t, d and k at the ends of words are the first to vanish when you rush, so “first thing” slides into “firs thin.” Read a sentence slowly and finish every word: “She asked about the cost and wanted it fixed.” A common mistake is over-correcting into a robotic voice; aim for crisp, not stiff." }
      ],
      glossary: {
        "articulation": "How precisely you shape speech sounds with your lips, tongue, teeth and jaw.",
        "final consonants": "The sounds at the ends of words, like the t in “first” or the d in “asked,” that often get dropped."
      },
      takeaway: "Warm up your lips, tongue and jaw, train precision with tongue twisters, and land your word endings, aiming for crisp rather than stiff.",
      tryIt: "Before your next call, spend two minutes on jaw, lip and tongue warm-ups. Then read three tongue twisters in read-aloud mode and note your clarity score.",
      quiz: [
        { type: "tf", statement: "When practicing tongue twisters, you should go as fast as possible from the very first try.", answer: false,
          explain: "Speed comes after accuracy. Start slowly with every sound sharp, and only speed up while the words stay clear." },
        { type: "mcq", question: "Which sounds are usually the first to disappear when you rush?",
          options: ["The vowels in the middle of words", "The consonants at the ends of words", "The first sound of each sentence", "The stressed syllables in long words"], answer: 1,
          explain: "When you hurry, final consonants like t, d and k get clipped, so words blur together. Landing those endings is a quick way to sound clearer." },
        { type: "match", prompt: "Match each warm-up to what it does",
          pairs: [["Motorboat lip trill", "Loosens your lips"], ["Tongue circles", "Stretches your tongue"], ["Slow jaw opening", "Releases jaw tension"], ["Tongue twisters", "Builds precision at speed"]] },
        { type: "blank", before: "Mumbling usually comes from your lips, tongue and jaw moving too", after: ".",
          answer: "little", options: ["little", "much", "quickly"],
          explain: "Clear sounds need active mouth movement. Warm-ups and slightly bigger mouth shapes fix most mumbling without making you louder." }
      ],
      flashcards: [
        { front: "What is articulation?", back: "How precisely you shape sounds with your lips, tongue, teeth and jaw. Crisp articulation means listeners don’t have to work to decode your words." },
        { front: "How should you practice tongue twisters?", back: "Start slowly with every sound sharp. Speed up only while the words stay clear, and slow down again when they blur." },
        { front: "What’s the risk of over-correcting your articulation?", back: "Sounding robotic or stiff. Aim for crisp and natural, landing your word endings without hammering every syllable." }
      ]
    },
    {
      id: "clarity-4",
      title: "Vocal variety that holds attention",
      minutes: 7,
      intro: "The same words can sound dull or gripping. Changing your pitch, pace, volume and emphasis keeps listeners with you.",
      steps: [
        { text: "[[Vocal variety]] means changing how you say things as you go: your pitch, pace, volume and emphasis. A [[monotone]], where everything comes out at the same level, makes even fascinating content hard to follow, because listeners lose track of what matters. Variety works like formatting for the ear, showing which ideas are headlines and which are details." },
        { text: "Emphasis alone can change meaning. Try saying “I never said you were late” several times, stressing a different word each time. Stress “I” and it suggests someone else said it. Stress “late” and it hints at a different complaint. Before an important sentence, decide which one word carries the point, and lean on it." },
        { text: "Use the other dials too. Let your pitch rise and fall naturally, the way it does when you tell a friend a good story. Get a little louder for energy, and a little softer to draw people in for something important. Move slightly faster through background details, then slow down for the point you want remembered." },
        { text: "Watch out for [[uptalk]], where statements rise in pitch at the end so they sound like questions: “We should launch in May?” In many settings, listeners hear it as uncertainty, which undercuts a firm recommendation. For statements you mean, let your pitch settle down at the end. The Speech Analyzer’s pitch variety and volume variety scores show how much range you’re using." }
      ],
      glossary: {
        "vocal variety": "Changing your pitch, pace, volume and emphasis as you speak so your voice signals what matters.",
        "monotone": "Speaking at one unchanging pitch and energy level, which makes it hard for listeners to stay engaged.",
        "uptalk": "A rising pitch at the end of a statement that makes it sound like a question."
      },
      takeaway: "Use pitch, pace, volume and emphasis to show what matters, and let your pitch settle down at the end of statements you mean.",
      tryIt: "Record a 60-second story in the Speech Analyzer. Record it again, choosing one word per sentence to stress, and compare your pitch variety scores.",
      quiz: [
        { type: "blank", before: "When a statement rises in pitch at the end so it sounds like a question, that’s called", after: ".",
          answer: "uptalk", options: ["uptalk", "monotone", "projection"],
          explain: "Uptalk makes a statement sound unsure. Letting your pitch fall at the end signals you mean what you’re saying." },
        { type: "match", prompt: "Match each vocal dial to a good use",
          pairs: [["Pitch", "Rise and fall like telling a story"], ["Volume", "Softer to draw people in"], ["Pace", "Slower for the main point"], ["Emphasis", "Lean on the one key word"]] },
        { type: "tf", statement: "Stressing a different word in the same sentence can change what the sentence means.", answer: true,
          explain: "Emphasis tells listeners which part matters. Stressing “I” or stressing “late” in the same sentence points to completely different meanings." },
        { type: "mcq", question: "Your recommendations keep sounding unsure in meetings. Which change will most likely help?",
          options: ["Speak in one steady pitch so you sound serious", "Add “I think” before each point to sound polite", "Speed up so no one can interrupt you", "Let your pitch settle downward at the end of each statement"], answer: 3,
          explain: "A falling pitch at the end signals a finished, confident statement. A monotone, extra hedges and rushing all tend to make a recommendation sound less sure." }
      ],
      flashcards: [
        { front: "What are the four dials of vocal variety?", back: "Pitch, pace, volume and emphasis. Changing them signals which ideas are headlines and which are details." },
        { front: "How do you avoid uptalk?", back: "On statements you mean, let your pitch settle down at the end of the sentence instead of rising like a question." }
      ]
    },
    {
      id: "clarity-5",
      title: "Breathe, project and be heard",
      minutes: 6,
      intro: "A strong voice starts below your chest. Learn to breathe low and fill a room without straining or shouting.",
      steps: [
        { text: "Your voice runs on air. When you’re nervous, breathing tends to get shallow and high in the chest, which can make your voice thin, shaky or breathless at the ends of sentences. [[Diaphragmatic breathing]], breathing low so your belly and lower ribs expand, gives you a steadier, fuller supply of air to speak on." },
        { text: "Try this: put one hand on your chest and one on your belly. Breathe in slowly through your nose so the lower hand moves out while the upper hand stays fairly still. Breathe out gently through your mouth. Take five slow breaths before you speak, then take quick, low breaths at natural pauses rather than gulping air mid-sentence." },
        { text: "[[Projection]] means sending your voice far enough to reach the back of the room without shouting. Shouting comes from a tight throat and strains your voice; projection comes from steady breath support and an open mouth. Picture the person farthest away and aim your words at them, not at the floor or your notes." },
        { text: "Practice by counting from one to ten, starting at a conversational level and getting slightly louder with each number while your throat stays relaxed. If you feel scratchiness or strain, ease off. A common mistake is trailing off so your last words vanish. Record yourself in the Speech Analyzer: if the waveform shrinks at the end of each sentence, save more breath to finish strong." }
      ],
      glossary: {
        "diaphragmatic breathing": "Breathing low into your belly and lower ribs rather than high in your chest, giving you steadier breath for speaking.",
        "projection": "Making your voice carry clearly to the back of a room using breath support, not by shouting or straining."
      },
      takeaway: "Breathe low into your belly, aim your voice at the farthest listener, and save enough breath to finish every sentence strong.",
      tryIt: "Take five slow belly breaths, then record a 60-second answer in the Speech Analyzer. Check the waveform to see whether your sentence endings fade, and try again.",
      quiz: [
        { type: "tf", statement: "Projecting your voice should come from steady breath support, not from tightening your throat.", answer: true,
          explain: "A tight throat produces shouting and strain. Breath support and an open mouth let your voice carry without hurting it." },
        { type: "blank", before: "When you breathe low for speaking, your", after: "and lower ribs should expand while your chest stays fairly still.",
          answer: "belly", options: ["belly", "shoulders", "throat"],
          explain: "Low breathing fills the lower lungs, so your belly and lower ribs move out. Rising shoulders are a sign of shallow chest breathing." },
        { type: "mcq", question: "Which best describes projection?",
          options: ["Speaking as loudly as you can at all times", "Raising your pitch so your voice sounds brighter", "Carrying your voice to the back of the room with breath support", "Leaning toward the microphone and speaking quickly"], answer: 2,
          explain: "Projection is about reach, not maximum volume. Steady breath and an open mouth let your voice carry without straining or shouting." },
        { type: "match", prompt: "Match each voice problem to its fix",
          pairs: [["Shaky, breathless voice", "Breathe low before speaking"], ["Strained, shouty voice", "Relax your throat and use breath"], ["Last words fade away", "Save breath to finish strong"], ["Voice not reaching back", "Aim at the farthest listener"]] }
      ],
      flashcards: [
        { front: "How can you check that you’re breathing low?", back: "One hand on your chest, one on your belly. Breathe in through your nose so the belly hand moves out while the chest hand stays fairly still." },
        { front: "What’s the difference between projecting and shouting?", back: "Projecting uses breath support and an open mouth to carry your voice. Shouting comes from a tight throat and strains your voice." }
      ]
    },
    {
      id: "clarity-6",
      title: "Say more with fewer words",
      minutes: 6,
      intro: "Clear speakers get to the point and then stop. Leading with your main idea and cutting hedges makes people listen more closely.",
      steps: [
        { text: "When you speak, listeners can’t scroll back. If your main point arrives after three minutes of background, many of them will have lost the thread. Concise speech respects their attention and makes your ideas easier to remember and act on. Being brief isn’t being cold; it’s doing the sorting work for your listener." },
        { text: "Lead with the point, a habit often called [[bottom line up front]]. Say your conclusion or request first, give one or two reasons, then stop or invite questions. Instead of walking through the whole history, try: “I recommend we delay the launch by a week. Two reasons: testing isn’t finished, and the support team needs training.”" },
        { text: "Next, cut [[hedges]]: phrases like “I just think,” “sort of,” “maybe it might be worth,” and “this is probably a dumb question.” One or two can soften a message politely, but stacked together they bury your point and signal doubt you may not feel. Compare “I sort of think maybe we could try it” with “Let’s try it for one week.”" },
        { text: "Practice the edit out loud. Take a point you need to make, say it in full, then say it again in half the words, then in one sentence. Record each version in the Speech Analyzer and listen back. A common mistake is ending with a long recap of everything you just said; once you’ve made your point, stop and let it land." }
      ],
      glossary: {
        "bottom line up front": "Stating your main conclusion or request first, before the background and details.",
        "hedges": "Softening words like “just,” “sort of” and “maybe” that make a statement sound less certain."
      },
      takeaway: "Lead with your point, back it with one or two reasons, cut stacked hedges, and stop when you’re done.",
      tryIt: "Pick an update you’ll give this week. Say it once in full, then in one sentence that leads with the point. Record both in the Speech Analyzer and compare.",
      quiz: [
        { type: "tf", statement: "To be clear, it’s best to give all the background first so people understand your conclusion when it finally arrives.", answer: false,
          explain: "Listeners can’t scroll back, so a late point often gets lost. Lead with the conclusion, then add the one or two reasons that support it." },
        { type: "match", prompt: "Match each habit to an example",
          pairs: [["Bottom line up front", "“I recommend we delay a week.”"], ["Stacked hedges", "“Maybe we could sort of try it?”"], ["Supporting reasons", "“Testing isn’t done, and support needs training.”"], ["Long recap ending", "Repeating every point after making it"]] },
        { type: "mcq", question: "Which opening best follows the bottom line up front approach?",
          options: ["“We should hire a second designer, mainly because the backlog has doubled.”", "“So, back in March, we started noticing some things about the backlog.”", "“This might be a silly idea, but I was sort of wondering about hiring.”", "“There are a lot of factors to consider before I get to my point.”"], answer: 0,
          explain: "It states the recommendation first, then gives a reason. The others delay the point with history, hedges or a preamble, so listeners wait to learn what you want." },
        { type: "blank", before: "Words like “just,” “sort of” and “maybe” that soften a statement are called", after: ".",
          answer: "hedges", options: ["hedges", "fillers", "transitions"],
          explain: "Hedges soften a claim, while fillers like um just fill silence. A few hedges are polite; stacking them buries your point." }
      ],
      flashcards: [
        { front: "What does bottom line up front mean?", back: "Say your conclusion or request first, give one or two reasons, then stop or invite questions." },
        { front: "What are hedges, and why cut them?", back: "Softeners like just, sort of and maybe. One or two are polite, but stacked together they bury your point and signal doubt." }
      ]
    }
  ]
};
