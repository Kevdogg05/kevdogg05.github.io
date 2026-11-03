// Speech Analyzer material. Format: see ../../CONTENT.md ("Speech practice").
export default {
  prompts: [
    // intro
    {
      id: "intro-first-day",
      category: "intro",
      seconds: 60,
      text: "It’s your first day on a new team. Introduce yourself so people remember you and know how to work with you.",
      tips: ["Say what you’ll be working on before your history.", "Add one personal detail people can ask about.", "Close by inviting them to reach out."]
    },
    {
      id: "intro-evening-class",
      category: "intro",
      seconds: 30,
      text: "You’re at the first meeting of an evening class. Introduce yourself and say why you signed up.",
      tips: ["Keep it to three or four sentences.", "Your reason for joining is the most interesting part."]
    },
    {
      id: "intro-neighbor-wave",
      category: "intro",
      seconds: 30,
      text: "Introduce yourself to a neighbor you’ve waved at for months but never actually met.",
      tips: ["Laugh about the months of waving.", "Offer your name, then ask an easy question."]
    },
    {
      id: "intro-panel-guest",
      category: "intro",
      seconds: 90,
      text: "You’re a guest on a panel. Give a short introduction that explains who you are and the perspective you bring.",
      tips: ["Name the one idea you want the audience to remember.", "Pick two highlights instead of your full history.", "Pause after your name so it lands."]
    },

    // story
    {
      id: "story-small-kindness",
      category: "story",
      seconds: 60,
      text: "Tell the story of a small kindness from a stranger that you still remember.",
      tips: ["Set the scene in one sentence.", "Slow down for the moment that mattered.", "End with why it stuck with you."]
    },
    {
      id: "story-plans-fell-apart",
      category: "story",
      seconds: 90,
      text: "Describe a time your plans fell apart and something better happened instead.",
      tips: ["Build a little tension before the turn.", "Use specific details, like sounds, places, and names.", "Finish with what you learned."]
    },
    {
      id: "story-first-job",
      category: "story",
      seconds: 60,
      text: "Tell a story about your first job and one lesson it taught you.",
      tips: ["Introduce one memorable person from that job.", "Show the lesson through what happened, then name it."]
    },
    {
      id: "story-harmless-mistake",
      category: "story",
      seconds: 30,
      text: "Share a quick story about a harmless mistake that still makes you laugh.",
      tips: ["Get to the funny part quickly.", "Laugh at yourself, not at anyone else."]
    },

    // work
    {
      id: "work-project-update",
      category: "work",
      seconds: 60,
      text: "Give your team a quick project update: what’s done, what’s next, and where you need help.",
      tips: ["Start with the headline, then the details.", "Ask for help clearly and specifically."]
    },
    {
      id: "work-pitch-improvement",
      category: "work",
      seconds: 90,
      text: "Pitch an idea to improve something at work, even something small, to a manager who has five minutes.",
      tips: ["State the problem before the solution.", "Name one concrete first step.", "Say what it will cost in time or money."]
    },
    {
      id: "work-decline-politely",
      category: "work",
      seconds: 30,
      text: "Politely decline an extra project because your plate is full, while staying helpful.",
      tips: ["Say no to the task, not the person.", "Offer an alternative or a later time."]
    },
    {
      id: "work-thank-teammate",
      category: "work",
      seconds: 30,
      text: "Thank a teammate in front of the group for their help on a recent project.",
      tips: ["Name exactly what they did.", "Say what difference it made."]
    },

    // opinion
    {
      id: "opinion-best-season",
      category: "opinion",
      seconds: 60,
      text: "Which season is the best, and why? Make your case to someone who disagrees.",
      tips: ["State your position in the first sentence.", "Give two reasons with vivid examples.", "Grant one point to the other side."]
    },
    {
      id: "opinion-where-teams-work",
      category: "opinion",
      seconds: 90,
      text: "Do teams work better in person, remotely, or with a mix of both? Explain your view.",
      tips: ["Share one experience that shaped your opinion.", "Address the strongest argument against you.", "End with a clear recommendation."]
    },
    {
      id: "opinion-overrated",
      category: "opinion",
      seconds: 30,
      text: "Name something popular that you think is overrated, and explain why in a good-natured way.",
      tips: ["Keep it playful, not harsh.", "Offer what you’d choose instead."]
    },
    {
      id: "opinion-life-skill",
      category: "opinion",
      seconds: 60,
      text: "What is one life skill every school should teach? Persuade your listener.",
      tips: ["Open with a quick example of why it matters.", "End with a clear call to action."]
    },

    // explain
    {
      id: "explain-favorite-dish",
      category: "explain",
      seconds: 60,
      text: "Explain how to make a simple dish you love, so a complete beginner could follow along.",
      tips: ["Give the steps in order.", "Mention one common mistake to avoid."]
    },
    {
      id: "explain-job-to-kid",
      category: "explain",
      seconds: 90,
      text: "Explain what you do for work, or what you study, to a curious ten-year-old.",
      tips: ["Use an everyday comparison.", "Skip jargon, or explain it right away.", "Check in with a question like “Does that make sense?”"]
    },
    {
      id: "explain-everyday-object",
      category: "explain",
      seconds: 60,
      text: "Pick an everyday object, like a bicycle or a refrigerator, and explain how it works in plain language.",
      tips: ["Start with what it does, then how.", "Use one simple comparison."]
    },
    {
      id: "explain-directions",
      category: "explain",
      seconds: 30,
      text: "Give clear directions from your front door to your favorite local spot.",
      tips: ["Use landmarks, not just street names.", "Say roughly how long the trip takes."]
    },

    // toast
    {
      id: "toast-best-friend-wedding",
      category: "toast",
      seconds: 90,
      text: "Give a toast at your best friend’s wedding.",
      tips: ["Share one short story that shows who they are.", "Leave out inside jokes, or explain them.", "Finish by raising a glass to the couple."]
    },
    {
      id: "toast-retirement",
      category: "toast",
      seconds: 60,
      text: "Give a toast at a coworker’s retirement party, celebrating their career and what comes next.",
      tips: ["Mention a specific way they made work better.", "Wish them something personal for the next chapter."]
    },
    {
      id: "toast-team-finish",
      category: "toast",
      seconds: 30,
      text: "Raise a quick toast to your team after finishing a tough project together.",
      tips: ["Name the challenge you overcame together.", "Keep it short and upbeat."]
    },
    {
      id: "toast-holiday-table",
      category: "toast",
      seconds: 60,
      text: "Give a toast at a holiday dinner to thank the people around the table.",
      tips: ["Mention something specific about this year.", "Include everyone, not just the hosts."]
    }
  ],

  passages: [
    {
      id: "harbor-at-dawn",
      kind: "passage",
      title: "Harbor at dawn",
      text: "Before the sun clears the hills, the harbor is already busy. Fishing boats bump gently against the dock, and gulls squabble over scraps. A woman in a yellow jacket coils rope into neat circles while her radio plays an old song. The air smells of salt, diesel, and fresh bread from the bakery up the street. By the time the first ferry sounds its horn, the boats are gone, and the water is bright and still."
    },
    {
      id: "rainy-library",
      kind: "passage",
      title: "A rainy afternoon at the library",
      text: "Rain taps steadily on the tall windows of the old library. Inside, it’s warm and quiet, except for the soft shuffle of pages and the squeak of a cart wheel. A boy at the corner table builds a careful tower of picture books. Near the front desk, a librarian with silver glasses whispers suggestions to a student who looks completely lost. Somewhere, a clock ticks. It’s the kind of afternoon that makes you want to stay until closing."
    },
    {
      id: "first-bike-ride",
      kind: "passage",
      title: "The first bike ride",
      text: "My father jogged beside me, one hand on the back of the seat, telling me to keep pedaling and look ahead. The sidewalk felt impossibly narrow. I wobbled past the mailbox, the maple tree, and the neighbor’s barking terrier. Then I heard his voice getting farther away and realized he had let go a while ago. I didn’t fall until the end of the block, and even then, I was grinning."
    },
    {
      id: "small-garden",
      kind: "passage",
      title: "Planning a small garden",
      text: "A small garden starts with a simple question: how much sun does the spot really get? Watch it for a full day. Tomatoes and peppers want six hours or more, while lettuce and spinach are happy with a little shade. Next, squeeze a handful of soil. If it crumbles, you’re in luck. If it sticks like clay, mix in compost. Then plant less than you think you need. A few healthy plants beat a crowded, struggling bed."
    },
    {
      id: "night-train",
      kind: "passage",
      title: "The night train",
      text: "The night train leaves the city at eleven, sliding past apartment windows glowing gold and blue. In the dining car, a conductor pours tea that rattles gently in thick white cups. Passengers trade quiet stories with strangers they will probably never meet again. Outside, the lights thin out, then vanish, and dark fields roll by under a sky full of stars. By morning, the mountains appear, sharp and enormous, as if they had been waiting all night."
    },
    {
      id: "workshop-welcome",
      kind: "passage",
      title: "Welcome to the workshop",
      text: "Good morning, everyone, and welcome. Over the next two hours, we’ll practice the skills that make conversations easier: listening closely, asking better questions, and speaking with calm confidence. There are no tests and no wrong answers today. You’ll work in pairs, try a few short exercises, and get friendly feedback. If you feel a little nervous, that’s perfectly normal. Everyone here is learning together. So grab a coffee, find a partner, and let’s begin."
    },
    {
      id: "silver-slippers",
      kind: "twister",
      title: "Silver slippers",
      text: "Six slim sisters slipped on silver slippers, then slid swiftly down the slick stone stairs."
    },
    {
      id: "great-green-grapes",
      kind: "twister",
      title: "Great green grapes",
      text: "Greta grabbed great green grapes from Grandpa’s grocery, grinning while the grumpy grocer grumbled."
    },
    {
      id: "three-thin-thinkers",
      kind: "twister",
      title: "Three thin thinkers",
      text: "Three thin thinkers thought thoroughly through thirty thousand thorny thoughts on Thursday."
    },
    {
      id: "wobbly-wagon-wheels",
      kind: "twister",
      title: "Wobbly wagon wheels",
      text: "Wally’s wobbly wagon wheels wheeze while Wanda’s wagon whistles. Which wagon wheels wobble worse, Wally’s or Wanda’s?"
    }
  ],

  sparks: [
    // work
    { context: "work", text: "What’s a project you’ve worked on that you’re quietly proud of?" },
    { context: "work", text: "What did you think you’d be doing when you first started your career?" },
    { context: "work", text: "What’s something about your job that most people would be surprised by?" },
    { context: "work", text: "Who’s someone here you’ve learned a lot from?" },
    { context: "work", text: "What’s keeping you busy this week, besides meetings?" },
    { context: "work", text: "What’s the best advice you got when you were starting out?" },
    { context: "work", text: "What’s a tool or habit that makes your workday easier?" },
    { context: "work", text: "What first got you interested in this field?" },
    { context: "work", text: "What’s something you’re looking forward to at work in the next few months?" },
    { context: "work", text: "If you could add one free hour to every workday, how would you spend it?" },

    // party
    { context: "party", text: "How do you know the host?" },
    { context: "party", text: "Have you been to one of these before, or is this your first time?" },
    { context: "party", text: "What’s been the highlight of your weekend so far?" },
    { context: "party", text: "This playlist is great. Do you know who picked the music?" },
    { context: "party", text: "Are you a host, a helper, or a stay-near-the-snacks kind of guest?" },
    { context: "party", text: "What’s the best concert or show you’ve ever been to?" },
    { context: "party", text: "What’s something you’ve gotten into recently?" },
    { context: "party", text: "Do you have any trips or plans coming up that you’re excited about?" },
    { context: "party", text: "Have you tried any of the food yet? What should I go for first?" },
    { context: "party", text: "What’s the best party game you’ve ever played?" },

    // date
    { context: "date", text: "What’s something you could talk about for an hour without getting bored?" },
    { context: "date", text: "What does a perfect lazy Sunday look like for you?" },
    { context: "date", text: "What’s a place you’ve visited that you still think about?" },
    { context: "date", text: "What’s something you’re learning or trying to get better at right now?" },
    { context: "date", text: "What’s a small thing that always makes your day better?" },
    { context: "date", text: "What were you completely obsessed with as a kid?" },
    { context: "date", text: "What’s a book, show, or song you keep recommending to people?" },
    { context: "date", text: "Is there a dish you’re known for making?" },
    { context: "date", text: "What’s something on your list to try this year?" },
    { context: "date", text: "What’s the best advice a friend has ever given you?" },

    // anywhere
    { context: "anywhere", text: "What’s something you’re looking forward to right now?" },
    { context: "anywhere", text: "What’s the most interesting thing you’ve read or heard lately?" },
    { context: "anywhere", text: "How did you end up in this part of town?" },
    { context: "anywhere", text: "What’s a hobby you’d pick up if you had more time?" },
    { context: "anywhere", text: "What’s a local spot you think is underrated?" },
    { context: "anywhere", text: "What’s something that made you laugh recently?" },
    { context: "anywhere", text: "If you had a free day tomorrow with nothing planned, what would you do?" },
    { context: "anywhere", text: "What’s a skill you picked up that surprised you?" },
    { context: "anywhere", text: "What’s a tradition you love, from your family or your friends?" },
    { context: "anywhere", text: "What’s something you’ve changed your mind about in the last few years?" }
  ]
};
