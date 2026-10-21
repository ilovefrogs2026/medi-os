'use strict';
// AI assistants for the Help and Leaderboards channels.
// If ANTHROPIC_API_KEY is set, replies come from Claude; otherwise a built-in
// rule-based assistant answers (the game works fully offline).
const C = require('../shared/content');

const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.AI_MODEL || 'claude-haiku-5-5';

async function callClaude(system, userText, maxTokens = 300) {
  if (!API_KEY || typeof fetch !== 'function') return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: userText }] })
    });
    if (!res.ok) return null;
    const j = await res.json();
    const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return text || null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const L = (lang, he, en) => (lang === 'en' ? en : he);
const has = (text, words) => words.some((w) => text.includes(w));

// ───────────────────────── Help bot: BOTGEORGE ─────────────────────────
// Each topic has two phrasings. The bot learns which phrasing actually solves problems
// (players press "you helped me") and prefers it; it also remembers what each player asked before.
const BOT_FIRST = {
  he: 'היי, השם שלי הוא BOTGEORGE אני AI ואני יעזור לך עד שיצטרף מנהל לשיחה איך אפשר לעזור?',
  en: "Hi, my name is BOTGEORGE, I'm an AI and I'll help you until a manager joins the chat. How can I help?"
};
const BOT_ACTION_LINES = {
  manager: { he: 'קיבלנו את בחירתך, המנהל יצטרף בקרוב לשיחה', en: 'We got your choice, a manager will join the chat soon' },
  continue: { he: 'תודה שבחרת להמשיך, מה לא הבנת?', en: 'Thanks for choosing to continue, what didn\'t you understand?' },
  helped: { he: 'תודה שכתבת לנו, אם תהיה לך עוד שאלה תפנה אלינו', en: 'Thanks for writing to us, if you have another question, contact us' }
};

const HELP_TOPICS = [
  {
    id: 'talk', words: ['לכתוב', 'כותב', 'מה לכתוב', 'להגיד', 'לדבר', 'שיח', 'מטופל', 'write', 'say', 'talk', 'patient', 'call', 'answer', 'לענות'],
    label: { he: 'שיחה עם מטופל', en: 'Talking to a patient' },
    v: [
      { he: 'בשיחה את/ה כותב/ת ראשון/ה: ברכו את המטופל, בקשו מספר קופת חולים, בדקו את התיק במד"א — ואז כתבו לו הנחיות במילים שלכם לפי המשימה באפליקציית "משימות".', en: 'In a call you write first: greet the patient, ask for the health-fund number, check the file in MDA — then write guidance in your own words following the task in the Tasks app.' },
      { he: 'הסוד: לקרוא את המשימה האחרונה באפליקציית "משימות" ולהסביר למטופל בדיוק את זה. למשל: מה לאכול, כמה לזוז, או מה לעשות בחירום. המטופל יגיד לך כשהבין.', en: 'The trick: read the last task in the Tasks app and explain exactly that to the patient — what to eat, how much to move, or what to do in an emergency. The patient tells you when it clicks.' }
    ],
    fix: { he: 'בדקו באיזה שלב השחקן בשיחה (משימות) והפנו לשלב הבא.', en: 'Check which call stage the player is at (Tasks) and point to the next step.' }
  },
  {
    id: 'file', words: ['קופ', 'מספר', 'תיק', 'מד"א', 'מדא', 'mda', 'file', 'number', 'fund', 'חיפוש', 'search'],
    label: { he: 'מספר קופה ותיק רפואי', en: 'Fund number & medical file' },
    v: [
      { he: 'בקשו מהמטופל את מספר קופת החולים, פתחו את אפליקציית מד"א › תיק רפואי, הקלידו את 7 הספרות ולחצו חיפוש. שם יש את כל פרטי המקרה.', en: 'Ask the patient for the health-fund number, open the MDA app › Medical file, type the 7 digits and press Search. All the case details are there.' },
      { he: 'המספר מופיע בשיחה אחרי שביקשתם אותו (ספרות כתומות). את אותו מספר מקלידים במד"א › תיק רפואי.', en: 'The number appears in the call after you ask for it (orange digits). Type that same number in MDA › Medical file.' }
    ],
    fix: { he: 'וודאו שהשחקן ביקש את המספר ושהוא מקליד אותו בדיוק.', en: 'Make sure the player asked for the number and types it exactly.' }
  },
  {
    id: 'george', words: ["ג'ורג", 'גורג', 'george', 'כוכב', 'planet', 'נוב', 'noob', 'מיינקראפט', 'minecraft'],
    label: { he: "ג'ורג', הנוב ועולמות מיוחדים", en: 'George, the Noob & special worlds' },
    v: [
      { he: 'ג\'ורג\' המסתורי (7%) והנוב המסתורי (9%) מדברים קצת ואז שואלים אם לעבור לעולם אחר. "כן" = שיחה אחת בכוכב ג\'ורג\' או בעולם המיינקראפט, עם פרס גדול.', en: 'Mysterious George (7%) and the Mysterious Noob (9%) talk for a bit, then ask if you want to travel. "Yes" = one call on Planet George or in the Minecraft world, with a big prize.' },
      { he: 'צריך לחכות שהדמות תסיים לדבר — רק אז מופיעים "כן" ו"לא".', en: 'Wait until the character finishes talking — only then do "Yes" and "No" appear.' }
    ],
    fix: { he: 'הסבירו שהכפתורים נפתחים רק אחרי הדיבור.', en: 'Explain the buttons unlock after the talking.' }
  },
  {
    id: 'money', words: ['כסף', 'money', 'בוסט', 'boost', 'נקוד', 'score', 'points', 'ניקוד', 'מטבע', 'coin', 'תגמול', 'reward'],
    label: { he: 'כסף וניקוד', en: 'Money & score' },
    v: [
      { he: 'מקבלים מטבעות רק כשעוזרים למטופל באמת. דמויות נדירות משלמות יותר, ואבא נמלה ואמא לוויתן נותנים בונוס גדול.', en: 'You only earn coins when you really help a patient. Rarer characters pay more, and Daddy Ant and Mama Whale give big bonuses.' },
      { he: 'כדי להרוויח יותר: סיימו כל שיחה עד הסוף (כל המשימות עם V), ואל תנתקו באמצע.', en: 'To earn more: finish each call (all tasks ticked) and don\'t hang up halfway.' }
    ],
    fix: { he: 'בדקו בהיסטוריה של השחקן אם הצליח במשימות.', en: 'Check the player history for completed tasks.' }
  },
  {
    id: 'sound', words: ['שמע', 'קול', 'סאונד', 'מוזיק', 'sound', 'music', 'volume', 'ווליום', 'שפה', 'language', 'english', 'אנגלית', 'צלצול', 'ring'],
    label: { he: 'שמע ושפה', en: 'Sound & language' },
    v: [
      { he: 'באפליקציית "הגדרות" אפשר להדליק/לכבות אפקטים ומוזיקה ולהחליף שפה. הצלצול נשמע רק כשאפליקציית השיחות פתוחה.', en: 'In the Settings app you can switch effects and music on or off and change language. Ringing is heard only while the Calls app is open.' },
      { he: 'אם אין צליל — לחצו פעם אחת על המסך (הדפדפן חוסם שמע עד לחיצה) ובדקו שהעוצמה ב"הגדרות" לא על 0.', en: 'No sound? Tap the screen once (browsers block audio until you tap) and check the volume in Settings isn\'t 0.' }
    ],
    fix: { he: 'בקשו לחיצה על המסך ובדיקת הגדרות.', en: 'Ask for a tap and a settings check.' }
  },
  {
    id: 'chat', words: ['מושתק', 'השתק', 'mute', 'muted', 'kick', 'העיפו', 'הועפתי', 'צ\'אט', 'chat', 'report', 'דיווח', 'חסום', 'blocked', 'הגבל', 'limit'],
    label: { he: 'צ\'אט, השתקות והגבלות', en: 'Chat, mutes & limits' },
    v: [
      { he: 'השתקה או הגבלה נקבעות ע"י המנהלים ומסתיימות לבד בסוף הזמן. אם שמך דווח — בחר/י שם חדש כדי להמשיך.', en: 'Mutes and limits are set by the managers and end on their own. If your name was reported, pick a new one to continue.' },
      { he: 'אם לדעתך ההגבלה טעות — לחצו "לקרוא למנהל" והסבירו.', en: 'If you think the limit is a mistake, press "Call a manager" and explain.' }
    ],
    fix: { he: 'בדקו את ההגבלות של השחקן ברשימת החברים.', en: 'Check the player\'s limits in the member list.' }
  },
  {
    id: 'bug', words: ['באג', 'bug', 'תקוע', 'stuck', 'לא עובד', 'not working', 'נתקע', 'error', 'שגיאה', 'freeze', 'קפא'],
    label: { he: 'תקלה טכנית', en: 'Technical issue' },
    v: [
      { he: 'נסו לרענן את הדף (F5) — המערכת תחבר אתכם מחדש ותשמור על הכסף.', en: 'Try refreshing (F5) — you\'ll be reconnected and keep your money.' },
      { he: 'אם זה קורה שוב: סגרו את האפליקציה שנתקעה ופתחו מחדש מהשולחן. אם זה לא עוזר — "לקרוא למנהל".', en: 'If it happens again: close the stuck app and reopen it from the desktop. If that fails, "Call a manager".' }
    ],
    fix: { he: 'בקשו רענון; בדקו בהערות אם יש התרעה על השחקן.', en: 'Ask for a refresh; check Notes for alerts on this player.' }
  },
  {
    id: 'timer', words: ['זמן', 'טיימר', 'timer', 'time', 'נגמר', 'end', 'כמה זמן', 'סקר', 'poll', 'משוב', 'feedback'],
    label: { he: 'זמן וסוף המשחק', en: 'Time & end of game' },
    v: [
      { he: 'הטיימר למעלה זהה לכולם. בסוף נפתחת אפליקציית סקרים ומשוב, והמארח מעביר שלבים במקש רווח.', en: 'The timer at the top is the same for everyone. At the end the Polls & Feedback app opens and the host moves through it with Space.' },
      { he: 'כשהזמן נגמר: כתבו משוב ודרגו מ-1 עד 10 — זה עוזר למורה לשפר את המשחק.', en: 'When time is up: write feedback and rate 1–10 — it helps the teacher improve the game.' }
    ],
    fix: { he: 'אין צורך בפעולה.', en: 'No action needed.' }
  }
];

function classifyHelp(text) {
  const t = String(text || '').toLowerCase();
  return HELP_TOPICS.find((h) => has(t, h.words)) || null;
}

// Pick the phrasing with the best "solved" rate so far (Laplace-smoothed); unseen phrasings get tried.
function pickVariant(topic, learn) {
  const st = (learn[topic.id] = learn[topic.id] || topic.v.map(() => ({ shown: 0, helped: 0, manager: 0 })));
  let best = 0, bestScore = -1;
  st.forEach((x, i) => { const sc = (x.helped + 1) / (x.shown + 2) - x.manager * 0.05; if (sc > bestScore) { bestScore = sc; best = i; } });
  return best;
}

function contextHint(ctx, lang) {
  if (!ctx || !ctx.call) return '';
  const c = ctx.call;
  if (c.stage === 'talk') return L(lang, ' כרגע את/ה בשיחה — שלב הבא: לבקש את מספר קופת החולים.', ' You\'re in a call now — next step: ask for the health-fund number.');
  if (c.stage === 'fund') return L(lang, ` המטופל כבר נתן מספר (${c.fund}) — הקלידו אותו במד"א › תיק רפואי.`, ` The patient already gave a number (${c.fund}) — type it in MDA › Medical file.`);
  if (c.stage === 'file') return L(lang, ' התיק פתוח — כתבו למטופל הנחיות לפי המשימה האחרונה ב"משימות".', ' The file is open — write guidance following the last task in Tasks.');
  return '';
}

async function helpReply({ text, lang, playerName, context, memory, learn }) {
  const topic = classifyHelp(text);
  const sys = `You are BOTGEORGE, the AI help assistant inside "MEDI-OS", a retro medical-dispatch classroom game about the heart and blood vessels. Answer in ${lang === 'en' ? 'English' : 'Hebrew'}, max 2 short sentences. How the game works: in a call the player writes first (greet, ask for the health-fund number), opens MDA › Medical file with that number to see the case, then writes guidance in their own words to complete the case task shown in the Tasks app; coins only for real help. George (7%) and the Noob (9%) offer trips to special worlds. Settings app: sound and language. Managers can mute, limit and kick. Never claim to be human. Player's current situation: ${JSON.stringify(context || {})}. Topics this player asked before and how it went: ${JSON.stringify(memory || [])}. If they asked the same thing before and it did not help, explain it differently.`;
  const ai = await callClaude(sys, `Player "${playerName}" asks: ${text}`, 200);
  if (ai) return { text: ai, topicId: topic ? topic.id : null, variant: null };
  if (!topic) return { text: L(lang, 'אני לא בטוח שיש לי תשובה מדויקת לזה. אפשר לנסח אחרת, או ללחוץ "לקרוא למנהל".', 'I\'m not sure I have an exact answer. Try rephrasing, or press "Call a manager".'), topicId: null, variant: null };
  const before = (memory || []).filter((m) => m.topicId === topic.id);
  let vi = pickVariant(topic, learn || {});
  // asked before and it didn't solve it → switch phrasing
  if (before.length && before[before.length - 1].outcome !== 'helped') vi = (before[before.length - 1].variant + 1) % topic.v.length;
  learn[topic.id][vi].shown++;
  const pre = before.length ? L(lang, 'שאלת על זה כבר קודם — הפעם בהסבר אחר: ', 'You asked about this before — here it is another way: ') : '';
  return { text: pre + L(lang, topic.v[vi].he, topic.v[vi].en) + (topic.id === 'talk' || topic.id === 'file' ? contextHint(context, lang) : ''), topicId: topic.id, variant: vi };
}

function learnOutcome(learn, topicId, variant, outcome) {
  if (!topicId || variant == null || !learn[topicId] || !learn[topicId][variant]) return;
  if (outcome === 'helped') learn[topicId][variant].helped++;
  if (outcome === 'manager') learn[topicId][variant].manager++;
}

function helpBrief(text, lang) {
  const topic = classifyHelp(text);
  return {
    category: topic ? L(lang, topic.label.he, topic.label.en) : L(lang, 'כללי / לא מסווג', 'General / unclassified'),
    howTo: topic ? L(lang, topic.fix.he, topic.fix.en) : L(lang, 'קראו את הפנייה, ענו ישירות לשחקן או שאלו שאלת הבהרה.', 'Read the request, answer the player directly or ask a clarifying question.')
  };
}

// ───────────────────────── Leaderboards bot ─────────────────────────
function fmt(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

function detectLbIntent(text) {
  const t = String(text || '').toLowerCase();
  if (has(t, ['טופ', 'top', 'שלושה', '3', 'מובילים', 'leaders'])) return 'top3';
  if (has(t, ['לעקוף', 'overtake', 'הבא', 'next', 'מעליי', 'above me'])) return 'next';
  if (has(t, ['חסר', 'פער', 'gap', 'far', 'רחוק', 'ראשון', 'first'])) return 'gap';
  if (has(t, ['מקום', 'rank', 'position', 'דירוג', 'איפה אני', 'where am i'])) return 'myrank';
  if (has(t, ['טבלה', 'table', 'כולם', 'all', 'full'])) return 'all';
  if (has(t, ['איך', 'how', 'טיפ', 'tip', 'להרוויח', 'earn'])) return 'tips';
  return null;
}

function ruleLb(intent, board, me, lang) {
  const idx = board.findIndex((p) => p.id === me.id);
  const rank = idx + 1;
  const line = (p, i) => `${['🥇', '🥈', '🥉'][i] || `#${i + 1}`} ${p.name} — ${fmt(p.money)}`;
  if (!board.length) return L(lang, 'הטבלה עדיין ריקה.', 'The table is still empty.');
  switch (intent) {
    case 'top3': return L(lang, 'שלושת המובילים כרגע:\n', 'Current top 3:\n') + board.slice(0, 3).map(line).join('\n');
    case 'myrank': return L(lang, `אתה במקום ${rank} מתוך ${board.length}, עם ${fmt(me.money)}.`, `You are #${rank} of ${board.length}, with ${fmt(me.money)}.`);
    case 'gap':
      if (rank === 1) return L(lang, 'אתה במקום הראשון! 🏆 שמור על היתרון.', 'You\'re in first place! 🏆 Keep the lead.');
      return L(lang, `חסרים לך ${fmt(board[0].money - me.money)} כדי להשיג את ${board[0].name} במקום הראשון.`, `You need ${fmt(board[0].money - me.money)} to catch ${board[0].name} in first place.`);
    case 'next':
      if (rank === 1) return L(lang, 'אין את מי לעקוף — אתה בראש! 👑', 'Nobody left to overtake — you\'re on top! 👑');
      return L(lang, `הבא בתור: ${board[idx - 1].name} (מקום ${rank - 1}) — עוד ${fmt(board[idx - 1].money - me.money + 1)}.`, `Next up: ${board[idx - 1].name} (#${rank - 1}) — ${fmt(board[idx - 1].money - me.money + 1)} more.`);
    case 'all': return L(lang, 'הטבלה המלאה:\n', 'Full table:\n') + board.map(line).join('\n');
    case 'tips': return L(lang, 'מטופלים נדירים משלמים יותר (אגדי = $1,000). אל תנחשו — טעות עולה $' + C.ECON.wrongPenalty + '. ותמיד תגידו "כן" לג\'ורג\'... אולי. 😉', 'Rarer callers pay more (Legendary = $1,000). Don\'t guess — mistakes cost $' + C.ECON.wrongPenalty + '. And always say "yes" to George... maybe. 😉');
    default: return null;
  }
}

async function lbReply({ text, presetId, board, me, lang }) {
  const intent = presetId || detectLbIntent(text);
  if (presetId) return '🤖 ' + ruleLb(intent, board, me, lang);
  const tableTxt = board.map((p, i) => `${i + 1}. ${p.name} ${fmt(p.money)}`).join('\n');
  const sys = `You are the Leaderboards AI of a multiplayer dispatch game. Answer in ${lang === 'en' ? 'English' : 'Hebrew'} in at most 3 short lines, using only this live table:\n${tableTxt}\nThe asking player is "${me.name}". Be playful but accurate. Only talk about standings/score.`;
  const ai = await callClaude(sys, text, 200);
  if (ai) return '🤖 ' + ai;
  const rule = intent ? ruleLb(intent, board, me, lang) : null;
  return '🤖 ' + (rule || L(lang, 'אני עונה רק על שאלות לגבי הטבלה. נסו: "מה המקום שלי?" או "מי בטופ 3?"', 'I only answer leaderboard questions. Try: "What is my rank?" or "Who is in the top 3?"'));
}

// ───────────────────────── AI patient (free-text answers) ─────────────────────────
// Returns { reply, success } or null when no AI key is set / the call fails.
async function judgePatient({ rules, character, bio, file, question, correct, history, text, lang }) {
  if (!API_KEY) return null;
  const sys = `${rules}

You are now: ${character} (${bio}).
Medical file shown to the player: ${file}
The question the player must solve: ${question}
The correct guidance (for judging only, NEVER reveal it or hint its wording): ${correct}
Reply language: ${lang === 'en' ? 'English' : 'Hebrew'}.
Return ONLY a JSON object: {"reply": "<your in-character reply>", "success": true|false}.
"success" is true only if the player's latest message gives accurate guidance that matches the correct guidance in substance (any wording). Otherwise false and react in character without giving the answer.`;
  const convo = history.map((m) => `${m.who === 'player' ? 'Player' : 'You'}: ${m.text}`).join('\n');
  const out = await callClaude(sys, `${convo ? convo + '\n' : ''}Player: ${text}`, 300);
  if (!out) return null;
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (typeof j.reply !== 'string') return null;
    return { reply: j.reply.slice(0, 600), success: j.success === true };
  } catch (_) { return null; }
}

// Ask Claude for a small JSON object. Returns the parsed object or null.
async function aiJSON(system, user, maxTokens = 400) {
  const out = await callClaude(system + '\nReturn ONLY one JSON object, nothing else.', user, maxTokens);
  if (!out) return null;
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (_) { return null; }
}

// End-of-game feedback: weighted score (1-10) + one summary sentence in Hebrew and English
async function summarizeFeedback(reviews) {
  if (!API_KEY || !reviews.length) return null;
  const list = reviews.map((r, i) => `${i + 1}. score ${r.rating}/10: ${r.text || '(no text)'}`).join('\n');
  const j = await aiJSON('You summarise player feedback for a classroom medical game. Weigh written reviews more than bare scores. Be fair and concise.',
    `Feedback:\n${list}\n\nReply as {"score": <number 1-10 with one decimal>, "he": "<one Hebrew sentence>", "en": "<one English sentence>"}`, 300);
  if (!j || typeof j.score !== 'number' || typeof j.he !== 'string') return null;
  return { score: Math.max(1, Math.min(10, Math.round(j.score * 10) / 10)), he: j.he.slice(0, 300), en: String(j.en || '').slice(0, 300) };
}

// Short history summary of one player's game (for managers)
async function historySummary(name, lines) {
  if (!API_KEY || !lines.length) return null;
  const j = await aiJSON('You write a short, fair summary of how one player played a classroom medical-dispatch game, for the teacher.',
    `Player: ${name}\nEvents:\n${lines.join('\n')}\n\nReply as {"he": "<2 Hebrew sentences>", "en": "<2 English sentences>"}`, 300);
  return j && typeof j.he === 'string' ? { he: j.he.slice(0, 400), en: String(j.en || '').slice(0, 400) } : null;
}

// One encouraging line per podium player
async function podiumNotes(players) {
  if (!API_KEY || !players.length) return null;
  const list = players.map((p, i) => `${i + 1}. ${p.name}: ${p.lines.join('; ')}`).join('\n');
  const j = await aiJSON('You celebrate the top 3 players of a classroom medical game with one short, specific line each.',
    `${list}\n\nReply as {"notes": [{"he": "...", "en": "..."}, ...]} in the same order.`, 400);
  return j && Array.isArray(j.notes) ? j.notes.map((n) => ({ he: String(n.he || '').slice(0, 200), en: String(n.en || '').slice(0, 200) })) : null;
}

module.exports = { BOT_FIRST, BOT_ACTION_LINES, learnOutcome, helpReply, helpBrief, lbReply, judgePatient, summarizeFeedback, historySummary, podiumNotes, aiEnabled: () => !!API_KEY };
