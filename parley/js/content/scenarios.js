// Interactive video scenarios. Format: see ../../CONTENT.md ("Video scenarios").
export default [
  {
    id: "gala-stairs",
    title: "Read before you lead",
    skill: "Reading the room",
    summary: "At a charity gala, Daniel finally finds the foundation director he hoped to pitch, but she seems distracted and upset.",
    scene: "gala",
    cast: {
      A: { name: "Daniel", avatar: { skin: "olive", hair: "short", hairColor: "black", outfit: "blazer", outfitColor: "black", beard: "stubble", voice: "m" } },
      B: { name: "Maya", avatar: { skin: "deep", hair: "bun", hairColor: "black", outfit: "dress", outfitColor: "purple", voice: "f" } }
    },
    start: "intro",
    nodes: {
      intro: {
        beats: [
          { who: "N", line: "A charity gala. Daniel has waited all night to talk with Maya, who runs the city’s largest education foundation. He finds her alone on the grand staircase." },
          { who: "A", line: "Maya! Daniel Reyes, from Open Pages. We met at the spring summit. Do you have a minute?", mood: "smile" },
          { who: "B", line: "Oh, Daniel. Hi. Sure, I suppose. It’s been a long night.", mood: "worried" },
          { who: "A", line: "I’ll be quick. Our reading program just doubled in size, and we’re hoping to reach three more schools this fall.", mood: "smile" },
          { who: "B", line: "That’s great. Really.", mood: "think" },
          { who: "N", line: "Maya glances at her phone again. Her smile doesn’t quite reach her eyes." }
        ],
        choices: [
          { label: "Push on with the pitch", next: "push" },
          { label: "Read before you lead", next: "read" }
        ]
      },
      push: {
        beats: [
          { who: "A", line: "So we’re looking for a partner to fund the expansion, and your foundation feels like a perfect fit.", mood: "smile" },
          { who: "B", line: "Daniel, I appreciate it. But this really isn’t a good moment.", mood: "annoyed" },
          { who: "A", line: "Oh. Of course.", mood: "surprised" },
          { who: "N", line: "An awkward pause. Maya starts to turn back toward the ballroom." }
        ],
        choices: [
          { label: "Ask for a meeting anyway", next: "push-insist" },
          { label: "Apologize and check in", next: "push-recover" }
        ]
      },
      "push-insist": {
        beats: [
          { who: "A", line: "Totally understand. Could we just grab twenty minutes next week? I can send you some times tonight.", mood: "smile" },
          { who: "B", line: "Send an email. I’ll look when I can.", mood: "annoyed" },
          { who: "N", line: "Maya walks back into the ballroom. Daniel’s email sits unanswered for a month." }
        ],
        end: {
          outcome: "poor",
          title: "Pushed past the signals",
          takeaway: "When someone signals they’re overwhelmed, pressing for a commitment makes you part of the stress. Pause your agenda and respond to the person first."
        }
      },
      "push-recover": {
        beats: [
          { who: "A", line: "I’m sorry, I jumped right in. You said it’s been a long night. Is everything okay?", mood: "worried" },
          { who: "B", line: "It’s my mom. She’s in the hospital. She’s stable, but I’ve been checking my phone all evening.", mood: "worried" },
          { who: "A", line: "I’m so sorry. That’s a lot to carry while you’re hosting all this. Can I at least grab you some water?", mood: "worried" },
          { who: "B", line: "That’s kind. Yes, please. And email me about the schools next week, okay?", mood: "smile" }
        ],
        end: {
          outcome: "mixed",
          title: "A late but kind recovery",
          takeaway: "Owning the misstep and checking in turned the moment around. Reading her mood before the pitch would have spared her the pressure in the first place."
        }
      },
      read: {
        beats: [
          { who: "A", line: "Actually, the schools can wait. You seem like you’ve got a lot on your mind tonight.", mood: "think" },
          { who: "B", line: "Is it that obvious? My mom is in the hospital. She’s stable, but I’ve been checking my phone all night.", mood: "surprised" },
          { who: "A", line: "I’m really sorry. That’s hard, especially at an event where you have to be on.", mood: "worried" },
          { who: "B", line: "It is. Everyone keeps asking me for things, and I keep nodding.", mood: "think" }
        ],
        choices: [
          { label: "Ask a follow-up question", next: "read-ask" },
          { label: "Slip the pitch back in", next: "read-pitch" }
        ]
      },
      "read-ask": {
        beats: [
          { who: "A", line: "Is someone with her tonight?", mood: "worried" },
          { who: "B", line: "My brother. He just texted that she’s sleeping.", mood: "smile" },
          { who: "A", line: "Good. Then maybe what you need is a minute of quiet. Can I bring you some water and give you some space?", mood: "smile" },
          { who: "B", line: "You know, you’re the first person tonight who hasn’t pitched me something. Email me about your schools. I mean that.", mood: "smile" }
        ],
        end: {
          outcome: "good",
          title: "Connection made",
          takeaway: "Reading her mood before leading with your agenda built trust. People remember who treated them like a person, and that opens doors later."
        }
      },
      "read-pitch": {
        beats: [
          { who: "A", line: "I hope she feels better soon. Before you go, could I send over our proposal for the three new schools?", mood: "smile" },
          { who: "B", line: "Sure. Send it over.", mood: "neutral" },
          { who: "N", line: "She’s polite, but the warmth from a moment ago is gone. The proposal sits in her inbox for weeks." }
        ],
        end: {
          outcome: "mixed",
          title: "Noticed, then moved on",
          takeaway: "You read the room, then stepped right back into your agenda. When someone shares something heavy, stay with them a little longer. The ask can wait."
        }
      }
    },
    quiz: {
      question: "Maya seems distracted and worried as Daniel starts his pitch. What’s the most effective next move?",
      options: [
        "Talk faster so the pitch takes less of her time",
        "Pause the pitch and gently acknowledge that she seems to have a lot on her mind",
        "Ask her to commit to a meeting before she walks away"
      ],
      answer: 1,
      explain: "Acknowledging what you notice shows you see the person, not just the opportunity. Your agenda can wait for a moment when she can actually hear it."
    }
  },

  {
    id: "coffee-date-lull",
    title: "When the coffee date stalls",
    skill: "Reviving a conversation",
    summary: "Grace and Owen are on a first coffee date. After the easy topics run out, the conversation falls into an awkward silence.",
    scene: "cafe",
    cast: {
      A: { name: "Grace", avatar: { skin: "light", hair: "wavy", hairColor: "auburn", outfit: "sweater", outfitColor: "teal", glasses: true, voice: "f" } },
      B: { name: "Owen", avatar: { skin: "brown", hair: "curly", hairColor: "black", outfit: "shirt", outfitColor: "blue", beard: "stubble", voice: "m" } }
    },
    start: "intro",
    nodes: {
      intro: {
        beats: [
          { who: "N", line: "A sunny café on a Saturday. Grace and Owen matched last week, and they’ve already covered jobs, neighborhoods, and how good the croissants are." },
          { who: "B", line: "Anyway, I spent most of last weekend losing a fight with a bookshelf kit. But yeah, work’s fine. Lots of spreadsheets.", mood: "smile" },
          { who: "A", line: "Ha. Same here, honestly.", mood: "smile" },
          { who: "N", line: "Then, silence. Owen stirs his coffee. Grace studies the menu board she has already read twice." },
          { who: "B", line: "So. Um. Yeah.", mood: "think" }
        ],
        choices: [
          { label: "Fill the silence with anything", next: "fill" },
          { label: "Pick up a thread he dropped", next: "thread" }
        ]
      },
      fill: {
        beats: [
          { who: "A", line: "So, crazy weather lately, right? And traffic was terrible on the way here. Do you think it’ll rain later?", mood: "worried" },
          { who: "B", line: "Maybe? I didn’t check.", mood: "neutral" },
          { who: "A", line: "Yeah. Me neither.", mood: "worried" },
          { who: "N", line: "The silence comes back, heavier this time." }
        ],
        choices: [
          { label: "Keep the small talk going", next: "fill-more" },
          { label: "Laugh and name the lull", next: "fill-name" }
        ]
      },
      "fill-more": {
        beats: [
          { who: "A", line: "I read that this might be the hottest summer on record. Or the wettest. One of those.", mood: "neutral" },
          { who: "B", line: "Huh. Interesting.", mood: "neutral" },
          { who: "N", line: "Ten minutes later, Owen checks the time and mentions an errand. They finish their coffee and say a polite goodbye." }
        ],
        end: {
          outcome: "poor",
          title: "A polite, forgettable goodbye",
          takeaway: "Filler topics keep words coming but not connection. When a conversation stalls, go back to something the person actually said, or something you’re truly curious about."
        }
      },
      "fill-name": {
        beats: [
          { who: "A", line: "Okay, I just asked you about rain. I think my brain hit the panic button. Can we try that again?", mood: "laugh" },
          { who: "B", line: "Please. I was about to ask about your commute.", mood: "laugh" },
          { who: "A", line: "Wait, go back. You lost a fight with a bookshelf?", mood: "smile" },
          { who: "B", line: "Badly. It leans to the left now. I’ve decided it has character.", mood: "laugh" },
          { who: "N", line: "The ice is broken. For the next hour, they trade stories about their worst furniture disasters." }
        ],
        end: {
          outcome: "good",
          title: "Laughter broke the ice",
          takeaway: "Naming an awkward moment with a smile takes the pressure off both of you. Then return to something real they mentioned and let curiosity take over."
        }
      },
      thread: {
        beats: [
          { who: "A", line: "Wait, back up. You lost a fight with a bookshelf? I need to hear this.", mood: "smile" },
          { who: "B", line: "Oh, it was humiliating. Forty screws, one tiny wrench, and somehow three pieces left over at the end.", mood: "laugh" },
          { who: "A", line: "The leftover pieces are the scariest part. Is it still standing?", mood: "laugh" },
          { who: "B", line: "It leans a little to the left. I’ve decided it has character.", mood: "smile" }
        ],
        choices: [
          { label: "Ask rapid questions to keep going", next: "thread-quiz" },
          { label: "Share a story, then hand back", next: "thread-share" }
        ]
      },
      "thread-quiz": {
        beats: [
          { who: "A", line: "So do you build a lot of furniture? Where did you buy it? Do you like your apartment? How long have you lived there?", mood: "smile" },
          { who: "B", line: "Uh, not really, online, yes, and two years. That’s a lot of questions.", mood: "surprised" },
          { who: "A", line: "Sorry. I think I panicked about the quiet.", mood: "worried" },
          { who: "B", line: "That’s fair. I get it.", mood: "smile" },
          { who: "N", line: "They find their footing again, but the date never quite relaxes. They agree it was nice and leave it there." }
        ],
        end: {
          outcome: "mixed",
          title: "Friendly, but felt like an interview",
          takeaway: "Rapid questions can feel like an interview, even when you mean well. Ask one question, really listen, and add something of your own before the next."
        }
      },
      "thread-share": {
        beats: [
          { who: "A", line: "I respect that. I once built a dresser with every drawer upside down, and I used it that way for a whole year.", mood: "laugh" },
          { who: "B", line: "A whole year? That’s dedication.", mood: "laugh" },
          { who: "A", line: "Stubbornness, mostly. But I love making things. Is there anything you’ve always wanted to build, if you knew it would turn out right?", mood: "smile" },
          { who: "B", line: "Honestly? A little wooden boat. My grandpa built one when I was a kid. I can still smell the varnish.", mood: "think" },
          { who: "A", line: "That sounds wonderful. What was he like?", mood: "smile" },
          { who: "N", line: "The silence is long forgotten. When the staff starts stacking chairs, they’re still talking." }
        ],
        end: {
          outcome: "good",
          title: "The conversation found its flow",
          takeaway: "Pick up a thread they dropped, share a matching story, then hand it back with a bigger question. A silence is just a pause, not a verdict."
        }
      }
    },
    quiz: {
      question: "A first date goes quiet after the easy topics run out. What usually restarts the conversation best?",
      options: [
        "Bring up the weather or traffic to fill the gap",
        "Return to something interesting they mentioned earlier and ask about it",
        "Ask several quick questions in a row so there’s no silence",
        "Check your phone until one of you thinks of something"
      ],
      answer: 1,
      explain: "Calling back to something they said shows you were listening and gives them an easy, personal topic. Filler and rapid questions keep words flowing but rarely build connection."
    }
  },

  {
    id: "meeting-airtime",
    title: "Getting a word in",
    skill: "Speaking up respectfully",
    summary: "In a planning meeting, Rob has talked for twelve minutes straight. Aisha knows his deadline won’t work, and the meeting ends soon.",
    scene: "meeting",
    cast: {
      A: { name: "Aisha", avatar: { skin: "brown", hair: "long", hairColor: "black", outfit: "blazer", outfitColor: "teal", glasses: true, voice: "f" } },
      B: { name: "Rob", avatar: { skin: "porcelain", hair: "side-part", hairColor: "blonde", outfit: "shirt", outfitColor: "white", beard: "full", voice: "m" } }
    },
    start: "intro",
    nodes: {
      intro: {
        beats: [
          { who: "N", line: "A Monday planning meeting. Rob is walking the team through the launch plan, and he hasn’t paused in twelve minutes." },
          { who: "B", line: "So that’s why I’m confident we can hit the March deadline. Design is basically done, engineering just needs to move fast, and honestly, we might go even sooner.", mood: "smile" },
          { who: "N", line: "Aisha leads engineering. She knows March isn’t realistic, and there are only five minutes left in the meeting." }
        ],
        choices: [
          { label: "Wait for him to finish", next: "wait" },
          { label: "Bridge in at his next breath", next: "bridge" }
        ]
      },
      wait: {
        beats: [
          { who: "B", line: "So, to recap: design is done, sprints start Monday, and we announce in early March. Any questions? No? Great.", mood: "smile" },
          { who: "N", line: "Rob closes his laptop. Chairs scrape as people start to stand up." }
        ],
        choices: [
          { label: "Stay quiet and email later", next: "wait-email" },
          { label: "Speak up before everyone leaves", next: "wait-late" }
        ]
      },
      "wait-email": {
        beats: [
          { who: "N", line: "Aisha says nothing. That night, she writes a long email explaining why March won’t work. The next morning, Rob stops by her desk." },
          { who: "B", line: "Aisha, I just read your email. Why didn’t you say any of this in the meeting? I already told leadership March.", mood: "annoyed" },
          { who: "A", line: "I know. I should have. I didn’t want to interrupt.", mood: "worried" },
          { who: "B", line: "Well, now I have to walk it back.", mood: "annoyed" }
        ],
        end: {
          outcome: "poor",
          title: "The concern came too late",
          takeaway: "Staying silent to be polite can cost the whole team. A respectful interruption in the moment is kinder than a surprise email after decisions are made."
        }
      },
      "wait-late": {
        beats: [
          { who: "A", line: "Sorry, before everyone goes, I do have a concern about March.", mood: "worried" },
          { who: "B", line: "Oh. We’re basically out of time. Can it wait?", mood: "surprised" },
          { who: "A", line: "It’s quick. Engineering needs about six more weeks. Can we find fifteen minutes tomorrow?", mood: "neutral" },
          { who: "B", line: "Okay. Send me the details, and I’ll hold off on telling leadership.", mood: "think" },
          { who: "N", line: "Half the room has already left. The concern is heard, but the team has to meet all over again." }
        ],
        end: {
          outcome: "mixed",
          title: "Heard, just barely",
          takeaway: "Speaking up late beats not speaking up at all, but waiting until the end leaves no time to solve the problem. Look for a natural pause earlier."
        }
      },
      bridge: {
        beats: [
          { who: "N", line: "Rob pauses to take a breath." },
          { who: "A", line: "Rob, can I jump in on that point? You’re right that design is in great shape.", mood: "smile" },
          { who: "B", line: "Oh, sure. Go ahead.", mood: "surprised" },
          { who: "A", line: "On the engineering side, March is tight. We still have the payment integration, and that’s about six weeks on its own.", mood: "neutral" },
          { who: "B", line: "Six weeks? I was told it was mostly done.", mood: "annoyed" }
        ],
        choices: [
          { label: "Defend your team’s honor", next: "bridge-defend" },
          { label: "Offer options and invite input", next: "bridge-options" }
        ]
      },
      "bridge-defend": {
        beats: [
          { who: "A", line: "Well, whoever told you that was wrong. My team has been saying this for weeks, and nobody listens.", mood: "annoyed" },
          { who: "B", line: "Okay. There’s no need to make it personal.", mood: "annoyed" },
          { who: "N", line: "The room goes quiet. The meeting ends with no decision and two frustrated colleagues." }
        ],
        end: {
          outcome: "mixed",
          title: "Spoke up, then lost the room",
          takeaway: "You found the moment to speak, which matters. But blame turns a planning problem into a conflict. Stick to the facts and focus on what the team can do next."
        }
      },
      "bridge-options": {
        beats: [
          { who: "A", line: "It’s a fair surprise. The work grew when we added the new payment options. I see two paths: launch in April with everything, or March without them.", mood: "neutral" },
          { who: "B", line: "Hmm. Leadership really wants March. What would we lose by holding the new payment options?", mood: "think" },
          { who: "A", line: "Not much at launch. We could add them in a follow-up release two weeks later.", mood: "smile" },
          { who: "B", line: "Okay, that’s workable. Thanks for flagging it now, before I promised March to everyone.", mood: "smile" }
        ],
        end: {
          outcome: "good",
          title: "A well-timed interruption",
          takeaway: "Use the person’s name, acknowledge what’s right in their point, then add your concern with options. Interrupting well is about timing and respect, not volume."
        }
      }
    },
    quiz: {
      question: "A colleague has talked for several minutes, and you have an important concern. Which approach works best?",
      options: [
        "Wait until the meeting ends and send a detailed email",
        "Use their name at a pause, acknowledge their point, then raise your concern with options",
        "Talk over them until the room starts listening to you"
      ],
      answer: 1,
      explain: "A brief pause, their name, and a nod to what’s right make the interruption feel respectful. Offering options keeps the focus on solving the problem together."
    }
  },

  {
    id: "missed-deadlines",
    title: "Feedback a peer needs to hear",
    skill: "Giving hard feedback",
    summary: "Marcus has missed three design handoffs this month, and each time Lena’s launch slipped. She decides to talk to him directly.",
    scene: "office",
    cast: {
      A: { name: "Lena", avatar: { skin: "tan", hair: "ponytail", hairColor: "dark-brown", outfit: "sweater", outfitColor: "navy", voice: "f" } },
      B: { name: "Marcus", avatar: { skin: "deep", hair: "locs", hairColor: "black", outfit: "shirt", outfitColor: "maroon", beard: "stubble", voice: "m" } }
    },
    start: "intro",
    nodes: {
      intro: {
        beats: [
          { who: "N", line: "Lena and Marcus are peers on the same product team. For the third time this month, his designs arrived days late, and her launch slipped again." },
          { who: "N", line: "On Thursday afternoon, she stops by his desk." },
          { who: "A", line: "Hey, Marcus. Do you have ten minutes? I wanted to talk about the design handoffs.", mood: "neutral" },
          { who: "B", line: "Uh, sure. Is something wrong?", mood: "worried" }
        ],
        choices: [
          { label: "Let the frustration out", next: "vent" },
          { label: "Describe the impact, then ask", next: "describe" }
        ]
      },
      vent: {
        beats: [
          { who: "A", line: "Honestly, yes. You’re always late. I’m tired of covering for you, and everyone has noticed.", mood: "annoyed" },
          { who: "B", line: "Always? That’s not fair. I’m juggling three projects, and nobody has asked how I’m doing.", mood: "annoyed" }
        ],
        choices: [
          { label: "Stand your ground harder", next: "vent-escalate" },
          { label: "Pause and dial it back", next: "vent-repair" }
        ]
      },
      "vent-escalate": {
        beats: [
          { who: "A", line: "Everyone’s busy. That’s not an excuse for missing deadlines.", mood: "annoyed" },
          { who: "B", line: "Fine. Let’s take it to our manager, then, since apparently I’m the whole problem.", mood: "annoyed" },
          { who: "N", line: "Marcus turns back to his screen. The next handoff is late again, and now the two of them barely speak." }
        ],
        end: {
          outcome: "poor",
          title: "Defensive and stuck",
          takeaway: "Words like “always” and “everyone” feel like an attack, so people defend instead of listen. Describe specific events and their impact, then get curious."
        }
      },
      "vent-repair": {
        beats: [
          { who: "A", line: "You’re right, “always” wasn’t fair. I’m sorry. Let me try again. The last three handoffs came in late, and my launch slipped each time. What’s going on?", mood: "worried" },
          { who: "B", line: "Three projects at once. I didn’t want to say no to anyone.", mood: "think" },
          { who: "A", line: "That makes sense. Could we look at the schedule together on Monday?", mood: "neutral" },
          { who: "B", line: "Yeah. Okay. Monday.", mood: "neutral" },
          { who: "N", line: "They have a plan, but the sting of that opening lingers for weeks." }
        ],
        end: {
          outcome: "mixed",
          title: "Repaired, but bruised",
          takeaway: "Owning a harsh opening can rescue the conversation, but it costs trust. Starting with specifics and curiosity would have gotten you there faster."
        }
      },
      describe: {
        beats: [
          { who: "A", line: "Nothing dramatic. The last three handoffs came two or three days after the dates we agreed on, and each time, our launch slipped.", mood: "neutral" },
          { who: "B", line: "Yeah. I know. I’ve been meaning to say something.", mood: "worried" },
          { who: "A", line: "I wanted to check in before it turns into a bigger problem. What’s been getting in the way?", mood: "think" },
          { who: "B", line: "Honestly, I’m on three projects right now, and I keep saying yes to everyone. Yours keeps getting squeezed.", mood: "worried" }
        ],
        choices: [
          { label: "Reassure him and let it go", next: "describe-drop" },
          { label: "Agree on a plan together", next: "describe-plan" }
        ]
      },
      "describe-drop": {
        beats: [
          { who: "A", line: "Oh, that’s a lot. Don’t worry about it, then. We’ll make it work.", mood: "smile" },
          { who: "B", line: "Really? Thanks, Lena. That’s a relief.", mood: "smile" },
          { who: "N", line: "Marcus feels better. But nothing changes, and two weeks later, the next handoff is late again." }
        ],
        end: {
          outcome: "mixed",
          title: "Kind, but nothing changed",
          takeaway: "Empathy matters, but softening the message until it disappears doesn’t help either of you. Be kind to the person and clear about the need."
        }
      },
      "describe-plan": {
        beats: [
          { who: "A", line: "That sounds like a lot. Thanks for telling me. Our launch really depends on getting designs by the Monday before. What would make that possible?", mood: "neutral" },
          { who: "B", line: "If I knew earlier which screens matter most, I could start with those. And maybe I need to talk to our manager about the third project.", mood: "think" },
          { who: "A", line: "I can send you priorities every Friday. Want to check in next week and see if it’s working?", mood: "smile" },
          { who: "B", line: "Yeah. And honestly, thanks for coming to me first instead of going over my head.", mood: "smile" }
        ],
        end: {
          outcome: "good",
          title: "Clear, kind, and on track",
          takeaway: "Describe specific events and their impact, ask what’s getting in the way, then agree on one concrete change and a time to check in."
        }
      }
    },
    quiz: {
      question: "Which opening is most likely to help a peer actually hear hard feedback?",
      options: [
        "“You’re always late, and everyone has noticed.”",
        "“The last three handoffs came in late, and our launch slipped. What’s getting in the way?”",
        "“No big deal, but maybe try to be a little faster?”"
      ],
      answer: 1,
      explain: "Specific events and their impact are hard to argue with, and a genuine question invites problem solving. Labels like “always” trigger defense, while vague hints get ignored."
    }
  },

  {
    id: "party-circle",
    title: "Joining the circle",
    skill: "Joining a group",
    summary: "At a birthday party where she only knows the host, Sofia wants to join a small group that’s laughing about a cooking show.",
    scene: "party",
    cast: {
      A: { name: "Sofia", avatar: { skin: "olive", hair: "bob", hairColor: "brown", outfit: "dress", outfitColor: "coral", voice: "f" } },
      B: { name: "Dev", avatar: { skin: "tan", hair: "short", hairColor: "black", outfit: "polo", outfitColor: "green", beard: "full", glasses: true, voice: "m" } }
    },
    start: "intro",
    nodes: {
      intro: {
        beats: [
          { who: "N", line: "A crowded birthday party. Sofia only knows the host, Nina, who’s busy in the kitchen. Nearby, a small group is laughing." },
          { who: "B", line: "No, the best part of Kitchen Panic last night was when he set the dessert on fire and called it caramelized.", mood: "laugh" },
          { who: "N", line: "Sofia drifts closer. The group is facing inward, mid-story." }
        ],
        choices: [
          { label: "Jump in with your own story", next: "jump" },
          { label: "Listen first, then add on", next: "listen" }
        ]
      },
      jump: {
        beats: [
          { who: "A", line: "Oh, cooking! I just got back from a food trip to Italy, and let me tell you, the pasta there is on another level.", mood: "smile" },
          { who: "B", line: "Oh. Hi. Sure, Italy is great.", mood: "surprised" },
          { who: "N", line: "The group shifts awkwardly. Someone checks their phone. The joke they were sharing has fizzled." }
        ],
        choices: [
          { label: "Keep telling the Italy story", next: "jump-more" },
          { label: "Laugh it off and ask about them", next: "jump-recover" }
        ]
      },
      "jump-more": {
        beats: [
          { who: "A", line: "We took a cooking class in Florence with a real Italian grandmother. I could probably teach you all to make fresh pasta right now.", mood: "smile" },
          { who: "B", line: "Cool. Hey, I’m going to grab a drink. Nice to meet you.", mood: "neutral" },
          { who: "N", line: "One by one, the group drifts away. Sofia is left standing by the snack table, alone." }
        ],
        end: {
          outcome: "poor",
          title: "Talked at, not with",
          takeaway: "Barging in with an unrelated story makes a group feel interrupted. Listen first, match their topic, and add to it instead of replacing it."
        }
      },
      "jump-recover": {
        beats: [
          { who: "A", line: "Sorry, I totally barged in there. I’m Sofia. I know Nina from work. Wait, someone set dessert on fire?", mood: "laugh" },
          { who: "B", line: "Ha, no worries. I’m Dev. It’s this baking show, Kitchen Panic. Have you seen it?", mood: "laugh" },
          { who: "A", line: "Never, but now I have to. Was the fire on purpose?", mood: "smile" },
          { who: "B", line: "Absolutely not. The host just kept smiling like everything was fine.", mood: "laugh" },
          { who: "N", line: "The group warms back up. Sofia is in, though it took a moment to reset." }
        ],
        end: {
          outcome: "mixed",
          title: "A bumpy but honest entry",
          takeaway: "Owning a clumsy entrance with a smile and asking about their topic gets you back in. Next time, listen first so you join the conversation they’re already having."
        }
      },
      listen: {
        beats: [
          { who: "N", line: "Sofia steps to the edge of the circle, smiles, and listens. One of the group, Dev, notices and shifts to make a little room." },
          { who: "B", line: "And the judges just ate it anyway, like that was totally normal.", mood: "laugh" },
          { who: "A", line: "Ha!", mood: "laugh" }
        ],
        choices: [
          { label: "Wait to be invited in", next: "listen-wait" },
          { label: "Add a line that fits", next: "listen-add" }
        ]
      },
      "listen-wait": {
        beats: [
          { who: "N", line: "Sofia keeps smiling and nodding, waiting for someone to ask her a question." },
          { who: "B", line: "Anyway, we should grab more snacks before they’re gone.", mood: "smile" },
          { who: "N", line: "The group heads for the kitchen. Sofia follows a step behind, still not quite part of it." }
        ],
        end: {
          outcome: "mixed",
          title: "Polite, but still outside",
          takeaway: "Listening first is smart, but groups rarely stop to invite you in. Once you’ve caught the topic, add a short comment that fits and introduce yourself."
        }
      },
      "listen-add": {
        beats: [
          { who: "A", line: "Kitchen Panic? The one where the host smiles through every disaster? My roommate and I watch it every Sunday.", mood: "laugh" },
          { who: "B", line: "Yes! Finally, someone who gets it. I’m Dev, by the way.", mood: "laugh" },
          { who: "A", line: "Sofia. I know Nina from work. What’s the worst dish you’ve ever seen on there?", mood: "smile" },
          { who: "B", line: "Fish ice cream. Season two. I still have nightmares.", mood: "laugh" },
          { who: "N", line: "The group laughs, and the circle widens to make room. Sofia’s in." }
        ],
        end: {
          outcome: "good",
          title: "Welcomed into the circle",
          takeaway: "Approach, listen for the topic, then add something that fits before you introduce yourself. You join a conversation by building on it, not taking it over."
        }
      }
    },
    quiz: {
      question: "What’s the smoothest way to join a group that’s already talking?",
      options: [
        "Start an unrelated story of your own so they notice you",
        "Stand nearby quietly until someone invites you in",
        "Listen for the topic, then add a short comment that fits and introduce yourself"
      ],
      answer: 2,
      explain: "Matching their topic shows you’re joining their conversation, not hijacking it. A quick introduction after your comment turns you from a listener into part of the group."
    }
  },

  {
    id: "noise-next-door",
    title: "The noise next door",
    skill: "Calm conflict conversations",
    summary: "Late-night music from next door has kept Ben awake three nights this week. He sees his neighbor Carla outside and decides to bring it up.",
    scene: "street",
    cast: {
      A: { name: "Ben", avatar: { skin: "light", hair: "buzz", hairColor: "red", outfit: "hoodie", outfitColor: "navy", beard: "full", voice: "m" } },
      B: { name: "Carla", avatar: { skin: "brown", hair: "curly", hairColor: "gray", outfit: "sweater", outfitColor: "mustard", glasses: true, voice: "f" } }
    },
    start: "intro",
    nodes: {
      intro: {
        beats: [
          { who: "N", line: "Saturday morning on a quiet street. Three nights this week, music from next door kept Ben awake past one." },
          { who: "N", line: "He spots his neighbor Carla unloading groceries from her car." },
          { who: "B", line: "Morning, Ben! Gorgeous day, isn’t it?", mood: "smile" },
          { who: "A", line: "Morning, Carla. It really is. Hey, do you have a second?", mood: "neutral" },
          { who: "B", line: "Sure, what’s up?", mood: "neutral" }
        ],
        choices: [
          { label: "Hint at it with a joke", next: "hint" },
          { label: "Name the problem kindly", next: "direct" }
        ]
      },
      hint: {
        beats: [
          { who: "A", line: "Sounded like quite the party over at your place this week. You must have a lot of energy!", mood: "laugh" },
          { who: "B", line: "Ha! That’s my son’s band. They’re practicing for a big show. They’re actually getting good.", mood: "laugh" },
          { who: "A", line: "Yeah. Definitely heard them.", mood: "neutral" },
          { who: "B", line: "Great! Well, enjoy your weekend.", mood: "smile" },
          { who: "N", line: "Carla heads for her front door, cheerful and completely unaware there’s a problem." }
        ],
        choices: [
          { label: "Let it go for now", next: "sleepless" },
          { label: "Catch her and say it plainly", next: "hint-clear" }
        ]
      },
      "hint-clear": {
        beats: [
          { who: "A", line: "Actually, Carla, one more thing. I was hinting, but I should just say it. The music has been going until about one, and I’m up at six.", mood: "neutral" },
          { who: "B", line: "Oh! I had no idea it carried that far. I’m so sorry.", mood: "surprised" },
          { who: "A", line: "No harm done. Could they wrap up by ten on weeknights?", mood: "smile" },
          { who: "B", line: "Of course. I’ll tell him tonight. Thanks for being straight with me.", mood: "smile" }
        ],
        end: {
          outcome: "good",
          title: "Clear on the second try",
          takeaway: "Jokes and hints are easy to miss. When you notice your message didn’t land, say it plainly and kindly, with a specific request."
        }
      },
      direct: {
        beats: [
          { who: "A", line: "This is a little awkward, but I’d rather just ask. The music has been going pretty late a few nights this week, until about one. I’m up at six for work.", mood: "neutral" },
          { who: "B", line: "Oh. That’s my son’s band. They’re practicing for a big show.", mood: "surprised" },
          { who: "B", line: "I mean, it’s only been a few nights, and they’ve worked so hard. It’s not like it’s every night.", mood: "annoyed" }
        ],
        choices: [
          { label: "Say never mind, it’s fine", next: "direct-retreat" },
          { label: "Acknowledge her, then suggest a time", next: "direct-plan" },
          { label: "Warn her you’ll call the city", next: "direct-threat" }
        ]
      },
      "direct-retreat": {
        beats: [
          { who: "A", line: "Oh, no, you’re right. Never mind. It’s fine, really.", mood: "worried" },
          { who: "B", line: "Great. The show is in a couple of weeks anyway.", mood: "smile" },
          { who: "N", line: "Carla carries her groceries inside. Ben stands on the sidewalk, still tired, with nothing settled." }
        ],
        next: "sleepless"
      },
      "direct-plan": {
        beats: [
          { who: "A", line: "That’s fair, and it sounds like they’re working hard. I don’t want to stop the practice. Could they wrap up by ten on weeknights?", mood: "neutral" },
          { who: "B", line: "Ten on weeknights. Yes, that’s reasonable. Could weekends go a little later?", mood: "think" },
          { who: "A", line: "Sure, eleven on weekends works for me. And good luck to them at the show.", mood: "smile" },
          { who: "B", line: "Thanks for coming to me directly, Ben. I’d much rather hear it from you than find a note on my door.", mood: "smile" }
        ],
        end: {
          outcome: "good",
          title: "Good neighbors, good sleep",
          takeaway: "Name the issue with specifics, acknowledge their side, and propose a fair, concrete fix. Talking face to face early keeps a small problem from becoming a feud."
        }
      },
      "direct-threat": {
        beats: [
          { who: "A", line: "Hard work or not, I need my sleep. If it happens again, I’m calling the city.", mood: "annoyed" },
          { who: "B", line: "Wow. Okay. You could have just asked nicely.", mood: "annoyed" },
          { who: "N", line: "From then on, the music stops by ten. But Carla stops waving, and the street feels a little colder." }
        ],
        end: {
          outcome: "mixed",
          title: "Quiet nights, colder neighbor",
          takeaway: "Threats can get results, but they burn goodwill you may need later. Acknowledge their side and propose a fix before reaching for consequences."
        }
      },
      sleepless: {
        beats: [
          { who: "N", line: "That night, the drums start again at eleven and keep going past one." },
          { who: "A", line: "I should have just asked for what I needed.", mood: "annoyed" },
          { who: "N", line: "Ben lies awake, rehearsing what he wishes he had said. By the end of the week, he dreads running into Carla at all." }
        ],
        end: {
          outcome: "poor",
          title: "Still awake at one",
          takeaway: "Hints and quick retreats protect the moment but not your sleep. Name the problem kindly and specifically, and suggest a fix you can both live with."
        }
      }
    },
    quiz: {
      question: "A neighbor’s late music keeps you awake. Which approach is most likely to fix it and keep the relationship friendly?",
      options: [
        "Drop a few jokes and hope they get the hint",
        "Describe the specific problem, acknowledge their side, and suggest a fair cutoff time",
        "Tell them you’ll report them if it happens again",
        "Leave an unsigned note on their door"
      ],
      answer: 1,
      explain: "Specifics make the problem clear, acknowledging their side lowers defenses, and a concrete request gives them an easy way to say yes."
    }
  }
];
