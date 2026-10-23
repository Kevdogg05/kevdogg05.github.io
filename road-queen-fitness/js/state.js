// Stores shared between sections.
import { createStore } from './store.js';

// Set once the visitor signs up through Join Us: { name, email }.
export const member = createStore(null, 'member');
