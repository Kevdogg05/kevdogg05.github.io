// Gathers every content file. Edit the content files, not this one (see ../../CONTENT.md).
import presence from './courses/presence.js';
import conversation from './courses/conversation.js';
import confidence from './courses/confidence.js';
import clarity from './courses/clarity.js';
import leadership from './courses/leadership.js';
import connection from './courses/connection.js';
import smalltalk from './smalltalk.js';
import scenarios from './scenarios.js';
import prompts from './prompts.js';

// Look and feel for each course card.
const LOOK = {
  presence: { color: '#5b5bf6', color2: '#2f8cff', icon: 'mic', tone: 'blue' },
  conversation: { color: '#13a6c2', color2: '#3ad0a8', icon: 'chat', tone: 'teal' },
  confidence: { color: '#8a4ff0', color2: '#d062e6', icon: 'diamond', tone: 'purple' },
  clarity: { color: '#2f6fe0', color2: '#5ef0ff', icon: 'wave', tone: 'blue' },
  leadership: { color: '#e08a1e', color2: '#f0c03a', icon: 'trophy', tone: 'gold' },
  connection: { color: '#e64a7b', color2: '#ff8a6b', icon: 'heart', tone: 'rose' },
};

export const courses = [presence, conversation, confidence, clarity, leadership, connection]
  .map((c) => ({ ...c, ...(LOOK[c.id] || LOOK.presence) }));

export const lessons = new Map();
courses.forEach((c) => c.lessons.forEach((l, i) => lessons.set(l.id, { ...l, course: c, index: i })));

export const allCards = courses.flatMap((c) => c.lessons.flatMap((l) =>
  l.flashcards.map((card, i) => ({ ...card, id: `${l.id}#${i}`, lessonId: l.id, courseId: c.id }))));

export { smalltalk, scenarios, prompts };
