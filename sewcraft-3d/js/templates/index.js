// Template registry. Order here is the order of the project picker.
import tote from './tote.js';
import cushion from './cushion.js';
import duffel from './duffel.js';
import cover from './cover.js';
import toolroll from './toolroll.js';
import apron from './apron.js';

export const TEMPLATE_LIST = [tote, duffel, cushion, cover, toolroll, apron];

export const TEMPLATES = Object.fromEntries(TEMPLATE_LIST.map((t) => [t.id, t]));
