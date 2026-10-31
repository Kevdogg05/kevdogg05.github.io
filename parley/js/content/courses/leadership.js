export default {
  id: "leadership",
  title: "Lead and Influence",
  subtitle: "Hard conversations, clear boundaries and leading people well",
  tags: ["leadership", "work"],
  lessons: [
    {
      id: "leadership-1",
      title: "Give hard feedback, kindly",
      minutes: 7,
      intro: "Hard feedback lands best when it is specific, timely and clearly meant to help. Here is a simple structure you can use tomorrow.",
      steps: [
        { text: "Kind feedback is not the same as soft feedback. Kind feedback is clear, specific and given because you want the other person to succeed. Vague hints like “maybe tighten things up a bit” feel gentle, but they leave people guessing and often make the problem last longer. Being direct about the issue while staying warm toward the person is the kindest option you have." },
        { text: "People can only fix what they can see. When feedback is about a specific action rather than their character, it feels fair and doable, and they are less likely to get defensive. It also protects trust: your team learns that when you raise something, it is accurate, private and meant to help them grow." },
        { text: "Use three parts. Name the situation, describe the [[observable behavior]], then share the impact. For example: “In Tuesday’s client call, you interrupted Priya twice while she was presenting. It threw her off, and the client didn’t hear her best ideas.” Then stop and ask, “How did it look from your side?” Listen fully before you suggest anything." },
        { text: "Finish by agreeing on one next step together, such as “Next call, could you hold questions until she finishes?” Choose a private moment, soon after the event. A common mistake is the [[feedback sandwich]], where criticism is hidden between two compliments. People learn to brace for the “but,” and your real praise starts to sound like padding." }
      ],
      glossary: {
        "observable behavior": "Something a camera could record, like words said or a deadline missed, rather than a guess about someone’s attitude or motives.",
        "feedback sandwich": "Hiding a criticism between two compliments. It blurs the message and makes people distrust your praise."
      },
      takeaway: "Describe the situation, the behavior and its impact, then listen and agree on one next step, privately and soon.",
      tryIt: "Think of one piece of feedback you have been putting off. Write it in three sentences: situation, behavior, impact. Then add one open question you will ask.",
      quiz: [
        { type: "tf", statement: "Describing a specific action, rather than someone’s attitude, makes feedback easier to hear and act on.", answer: true,
          explain: "A specific action feels fair and fixable. Comments about character or attitude feel like attacks, so people defend themselves instead of listening." },
        { type: "blank", before: "Good feedback describes", after: "behavior, something a camera could record, rather than a guess about motives.",
          answer: "observable", options: ["emotional", "observable", "typical"],
          explain: "If you can point to what was said or done, the person can see it and change it. Guesses about motives invite argument." },
        { type: "match", prompt: "Match each part of the feedback to an example",
          pairs: [["Situation", "In this morning’s team meeting"], ["Behavior", "You arrived twenty minutes late"], ["Impact", "We had to repeat the updates"], ["Next step", "Could you message me if you’re running late?"]] },
        { type: "mcq", question: "After you share the situation, behavior and impact, what should you do next?",
          options: ["Repeat the point so it sticks", "Ask for their view and listen", "Add a compliment to soften it", "Move straight on to the next agenda item"], answer: 1,
          explain: "Asking how it looked from their side gives you missing context, shows respect and makes the person a partner in the fix rather than a target." }
      ],
      flashcards: [
        { front: "What are the three parts of clear feedback?", back: "Situation: when and where. Behavior: what they actually did. Impact: what it caused. Then ask for their view and agree on one next step." },
        { front: "Why avoid the feedback sandwich?", back: "Hiding criticism between compliments blurs the message and teaches people to distrust your praise. Give praise and correction separately, and mean both." }
      ]
    },
    {
      id: "leadership-2",
      title: "Say no and stay likable",
      minutes: 6,
      intro: "Every yes you give spends time you can’t get back. Learn to decline clearly, warmly and without a pile of excuses.",
      steps: [
        { text: "Saying no is part of doing your job well. When you accept everything, your real priorities slip, quality drops and people end up with a tired, rushed version of you. A clear, friendly no is more respectful than a reluctant yes that turns into a missed deadline or quiet resentment later." },
        { text: "People rarely remember the no itself. They remember how you made them feel while you said it. If you sound warm, give an honest reason and offer whatever help you genuinely can, most colleagues walk away feeling respected. What damages relationships is vague stalling, overpromising and going quiet." },
        { text: "Try three beats: appreciate, decline, [[redirect]]. “Thanks for thinking of me. I can’t take this on this month, because the launch needs my full attention. Sam knows this system well, or I could review a draft next Friday.” Keep the reason short and true. A long list of excuses sounds like you are asking for permission." },
        { text: "When your manager asks, turn the no into a choice about priorities: “I’m glad to help. If I take this on, the report slips to Thursday. Which matters more?” If someone pushes after you have declined, calmly repeat your [[boundary]] once, in the same words. You don’t need to defend it again or raise your voice." },
        { text: "A common mistake is the soft maybe: “Let me see what I can do.” It feels kinder in the moment, but it creates false hope. If you genuinely need time to decide, say when you will answer: “Let me check my week and get back to you by three o’clock.” Then keep that promise." }
      ],
      glossary: {
        "redirect": "Offering a smaller, realistic alternative, like a later date, a better-placed person or a reduced role, instead of a flat refusal.",
        "boundary": "A clear limit on what you will and won’t do, stated calmly, so other people know where they stand."
      },
      takeaway: "Appreciate, decline, redirect: one short, true reason and a realistic alternative protect both your time and the relationship.",
      tryIt: "The next time someone asks for something you can’t give, use the three beats out loud: thanks, a clear no with one reason, and one small alternative.",
      quiz: [
        { type: "tf", statement: "Giving several reasons for a no makes it more convincing and helps people accept it.", answer: false,
          explain: "A long list of excuses sounds like you want permission and invites people to argue with each one. One short, true reason is clearer and more confident." },
        { type: "blank", before: "When your manager adds work, turn the no into a question about", after: ", like “Which matters more this week?”",
          answer: "priorities", options: ["fairness", "your feelings", "priorities"],
          explain: "Framing it as a priority choice keeps you helpful and honest. Your manager decides what slips, and you avoid quietly overloading yourself." },
        { type: "match", prompt: "Match each beat of a warm no to an example",
          pairs: [["Appreciate", "Thanks for thinking of me"], ["Decline", "I can’t take this on this month"], ["Redirect", "Sam knows this system well"]] },
        { type: "mcq", question: "A colleague asks for help you can’t give right now. Which reply is clearest and kindest?",
          options: ["“Let me see what I can do.”", "“Sorry, I’m so swamped, things are crazy, you know how it is.”", "“I can’t this week, but I could look at it Monday.”"], answer: 2,
          explain: "It gives a clear no and a real alternative. The maybe creates false hope, and the rambling excuse sounds evasive without actually answering." }
      ],
      flashcards: [
        { front: "What are the three beats of a warm no?", back: "Appreciate the ask, decline clearly with one true reason, then redirect to a realistic alternative, like a later date or a better-placed person." },
        { front: "How do you say no to your manager?", back: "Make it a priority choice: “If I take this on, the report slips to Thursday. Which matters more?”" }
      ]
    },
    {
      id: "leadership-3",
      title: "Cut in without being rude",
      minutes: 6,
      intro: "Sometimes a meeting needs you to interrupt. Done well, it keeps things moving and still respects the person speaking.",
      steps: [
        { text: "Interrupting has a bad reputation, but sometimes it is the responsible move: a meeting is running over, someone is repeating themselves, a decision is being made on wrong facts, or a quieter colleague keeps getting talked over. Staying silent in those moments can cost more than a polite interruption." },
        { text: "What makes an interruption feel rude is usually the purpose behind it. Cutting in to grab the spotlight says “my point matters more.” Cutting in to serve the group, the time or the goal says “I’m helping all of us.” People forgive the second kind quickly, especially when you hand the floor back afterward." },
        { text: "Use a [[bridge phrase]] that names their point before you steer somewhere new. Say their name, acknowledge, then redirect with a reason: “Jordan, that’s a useful point about budget. Can I pause us there, because we have ten minutes left and still need to pick a launch date?” Raise a hand or lean in first, so the cut feels signaled, not sudden." },
        { text: "You can also interrupt on someone else’s behalf, which is called [[amplifying]]: “Sorry, I want to go back to Lena. I don’t think she finished.” And if you are the one being cut off, stay calm and keep the floor: “I’ll be quick, let me just finish this thought.” Then actually be quick." },
        { text: "A common mistake is apologizing so much that your interruption gets longer than their point: “Sorry, sorry, I hate to do this, and this is probably silly, but can I just jump in?” One short “sorry to jump in” is enough. Make your point in a sentence or two, then hand the floor back with a question." }
      ],
      glossary: {
        "bridge phrase": "A short line that acknowledges what someone just said before you move the conversation in a new direction.",
        "amplifying": "Bringing a colleague’s overlooked point or unfinished thought back to the group, and giving them credit for it."
      },
      takeaway: "Interrupt to serve the group, not your ego: use their name, acknowledge their point, redirect briefly, then hand the floor back.",
      tryIt: "Before your next meeting, prepare one bridge phrase, like “Can I pause us there?” Watch for a moment when a polite interruption would help, and use it once.",
      quiz: [
        { type: "tf", statement: "Interrupting to bring a quieter colleague back into the conversation is a respectful way to interrupt.", answer: true,
          explain: "Cutting in on someone else’s behalf serves the group. It gives credit and space to a person who was talked over, which builds trust." },
        { type: "blank", before: "A", after: "phrase names the speaker’s point before you steer the conversation somewhere new.",
          answer: "bridge", options: ["closing", "filler", "bridge"],
          explain: "Acknowledging their point first shows you were listening, so the redirect feels like teamwork instead of a brush-off." },
        { type: "match", prompt: "Match each moment to a helpful line",
          pairs: [["Meeting running over", "Can I pause us there?"], ["Colleague talked over", "I don’t think Lena finished"], ["You get cut off", "Let me just finish this thought"], ["Decision based on wrong facts", "Quick check before we decide"]] },
        { type: "mcq", question: "What most often makes an interruption feel rude?",
          options: ["Cutting in to take the spotlight for yourself", "Cutting in before the speaker has talked for a full minute", "Cutting in while using the person’s name"], answer: 0,
          explain: "People judge the purpose behind the cut. Interrupting to serve the group or the goal is forgiven quickly; interrupting to grab attention feels dismissive." }
      ],
      flashcards: [
        { front: "What are the three moves of a polite interruption?", back: "Use their name, acknowledge their point, then redirect with a reason: “Jordan, useful point on budget. Can I pause us, since we have ten minutes left?”" },
        { front: "What can you say when someone cuts you off?", back: "Stay calm and keep the floor briefly: “I’ll be quick, let me just finish this thought.” Then keep it short." }
      ]
    },
    {
      id: "leadership-4",
      title: "Defuse tension fast",
      minutes: 7,
      intro: "When voices rise, the calmest person in the room usually shapes what happens next. Here is how to lower the heat in the first minute.",
      steps: [
        { text: "Tension spreads. When someone is upset, they speak faster and louder, and it is natural to match them. But matching their energy signals that the fight is on. Your first job is not to win the point. It is to bring the temperature down so both of you can think clearly again." },
        { text: "Start with yourself. Take one slow breath, drop your shoulders and lower your voice a little. Speak slightly slower than usual. A steady pace and a softer volume can spread in the same way raised voices do, and they show the other person you are not a threat." },
        { text: "Next, [[label]] the emotion you notice, without judging it: “It sounds like this has been really frustrating.” Or: “You seem worried this will land on you.” Naming a feeling often helps people feel heard, which takes some of the heat out of it. You are not agreeing with every claim, only showing that you understand where they are." },
        { text: "Then move to [[shared ground]] and a next step: “We both want this client to stay. Let’s work out what we can fix today.” Offer a small, real choice, like talking now or after lunch, here or somewhere private. If things stay heated, pause on purpose: “I want to get this right. Can we take ten minutes and come back to it?”" },
        { text: "A common mistake is saying “calm down” or “you’re overreacting.” Those phrases tell people their feelings are wrong, so they push harder to prove them. Arguing the facts too early has the same effect. Feelings first, facts second. And if anyone is threatening or abusive, step away and get help rather than handling it alone." }
      ],
      glossary: {
        "label": "To name the emotion you notice in someone, out loud and without judging it, so they feel understood.",
        "shared ground": "A goal or concern both people already agree on, used as the starting point for solving the problem."
      },
      takeaway: "Calm your own body first, name the feeling, find shared ground, then agree on one next step. Feelings first, facts second.",
      tryIt: "Pick one phrase to keep ready, like “It sounds like this has been really frustrating.” Say it aloud in a calm, slow voice, then practice staying calm in one of the video Scenarios.",
      quiz: [
        { type: "tf", statement: "Telling an upset person to calm down usually helps them settle faster.", answer: false,
          explain: "It implies their feelings are wrong, so people often push harder to prove them. Naming the emotion and slowing your own pace works better." },
        { type: "blank", before: "When things get heated, deal with feelings first and", after: "second.",
          answer: "facts", options: ["apologies", "facts", "feedback"],
          explain: "People struggle to take in facts while they feel unheard. Once the emotion has been acknowledged, a calm conversation about what happened becomes possible." },
        { type: "match", prompt: "Match each de-escalation step to an example",
          pairs: [["Calm yourself", "Slow breath, softer voice"], ["Label the emotion", "This sounds really frustrating"], ["Find shared ground", "We both want this client"], ["Pause on purpose", "Can we take ten minutes?"]] },
        { type: "mcq", question: "A colleague storms over, angry that a deadline moved. What is the best first line?",
          options: ["“Calm down, it’s not a big deal.”", "“You sound really frustrated. Tell me what happened.”", "“Actually, the change was in last week’s email.”"], answer: 1,
          explain: "Naming the emotion and inviting their story lowers the heat. Dismissing feelings or jumping straight to facts tends to make people defend themselves harder." }
      ],
      flashcards: [
        { front: "What are the four steps to defuse tension?", back: "Calm your own body and voice, label the emotion, find shared ground, then agree on one small next step or a short pause." },
        { front: "Why avoid saying “calm down”?", back: "It tells people their feelings are wrong, so they push harder to prove them. Acknowledge the feeling instead." }
      ]
    },
    {
      id: "leadership-5",
      title: "Handle difficult personalities",
      minutes: 7,
      intro: "You can’t change difficult people, but you can change how you respond. Focus on behavior, stay steady and protect your boundaries.",
      steps: [
        { text: "Most “difficult people” are not villains. They are often stressed, insecure, overloaded or using habits that worked for them somewhere else. That does not excuse bad behavior, but it changes your goal. Instead of trying to fix someone’s personality, aim to manage the specific behaviors that affect your work." },
        { text: "Labels like “toxic” or “impossible” feel satisfying, but they lock you into a fight and make every interaction personal. Focusing on behavior keeps you calm and gives you something concrete to address. It also keeps you fair: you can be firm about a pattern while still treating the person with respect." },
        { text: "Match your response to the pattern. With the constant interrupter, hold the floor and finish your point. With the harsh critic, ask for specifics: “What exactly would make it stronger?” With the one who stays quiet and complains later, invite their input early, by name. With the steamroller who decides alone, agree on the process first: “Let’s list options before we pick one.”" },
        { text: "If a behavior keeps crossing a line, name it calmly and privately, then set a [[boundary]] with a consequence you can actually keep: “When I’m spoken to like that, I’ll end the meeting and we’ll pick it up later.” If the pattern continues, keep notes on dates, words and witnesses, and [[escalate]] to your manager or human resources." },
        { text: "A common mistake is complaining about the person to everyone except them. It feels like relief, but it spreads tension and usually reaches them in a worse form. Another is copying their behavior. Before you reply, ask yourself what you want to happen next, then say only what moves toward that." }
      ],
      glossary: {
        "boundary": "A clear limit on how you will be treated, stated calmly, with a consequence you are willing to follow through on.",
        "escalate": "To take a problem to someone with more authority, like your manager or human resources, when direct conversation has not worked."
      },
      takeaway: "Address specific behaviors, not personalities. Stay steady, set boundaries you can keep, and escalate with notes when a pattern continues.",
      tryIt: "Think of one challenging colleague. Write down the single behavior that affects you most, then draft one calm sentence about it that names the behavior, not their character.",
      quiz: [
        { type: "tf", statement: "If a colleague keeps crossing a line, setting a boundary with a consequence you will actually follow through on is a reasonable step.", answer: true,
          explain: "A calm boundary tells people where you stand. A consequence you will really keep, like ending the meeting, makes it credible without threats or shouting." },
        { type: "blank", before: "Aim to manage specific", after: ", not to fix someone’s personality.",
          answer: "behaviors", options: ["feelings", "friendships", "behaviors"],
          explain: "Behaviors are concrete and changeable. Trying to fix someone’s personality is out of your control and usually turns into a fight." },
        { type: "match", prompt: "Match each difficult pattern to a helpful response",
          pairs: [["The harsh critic", "Ask what exactly would help"], ["The steamroller", "Agree on the process first"], ["The silent complainer", "Invite their input early, by name"], ["The constant interrupter", "Hold the floor and finish"]] },
        { type: "mcq", question: "A teammate keeps calling your work “weak” in meetings without saying why. What is the most useful response?",
          options: ["Criticize their work back so they feel it", "Complain about them to the rest of the team", "Stop sharing your work in meetings", "Ask calmly, “What specifically would make it stronger?”"], answer: 3,
          explain: "Asking for specifics turns a vague attack into usable feedback, or shows the criticism has no substance. Either way, you stay calm and professional." }
      ],
      flashcards: [
        { front: "What should you focus on with a difficult colleague?", back: "The specific behavior that affects your work. Address that behavior calmly and privately, rather than trying to change who they are." },
        { front: "When should you escalate?", back: "When a pattern continues after you have raised it directly, or right away if behavior is threatening or abusive. Bring notes with dates, words and witnesses." }
      ]
    },
    {
      id: "leadership-6",
      title: "Listen like a leader",
      minutes: 6,
      intro: "The leaders people trust most are often the ones who listen best. Listening well is a skill you can practice, not a personality trait.",
      steps: [
        { text: "When you lead, your words carry extra weight, so it is tempting to talk more. But a big part of whether people trust you is whether they feel heard. Listening well gets you better information, earlier warnings about problems and more commitment, because people support plans they helped shape." },
        { text: "[[Active listening]] means listening to understand, not to reply. Put your phone away, face the person and let pauses happen. When they stop talking, wait a moment before you answer. Often the most important thing comes after the first silence, once they see you are really paying attention." },
        { text: "Use three tools. Ask open questions: “What’s getting in the way?” [[Paraphrase]] what you heard: “So the problem isn’t the deadline, it’s that the plans keep changing?” Then ask “What else?” before you offer any solution. Paraphrasing lets people correct you early, and it proves you were listening." },
        { text: "Leaders face an extra trap: jumping in to fix things. When someone brings you a problem, ask, “Do you want ideas, or do you mostly need to talk it through?” Sometimes they need a solution. Sometimes they need to think out loud and solve it themselves, which builds their confidence and judgment." },
        { text: "A common mistake is fake listening: nodding while you plan your answer, or asking for input after the decision is already made. People notice quickly. If a decision is fixed, say so honestly. And [[close the loop]] later by telling people what you did with what they said." }
      ],
      glossary: {
        "active listening": "Listening to understand rather than to reply, with full attention, open questions and checking back what you heard.",
        "paraphrase": "Putting what someone said into your own words and checking it with them, so they can confirm or correct you.",
        "close the loop": "Going back to people afterward to tell them what happened with their input, even when you decided not to use it."
      },
      takeaway: "Listen to understand: ask open questions, paraphrase, ask “What else?”, hold back the fix, and close the loop afterward.",
      tryIt: "In your next one-on-one conversation, ask “What else?” at least twice before you offer any advice. Notice what comes up the second time.",
      quiz: [
        { type: "tf", statement: "When a team member brings you a problem, a good leader offers a solution right away.", answer: false,
          explain: "Jumping to fix can cut people off before the real issue appears. Ask whether they want ideas or need to talk it through first." },
        { type: "blank", before: "Putting what someone said into your own words and checking it with them is called a", after: ".",
          answer: "paraphrase", options: ["paraphrase", "pitch", "rebuttal"],
          explain: "A paraphrase lets people correct a misunderstanding early, and it shows them you were genuinely following what they said." },
        { type: "match", prompt: "Match each listening tool to an example",
          pairs: [["Open question", "What’s getting in the way?"], ["Paraphrase", "So the plans keep changing?"], ["Digging deeper", "What else?"], ["Closing the loop", "Here’s what we did with your idea"]] },
        { type: "mcq", question: "Why ask, “Do you want ideas, or do you need to talk it through?”",
          options: ["It shows what kind of help the person actually needs", "It lets you avoid giving any advice at all", "It makes the conversation end sooner"], answer: 0,
          explain: "Sometimes people want a fix, and sometimes they want to think out loud. Asking avoids solving the wrong problem and respects their ability to handle it." }
      ],
      flashcards: [
        { front: "What are three tools for active listening?", back: "Open questions, paraphrasing what you heard, and asking “What else?” before you offer any solution." },
        { front: "What does it mean to close the loop?", back: "Going back to people later to tell them what happened with their input, even if you didn’t use it. It shows their voice mattered." }
      ]
    }
  ]
};
