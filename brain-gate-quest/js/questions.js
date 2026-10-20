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
      hint: 'Ships crossing from New York to London sail across it.', fact: 'The Atlantic is the second-largest ocean on Earth.' },
    { cat: 'Science', q: 'Bees make honey from a sweet liquid in flowers called…', a: 'Nectar', w: ['Sap', 'Dew', 'Syrup'],
      hint: 'It starts with the letter N.', fact: 'A honeybee may visit 50 to 100 flowers on a single trip.' },
    { cat: 'Science', q: 'What is the largest organ of the human body?', a: 'Skin', w: ['Heart', 'Liver', 'Brain'],
      hint: 'It covers you from head to toe.', fact: 'Your skin is always renewing itself and sheds millions of tiny skin cells every day.' },
    { cat: 'Science', q: 'Which planet is famous for its beautiful rings?', a: 'Saturn', w: ['Mars', 'Mercury', 'Venus'],
      hint: 'It is the sixth planet from the Sun.', fact: 'Saturn\'s rings are made of billions of chunks of ice and rock.' },
    { cat: 'Science', q: 'What do we call a scientist who studies rocks?', a: 'Geologist', w: ['Biologist', 'Astronomer', 'Zoologist'],
      hint: '"Geo" means Earth.', fact: 'Geologists can learn how old rocks are by studying their layers.' },
    { cat: 'Science', q: 'Which gas makes up most of the air we breathe?', a: 'Nitrogen', w: ['Oxygen', 'Carbon dioxide', 'Helium'],
      hint: 'Surprise — it is not oxygen! It starts with N.', fact: 'Air is about 78% nitrogen and only about 21% oxygen.' },
    { cat: 'Science', q: 'What causes day and night on Earth?', a: 'Earth spinning', w: ['The Sun moving around Earth', 'The Moon covering the Sun', 'Clouds blocking sunlight'],
      hint: 'Earth turns all the way around once every day.', fact: 'Earth spins around once about every 24 hours.' },
    { cat: 'Science', q: 'Which state of matter keeps its own shape?', a: 'Solid', w: ['Liquid', 'Gas', 'Steam'],
      hint: 'Think of an ice cube.', fact: 'Liquids take the shape of their container, and gases spread out to fill any space.' },
    { cat: 'Science', q: 'Which is the hottest planet in our solar system?', a: 'Venus', w: ['Mercury', 'Mars', 'Jupiter'],
      hint: 'Surprise — it is not the closest planet to the Sun!', fact: 'Venus\'s thick clouds trap heat, making it even hotter than Mercury.' },
    { cat: 'Science', q: 'Which part of your body has an iris and a pupil?', a: 'Eye', w: ['Ear', 'Nose', 'Tongue'],
      hint: 'You use it to see.', fact: 'Your pupils get bigger in the dark to let in more light.' },
    { cat: 'Science', q: 'What force makes rubbing your hands together feel warm?', a: 'Friction', w: ['Gravity', 'Magnetism', 'Electricity'],
      hint: 'It happens when two surfaces rub against each other.', fact: 'Friction also helps your shoes grip the ground so you don\'t slip.' },
    { cat: 'Science', q: 'How many colors are in a rainbow?', a: '7', w: ['5', '6', '10'],
      hint: 'Remember ROY G BIV — count the letters.', fact: 'ROY G BIV: red, orange, yellow, green, blue, indigo, violet.' },
    { cat: 'Science', q: 'What does a thermometer measure?', a: 'Temperature', w: ['Weight', 'Speed', 'Time'],
      hint: 'It tells you how hot or cold something is.', fact: 'Thermometers can measure in degrees Celsius or degrees Fahrenheit.' },
    { cat: 'Science', q: 'Where does the Moon\'s light really come from?', a: 'Reflected sunlight', w: ['Fire on the Moon', 'Glowing Moon rocks', 'Lightning'],
      hint: 'The Moon does not make its own light.', fact: 'Moonlight takes only about 1.3 seconds to reach Earth.' },
    { cat: 'Science', q: 'What is the name of the galaxy we live in?', a: 'The Milky Way', w: ['Andromeda', 'The Big Dipper', 'The Sombrero'],
      hint: 'It shares its name with a chocolate bar!', fact: 'The Milky Way has more than 100 billion stars.' },
    { cat: 'Science', q: 'Magnets pull on objects made of which material?', a: 'Iron', w: ['Wood', 'Plastic', 'Glass'],
      hint: 'Paper clips and nails are made of it.', fact: 'Earth acts like a giant magnet — that is why a compass points north.' },
    { cat: 'Science', q: 'Snowflakes are made of tiny crystals of…', a: 'Ice', w: ['Salt', 'Sugar', 'Sand'],
      hint: 'It is frozen water.', fact: 'Most snowflakes have six sides or six points.' },
    { cat: 'Animals', q: 'What is a baby kangaroo called?', a: 'Joey', w: ['Cub', 'Kit', 'Calf'],
      hint: 'It rides in its mother\'s pouch.', fact: 'A newborn joey is only about the size of a jellybean!' },
    { cat: 'Animals', q: 'Which lizard can change its skin color?', a: 'Chameleon', w: ['Gecko', 'Komodo dragon', 'Iguana'],
      hint: 'It has eyes that can look in two directions at once.', fact: 'Chameleons change color to show their mood and to warm up or cool down.' },
    { cat: 'Animals', q: 'How many hearts does an octopus have?', a: '3', w: ['1', '2', '8'],
      hint: 'More than two, but fewer than four.', fact: 'An octopus has three hearts and blue blood!' },
    { cat: 'Animals', q: 'Which bird cannot fly but is an amazing swimmer?', a: 'Penguin', w: ['Eagle', 'Parrot', 'Owl'],
      hint: 'It looks like it is wearing a tuxedo.', fact: 'Emperor penguins can dive more than 500 meters deep.' },
    { cat: 'Animals', q: 'What is the largest animal that lives on land?', a: 'African elephant', w: ['Giraffe', 'Hippopotamus', 'Rhinoceros'],
      hint: 'It has huge ears and a trunk.', fact: 'An African elephant can weigh about 6,000 kilograms (13,000 pounds).' },
    { cat: 'Animals', q: 'What is the tallest animal in the world?', a: 'Giraffe', w: ['Elephant', 'Camel', 'Ostrich'],
      hint: 'It has a very long neck.', fact: 'A giraffe\'s neck has just seven bones — the same number as yours!' },
    { cat: 'Animals', q: 'What is the largest bird in the world?', a: 'Ostrich', w: ['Bald eagle', 'Penguin', 'Pelican'],
      hint: 'It cannot fly, but it runs very fast.', fact: 'Ostriches lay the biggest eggs of any living bird.' },
    { cat: 'Animals', q: 'What do giant pandas mostly eat?', a: 'Bamboo', w: ['Fish', 'Berries', 'Insects'],
      hint: 'It is a tall, woody plant.', fact: 'A giant panda can spend 10 to 16 hours a day eating bamboo.' },
    { cat: 'Animals', q: 'Bats are the only mammals that can truly…', a: 'Fly', w: ['Swim', 'Glow', 'Hop'],
      hint: 'They have wings.', fact: 'Many bats find food in the dark using echoes — that is called echolocation.' },
    { cat: 'Animals', q: 'A group of lions is called a…', a: 'Pride', w: ['Pack', 'Herd', 'Flock'],
      hint: 'It is also a word for feeling proud.', fact: 'In a pride, the lionesses do most of the hunting.' },
    { cat: 'Animals', q: 'Animals that are awake at night and sleep in the day are called…', a: 'Nocturnal', w: ['Hibernating', 'Migrating', 'Domestic'],
      hint: 'The word comes from the Latin word for "night."', fact: 'Owls, bats and raccoons are all nocturnal.' },
    { cat: 'Geography', q: 'What is the capital city of France?', a: 'Paris', w: ['London', 'Rome', 'Madrid'],
      hint: 'The Eiffel Tower is there.', fact: 'The Eiffel Tower is about 330 meters (1,083 feet) tall.' },
    { cat: 'Geography', q: 'Which country is shaped like a boot?', a: 'Italy', w: ['Spain', 'France', 'Greece'],
      hint: 'Pizza and pasta are famous foods from there.', fact: 'Italy\'s capital, Rome, is more than 2,700 years old.' },
    { cat: 'Geography', q: 'In which country is the city of Tokyo?', a: 'Japan', w: ['China', 'South Korea', 'Thailand'],
      hint: 'It is an island country in Asia.', fact: 'Japan is made up of thousands of islands.' },
    { cat: 'Geography', q: 'Which is the largest country in the world by area?', a: 'Russia', w: ['Canada', 'China', 'United States'],
      hint: 'It stretches across Europe and Asia.', fact: 'Russia is so wide that it has 11 time zones!' },
    { cat: 'Geography', q: 'Most of the Amazon rainforest is in which country?', a: 'Brazil', w: ['Mexico', 'Egypt', 'India'],
      hint: 'It is the biggest country in South America.', fact: 'The Amazon is home to millions of kinds of plants, insects and animals.' },
    { cat: 'Geography', q: 'Which U.S. state is made up entirely of islands?', a: 'Hawaii', w: ['Florida', 'Alaska', 'Maine'],
      hint: 'It is in the middle of the Pacific Ocean.', fact: 'Hawaii\'s islands were made by volcanoes.' },
    { cat: 'Geography', q: 'What is the capital city of the United Kingdom?', a: 'London', w: ['Paris', 'Dublin', 'Edinburgh'],
      hint: 'Big Ben and Buckingham Palace are there.', fact: '"Big Ben" is actually the name of the giant bell inside the clock tower.' },
    { cat: 'Geography', q: 'What imaginary line circles the middle of the Earth?', a: 'The Equator', w: ['The Prime Meridian', 'The Arctic Circle', 'The Horizon'],
      hint: 'It is halfway between the North Pole and the South Pole.', fact: 'Places near the equator get strong sunshine all year round.' },
    { cat: 'Geography', q: 'On which continent is Egypt?', a: 'Africa', w: ['Asia', 'Europe', 'South America'],
      hint: 'The Sahara Desert is on the same continent.', fact: 'Egypt is in the northeast corner of Africa.' },
    { cat: 'Geography', q: 'What is the capital city of Canada?', a: 'Ottawa', w: ['Toronto', 'Vancouver', 'Montreal'],
      hint: 'It is not the biggest city — it starts with O.', fact: 'Canada has the longest coastline of any country in the world.' },
    { cat: 'Geography', q: 'Which river carved the Grand Canyon?', a: 'Colorado River', w: ['Mississippi River', 'Nile River', 'Hudson River'],
      hint: 'It shares its name with a U.S. state.', fact: 'The river carved the canyon slowly over millions of years.' },
    { cat: 'Geography', q: 'How many states are in the United States?', a: '50', w: ['48', '52', '13'],
      hint: 'Count the stars on the U.S. flag.', fact: 'Alaska is the biggest state and Rhode Island is the smallest.' },
    { cat: 'Geography', q: 'Which is the smallest continent?', a: 'Australia', w: ['Europe', 'Antarctica', 'South America'],
      hint: 'Kangaroos live there.', fact: 'Australia is both a country and a continent!' },
    { cat: 'History', q: 'Ancient Egyptians wrote using picture symbols called…', a: 'Hieroglyphs', w: ['Emojis', 'Cursive', 'Morse code'],
      hint: 'You can see them carved on temple walls.', fact: 'Egyptian hieroglyphs used more than 700 different symbols.' },
    { cat: 'History', q: 'Who was the first person to walk on the Moon?', a: 'Neil Armstrong', w: ['Buzz Aldrin', 'John Glenn', 'Yuri Gagarin'],
      hint: 'His last name has the word "arm" in it.', fact: 'Neil Armstrong stepped onto the Moon on July 20, 1969.' },
    { cat: 'History', q: 'Which famous ship sank in 1912 after hitting an iceberg?', a: 'Titanic', w: ['Mayflower', 'Santa Maria', 'Queen Mary'],
      hint: 'Its name means "giant."', fact: 'The Titanic was the largest ship in the world when it set sail.' },
    { cat: 'History', q: 'In what year did the Pilgrims sail to America on the Mayflower?', a: '1620', w: ['1492', '1776', '1812'],
      hint: 'It was in the 1600s.', fact: 'The Pilgrims landed at Plymouth, in what is now Massachusetts.' },
    { cat: 'History', q: 'In what year did the United States declare independence?', a: '1776', w: ['1492', '1620', '1865'],
      hint: 'It is celebrated every Fourth of July.', fact: 'The Declaration of Independence was adopted on July 4, 1776.' },
    { cat: 'History', q: 'Who invented the telephone?', a: 'Alexander Graham Bell', w: ['Thomas Edison', 'Benjamin Franklin', 'The Wright brothers'],
      hint: 'His last name sounds like something that rings!', fact: 'Bell\'s first words on the phone were "Mr. Watson, come here — I want to see you."' },
    { cat: 'History', q: 'Who built the Colosseum?', a: 'The ancient Romans', w: ['The ancient Egyptians', 'The Vikings', 'The Aztecs'],
      hint: 'The Colosseum is in the city of Rome.', fact: 'The Colosseum could hold about 50,000 people.' },
    { cat: 'History', q: 'Who painted the Mona Lisa?', a: 'Leonardo da Vinci', w: ['Pablo Picasso', 'Vincent van Gogh', 'Claude Monet'],
      hint: 'He was also an inventor from Italy.', fact: 'The Mona Lisa hangs in the Louvre museum in Paris.' },
    { cat: 'History', q: 'What did knights wear to protect themselves in battle?', a: 'Armor', w: ['Capes', 'Robes', 'Togas'],
      hint: 'It was made of metal.', fact: 'A full suit of armor could weigh about 20 to 25 kilograms.' },
    { cat: 'History', q: 'Which scientist described the law of gravity after, the story says, watching an apple fall?', a: 'Isaac Newton', w: ['Albert Einstein', 'Galileo Galilei', 'Marie Curie'],
      hint: 'His first name is Isaac.', fact: 'Newton also showed that white light is made of all the colors of the rainbow.' },
    { cat: 'History', q: 'Benjamin Franklin flew a kite in a storm to learn about…', a: 'Electricity', w: ['Wind', 'Rain', 'Magnets'],
      hint: 'Lightning is a giant spark of it.', fact: 'Franklin also invented the lightning rod and bifocal glasses.' }
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

  /**
   * Multiplication difficulty grows with the level number:
   *   levels 1-5   single-digit facts (2-9 × 2-9)
   *   levels 6-10  single digits, plus 10-12 × a single digit
   *   levels 11-15 harder single digits (6-9), plus 11-15 × a single digit
   *   levels 16-20 harder single digits, plus 12-25 × a single digit
   */
  function pickFactors(levelIndex) {
    const tier = Math.min(3, Math.floor((levelIndex || 0) / 5));
    const roll = Math.random();
    if (tier === 0) return [BGQ.randInt(2, 9), BGQ.randInt(2, 9)];
    if (tier === 1) return roll < 0.5 ? [BGQ.randInt(3, 9), BGQ.randInt(3, 9)] : [BGQ.randInt(10, 12), BGQ.randInt(2, 9)];
    if (tier === 2) return roll < 0.4 ? [BGQ.randInt(6, 9), BGQ.randInt(6, 9)] : [BGQ.randInt(11, 15), BGQ.randInt(3, 9)];
    return roll < 0.3 ? [BGQ.randInt(6, 9), BGQ.randInt(6, 9)] : [BGQ.randInt(12, 25), BGQ.randInt(3, 9)];
  }

  function mathHint(a, b) {
    if (a < 10) {
      return 'Start from ' + a + ' × ' + (b - 1) + ' = ' + (a * (b - 1)) + ', then add one more ' + a + '.';
    }
    const tens = Math.floor(a / 10) * 10;
    const ones = a - tens;
    if (ones === 0) {
      return 'Work out ' + (tens / 10) + ' × ' + b + ' = ' + ((tens / 10) * b) + ', then put a zero on the end!';
    }
    return 'Break it apart: ' + tens + ' × ' + b + ' = ' + (tens * b) + ' and ' + ones + ' × ' + b + ' = ' + (ones * b) + '. Now add them together!';
  }

  function makeMath(levelIndex) {
    let a, b, key;
    // Avoid repeating the exact same fact twice in a row.
    do {
      const f = pickFactors(levelIndex);
      a = f[0];
      b = f[1];
      key = a + 'x' + b;
    } while (key === lastMath);
    lastMath = key;

    const answer = a * b;
    const choices = BGQ.shuffle([answer].concat(mathDistractors(a, b)));
    return {
      type: 'math',
      category: 'Multiplication',
      prompt: 'What is ' + a + ' × ' + b + '?',
      choices: choices.map(String),
      correct: choices.indexOf(answer),
      hint: mathHint(a, b),
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
    make: function (type, levelIndex) {
      return type === 'math' ? makeMath(levelIndex) : makeKnowledge();
    },
    /** Exposed for automated checks of the question bank. */
    bank: KNOWLEDGE
  };
})();
