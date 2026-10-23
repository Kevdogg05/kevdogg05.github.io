// Site content: gallery, weekly classes, remote events, videos and products.
// Edit freely — every section renders from these lists.

export const GALLERY = [
  { src: 'img/dancer-feathers.jpg', w: 768, h: 960, title: 'Feathers up', caption: 'Red, blue and royal on the road.', alt: 'Masquerader in a towering red and blue feathered headpiece and jewelled costume, mid-dance', size: 'tall' },
  { src: 'img/blue-devil.jpg', w: 880, h: 1100, title: 'Blue devil energy', caption: "J'ouvert paint, no apologies.", alt: 'Masquerader covered in blue body paint with horns, blowing a red kiss', size: '' },
  { src: 'img/light-trails.jpg', w: 791, h: 1400, title: 'After-dark fete', caption: 'Sweat sessions that feel like a party.', alt: 'Streaks of crimson and electric blue light at night', size: 'tall' },
  { src: 'img/blue-plumes.jpg', w: 880, h: 1100, title: 'Plumes & beads', caption: 'Built to move in every costume.', alt: 'Close-up of royal blue ostrich plumes and beaded sequin costume', size: '' },
  { src: 'img/eye.jpg', w: 880, h: 1100, title: 'Eyes on the crown', caption: 'Focus. Fire. Finish.', alt: 'Painted eye in electric blue with crimson lashes and a red tear', size: '' },
  { src: 'img/palms-crimson.jpg', w: 1199, h: 899, title: 'Island heat', caption: 'Palms on fire over a midnight sea.', alt: 'Palm fronds glowing crimson above a deep blue sea', size: 'wide' },
  { src: 'img/crimson-tide.jpg', w: 787, h: 1400, title: 'Midnight tide', caption: 'Recovery is part of the rhythm.', alt: 'Waves washing onto a dark shore in crimson and violet tones', size: '' },
];

// Weekly live classes. day: 0 = Sunday … 6 = Saturday; time is 24h in CONFIG.timezone.
export const CLASSES = [
  { id: 'soca-sweat', title: 'Soca Sweat HIIT', day: 1, time: '19:00', minutes: 45, platform: 'zoom', level: 'All levels', blurb: 'Intervals timed to the drop. Bring water and a towel.' },
  { id: 'wine-core', title: 'Lunch Break Wine & Core', day: 2, time: '12:15', minutes: 30, platform: 'ig', level: 'All levels', blurb: 'Thirty minutes of waistline work on your lunch break.' },
  { id: 'road-march', title: 'Road March Cardio', day: 3, time: '19:30', minutes: 60, platform: 'zoom', level: 'Intermediate', blurb: 'Chip, jump and wave — stamina for the full parade route.' },
  { id: 'choreo-lab', title: 'Choreo Lab: Feather Flow', day: 4, time: '20:00', minutes: 45, platform: 'ig', level: 'Beginner friendly', blurb: 'Learn this week’s routine count by count.' },
  { id: 'fete-bootcamp', title: 'Saturday Fete Bootcamp', day: 6, time: '10:00', minutes: 60, platform: 'zoom', level: 'Advanced', blurb: 'Strength circuits and soca sprints. Our biggest class.' },
  { id: 'queen-stretch', title: "Queen's Stretch & Recovery", day: 0, time: '17:00', minutes: 30, platform: 'ig', level: 'All levels', blurb: 'Mobility and deep stretch to reset for the week.' },
];

// One-off interactive events. date is local to CONFIG.timezone.
export const EVENTS = [
  { id: 'jouvert-jam', title: "Virtual J'ouvert Jam", date: '2026-11-14T10:00', platform: 'zoom', blurb: 'Paint up at home and dance with queens worldwide.' },
  { id: 'fete-challenge', title: '30-Day Fete Ready Challenge', date: '2027-01-04T19:00', platform: 'zoom', blurb: 'Daily workouts, weekly check-ins and a crowned winner.' },
  { id: 'countdown-bootcamp', title: 'Carnival Countdown Bootcamp', date: '2027-01-30T10:00', platform: 'zoom', blurb: 'Four weekends of road-march conditioning.' },
];

export const VIDEOS = [
  { id: 'v1', title: 'Soca Sweat HIIT: Full Fete Burn', cat: 'workout', minutes: 32, level: 'All levels', thumb: 'img/dancer-feathers.jpg', pos: '50% 30%', youtubeId: '' },
  { id: 'v2', title: 'Wine & Core: 20-Minute Waistline', cat: 'workout', minutes: 20, level: 'Intermediate', thumb: 'img/crimson-tide.jpg', pos: '50% 40%', youtubeId: '' },
  { id: 'v3', title: 'Road March Stamina Builder', cat: 'workout', minutes: 45, level: 'Advanced', thumb: 'img/palms-night.jpg', pos: '50% 35%', youtubeId: '' },
  { id: 'v4', title: 'Choreo Breakdown: The Feather Flow', cat: 'choreo', minutes: 18, level: 'Beginner', thumb: 'img/blue-plumes.jpg', pos: '50% 30%', youtubeId: '' },
  { id: 'v5', title: 'Choreo Breakdown: Jab Jab Energy', cat: 'choreo', minutes: 15, level: 'Intermediate', thumb: 'img/blue-devil.jpg', pos: '60% 40%', youtubeId: '' },
  { id: 'v6', title: 'Wining 101: Hips, Isolation & Control', cat: 'choreo', minutes: 22, level: 'Beginner', thumb: 'img/eye.jpg', pos: '45% 30%', youtubeId: '' },
  { id: 'v7', title: "J'ouvert Morning: Paint, Powder & Power", cat: 'recap', minutes: 6, level: 'Event recap', thumb: 'img/light-trails.jpg', pos: '50% 50%', youtubeId: '' },
  { id: 'v8', title: 'Road Queen Takeover: Parade Day', cat: 'recap', minutes: 8, level: 'Event recap', thumb: 'img/dancer-feathers.jpg', pos: '50% 75%', youtubeId: '' },
  { id: 'v9', title: 'Midnight Fete Meetup', cat: 'recap', minutes: 5, level: 'Meetup recap', thumb: 'img/palms-crimson.jpg', pos: '60% 50%', youtubeId: '' },
];

export const CATEGORY_LABELS = { workout: 'Workout', choreo: 'Choreo Breakdown', recap: 'Road March Recap' };

const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL'];

// art: which illustration in shop-art.js draws the product (front + back views).
export const PRODUCTS = [
  { id: 'crop-tee', name: 'Road Queen Crop Tee', cat: 'apparel', price: 34, sizes: APPAREL_SIZES, art: 'tee', badge: 'Best seller', blurb: 'Boxy cropped cotton tee with the gold crown up front.' },
  { id: 'leggings', name: 'Midnight Carnival Leggings', cat: 'apparel', price: 58, sizes: APPAREL_SIZES, art: 'leggings', blurb: 'High-rise, squat-proof, with a crimson side stripe.' },
  { id: 'sports-bra', name: 'Strappy Reign Sports Bra', cat: 'apparel', price: 42, sizes: APPAREL_SIZES, art: 'bra', badge: 'New', blurb: 'Medium support with a criss-cross back made to wine in.' },
  { id: 'waist-trainer', name: 'Soca Sculpt Waist Trainer', cat: 'trainers', price: 65, sizes: APPAREL_SIZES, art: 'trainer', blurb: 'Steel-boned latex core with three rows of hooks.' },
  { id: 'sweat-belt', name: 'Road Ready Sweat Belt', cat: 'trainers', price: 32, sizes: ['S/M', 'L/XL', '2XL/3XL'], art: 'belt', blurb: 'Neoprene wrap with a grip lining for heat on every rep.' },
  { id: 'arm-cuffs', name: 'Feather Arm Cuffs (Pair)', cat: 'carnival', price: 38, sizes: null, art: 'cuffs', badge: 'Fete ready', blurb: 'Red and royal blue plumes on a stretch-gem band.' },
  { id: 'face-gems', name: 'Jewelled Face Gem Set', cat: 'carnival', price: 18, sizes: null, art: 'gems', blurb: 'Iridescent self-adhesive gems for brows, cheeks and crown.' },
  { id: 'road-cup', name: 'Road March Cup', cat: 'gear', price: 24, sizes: null, art: 'cup', blurb: '24 oz double-wall jar with a lid and reusable straw.' },
  { id: 'band-trio', name: 'Booty Band Trio', cat: 'gear', price: 29, sizes: null, art: 'bands', blurb: 'Light, medium and heavy fabric bands with a carry pouch.' },
];

// Sample messages for the pre-show chat preview.
export const CHAT_SEED = [
  { name: 'Keisha', text: 'Who ready to WINE?? 🔥' },
  { name: 'Marisol', text: 'Water bottle ✅ towel ✅ waistline ✅' },
  { name: 'Coach Tee', text: 'Warm up those hips, queens — we start on the drop 👑' },
];
