#!/usr/bin/env node
// Checks Parley's content files against the format in parley/CONTENT.md.
// Usage: node parley/tools/validate-content.mjs [file ...]
// With no arguments every content file is checked.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(here, '..', 'js', 'content');

const SKINS = ['porcelain', 'light', 'tan', 'olive', 'brown', 'deep'];
const HAIRS = ['short', 'side-part', 'curly', 'wavy', 'long', 'bun', 'ponytail', 'afro', 'buzz', 'bald', 'bob', 'locs'];
const HAIR_COLORS = ['black', 'dark-brown', 'brown', 'auburn', 'blonde', 'gray', 'red'];
const OUTFITS = ['blazer', 'shirt', 'tee', 'sweater', 'hoodie', 'dress', 'polo'];
const OUTFIT_COLORS = ['navy', 'blue', 'teal', 'green', 'maroon', 'purple', 'gray', 'black', 'white', 'mustard', 'coral'];
const BEARDS = ['none', 'stubble', 'full', 'mustache'];
const SCENES = ['office', 'cafe', 'party', 'gala', 'park', 'restaurant', 'meeting', 'street'];
const MOODS = ['neutral', 'smile', 'laugh', 'think', 'worried', 'annoyed', 'surprised'];
const TAGS = ['work', 'smalltalk', 'dating', 'leadership', 'confidence', 'speaking'];

const problems = [];
let where = '';
const fail = (msg) => problems.push(`${where}: ${msg}`);

const words = (s) => (typeof s === 'string' ? s.trim().split(/\s+/).filter(Boolean).length : 0);
const isStr = (s) => typeof s === 'string' && s.trim().length > 0;
const kebab = (s) => typeof s === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);

function str(obj, key, { maxWords, minWords, maxChars, label } = {}) {
  const v = obj?.[key];
  const name = label || key;
  if (!isStr(v)) return fail(`"${name}" must be a non-empty string`);
  if (maxWords && words(v) > maxWords) fail(`"${name}" has ${words(v)} words (max ${maxWords}): ${v.slice(0, 60)}…`);
  if (minWords && words(v) < minWords) fail(`"${name}" has ${words(v)} words (min ${minWords}): ${v.slice(0, 60)}…`);
  if (maxChars && v.length > maxChars) fail(`"${name}" is ${v.length} chars (max ${maxChars}): ${v}`);
  if (/\\'|\\"/.test(v)) fail(`"${name}" contains escaped quotes; use ’ “ ” instead`);
}

function oneOf(obj, key, allowed, { optional = false } = {}) {
  const v = obj?.[key];
  if (v === undefined && optional) return;
  if (!allowed.includes(v)) fail(`"${key}" is ${JSON.stringify(v)}; expected one of ${allowed.join(', ')}`);
}

function unique(list, label) {
  const seen = new Set();
  for (const item of list) {
    const k = String(item).toLowerCase();
    if (seen.has(k)) fail(`duplicate ${label}: ${item}`);
    seen.add(k);
  }
}

function checkAvatar(a, label) {
  const saved = where;
  where = `${saved} > ${label}.avatar`;
  if (!a || typeof a !== 'object') { fail('missing avatar object'); where = saved; return; }
  oneOf(a, 'skin', SKINS);
  oneOf(a, 'hair', HAIRS);
  oneOf(a, 'hairColor', HAIR_COLORS);
  oneOf(a, 'outfit', OUTFITS);
  oneOf(a, 'outfitColor', OUTFIT_COLORS);
  oneOf(a, 'beard', BEARDS, { optional: true });
  if (a.glasses !== undefined && typeof a.glasses !== 'boolean') fail('"glasses" must be true or false');
  oneOf(a, 'voice', ['m', 'f']);
  const known = ['skin', 'hair', 'hairColor', 'outfit', 'outfitColor', 'beard', 'glasses', 'voice'];
  for (const k of Object.keys(a)) if (!known.includes(k)) fail(`unknown avatar key "${k}"`);
  where = saved;
}

function checkMcq(q) {
  str(q, 'question', { maxWords: 35 });
  if (!Array.isArray(q.options) || q.options.length < 3 || q.options.length > 4) fail('mcq needs 3–4 options');
  else { q.options.forEach((o, i) => str(q.options, i, { maxWords: 25, label: `options[${i}]` })); unique(q.options, 'option'); }
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length || 0)) fail('mcq "answer" must be the index of the correct option');
  str(q, 'explain', { maxWords: 35 });
}

// ---------------------------------------------------------------- courses
function checkCourse(course, file) {
  where = path.basename(file);
  const expectedId = path.basename(file, '.js');
  if (!kebab(course.id)) fail('course "id" must be kebab-case');
  if (course.id !== expectedId) fail(`course id "${course.id}" must match the file name "${expectedId}"`);
  str(course, 'title', { maxChars: 40 });
  str(course, 'subtitle', { maxChars: 70 });
  if (!Array.isArray(course.tags) || !course.tags.length) fail('"tags" must be a non-empty array');
  else course.tags.forEach((t) => { if (!TAGS.includes(t)) fail(`unknown tag "${t}"`); });
  if (!Array.isArray(course.lessons) || course.lessons.length !== 6) { fail('course needs exactly 6 lessons'); if (!Array.isArray(course.lessons)) return; }

  course.lessons.forEach((l, i) => {
    where = `${path.basename(file)} > lesson ${i + 1}`;
    if (l.id !== `${course.id}-${i + 1}`) fail(`lesson id must be "${course.id}-${i + 1}" (got ${JSON.stringify(l.id)})`);
    where = `${path.basename(file)} > ${l.id}`;
    str(l, 'title', { maxChars: 48 });
    if (!Number.isInteger(l.minutes) || l.minutes < 4 || l.minutes > 15) fail('"minutes" must be an integer 4..15');
    str(l, 'intro', { maxWords: 30 });
    str(l, 'takeaway', { maxWords: 30 });
    str(l, 'tryIt', { maxWords: 35 });

    const glossary = l.glossary && typeof l.glossary === 'object' ? l.glossary : null;
    const gKeys = glossary ? Object.keys(glossary) : [];
    if (!glossary || gKeys.length < 1 || gKeys.length > 3) fail('"glossary" needs 1–3 terms');
    gKeys.forEach((k) => str(glossary, k, { maxWords: 30, label: `glossary["${k}"]` }));

    const used = new Set();
    if (!Array.isArray(l.steps) || l.steps.length < 3 || l.steps.length > 5) fail('lesson needs 3–5 steps');
    (l.steps || []).forEach((s, si) => {
      const plain = (s?.text || '').replace(/\[\[|\]\]/g, '');
      if (!isStr(s?.text)) return fail(`steps[${si}].text missing`);
      const w = words(plain);
      if (w < 12 || w > 70) fail(`steps[${si}] has ${w} words (12..70)`);
      if (/\\'|\\"/.test(s.text)) fail(`steps[${si}] contains escaped quotes; use ’ “ ”`);
      const open = (s.text.match(/\[\[/g) || []).length;
      const close = (s.text.match(/\]\]/g) || []).length;
      if (open !== close) fail(`steps[${si}] has unbalanced [[ ]]`);
      for (const m of s.text.matchAll(/\[\[([^\]]+)\]\]/g)) {
        const term = m[1].trim().toLowerCase();
        const key = gKeys.find((k) => k.toLowerCase() === term);
        if (!key) fail(`steps[${si}] marks [[${m[1]}]] but the glossary has no "${m[1]}" entry`);
        else used.add(key);
      }
    });
    gKeys.forEach((k) => { if (!used.has(k)) fail(`glossary term "${k}" is never marked with [[ ]] in the steps`); });

    if (!Array.isArray(l.quiz) || l.quiz.length !== 4) fail('quiz needs exactly 4 questions');
    const types = (l.quiz || []).map((q) => q?.type).sort().join(',');
    if (types !== 'blank,match,mcq,tf') fail(`quiz needs one each of tf, blank, match, mcq (got ${types})`);
    (l.quiz || []).forEach((q, qi) => {
      const saved = where;
      where = `${saved} > quiz[${qi}] (${q?.type})`;
      if (q.type === 'tf') {
        str(q, 'statement', { maxWords: 35 });
        if (typeof q.answer !== 'boolean') fail('tf "answer" must be true or false');
        str(q, 'explain', { maxWords: 35 });
      } else if (q.type === 'blank') {
        str(q, 'before', { maxWords: 30 });
        if (typeof q.after !== 'string') fail('"after" must be a string (may be empty)');
        if (!Array.isArray(q.options) || q.options.length !== 3) fail('blank needs exactly 3 options');
        else {
          q.options.forEach((o, oi) => { if (!isStr(o) || words(o) > 3) fail(`options[${oi}] must be 1–3 words`); });
          unique(q.options, 'option');
          if (!q.options.includes(q.answer)) fail(`answer "${q.answer}" is not one of the options`);
        }
        str(q, 'explain', { maxWords: 35 });
      } else if (q.type === 'match') {
        str(q, 'prompt', { maxWords: 15 });
        if (!Array.isArray(q.pairs) || q.pairs.length < 3 || q.pairs.length > 4) fail('match needs 3–4 pairs');
        else {
          q.pairs.forEach((p, pi) => {
            if (!Array.isArray(p) || p.length !== 2 || !isStr(p[0]) || !isStr(p[1])) return fail(`pairs[${pi}] must be ["left", "right"]`);
            if (words(p[0]) > 5) fail(`pairs[${pi}] left side is over 5 words: ${p[0]}`);
            if (words(p[1]) > 8) fail(`pairs[${pi}] right side is over 8 words: ${p[1]}`);
          });
          unique(q.pairs.map((p) => p?.[0]), 'left side');
          unique(q.pairs.map((p) => p?.[1]), 'right side');
        }
        if (q.explain !== undefined) str(q, 'explain', { maxWords: 35 });
      } else if (q.type === 'mcq') {
        checkMcq(q);
      } else fail(`unknown quiz type ${JSON.stringify(q?.type)}`);
      where = saved;
    });

    if (!Array.isArray(l.flashcards) || l.flashcards.length < 2 || l.flashcards.length > 3) fail('lesson needs 2–3 flashcards');
    (l.flashcards || []).forEach((c, ci) => {
      str(c, 'front', { maxWords: 15, label: `flashcards[${ci}].front` });
      str(c, 'back', { maxWords: 35, label: `flashcards[${ci}].back` });
    });
  });
}

// ---------------------------------------------------------------- small talk
function checkSmallTalk(list) {
  where = 'smalltalk.js';
  if (!Array.isArray(list) || list.length < 8) fail('export an array of at least 8 small talk scenarios');
  unique((list || []).map((s) => s.id), 'scenario id');
  (list || []).forEach((s, i) => {
    where = `smalltalk.js > [${i}] ${s.id || ''}`;
    if (!kebab(s.id)) fail('"id" must be kebab-case');
    str(s, 'title', { maxChars: 40 });
    oneOf(s, 'category', ['work', 'social', 'dating', 'networking', 'neighbors']);
    if (![1, 2, 3].includes(s.level)) fail('"level" must be 1, 2 or 3');
    oneOf(s, 'scene', SCENES);
    str(s.partner || {}, 'name', { maxChars: 20, label: 'partner.name' });
    str(s.partner || {}, 'role', { maxWords: 10, label: 'partner.role' });
    checkAvatar(s.partner?.avatar, 'partner');
    str(s, 'goal', { maxWords: 25 });
    str(s, 'takeaway', { maxWords: 30 });
    if (!Array.isArray(s.turns) || s.turns.length < 4 || s.turns.length > 6) fail('needs 4–6 turns');
    (s.turns || []).forEach((t, ti) => {
      const saved = where;
      where = `${saved} > turns[${ti}]`;
      str(t, 'say', { maxWords: 40 });
      if (!Array.isArray(t.options) || t.options.length !== 3) fail('needs exactly 3 options');
      const ratings = (t.options || []).map((o) => o.rating).sort().join(',');
      if (ratings !== 'negative,neutral,positive') fail(`options need one positive, one neutral, one negative (got ${ratings})`);
      (t.options || []).forEach((o, oi) => {
        str(o, 'text', { maxWords: 35, label: `options[${oi}].text` });
        str(o, 'feedback', { maxWords: 35, label: `options[${oi}].feedback` });
        str(o, 'reply', { maxWords: 30, label: `options[${oi}].reply` });
      });
      where = saved;
    });
  });
}

// ---------------------------------------------------------------- video scenarios
function checkScenarios(list) {
  where = 'scenarios.js';
  if (!Array.isArray(list) || list.length < 5) fail('export an array of at least 5 scenarios');
  unique((list || []).map((s) => s.id), 'scenario id');
  (list || []).forEach((s, i) => {
    where = `scenarios.js > [${i}] ${s.id || ''}`;
    if (!kebab(s.id)) fail('"id" must be kebab-case');
    str(s, 'title', { maxChars: 40 });
    str(s, 'skill', { maxWords: 4 });
    str(s, 'summary', { maxWords: 30 });
    oneOf(s, 'scene', SCENES);
    for (const k of ['A', 'B']) {
      str(s.cast?.[k] || {}, 'name', { maxChars: 20, label: `cast.${k}.name` });
      checkAvatar(s.cast?.[k]?.avatar, `cast.${k}`);
    }
    const nodes = s.nodes && typeof s.nodes === 'object' ? s.nodes : {};
    if (!nodes[s.start]) fail(`"start" (${s.start}) is not a node`);
    let goodEnding = false;
    for (const [id, n] of Object.entries(nodes)) {
      const saved = where;
      where = `${saved} > nodes.${id}`;
      if (!kebab(id)) fail('node ids must be kebab-case');
      if (!Array.isArray(n.beats) || n.beats.length < 1 || n.beats.length > 8) fail('needs 1–8 beats');
      (n.beats || []).forEach((b, bi) => {
        oneOf(b, 'who', ['N', 'A', 'B']);
        str(b, 'line', { maxWords: 35, label: `beats[${bi}].line` });
        if (b.mood !== undefined) oneOf(b, 'mood', MOODS);
        if (b.who === 'N' && b.mood !== undefined) fail(`beats[${bi}]: the narrator has no mood`);
      });
      const kinds = ['choices', 'next', 'end'].filter((k) => n[k] !== undefined);
      if (kinds.length !== 1) fail(`needs exactly one of choices / next / end (has ${kinds.join(', ') || 'none'})`);
      if (n.choices) {
        if (!Array.isArray(n.choices) || n.choices.length < 2 || n.choices.length > 3) fail('needs 2–3 choices');
        (n.choices || []).forEach((c, ci) => {
          str(c, 'label', { maxWords: 7, label: `choices[${ci}].label` });
          if (!nodes[c.next]) fail(`choices[${ci}].next "${c.next}" is not a node`);
        });
      }
      if (n.next !== undefined && !nodes[n.next]) fail(`next "${n.next}" is not a node`);
      if (n.end) {
        oneOf(n.end, 'outcome', ['good', 'mixed', 'poor']);
        str(n.end, 'title', { maxWords: 6, label: 'end.title' });
        str(n.end, 'takeaway', { maxWords: 35, label: 'end.takeaway' });
        if (n.end.outcome === 'good') goodEnding = true;
      }
      where = saved;
    }
    if (!goodEnding) fail('needs at least one ending with outcome "good"');

    // reachability, loops, choice on every path, path length
    const reached = new Set();
    let longest = 0;
    const walk = (id, stack, wordsSoFar, choiceSeen) => {
      const n = nodes[id];
      if (!n) return;
      if (stack.includes(id)) { fail(`loop through node "${id}"`); return; }
      reached.add(id);
      const total = wordsSoFar + (n.beats || []).reduce((a, b) => a + words(b.line), 0);
      const nextStack = [...stack, id];
      if (n.choices) n.choices.forEach((c) => walk(c.next, nextStack, total, true));
      else if (n.next) walk(n.next, nextStack, total, choiceSeen);
      else {
        longest = Math.max(longest, total);
        if (!choiceSeen) fail(`path ending at "${id}" never offers a choice`);
      }
    };
    if (nodes[s.start]) walk(s.start, [], 0, false);
    for (const id of Object.keys(nodes)) if (!reached.has(id)) fail(`node "${id}" is unreachable`);
    if (longest > 420) fail(`longest path is ${longest} spoken words (keep it under ~400)`);

    const saved = where;
    where = `${saved} > quiz`;
    if (!s.quiz) fail('missing quiz'); else checkMcq(s.quiz);
    where = saved;
  });
}

// ---------------------------------------------------------------- prompts
function checkPrompts(data) {
  where = 'prompts.js';
  const { prompts = [], passages = [], sparks = [] } = data || {};
  if (prompts.length < 20) fail(`needs at least 20 prompts (has ${prompts.length})`);
  if (passages.length < 8) fail(`needs at least 8 passages (has ${passages.length})`);
  if (sparks.length < 30) fail(`needs at least 30 sparks (has ${sparks.length})`);
  unique([...prompts, ...passages].map((p) => p.id), 'id');
  prompts.forEach((p, i) => {
    where = `prompts.js > prompts[${i}] ${p.id || ''}`;
    if (!kebab(p.id)) fail('"id" must be kebab-case');
    oneOf(p, 'category', ['intro', 'story', 'work', 'opinion', 'explain', 'toast']);
    if (![30, 60, 90].includes(p.seconds)) fail('"seconds" must be 30, 60 or 90');
    str(p, 'text', { maxWords: 30 });
    if (!Array.isArray(p.tips) || p.tips.length < 1 || p.tips.length > 3) fail('needs 1–3 tips');
    (p.tips || []).forEach((t, ti) => str(p.tips, ti, { maxWords: 20, label: `tips[${ti}]` }));
  });
  passages.forEach((p, i) => {
    where = `prompts.js > passages[${i}] ${p.id || ''}`;
    if (!kebab(p.id)) fail('"id" must be kebab-case');
    oneOf(p, 'kind', ['passage', 'twister']);
    str(p, 'title', { maxChars: 40 });
    if (p.kind === 'passage') str(p, 'text', { minWords: 40, maxWords: 110 });
    else str(p, 'text', { maxWords: 30 });
  });
  sparks.forEach((s, i) => {
    where = `prompts.js > sparks[${i}]`;
    oneOf(s, 'context', ['work', 'party', 'date', 'anywhere']);
    str(s, 'text', { maxWords: 25 });
  });
  where = 'prompts.js';
  unique(sparks.map((s) => s.text), 'spark');
}

// ---------------------------------------------------------------- main
async function checkFile(file) {
  const abs = path.resolve(file);
  let mod;
  try {
    mod = await import(pathToFileURL(abs).href + `?t=${Date.now()}`);
  } catch (e) {
    problems.push(`${path.basename(abs)}: cannot be loaded: ${e.message}`);
    return;
  }
  const data = mod.default;
  if (data === undefined) { problems.push(`${path.basename(abs)}: has no default export`); return; }
  const rel = path.relative(contentDir, abs);
  if (rel.startsWith('courses' + path.sep)) checkCourse(data, abs);
  else if (rel === 'smalltalk.js') checkSmallTalk(data);
  else if (rel === 'scenarios.js') checkScenarios(data);
  else if (rel === 'prompts.js') checkPrompts(data);
  else problems.push(`${rel}: not a known content file`);
}

const args = process.argv.slice(2);
let files = args;
if (!files.length) {
  const coursesDir = path.join(contentDir, 'courses');
  files = fs.existsSync(coursesDir) ? fs.readdirSync(coursesDir).filter((f) => f.endsWith('.js')).map((f) => path.join(coursesDir, f)) : [];
  for (const f of ['smalltalk.js', 'scenarios.js', 'prompts.js']) if (fs.existsSync(path.join(contentDir, f))) files.push(path.join(contentDir, f));
}
for (const f of files) await checkFile(f);

// lesson ids and titles must be unique across courses
if (!args.length) {
  where = 'all courses';
  const titles = [];
  for (const f of files.filter((f) => f.includes(`${path.sep}courses${path.sep}`))) {
    const mod = await import(pathToFileURL(path.resolve(f)).href);
    (mod.default.lessons || []).forEach((l) => titles.push(l.title));
  }
  unique(titles, 'lesson title');
}

if (problems.length) {
  console.log(problems.map((p) => `✗ ${p}`).join('\n'));
  console.log(`\n${problems.length} problem(s) in ${files.length} file(s).`);
  process.exit(1);
}
console.log(`✓ ${files.length} content file(s) OK.`);
