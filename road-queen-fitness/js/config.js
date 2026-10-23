// Everything the business owner is likely to change lives here.
// Leave an endpoint blank and the site falls back to opening an email,
// so every form still reaches a person without a backend.

export const CONFIG = {
  brand: 'Road Queen Fitness',
  siteUrl: 'https://kevdogg05.github.io/road-queen-fitness/',
  email: 'hello@roadqueenfitness.com',
  handle: '@roadqueenfitness',

  // Class times in data.js are written in this time zone; visitors see them in their own.
  timezone: 'America/New_York',

  socials: {
    tiktok: 'https://www.tiktok.com/@roadqueenfitness',
    instagram: 'https://www.instagram.com/roadqueenfitness/',
    facebook: 'https://www.facebook.com/roadqueenfitness',
    youtube: 'https://www.youtube.com/@roadqueenfitness',
  },

  // Members' Zoom room. Blank: the RSVP flow says the link is emailed before class.
  zoomUrl: '',
  // An embeddable live player URL (YouTube Live, Vimeo, or a Zoom Web SDK page).
  // When set, the Live stage plays it during class instead of the countdown.
  liveEmbedUrl: '',

  // Form backends (e.g. a Formspree or Basin URL). Blank: open a pre-filled email.
  joinEndpoint: '',
  uploadEndpoint: '',
  // A hosted checkout (Shopify, Square, Stripe Payment Link…). Blank: email the order.
  checkoutUrl: '',

  currency: 'USD',
  freeShippingAt: 75,
};
