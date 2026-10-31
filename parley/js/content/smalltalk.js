// Small talk game. Format: see ../../CONTENT.md ("Small talk game").
export default [
  {
    id: "after-the-launch",
    title: "After the big launch",
    category: "work",
    level: 1,
    scene: "office",
    partner: {
      name: "Jake",
      role: "Product manager on your floor",
      avatar: { skin: "light", hair: "side-part", hairColor: "blonde", outfit: "polo", outfitColor: "blue", beard: "stubble", voice: "m" }
    },
    goal: "Celebrate Jake’s win, show real interest, and keep the conversation easy and two-sided.",
    turns: [
      {
        say: "Hey! My calendar just cleared for the first time in three weeks. The new checkout flow went live this morning. What are you up to?",
        options: [
          {
            text: "Congratulations, that’s huge! I’m just finishing a report. How does it feel to finally have it out in the world?",
            rating: "positive",
            feedback: "You answered briefly, celebrated his win, and handed the conversation back with an open question about how he feels.",
            reply: "Honestly? Relieved, and a little nervous. We’ve been watching the dashboard all morning like it’s a sports game."
          },
          {
            text: "Not much, just working on a report. Congrats on the launch.",
            rating: "neutral",
            feedback: "Polite and friendly, but it closes the door. Add a question so Jake has something to pick up.",
            reply: "Thanks! It’s been a long road."
          },
          {
            text: "Oh, I’m drowning. Three deadlines this week, and my manager keeps adding more. It’s honestly a mess.",
            rating: "negative",
            feedback: "He shared good news and asked a light question. Jumping straight to complaints makes the moment about your stress instead of his win.",
            reply: "Oof, that sounds rough. Hopefully it eases up soon."
          }
        ]
      },
      {
        say: "The early numbers actually look good. Way fewer people are giving up on their carts at the payment page.",
        options: [
          {
            text: "That’s great to see so quickly. What do you think made the biggest difference?",
            rating: "positive",
            feedback: "Asking what made the difference invites him to tell the story behind the win, which people usually love to share.",
            reply: "Cutting the form from four pages to one. Sounds simple, but it took months of convincing people."
          },
          {
            text: "Nice. Good numbers are always good.",
            rating: "neutral",
            feedback: "Friendly, but generic. A reply this short gives him nothing to build on, so the conversation stalls.",
            reply: "Ha, yeah. Better than the alternative."
          },
          {
            text: "Early numbers can be misleading, though. I’d wait a month before celebrating.",
            rating: "negative",
            feedback: "Even if it’s true, deflating someone’s good news sounds like a put-down. Save the critique for when it’s asked for.",
            reply: "Sure, we’ll keep watching. Still, it’s nice to have a good morning."
          }
        ]
      },
      {
        say: "Anyway, enough about checkout pages. What’s keeping you busy these days?",
        options: [
          {
            text: "I’m pulling together our customer survey results. Lots of spreadsheets, but some of the comments are surprisingly useful. Your new checkout might even show up in next quarter’s answers.",
            rating: "positive",
            feedback: "You shared something real and specific, then linked it back to his work. That creates a natural thread you both care about.",
            reply: "Oh, I’d love to see those comments when they come in. Send them my way?"
          },
          {
            text: "Oh, just the usual. Reports and meetings.",
            rating: "neutral",
            feedback: "A vague answer is safe but forgettable. One specific detail gives the other person a hook to ask about.",
            reply: "Ha, the classic combo. I know that feeling."
          },
          {
            text: "Honestly, let’s not talk about work. Did you see the game last night?",
            rating: "negative",
            feedback: "Shifting topics is fine, but brushing off his question this abruptly can feel dismissive. Answer briefly first, then pivot.",
            reply: "Oh, I missed it, actually. I was here pretty late."
          }
        ]
      },
      {
        say: "Hey, a few of us are grabbing tacos on Friday to celebrate the launch. You should come if you’re free.",
        options: [
          {
            text: "I’d love that, thanks for including me. Is it the place on Fifth Street? Their salsa is amazing.",
            rating: "positive",
            feedback: "Accepting warmly and adding a small, specific detail shows genuine enthusiasm and gives you something to chat about on Friday.",
            reply: "That’s the one! Great, I’ll add you to the group thread."
          },
          {
            text: "Maybe. I’ll see how the week goes.",
            rating: "neutral",
            feedback: "Noncommittal answers are honest when you’re unsure, but they can sound like a polite no. If you can’t commit, at least thank him warmly.",
            reply: "No pressure. Just let me know."
          },
          {
            text: "Tacos again? Your team really needs to branch out.",
            rating: "negative",
            feedback: "Teasing an invitation can land as ungrateful, especially with someone you don’t know well. Lead with thanks before any jokes.",
            reply: "Ha, fair. It’s kind of our tradition at this point."
          }
        ]
      },
      {
        say: "Well, I should get back before someone finds a bug. Good catching up with you.",
        options: [
          {
            text: "You too, Jake. Enjoy the quiet calendar while it lasts, and congratulations again to the whole team.",
            rating: "positive",
            feedback: "A warm goodbye that recalls what he told you at the start ends the chat on a high note.",
            reply: "Ha, thanks. I’ll try. See you around!"
          },
          {
            text: "Okay, see you.",
            rating: "neutral",
            feedback: "Fine, but abrupt. A warm closing line, even a short one, helps people remember the chat fondly.",
            reply: "See you."
          },
          {
            text: "Wait, before you go, can I tell you about this bug I found in our expense app?",
            rating: "negative",
            feedback: "He signaled he needs to leave. Starting a new topic at the exit ignores that cue. Let people go gracefully.",
            reply: "Uh, maybe another time? I really should get back to my desk."
          }
        ]
      }
    ],
    takeaway: "Celebrate other people’s wins, answer questions with one specific detail, and hand the conversation back with an open question."
  },

  {
    id: "coffee-line",
    title: "Waiting in the coffee line",
    category: "social",
    level: 1,
    scene: "cafe",
    partner: {
      name: "Amara",
      role: "Fellow regular at your neighborhood café",
      avatar: { skin: "deep", hair: "locs", hairColor: "black", outfit: "sweater", outfitColor: "coral", voice: "f" }
    },
    goal: "Turn a few minutes of waiting into a friendly, low-pressure chat with a stranger.",
    turns: [
      {
        say: "Okay, I have to ask. Is the honey lavender latte any good? I keep staring at it on the menu and can’t decide if it’s brilliant or a terrible idea.",
        options: [
          {
            text: "I just ordered it for the first time, so I’ll report back! I’m hoping it tastes like a garden, not like soap. Do you have a usual?",
            rating: "positive",
            feedback: "A light joke, a little about you, and an easy question back. That’s the simplest recipe for small talk with a stranger.",
            reply: "Black coffee, every single day. But that drink is seriously tempting me."
          },
          {
            text: "It’s okay, I guess.",
            rating: "neutral",
            feedback: "Not rude, but a short answer signals you’d rather not chat. Add a detail or a question if you’re open to talking.",
            reply: "Oh, okay. Good to know."
          },
          {
            text: "I wouldn’t know. Honestly, I think flavored lattes are kind of a waste of money.",
            rating: "negative",
            feedback: "She asked a playful question. Judging the drink she’s curious about can feel like judging her. Keep first exchanges positive.",
            reply: "Ha, well, I guess it’s a treat for some of us."
          }
        ]
      },
      {
        say: "This place is always packed at this hour. I come here before work most mornings. Do you live around here?",
        options: [
          {
            text: "Just a few blocks away. I moved here last spring, and this was the first café I found. Any other neighborhood spots I should know about?",
            rating: "positive",
            feedback: "You answered with a small personal detail and asked for her local knowledge. People enjoy giving recommendations.",
            reply: "Oh, definitely try the bakery on the corner. Their cinnamon rolls sell out by nine."
          },
          {
            text: "Yeah, nearby.",
            rating: "neutral",
            feedback: "Accurate but closed. One extra detail, like how long you’ve lived here, gives her something to respond to.",
            reply: "Cool, cool."
          },
          {
            text: "Why, are you planning to follow me home? Kidding. Mostly.",
            rating: "negative",
            feedback: "It’s fine to keep your address private, but a suspicious joke treats a friendly question like a threat. “Just nearby, how about you?” protects your privacy and stays warm.",
            reply: "Oh! Ha, no, sorry. Just making conversation."
          }
        ]
      },
      {
        say: "I work at the library across the street, so this is basically my second office. What gets you up and out this early?",
        options: [
          {
            text: "I’m a nurse, so early shifts are my life. A library sounds so peaceful, though. Is it as quiet as people imagine?",
            rating: "positive",
            feedback: "You shared your job briefly, then got curious about hers with a question that invites a fun answer.",
            reply: "Ha! Not at all. Toddler story time is basically a rock concert."
          },
          {
            text: "Work. I start at eight.",
            rating: "neutral",
            feedback: "Fine, but it’s a closed answer. Giving one detail and asking a question back keeps things flowing.",
            reply: "Ah, an early starter. Same here."
          },
          {
            text: "Work, unfortunately. My job is honestly the worst. My boss micromanages everything, and my team is useless.",
            rating: "negative",
            feedback: "Venting to someone you just met puts a lot of weight on a light conversation. Keep early small talk easy and upbeat.",
            reply: "Oh no. That sounds really draining. I’m sorry."
          }
        ]
      },
      {
        say: "Okay, honest question. Is it weird that I know the barista’s dog’s name? I think I might come here too often.",
        options: [
          {
            text: "Not weird at all, that’s the mark of a true regular. Now I have to know. What’s the dog’s name?",
            rating: "positive",
            feedback: "Reassuring her and asking a playful follow-up keeps the mood light and shows you’re enjoying the chat.",
            reply: "Pickles. He has a birthday party every year, and I’ve been invited twice."
          },
          {
            text: "Ha, maybe a little.",
            rating: "neutral",
            feedback: "A small laugh is friendly, but you missed an easy chance to play along and keep the fun going.",
            reply: "Ha, yeah. I should probably get out more."
          },
          {
            text: "I don’t really like dogs, honestly.",
            rating: "negative",
            feedback: "Her question was a playful joke about being a regular. Answering with a personal dislike shuts down the fun she offered.",
            reply: "Oh. Fair enough, they’re not for everyone."
          }
        ]
      },
      {
        say: "Oh, that’s my name they just called. Well, enjoy your coffee. Maybe I’ll see you here again.",
        options: [
          {
            text: "I’d like that! I’m usually here around this time. Have a great day at the library.",
            rating: "positive",
            feedback: "Signaling you’d be glad to chat again, plus a personal goodbye that recalls her job, turns a stranger into a friendly face.",
            reply: "You too! See you around, coffee buddy."
          },
          {
            text: "Okay, bye.",
            rating: "neutral",
            feedback: "Polite enough, but flat. A warm sign-off costs nothing and leaves a better impression.",
            reply: "Bye!"
          },
          {
            text: "Wait, can I get your number? We should hang out sometime.",
            rating: "negative",
            feedback: "Jumping from a short chat to asking for a number can feel like pressure. Let a friendly acquaintance grow over a few more conversations first.",
            reply: "Oh, um, I’m sure I’ll see you around here. Have a good one."
          }
        ]
      }
    ],
    takeaway: "With strangers, keep it light: answer with a small detail, ask an easy question back, and leave with a warm goodbye."
  },

  {
    id: "new-neighbor",
    title: "Welcome the new neighbor",
    category: "neighbors",
    level: 1,
    scene: "street",
    partner: {
      name: "Luis",
      role: "Moving in next door today",
      avatar: { skin: "tan", hair: "wavy", hairColor: "black", outfit: "tee", outfitColor: "green", beard: "mustache", voice: "m" }
    },
    goal: "Make Luis feel welcome on moving day without overwhelming him.",
    turns: [
      {
        say: "Hi there! Sorry about the truck blocking the sidewalk. We should be out of your way in an hour or so. I’m Luis, by the way.",
        options: [
          {
            text: "No worries at all. Welcome to the street! I’m in the blue house right there. How’s the move going so far?",
            rating: "positive",
            feedback: "You put him at ease, introduced yourself with a useful detail, and asked about his day. Warm and simple.",
            reply: "Better than expected, honestly. Only one broken lamp so far. My daughter is calling that a win."
          },
          {
            text: "Hi. It’s fine.",
            rating: "neutral",
            feedback: "You reassured him, which is kind, but skipping your name makes the welcome feel cool. Introduce yourself back.",
            reply: "Okay, great. Thanks for being patient."
          },
          {
            text: "Yeah, I noticed. Just make sure they don’t block my driveway.",
            rating: "negative",
            feedback: "A fair request, but leading with it on moving day sounds cold. Welcome him first. Logistics can follow a friendly hello.",
            reply: "Of course, I’ll tell the movers right away. Sorry about that."
          }
        ]
      },
      {
        say: "We came from across town, so this whole neighborhood is new to us. What’s it like living here?",
        options: [
          {
            text: "It’s really friendly. People wave, and there’s a block party every summer. What made you choose this area?",
            rating: "positive",
            feedback: "You painted a picture of the neighborhood and asked a question that lets him share his story.",
            reply: "The school, mostly. And the park. My kids already want to live at that playground."
          },
          {
            text: "It’s nice. Quiet.",
            rating: "neutral",
            feedback: "True and pleasant, but short. Newcomers want to hear what makes a place special, so give one specific detail.",
            reply: "Quiet sounds good to me."
          },
          {
            text: "It used to be nicer, honestly. Property taxes keep going up, and the trash pickup is a joke.",
            rating: "negative",
            feedback: "Complaints can be valid, but unloading them on someone who just moved in can make them second-guess the move. Start with what you enjoy.",
            reply: "Oh. Well, hopefully we’ll like it anyway."
          }
        ]
      },
      {
        say: "Oh, and is there anything I should know? Like which night the trash goes out?",
        options: [
          {
            text: "Trash and recycling go out Tuesday night. And there’s a neighborhood group chat for lost cats and borrowed tools. Want me to add you?",
            rating: "positive",
            feedback: "Practical information plus an invitation into the community. Small offers like this help new people feel they belong.",
            reply: "Yes, please! That would help a lot."
          },
          {
            text: "Tuesdays, I think.",
            rating: "neutral",
            feedback: "Helpful, but minimal. Adding one more useful tip would show you’re glad he’s here.",
            reply: "Tuesdays. Got it, thanks."
          },
          {
            text: "Just don’t park in front of the Hendersons’ house. Trust me, you do not want to get on their bad side.",
            rating: "negative",
            feedback: "Gossip about other neighbors in your first chat can make you seem like a source of drama. Stick to helpful, neutral information.",
            reply: "Oh, wow. Okay. Noted, I guess."
          }
        ]
      },
      {
        say: "Last question, I promise. Is there a good place nearby for takeout? I don’t think we’ll find the pots and pans tonight.",
        options: [
          {
            text: "Definitely. Bangkok Corner, two blocks down. They deliver fast, and their noodles are perfect after a long day. Tell them the neighbor sent you.",
            rating: "positive",
            feedback: "A specific, practical tip solves a real problem for him tonight. Helpful details make a strong first impression.",
            reply: "Perfect, that’s exactly what we need. Thank you!"
          },
          {
            text: "There are a few places on Main Street.",
            rating: "neutral",
            feedback: "Helpful in spirit, but vague. Naming one favorite spot is easier for a tired newcomer to act on.",
            reply: "Okay, I’ll look them up."
          },
          {
            text: "I mostly cook at home. Takeout is so overpriced these days.",
            rating: "negative",
            feedback: "He asked for help, and you answered with your own habits and an opinion. Try to answer the question he actually asked.",
            reply: "Ha, fair enough. I’ll search online."
          }
        ]
      },
      {
        say: "Well, I should get back before the movers put the couch in the bathroom. It was really nice to meet you.",
        options: [
          {
            text: "You too, Luis! If you need anything, like a ladder or a wrench, just knock. Good luck with the couch.",
            rating: "positive",
            feedback: "Using his name, offering practical help, and calling back to his joke make a warm, memorable goodbye.",
            reply: "That’s really kind. I might take you up on that ladder. See you around!"
          },
          {
            text: "Okay, good luck.",
            rating: "neutral",
            feedback: "Friendly, but quick. Using his name or offering help would make the welcome feel more genuine.",
            reply: "Thanks! See you."
          },
          {
            text: "Sure. Oh, and just so you know, quiet hours here start at nine. Some of us get up early.",
            rating: "negative",
            feedback: "Raising house rules in your first conversation can feel like a warning. If noise ever becomes an issue, talk about it then.",
            reply: "Oh. Okay. We’ll keep that in mind."
          }
        ]
      }
    ],
    takeaway: "A good welcome makes someone’s day easier: introduce yourself, share one useful tip, and offer help with no strings attached."
  },

  {
    id: "dog-park",
    title: "Chatting at the dog park",
    category: "neighbors",
    level: 1,
    scene: "park",
    partner: {
      name: "Peggy",
      role: "Dog park regular with a beagle named Biscuit",
      avatar: { skin: "porcelain", hair: "bob", hairColor: "gray", outfit: "sweater", outfitColor: "teal", glasses: true, voice: "f" }
    },
    goal: "Chat with a fellow dog owner while your dogs play, and find some common ground.",
    turns: [
      {
        say: "Looks like our two have decided they’re best friends. Mine’s Biscuit. She doesn’t usually warm up this fast.",
        options: [
          {
            text: "They’re adorable together! Mine’s Juno. She’s usually shy too, so this is a big moment. How old is Biscuit?",
            rating: "positive",
            feedback: "You matched her friendly tone, shared a little about your dog, and asked a simple question. Dog owners love talking about their dogs.",
            reply: "She just turned seven. Still acts like a puppy when she sees a tennis ball."
          },
          {
            text: "Yeah, they seem to get along.",
            rating: "neutral",
            feedback: "Pleasant, but it doesn’t add anything new. Share your dog’s name or ask about hers to keep it going.",
            reply: "They do. It’s nice to see."
          },
          {
            text: "Mine warms up to everyone right away. She’s really well trained. We did six months of classes.",
            rating: "negative",
            feedback: "Bragging turns a shared moment into a comparison. She made a sweet observation, so meet it with warmth instead of a contest.",
            reply: "Oh. Well, good for her. Biscuit is more of a free spirit."
          }
        ]
      },
      {
        say: "I’ve been coming here every morning for years. I don’t think I’ve seen you two before, though.",
        options: [
          {
            text: "We usually come in the evenings, but I’m working from home today. It’s so nice in the morning. Is it always this calm?",
            rating: "positive",
            feedback: "You explained yourself naturally and asked her, the expert regular, about the park. That invites her to share what she knows.",
            reply: "Mornings are the best. By five o’clock it’s chaos. Twenty dogs and one frisbee."
          },
          {
            text: "Yeah, we’re usually here later.",
            rating: "neutral",
            feedback: "Fine, but closed. A little more detail or a question back keeps the exchange from stalling.",
            reply: "Ah, the evening crowd. That makes sense."
          },
          {
            text: "Every single morning? Don’t you have a job? What do you do all day?",
            rating: "negative",
            feedback: "Rapid personal questions feel like an interrogation, and asking about someone’s job status can sound judgmental. Ask one gentle question at a time.",
            reply: "Ha. That’s a lot of questions before my second cup of coffee."
          }
        ]
      },
      {
        say: "I retired last spring, so the dog park is basically my social life now. Biscuit has more friends than I do.",
        options: [
          {
            text: "Ha, honestly, same with Juno. Congratulations on retiring, though! What have you enjoyed most so far?",
            rating: "positive",
            feedback: "A light, relatable joke and a warm question about her new chapter. You took her humor in the spirit she meant it.",
            reply: "Gardening, and sleeping past six. I’m growing tomatoes for the first time. Mostly feeding the squirrels, so far."
          },
          {
            text: "That’s nice.",
            rating: "neutral",
            feedback: "Kind, but it skims past what she shared. Retirement is a big change, so a curious question shows you care.",
            reply: "It is. Most days, anyway."
          },
          {
            text: "Retirement sounds amazing. I’m so jealous. I’ve got at least thirty more years of meetings ahead of me.",
            rating: "negative",
            feedback: "A little envy is relatable, but you turned her story into a comment about your situation. Ask about her experience first.",
            reply: "Ha. It goes by faster than you’d think."
          }
        ]
      },
      {
        say: "Oh no, look. They’ve found the mud puddle. That’s a bath for both of us tonight.",
        options: [
          {
            text: "Ha, worth it for how happy they look. Any tricks for bath time? Juno acts like it’s a disaster movie.",
            rating: "positive",
            feedback: "Humor plus a practical question keeps the shared moment going. Asking for advice is a great way to show respect.",
            reply: "Peanut butter on the tub wall. She licks, I scrub, everyone’s happy."
          },
          {
            text: "Yep, looks like it.",
            rating: "neutral",
            feedback: "You agreed, but you didn’t build on her joke. A little playfulness or a question turns the moment into connection.",
            reply: "Oh well. That’s dog life."
          },
          {
            text: "Ugh, seriously? Can you call her back? I just had Juno groomed yesterday.",
            rating: "negative",
            feedback: "Both dogs chose the puddle, so blaming hers feels unfair. Shrugging it off together keeps the friendly mood.",
            reply: "Oh, sorry. They both jumped in, though. Biscuit, come!"
          }
        ]
      },
      {
        say: "Well, we’d better head home and start that bath. It was lovely meeting you. We’re here most mornings if you two ever want a playdate.",
        options: [
          {
            text: "We’d love that. I have a feeling Juno will be dragging me here now. Enjoy your morning, and good luck with bath time!",
            rating: "positive",
            feedback: "Accepting the invitation warmly and ending with a light callback leaves the door open for a real neighborhood friendship.",
            reply: "Ha, thank you. See you both soon!"
          },
          {
            text: "Maybe. Bye!",
            rating: "neutral",
            feedback: "Polite, but noncommittal. If you’d like to see her again, a warmer yes helps the connection stick.",
            reply: "Bye now!"
          },
          {
            text: "Sure. Oh, before you go, can you recommend a vet? And a groomer? And is that dog daycare on Elm Street any good?",
            rating: "negative",
            feedback: "She’s wrapping up. Piling on new questions as someone leaves ignores their cue. Save them for the next playdate.",
            reply: "Oh, goodness. Ask me next time, okay? I really need to get her home."
          }
        ]
      }
    ],
    takeaway: "Shared moments, like dogs playing, are natural openers. Match the other person’s mood, ask about their world, and keep it light."
  },

  {
    id: "networking-mixer",
    title: "The industry mixer",
    category: "networking",
    level: 2,
    scene: "party",
    partner: {
      name: "Kofi",
      role: "Founder of a small solar energy startup",
      avatar: { skin: "brown", hair: "buzz", hairColor: "black", outfit: "blazer", outfitColor: "gray", beard: "full", voice: "m" }
    },
    goal: "Have a real conversation with Kofi instead of trading pitches, and leave with a natural reason to follow up.",
    turns: [
      {
        say: "These name tags never stay on, do they? I’m Kofi. I don’t really know anyone here, to be honest.",
        options: [
          {
            text: "Same here, so I’m glad you said hi. I’m new to this group too. What brings you here tonight?",
            rating: "positive",
            feedback: "Admitting you’re new matches his honesty and builds instant rapport. Then you gave him an easy, open question.",
            reply: "A friend dragged me here, then abandoned me for the snack table. So now I’m making friends with strangers."
          },
          {
            text: "Hi, nice to meet you.",
            rating: "neutral",
            feedback: "Polite but bare. He admitted he feels out of place, so a little warmth and a question would help you both relax.",
            reply: "You too."
          },
          {
            text: "Hi! Here’s my card. I’m a senior consultant specializing in growth strategy for early stage startups. Are you hiring?",
            rating: "negative",
            feedback: "Leading with a pitch skips the human part. People remember how a conversation felt, not your title. Connect first, then talk business.",
            reply: "Oh, thanks. Not hiring right now, I’m afraid."
          }
        ]
      },
      {
        say: "I run a small startup that puts solar panels on school roofs. Honestly, the panels are the easy part. Getting parts delivered on time is the real nightmare.",
        options: [
          {
            text: "That’s right in my world, actually. I work on shipping software. What usually goes wrong with your deliveries?",
            rating: "positive",
            feedback: "You found genuine common ground and asked about his specific pain point. That’s how networking turns into real conversation.",
            reply: "Everything! Customs, warehouses, weather. Last month a whole pallet of panels spent two weeks in the wrong state."
          },
          {
            text: "Solar panels on schools, that’s cool.",
            rating: "neutral",
            feedback: "Encouraging, but it just repeats him back. Ask about the problem he mentioned to show you were really listening.",
            reply: "Thanks. The kids love watching the energy numbers go up."
          },
          {
            text: "Oh, I hear you. When I ran logistics for a big retailer, we moved ten thousand shipments a week. Now that was a nightmare.",
            rating: "negative",
            feedback: "One-upping his challenge with a bigger story shifts the spotlight to you. Ask about his situation before sharing your own.",
            reply: "Wow, okay. Ours is a bit smaller than that."
          }
        ]
      },
      {
        say: "Enough about my shipping drama. What do you enjoy most about your work?",
        options: [
          {
            text: "Honestly, the puzzles. I help small companies untangle their shipping, and I love when total chaos turns out to have a simple fix. Is that the kind of mess you’re dealing with?",
            rating: "positive",
            feedback: "You described your work through what you enjoy, not just a title, and connected it back to his problem. Enthusiasm is more memorable than a job description.",
            reply: "Constantly. We track everything in one giant spreadsheet. It’s held together with hope."
          },
          {
            text: "I don’t know. It pays the bills, I guess.",
            rating: "neutral",
            feedback: "Downplaying your work can sound like you’re not interested in the conversation. Share one thing you genuinely like about it.",
            reply: "Ha, fair enough. That counts for a lot."
          },
          {
            text: "Fixing problems like yours. You need a freight partner, live tracking, and a warehouse plan. I could set all that up for you.",
            rating: "negative",
            feedback: "Unsolicited advice that turns into a sales pitch feels pushy in a first chat. Ask questions, and let him invite your expertise.",
            reply: "Uh, thanks. I think we’re okay for now."
          }
        ]
      },
      {
        say: "Can I ask you something? Do you actually like these events? I always feel like I’m doing them wrong.",
        options: [
          {
            text: "I used to dread them. Now I aim for one good conversation, then I let myself go home. Tonight, that box is already checked.",
            rating: "positive",
            feedback: "Honest, relatable, and a sincere compliment at the end. Meeting his openness with a little of your own builds trust quickly.",
            reply: "Ha, I love that rule. I’m stealing it."
          },
          {
            text: "They’re okay. Some are better than others.",
            rating: "neutral",
            feedback: "A safe answer, but he opened up about feeling awkward. Matching that honesty with a little of your own deepens the connection.",
            reply: "Yeah, that’s true."
          },
          {
            text: "Oh, I love them. I’ve already collected thirty business cards tonight. It’s all about volume, you know?",
            rating: "negative",
            feedback: "Boasting about volume can make him feel like card number thirty-one. Networking works best as a few genuine conversations, not a numbers game.",
            reply: "Oh. Wow. That’s a lot of cards."
          }
        ]
      },
      {
        say: "Oh, there’s someone from the school district I’ve been hoping to meet all year. I should say hello before she leaves.",
        options: [
          {
            text: "Go, don’t miss her! I’d love to keep talking about your shipping puzzle sometime. Mind if I send you a message this week?",
            rating: "positive",
            feedback: "You respected his goal, kept it brief, and suggested a low-pressure follow-up based on what you actually talked about.",
            reply: "Please do! Maybe coffee next week. Wish me luck."
          },
          {
            text: "Okay, nice talking to you.",
            rating: "neutral",
            feedback: "A gracious exit, but you missed the chance to suggest a follow-up while the conversation was fresh.",
            reply: "You too! Enjoy the rest of the night."
          },
          {
            text: "Can I come with you? I’d love to meet someone from the school district too.",
            rating: "negative",
            feedback: "Inviting yourself into his important introduction puts him in an awkward spot. Let him go, and ask for an introduction later if it fits.",
            reply: "Oh, um, I’d better meet her on my own first. I’ll find you later."
          }
        ]
      }
    ],
    takeaway: "Great networking feels like a good conversation: get curious about their challenges, talk about your work with enthusiasm, and suggest a specific follow-up."
  },

  {
    id: "first-date-dinner",
    title: "First date dinner",
    category: "dating",
    level: 2,
    scene: "restaurant",
    partner: {
      name: "Nadia",
      role: "Your first date, introduced by your friend Talia",
      avatar: { skin: "olive", hair: "long", hairColor: "dark-brown", outfit: "dress", outfitColor: "maroon", voice: "f" }
    },
    goal: "Get to know Nadia, share a bit about yourself, and keep the evening relaxed and respectful.",
    turns: [
      {
        say: "Okay, I have a confession. I looked at this menu online three times today. I’m that person. Have you been here before?",
        options: [
          {
            text: "I’m so glad you said that, because I did the exact same thing. First time here, though. Anything catch your eye?",
            rating: "positive",
            feedback: "Matching her small confession with your own puts you both at ease. Then you asked about her pick, which keeps it about the two of you.",
            reply: "The mushroom risotto, definitely. Unless that’s too boring for a first date."
          },
          {
            text: "No, first time.",
            rating: "neutral",
            feedback: "Honest, but brief. She shared something a little playful, so meeting her energy with a detail of your own keeps things warm.",
            reply: "Oh, okay. Me too."
          },
          {
            text: "Three times? Wow, that’s a little intense.",
            rating: "negative",
            feedback: "Teasing that sounds like judgment can make someone self-conscious, especially on a first date. Respond to openness with warmth.",
            reply: "Ha. Yeah, I guess so."
          }
        ]
      },
      {
        say: "So, Talia told me you just got back from a trip. Where did you go?",
        options: [
          {
            text: "Lisbon, for a week! I ate way too many custard tarts. Talia says you love to travel too. What’s a place that surprised you?",
            rating: "positive",
            feedback: "A fun detail, then a question that invites a story. “What surprised you” gets far more interesting answers than “where have you been.”",
            reply: "Iceland. I expected glaciers. I didn’t expect to fall in love with a hot spring next to a parking lot."
          },
          {
            text: "Portugal. It was nice.",
            rating: "neutral",
            feedback: "A one-line answer makes her do all the work. Share one vivid moment so she can picture it and ask more.",
            reply: "Nice. I’ve always wanted to go."
          },
          {
            text: "Portugal. I’ve actually been to thirty-two countries now. Want to hear my ranking? It’s pretty detailed.",
            rating: "negative",
            feedback: "Counting countries and offering a ranking can come across as bragging. Pick one story, then turn the spotlight to her.",
            reply: "Oh, wow. That’s a lot of countries."
          }
        ]
      },
      {
        say: "Okay, here’s my slightly random question. What’s something you’re really into right now that most people don’t know about?",
        options: [
          {
            text: "I’ve been learning pottery. Every bowl I make is a little lopsided, but I love it. What about you? I feel like you have a good answer ready.",
            rating: "positive",
            feedback: "You shared something personal and a bit imperfect, which feels genuine, then returned the question with a playful nudge.",
            reply: "I do! I sing in a community choir. We perform old soul songs at the library every month."
          },
          {
            text: "Hmm, I don’t know. Not much, really.",
            rating: "neutral",
            feedback: "She offered a fun question. Even a small hobby or recent interest gives her something to connect with.",
            reply: "That’s okay. It’s a hard one on the spot."
          },
          {
            text: "Honestly, my ex got me into rock climbing, and I keep going even though it reminds me of the breakup. It’s complicated.",
            rating: "negative",
            feedback: "Bringing up an ex and lingering feelings on a first date makes things heavy fast. Share what you enjoy now, and save the past for later.",
            reply: "Oh. That sounds like a lot. I’m sorry."
          }
        ]
      },
      {
        say: "Oh, the food’s here. This looks amazing. Want to try a bite of mine? No pressure, I know not everyone likes sharing.",
        options: [
          {
            text: "I’d love a bite, thank you. Want to try mine too? Then we can officially decide who ordered better.",
            rating: "positive",
            feedback: "Accepting kindly and offering yours back is warm and playful, and a friendly contest gives you a fun little moment together.",
            reply: "Deal. Okay, yours might win. Don’t tell the chef."
          },
          {
            text: "I’m okay, thanks.",
            rating: "neutral",
            feedback: "Totally fine to decline, and she made that easy. Adding a warm word about her choice would keep the moment friendly.",
            reply: "No problem. More for me!"
          },
          {
            text: "Sure! And you have to try mine. Come on, just one bite. You’ll love it, I promise.",
            rating: "negative",
            feedback: "Offering is kind. Insisting isn’t. Pressure, even playful, ignores the easygoing respect she just showed you. Offer once, then let her choose.",
            reply: "Maybe later. I’m good for now."
          }
        ]
      },
      {
        say: "This was really fun. I have an early morning, though, so I should probably head out soon.",
        options: [
          {
            text: "I had a great time too. I’d love to do this again, if you would. No pressure either way.",
            rating: "positive",
            feedback: "Clear, warm interest with an easy way for her to say yes or no. Respectful directness beats playing it cool.",
            reply: "I’d like that. Text me, and we’ll find a day."
          },
          {
            text: "Okay, sounds good. Get home safe.",
            rating: "neutral",
            feedback: "Kind and considerate, but if you’re interested, saying so clearly is better than leaving her guessing.",
            reply: "Thanks, you too. This was nice."
          },
          {
            text: "Already? Come on, one more drink. The night is young.",
            rating: "negative",
            feedback: "She told you her plans. Pushing her to stay disregards that, even if you mean it kindly. Respecting a no makes a future yes more likely.",
            reply: "I really do need to go. Thanks for tonight, though."
          }
        ]
      }
    ],
    takeaway: "On a first date, curiosity and kindness beat performance. Share real things about yourself, ask questions that invite stories, and respect every no."
  },

  {
    id: "wedding-table",
    title: "Strangers at the wedding table",
    category: "social",
    level: 2,
    scene: "gala",
    partner: {
      name: "Theo",
      role: "The bride’s uncle, seated next to you",
      avatar: { skin: "brown", hair: "bald", hairColor: "gray", outfit: "blazer", outfitColor: "navy", beard: "full", glasses: true, voice: "m" }
    },
    goal: "Make easy conversation with a stranger at a wedding reception and help the table feel friendly.",
    turns: [
      {
        say: "Well, it looks like we’re table neighbors. I’m Theo, the bride’s uncle. How do you know the happy couple?",
        options: [
          {
            text: "Nice to meet you, Theo! I went to college with Ben. We were roommates for two very messy years. Have you known Priya since she was little?",
            rating: "positive",
            feedback: "You answered with a fun detail and asked a question that invites him to share family stories. Weddings are full of them.",
            reply: "Since the day she was born. She bossed everyone around at age four. Now she runs a hospital department. Some things don’t change."
          },
          {
            text: "I know Ben from college.",
            rating: "neutral",
            feedback: "Clear and polite, but brief. A detail about how you met gives him a story to react to.",
            reply: "Ah, a college friend. Nice."
          },
          {
            text: "Through Ben. Honestly, I’m surprised I was invited. We haven’t really talked in years.",
            rating: "negative",
            feedback: "Saying you’re surprised to be there can make others feel awkward, especially family. Focus on what connects you to the couple.",
            reply: "Oh. Well, I’m sure he’s glad you came."
          }
        ]
      },
      {
        say: "That ceremony got me. I promised myself I wouldn’t cry, and I lasted about forty seconds.",
        options: [
          {
            text: "Ha, you weren’t alone. When Priya read her vows, half the room reached for tissues. What was your favorite moment?",
            rating: "positive",
            feedback: "Normalizing his emotion and asking about his favorite moment invites him to share something meaningful, not just small facts.",
            reply: "Her dad walking her down the aisle. That’s my brother. He practiced that walk in his hallway for a week."
          },
          {
            text: "It was a nice ceremony.",
            rating: "neutral",
            feedback: "True, but it skips over the feeling he shared. Responding to emotion, even lightly, makes people feel heard.",
            reply: "It really was."
          },
          {
            text: "Really? I thought it ran a bit long, honestly. I was counting the minutes.",
            rating: "negative",
            feedback: "Criticizing the ceremony to the bride’s family sours the mood fast. If you can’t share the feeling, find something genuine to appreciate.",
            reply: "Oh. Well, it meant a lot to the family."
          }
        ]
      },
      {
        say: "So what do you do when you’re not at weddings?",
        options: [
          {
            text: "I teach high school chemistry, so I spend my days trying to make teenagers care about atoms. Some days I win. What about you?",
            rating: "positive",
            feedback: "Humor about your own work is disarming and gives him plenty to ask about. Then you passed the question back.",
            reply: "Retired engineer. I built bridges for thirty years. Now I build birdhouses. The birds complain less."
          },
          {
            text: "I’m a teacher.",
            rating: "neutral",
            feedback: "Fine, but it ends there. One more line about what you teach or enjoy gives the conversation somewhere to go.",
            reply: "A teacher! Good for you. That’s important work."
          },
          {
            text: "I’m in finance. Speaking of which, any idea what this wedding cost? I heard the venue alone was huge.",
            rating: "negative",
            feedback: "Speculating about costs at someone’s wedding, especially with family, comes across as nosy. Keep the focus on the celebration.",
            reply: "I really couldn’t say. That’s their business."
          }
        ]
      },
      {
        say: "Uh oh. My wife is giving me that look from across the room. She wants me on the dance floor, and I have two left feet.",
        options: [
          {
            text: "Same here, but weddings are the one place nobody judges. If you go out there, I’ll go too. Moral support.",
            rating: "positive",
            feedback: "Playful solidarity turns his worry into a shared joke. Gentle humor that puts you on the same side is perfect at a wedding.",
            reply: "Deal. If I step on anyone, I’m blaming you."
          },
          {
            text: "Ha, good luck.",
            rating: "neutral",
            feedback: "Friendly, but you didn’t join in. A little playful encouragement could turn this into a shared memory.",
            reply: "Thanks. I’ll need it."
          },
          {
            text: "Yeah, I saw you during the first dance. You definitely shouldn’t quit your day job.",
            rating: "negative",
            feedback: "Even as a joke, teasing someone about a real insecurity can sting. Choose jokes that put you both on the same side.",
            reply: "Ha. Thanks a lot."
          }
        ]
      },
      {
        say: "Oh, wait, saved by the cake! The dancing can wait. That’s my mother’s lemon cake recipe, you know. Priya insisted.",
        options: [
          {
            text: "That’s wonderful. A family recipe makes it feel so personal. Is there a story behind it?",
            rating: "positive",
            feedback: "Asking for the story behind something personal shows real interest and often leads to the best conversation of the night.",
            reply: "My mother made it for every birthday. Priya learned it from her. Excuse me, I may need another tissue."
          },
          {
            text: "Nice. I love lemon cake.",
            rating: "neutral",
            feedback: "Friendly and positive. Asking about the recipe’s history would have shown interest in what he’s sharing.",
            reply: "Then you’re in for a treat."
          },
          {
            text: "Oh, I don’t eat sugar anymore. I cut it out last year, and I feel ten years younger. You should try it.",
            rating: "negative",
            feedback: "Diet talk and unsolicited advice at a celebration can feel preachy. A simple “none for me, thanks” is plenty.",
            reply: "Ha. Maybe after the wedding."
          }
        ]
      }
    ],
    takeaway: "At events full of strangers, share how you’re connected, respond to the feelings people share, and use humor that puts you on the same side."
  },

  {
    id: "old-friend",
    title: "Running into an old friend",
    category: "social",
    level: 2,
    scene: "street",
    partner: {
      name: "Megan",
      role: "College friend you haven’t seen in five years",
      avatar: { skin: "light", hair: "ponytail", hairColor: "red", outfit: "hoodie", outfitColor: "gray", voice: "f" }
    },
    goal: "Reconnect warmly with Megan, skip the guilt, catch up for real, and make a plan if you both want one.",
    turns: [
      {
        say: "Oh my gosh, is that you? It’s Megan! From college! I haven’t seen you in, what, five years?",
        options: [
          {
            text: "Megan! Wow, it’s so good to see you. You look great. What are you doing in this part of town?",
            rating: "positive",
            feedback: "Genuine excitement and a simple question make the reunion warm right away. No need to explain the years of silence.",
            reply: "Picking up a birthday cake for my roommate. What a lucky detour this turned out to be!"
          },
          {
            text: "Oh, hey. Yeah, it’s been a while.",
            rating: "neutral",
            feedback: "Friendly, but subdued. She’s clearly excited, so matching some of her energy helps the reunion feel mutual.",
            reply: "It really has! Wow. Okay, hi!"
          },
          {
            text: "Megan! Oh no, I’m so sorry I never wrote back after graduation. I’m terrible at keeping in touch. I feel awful.",
            rating: "negative",
            feedback: "Over-apologizing turns a happy surprise into a guilt session. A simple “it’s so good to see you” is all the moment needs.",
            reply: "Oh, don’t worry about it! I’m terrible too. Really, it’s fine."
          }
        ]
      },
      {
        say: "So, quick update. I moved here three months ago for a job at the children’s museum. What about you? What have you been up to?",
        options: [
          {
            text: "The children’s museum, that’s perfect for you! I’m doing graphic design for a nonprofit. Still drawing, just on a bigger screen. Are you loving the new job?",
            rating: "positive",
            feedback: "You celebrated her news, gave a quick but real update, and asked a follow-up. A good catch-up is a two-way trade.",
            reply: "I really am. Yesterday a kid asked me if dinosaurs had birthdays. That’s my job now."
          },
          {
            text: "Oh, same old stuff. Working, mostly.",
            rating: "neutral",
            feedback: "Vague answers can feel like you’re holding back. Share one real update so she can reconnect with your life now.",
            reply: "Ha, fair. Work is work."
          },
          {
            text: "Ugh, where do I start? I got laid off, my landlord is raising the rent, and my car broke down twice this month.",
            rating: "negative",
            feedback: "Honesty is good, but a list of troubles in a quick sidewalk run-in is hard to respond to. Share one thing, and leave room for her.",
            reply: "Oh no, that’s a lot at once. I’m really sorry."
          }
        ]
      },
      {
        say: "Do you remember our study group’s late-night pancake runs? I still can’t look at blueberry pancakes the same way.",
        options: [
          {
            text: "Yes! The night we got locked out of the library and studied at the diner until sunrise. Best worst night ever.",
            rating: "positive",
            feedback: "Adding your own memory to hers brings the shared story to life. Reminiscing together is one of the fastest ways to reconnect.",
            reply: "Yes! And we both passed that exam! I still don’t know how."
          },
          {
            text: "Ha, yeah, those were fun.",
            rating: "neutral",
            feedback: "Warm, but it lets the memory fade fast. Add a detail you remember so the moment becomes something you share.",
            reply: "They really were."
          },
          {
            text: "Kind of? Honestly, college is a blur. I don’t really think about those days.",
            rating: "negative",
            feedback: "Even if it’s true, dismissing a memory she treasures can feel like dismissing her. Find a piece you can connect with.",
            reply: "Oh. Right. It was a long time ago."
          }
        ]
      },
      {
        say: "This is so fun. I know we’re blocking the whole sidewalk, but I don’t want to say bye and disappear for another five years.",
        options: [
          {
            text: "Me neither. Let’s swap numbers. Are you free for dinner next week? I know a great noodle place near the museum.",
            rating: "positive",
            feedback: "Turning “we should hang out” into a specific plan makes it real. A concrete suggestion is the kindest way to show you mean it.",
            reply: "Yes! Thursday works. Here, put your number in my phone."
          },
          {
            text: "Yeah, we should totally hang out sometime.",
            rating: "neutral",
            feedback: "Well meant, but vague plans often fade. Suggest a specific day or activity if you really want to see her.",
            reply: "We should! Let’s make it happen."
          },
          {
            text: "Ha, you know me. I’m not great at plans. If it happens, it happens.",
            rating: "negative",
            feedback: "She was clearly hoping to reconnect. A shrug can feel like a quiet rejection. If you’re interested, say so and suggest something.",
            reply: "Oh. Okay. Well, you know where to find me now."
          }
        ]
      },
      {
        say: "Oh, that’s my bus! I have to run. It was so good to see you!",
        options: [
          {
            text: "You too, Megan. Seriously, this made my week. Go, don’t miss it!",
            rating: "positive",
            feedback: "A warm close that respects her timing. Telling someone they made your day leaves a lasting good feeling.",
            reply: "It made mine too! Bye!"
          },
          {
            text: "Okay, see you.",
            rating: "neutral",
            feedback: "Fine, but a little flat after a happy reunion. One warm sentence would end things on a higher note.",
            reply: "Bye!"
          },
          {
            text: "Wait, one more thing! Do you still talk to Chris? Whatever happened with him?",
            rating: "negative",
            feedback: "She’s running for her bus. Opening a gossip topic now ignores her cue and puts her on the spot. Save it for another day.",
            reply: "Oh, um, that’s a long story. Another time, okay? I really have to go."
          }
        ]
      }
    ],
    takeaway: "When you reconnect, skip the guilt, share real updates, relive a shared memory, and turn “we should hang out” into a specific plan."
  },

  {
    id: "elevator-with-the-ceo",
    title: "Elevator with the CEO",
    category: "work",
    level: 3,
    scene: "office",
    partner: {
      name: "Diane",
      role: "Chief executive of your company",
      avatar: { skin: "deep", hair: "short", hairColor: "gray", outfit: "blazer", outfitColor: "black", glasses: true, voice: "f" }
    },
    goal: "Make a calm, genuine impression on a short elevator ride without gushing, pitching, or freezing up.",
    turns: [
      {
        say: "Morning. Which floor?",
        options: [
          {
            text: "Eleven, please. Thank you. I don’t think we’ve met yet. I’m on the customer insights team.",
            rating: "positive",
            feedback: "Calm, polite, and a brief introduction. Treating her like a person rather than a title is exactly right.",
            reply: "Nice to meet you. I’m Diane. I read your team’s report last week, actually."
          },
          {
            text: "Eleven, thanks.",
            rating: "neutral",
            feedback: "Perfectly polite, but you skipped a rare chance to introduce yourself. A one-line introduction is welcome, not pushy.",
            reply: "Sure thing."
          },
          {
            text: "Oh! Hi! Wow, you’re Diane Brooks. Um, eleven, please. Sorry, I’m just a huge fan. Big fan.",
            rating: "negative",
            feedback: "Nerves are normal, but gushing puts her on a pedestal and makes things awkward. Speak to her the way you would any colleague.",
            reply: "Ha, well, thank you. Eleven it is."
          }
        ]
      },
      {
        say: "So, how’s your week going so far?",
        options: [
          {
            text: "Busy, in a good way. We’re wrapping up the customer survey, and some of the comments are surprisingly useful. How’s yours going?",
            rating: "positive",
            feedback: "An honest, upbeat answer with one specific detail, then a simple question back. Treat the chief executive as a person, not an audience.",
            reply: "Lots of budget meetings, so I’m a little jealous. I love hearing what customers actually say."
          },
          {
            text: "Good, thanks.",
            rating: "neutral",
            feedback: "Safe, but forgettable. Leaders often ask because they want a window into the company. One real detail is valuable to her.",
            reply: "Glad to hear it."
          },
          {
            text: "Honestly? Rough. We’re understaffed, the new software keeps crashing, and nobody listens to us.",
            rating: "negative",
            feedback: "A stream of complaints in an elevator puts her on the spot with no context. If something matters, raise it calmly through the right channel.",
            reply: "I’m sorry to hear that. Those things matter. Make sure your manager has the details."
          }
        ]
      },
      {
        say: "How long have you been with us?",
        options: [
          {
            text: "Almost two years. I started in customer support, which taught me a lot about what people actually need. It’s still my favorite part of the job.",
            rating: "positive",
            feedback: "A short story that shows growth and what you care about is far more memorable than a title. And it was natural, not a pitch.",
            reply: "Support is the best training there is. I started out answering phones myself."
          },
          {
            text: "About two years.",
            rating: "neutral",
            feedback: "Accurate, but closed. Adding what you’ve learned or enjoyed would help her remember you.",
            reply: "Two years. Time flies."
          },
          {
            text: "Two years, and honestly, I’m more than ready for a promotion. Who actually decides that, by the way?",
            rating: "negative",
            feedback: "Angling for a promotion in an elevator chat feels transactional. Build the relationship first, and discuss your growth with your manager.",
            reply: "Your manager is the right person for that conversation."
          }
        ]
      },
      {
        say: "I take the elevator instead of hiding upstairs, because it’s where people tell me what’s really going on. What’s one thing you think we could do better?",
        options: [
          {
            text: "Customers keep telling us our help pages are hard to search. It seems like a small fix with a big payoff. I’d be happy to share examples.",
            rating: "positive",
            feedback: "Specific, constructive, and offered with a way to help. Candor framed around a solution is exactly what leaders hope to hear.",
            reply: "That’s useful. Send me three examples, and copy your manager. I mean it."
          },
          {
            text: "Oh, I think things are pretty good, really.",
            rating: "neutral",
            feedback: "Playing it safe is understandable, but she asked sincerely. A thoughtful, specific suggestion shows you care about the company.",
            reply: "Good to hear. If anything comes to mind, my door is open."
          },
          {
            text: "Since you asked, leadership seems pretty out of touch. Nobody on my floor knows what you all actually do.",
            rating: "negative",
            feedback: "Sweeping criticism of her team feels personal and gives her nothing to act on. Pick one specific issue and suggest a fix.",
            reply: "That’s worth hearing. But I’d need specifics to actually fix anything."
          }
        ]
      },
      {
        say: "Looks like this is your floor.",
        options: [
          {
            text: "It is. Thanks for asking, and for listening. Have a great rest of your day.",
            rating: "positive",
            feedback: "A short, gracious exit that thanks her for her interest. Ending cleanly matters as much as starting well.",
            reply: "You too. Good to meet you."
          },
          {
            text: "Yep. Bye.",
            rating: "neutral",
            feedback: "Fine, but abrupt. A brief thank you would end the ride on a confident, warm note.",
            reply: "Have a good one."
          },
          {
            text: "It is, but quickly, can I pitch you my idea for a new product line? It’s only five minutes.",
            rating: "negative",
            feedback: "Pitching as the doors open puts her in an impossible spot. Ask for a proper meeting instead, with a short written summary.",
            reply: "Send a short note to my assistant, and we’ll find time. Have a good day."
          }
        ]
      }
    ],
    takeaway: "With senior leaders, be human and brief: introduce yourself, share one specific detail, offer candid ideas with solutions, and exit gracefully."
  },

  {
    id: "quiet-coworker",
    title: "Talking with a quiet coworker",
    category: "work",
    level: 3,
    scene: "meeting",
    partner: {
      name: "Arjun",
      role: "Data analyst who joined your team last month",
      avatar: { skin: "brown", hair: "side-part", hairColor: "black", outfit: "shirt", outfitColor: "white", glasses: true, voice: "m" }
    },
    goal: "Help Arjun open up a little before the meeting starts, without pressuring him or filling every silence yourself.",
    turns: [
      {
        say: "Hi.",
        options: [
          {
            text: "Hey, Arjun. Looks like we’re the early birds. How are you settling in so far?",
            rating: "positive",
            feedback: "A calm greeting with his name, a little warmth, and an easy question. Quieter people often appreciate a gentle, low-stakes start.",
            reply: "Pretty well."
          },
          {
            text: "Hi.",
            rating: "neutral",
            feedback: "Mirroring is polite, but someone has to offer a little more. Since he’s new, a friendly question helps him feel included.",
            reply: "Hey."
          },
          {
            text: "Wow, a man of few words, huh? Don’t worry, I’ll talk enough for both of us.",
            rating: "negative",
            feedback: "Pointing out someone’s quietness can make them self-conscious. Accept his style and give him easy openings instead.",
            reply: "Oh. Ha. Okay."
          }
        ]
      },
      {
        say: "Is this meeting usually long?",
        options: [
          {
            text: "Usually about thirty minutes. Maria keeps it moving. The first ten minutes are updates, then we brainstorm. Have you been to one of those yet?",
            rating: "positive",
            feedback: "He asked a practical question, so you gave a helpful answer and a simple follow-up that’s easy for him to answer.",
            reply: "Not yet. I’m a little nervous about it, honestly."
          },
          {
            text: "Depends on the day.",
            rating: "neutral",
            feedback: "True, but unhelpful for a newcomer. A few concrete details would ease his nerves and show you’re glad he asked.",
            reply: "Okay."
          },
          {
            text: "Ugh, way too long. Half of these meetings could be an email. You’ll see.",
            rating: "negative",
            feedback: "Complaining to a new teammate shapes his view of the team before he’s formed his own. Help him settle in, not get cynical.",
            reply: "Oh. Okay."
          }
        ]
      },
      {
        say: "I’m not great at speaking up in big meetings. I usually think of what to say after it’s over.",
        options: [
          {
            text: "That’s really common, and those after-the-meeting ideas are often the best ones. Maria loves it when people send thoughts afterward. Would that work better for you?",
            rating: "positive",
            feedback: "You normalized his experience and offered a practical option that fits his style, instead of telling him to be louder.",
            reply: "Yeah. That would actually help. Thanks."
          },
          {
            text: "You’ll get used to it.",
            rating: "neutral",
            feedback: "Reassuring, but it brushes past what he shared. Acknowledge it, and offer something useful.",
            reply: "I hope so."
          },
          {
            text: "You just have to push through it. Speak up, be confident. Fake it till you make it, you know?",
            rating: "negative",
            feedback: "Generic advice to “be confident” can feel dismissive. Respect different working styles and look for practical ways to include them.",
            reply: "Sure. I’ll try."
          }
        ]
      },
      {
        say: "Is that sticker on your laptop from the Smoky Mountains?",
        options: [
          {
            text: "Good eye! I hiked there last fall. Do you hike? I’d love to hear about your favorite trail.",
            rating: "positive",
            feedback: "He started a topic, which is a big step for a quiet person. You rewarded it with enthusiasm and an invitation to share.",
            reply: "I do. Mostly alone, early mornings. There’s a waterfall trail an hour north. It’s my favorite place, actually."
          },
          {
            text: "Yeah, it is.",
            rating: "neutral",
            feedback: "He worked up to a question. A short answer leaves him to carry it alone. Return the effort with a detail and a question.",
            reply: "Cool."
          },
          {
            text: "Yes! Oh, that trip was wild. We started at five in the morning, my buddy forgot the water, then it rained for six hours, then we got lost.",
            rating: "negative",
            feedback: "He finally opened a topic, and you took it over with a long story. Share a little, then ask about his experience.",
            reply: "Ha. Sounds like quite a trip."
          }
        ]
      },
      {
        say: "Looks like people are coming in. Thanks for, um, talking. I don’t know many people here yet.",
        options: [
          {
            text: "Anytime, I enjoyed it. Want to grab lunch this week? No big group, just a sandwich and a break.",
            rating: "positive",
            feedback: "A small, specific, low-pressure invitation is perfect for someone quieter. You made it easy to say yes.",
            reply: "Yeah. I’d like that. Thursday?"
          },
          {
            text: "No problem.",
            rating: "neutral",
            feedback: "Kind, but he just shared that he feels a bit isolated. A small follow-up offer would go a long way.",
            reply: "Okay. See you after."
          },
          {
            text: "Ha, see, you can talk after all! I knew you had it in you.",
            rating: "negative",
            feedback: "It’s meant warmly, but highlighting his quietness again can feel patronizing. Thank him and build on the connection instead.",
            reply: "Ha. Yeah. I guess."
          }
        ]
      }
    ],
    takeaway: "With quiet people, give easy openings, welcome short answers without judgment, reward the topics they start, and offer small, low-pressure invitations."
  }
];
