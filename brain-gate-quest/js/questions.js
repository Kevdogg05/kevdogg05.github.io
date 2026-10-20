/**
 * Brain Gate Quest — question generator for the Brain Gates.
 *
 * Two kinds of challenges, pitched at 4th/5th grade (ages 9–10):
 *   - "math": multiplication facts, single-digit (7 × 8) or a
 *     double-digit number times a single digit (12 × 6).
 *   - "knowledge": general knowledge from science, geography,
 *     history and animals, each with a fun fact shown on success.
 *
 * Every question has exactly four choices, a gentle hint for retries,
 * and a short "did you know" message for when it is answered correctly.
 */
(function () {
  'use strict';

  const BGQ = window.BGQ;

  /* ------------------------------------------------------------------ *
   * General knowledge bank. `a` is the correct answer; `w` holds three
   * believable wrong answers. Choices are shuffled every time.
   * ------------------------------------------------------------------ */
  const KNOWLEDGE = [
    { cat: 'Science', q: 'Which planet is known as the Red Planet?', a: 'Mars', w: ['Venus', 'Jupiter', 'Saturn'],
      hint: 'It is the fourth planet from the Sun.', fact: 'Mars looks red because its dusty ground is full of iron oxide — rust!' },
    { cat: 'Geography', q: 'What is the largest ocean on Earth?', a: 'Pacific Ocean', w: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'],
      hint: 'Its name means "peaceful."', fact: 'The Pacific Ocean is bigger than all of Earth\'s land put together!' },
    { cat: 'Geography', q: 'How many continents are there on Earth?', a: '7', w: ['5', '6', '8'],
      hint: 'Count them: Africa, Antarctica, Asia, Australia, Europe, North America, South America.', fact: 'Asia is the biggest continent, and Australia is the smallest.' },
    { cat: 'Science', q: 'What gas do plants take in from the air to make their food?', a: 'Carbon dioxide', w: ['Oxygen', 'Helium', 'Hydrogen'],
      hint: 'It is the gas we breathe out.', fact: 'Plants use sunlight, water and carbon dioxide to make sugar, and they give off oxygen.' },
    { cat: 'Animals', q: 'What is the largest animal that has ever lived?', a: 'Blue whale', w: ['African elephant', 'Giraffe', 'Great white shark'],
      hint: 'It lives in the ocean and is a mammal.', fact: 'A blue whale\'s heart is about the size of a small car!' },
    { cat: 'Animals', q: 'How many legs does a spider have?', a: '8', w: ['6', '10', '4'],
      hint: 'Insects have 6 legs, but spiders have more.', fact: 'Spiders are arachnids, not insects. Insects have 6 legs.' },
    { cat: 'History', q: 'Who was the first President of the United States?', a: 'George Washington', w: ['Abraham Lincoln', 'Thomas Jefferson', 'John Adams'],
      hint: 'His face is on the one-dollar bill.', fact: 'George Washington became the first President in 1789.' },
    { cat: 'Geography', q: 'What is the longest river in Africa?', a: 'Nile River', w: ['Amazon River', 'Congo River', 'Mississippi River'],
      hint: 'It flows north through Egypt.', fact: 'The Nile flows through 11 countries before reaching the Mediterranean Sea.' },
    { cat: 'Science', q: 'Which part of a plant soaks up water from the soil?', a: 'Roots', w: ['Leaves', 'Flowers', 'Seeds'],
      hint: 'This part grows underground.', fact: 'Roots also hold the plant firmly in the ground so wind can\'t blow it away.' },
    { cat: 'Science', q: 'Which planet is the largest in our solar system?', a: 'Jupiter', w: ['Saturn', 'Earth', 'Neptune'],
      hint: 'It has a giant storm called the Great Red Spot.', fact: 'More than 1,000 Earths could fit inside Jupiter!' },
    { cat: 'Science', q: 'Water can be a solid, a liquid, or a…', a: 'Gas', w: ['Rock', 'Metal', 'Light'],
      hint: 'Think about the steam from a hot pot.', fact: 'Ice is solid water, and steam is water as a gas called water vapor.' },
    { cat: 'Science', q: 'What force pulls objects down toward the ground?', a: 'Gravity', w: ['Magnetism', 'Friction', 'Electricity'],
      hint: 'It keeps your feet on the ground — and makes Pip fall!', fact: 'Gravity on the Moon is about one-sixth as strong as on Earth.' },
    { cat: 'Science', q: 'About how many days does it take Earth to travel around the Sun?', a: '365 days', w: ['30 days', '100 days', '24 days'],
      hint: 'It is the same as one year.', fact: 'Every 4 years we add one extra day, February 29, to keep the calendar on track.' },
    { cat: 'Geography', q: 'Which continent is the coldest?', a: 'Antarctica', w: ['Europe', 'Asia', 'North America'],
      hint: 'It is at the South Pole.', fact: 'Antarctica is covered in ice that is, on average, more than a mile thick.' },
    { cat: 'Animals', q: 'Which of these animals is a mammal?', a: 'Dolphin', w: ['Shark', 'Octopus', 'Salmon'],
      hint: 'Mammals breathe air and feed their babies milk.', fact: 'Dolphins breathe air through a blowhole on top of their heads.' },
    { cat: 'Science', q: 'Which organ pumps blood all around your body?', a: 'Heart', w: ['Lungs', 'Brain', 'Stomach'],
      hint: 'You can feel it beating in your chest.', fact: 'Your heart beats about 100,000 times every single day!' },
    { cat: 'History', q: 'Which country built the Great Wall?', a: 'China', w: ['Japan', 'India', 'Egypt'],
      hint: 'It is the country with the most people in Asia.', fact: 'The Great Wall was built and rebuilt over about 2,000 years.' },
    { cat: 'History', q: 'In which country are the ancient Pyramids of Giza?', a: 'Egypt', w: ['Mexico', 'Greece', 'Peru'],
      hint: 'The Nile River flows through this country.', fact: 'The Great Pyramid was the tallest building in the world for almost 4,000 years.' },
    { cat: 'Science', q: 'Which tool helps scientists see tiny things like cells?', a: 'Microscope', w: ['Telescope', 'Thermometer', 'Compass'],
      hint: 'The word "micro" means very small.', fact: 'A telescope is for things far away; a microscope is for things very small.' },
    { cat: 'Science', q: 'At what temperature does water boil, in degrees Celsius?', a: '100 °C', w: ['50 °C', '0 °C', '212 °C'],
      hint: 'Water freezes at 0 °C. It boils at a nice round number.', fact: 'In Fahrenheit, water boils at 212 °F and freezes at 32 °F.' },
    { cat: 'Science', q: 'Which of these is a renewable energy source?', a: 'Sunlight', w: ['Coal', 'Oil', 'Natural gas'],
      hint: 'It shines on us every day and will not run out.', fact: 'Solar panels turn sunlight straight into electricity.' },
    { cat: 'Animals', q: 'A frog is what kind of animal?', a: 'Amphibian', w: ['Reptile', 'Mammal', 'Fish'],
      hint: 'These animals live part of their lives in water and part on land.', fact: 'Frogs start life as tadpoles that breathe with gills like fish.' },
    { cat: 'Science', q: 'Which planet is closest to the Sun?', a: 'Mercury', w: ['Venus', 'Earth', 'Mars'],
      hint: 'It is also the smallest planet.', fact: 'A year on Mercury lasts only 88 Earth days.' },
    { cat: 'Geography', q: 'What is the largest hot desert in the world?', a: 'Sahara Desert', w: ['Gobi Desert', 'Mojave Desert', 'Kalahari Desert'],
      hint: 'It covers much of North Africa.', fact: 'The Sahara is almost as big as the whole United States!' },
    { cat: 'Animals', q: 'What do we call an animal that eats only plants?', a: 'Herbivore', w: ['Carnivore', 'Omnivore', 'Predator'],
      hint: '"Herb" is another word for a plant.', fact: 'Cows, rabbits and elephants are all herbivores.' },
    { cat: 'Science', q: 'How many bones are in an adult human body?', a: '206', w: ['106', '306', '150'],
      hint: 'It is a little more than 200.', fact: 'Babies are born with about 300 bones — some join together as they grow.' },
    { cat: 'Geography', q: 'What is the tallest mountain on Earth above sea level?', a: 'Mount Everest', w: ['K2', 'Mount Kilimanjaro', 'Denali'],
      hint: 'It is in the Himalaya mountains in Asia.', fact: 'Mount Everest is about 8,849 meters (29,032 feet) tall.' },
    { cat: 'History', q: 'The Wright brothers were the first to fly a powered…', a: 'Airplane', w: ['Hot-air balloon', 'Rocket', 'Helicopter'],
      hint: 'It has wings and an engine.', fact: 'Their first flight in 1903 lasted just 12 seconds!' },
    { cat: 'Animals', q: 'What do caterpillars turn into?', a: 'Butterflies', w: ['Bees', 'Beetles', 'Spiders'],
      hint: 'They wrap up in a chrysalis first.', fact: 'This amazing change is called metamorphosis.' },
    { cat: 'Science', q: 'What is the closest star to Earth?', a: 'The Sun', w: ['The North Star', 'Sirius', 'The Moon'],
      hint: 'You can see it during the day.', fact: 'Sunlight takes about 8 minutes to travel from the Sun to Earth.' },
    { cat: 'Animals', q: 'Which animal is the fastest runner on land?', a: 'Cheetah', w: ['Lion', 'Horse', 'Greyhound'],
      hint: 'It is a spotted big cat.', fact: 'A cheetah can sprint about 100 km/h (60 mph) in short bursts.' },
    { cat: 'Geography', q: 'Which ocean lies between North America and Europe?', a: 'Atlantic Ocean', w: ['Pacific Ocean', 'Indian Ocean', 'Southern Ocean'],
      hint: 'Ships crossing from New York to London sail across it.', fact: 'The Atlantic is the second-largest ocean on Earth.' }
  ];

  let unusedKnowledge = [];
  let lastMath = '';

  /** Picks up to three distinct, positive wrong answers near the real one. */
  function mathDistractors(a, b) {
    const answer = a * b;
    const candidates = [
      a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b,
      answer + 10, answer - 10, answer + 2, answer - 2, answer + 1
    ];
    // A swapped-digits mistake (e.g. 54 vs 45) is a classic slip worth testing.
    if (answer >= 10 && answer < 100 && answer % 10 !== 0) {
      const swapped = (answer % 10) * 10 + Math.floor(answer / 10);
      if (swapped !== answer) candidates.push(swapped);
    }

    const picked = [];
    BGQ.shuffle(candidates).forEach(function (n) {
      if (picked.length < 3 && n > 0 && n !== answer && picked.indexOf(n) === -1) picked.push(n);
    });
    return picked;
  }

  function makeMath() {
    let a, b, key;
    // Avoid repeating the exact same fact twice in a row.
    do {
      if (Math.random() < 0.5) {
        a = BGQ.randInt(3, 9);   // single-digit facts, e.g. 7 × 8
        b = BGQ.randInt(3, 9);
      } else {
        a = BGQ.randInt(11, 15); // double-digit × single-digit, e.g. 12 × 6
        b = BGQ.randInt(3, 9);
      }
      key = a + 'x' + b;
    } while (key === lastMath);
    lastMath = key;

    const answer = a * b;
    let hint;
    if (a >= 10) {
      const ones = a - 10;
      hint = 'Break it apart: 10 × ' + b + ' = ' + (10 * b) + ' and ' + ones + ' × ' + b + ' = ' + (ones * b) + '. Now add them together!';
    } else {
      hint = 'Start from ' + a + ' × ' + (b - 1) + ' = ' + (a * (b - 1)) + ', then add one more ' + a + '.';
    }

    const choices = BGQ.shuffle([answer].concat(mathDistractors(a, b)));
    return {
      type: 'math',
      category: 'Multiplication',
      prompt: 'What is ' + a + ' × ' + b + '?',
      choices: choices.map(String),
      correct: choices.indexOf(answer),
      hint: hint,
      fact: a + ' × ' + b + ' = ' + answer + '. Flip it around and ' + b + ' × ' + a + ' = ' + answer + ' too!'
    };
  }

  function makeKnowledge() {
    if (unusedKnowledge.length === 0) unusedKnowledge = BGQ.shuffle(KNOWLEDGE);
    const item = unusedKnowledge.pop();
    const choices = BGQ.shuffle([item.a].concat(item.w));
    return {
      type: 'knowledge',
      category: item.cat,
      prompt: item.q,
      choices: choices,
      correct: choices.indexOf(item.a),
      hint: item.hint,
      fact: item.fact
    };
  }

  BGQ.Questions = {
    /** Creates a fresh question of the requested type ('math' | 'knowledge'). */
    make: function (type) {
      return type === 'math' ? makeMath() : makeKnowledge();
    },
    /** Exposed for automated checks of the question bank. */
    bank: KNOWLEDGE
  };
})();
