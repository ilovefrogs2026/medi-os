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

// ───────────────────────── Help bot ─────────────────────────
const HELP_TOPICS = [
  {
    id: 'calls', words: ['שיח', 'call', 'phone', 'טלפון', 'לענות', 'answer', 'מטופל', 'patient'],
    label: { he: 'שיחות ומטופלים', en: 'Calls & patients' },
    he: 'פתחו את אפליקציית "שיחות". כשמגיעה שיחה — ענו, קראו את התיאור ובחרו את הטיפול הנכון. תשובה נכונה = כסף, שגויה = קנס קטן. אפשר להיעזר באפליקציית מד"א.',
    en: 'Open the "Calls" app. When a call rings — answer, read the description and pick the right treatment. Correct = money, wrong = small penalty. Use the MDA app for help.',
    fix: { he: 'הפנו לאפליקציית מד"א; וודאו שהשחקן לא מושתק/תקוע בשיחה.', en: 'Point to the MDA app; check the player is not stuck in a call.' }
  },
  {
    id: 'george', words: ["ג'ורג", 'גורג', 'george', 'כוכב', 'planet'],
    label: { he: "ג'ורג' וכוכב ג'ורג'", en: 'George & Planet George' },
    he: 'ג\'ורג\' המסתורי מופיע ב-10% מהשיחות. הקשיבו לו 30 שניות ואז בחרו: "כן" יטיס אתכם לשיחה אחת בכוכב ג\'ורג\' עם פרס גדול, "לא" ממשיך כרגיל.',
    en: 'Mysterious George appears in 10% of calls. Listen for 30 seconds, then choose: "Yes" flies you to one big-reward call on Planet George, "No" continues normally.',
    fix: { he: 'הסבירו שהכפתורים נפתחים רק אחרי 30 שניות.', en: 'Explain the buttons unlock only after 30 seconds.' }
  },
  {
    id: 'money', words: ['כסף', 'money', 'בוסט', 'boost', 'נקוד', 'score', 'points', 'ניקוד'],
    label: { he: 'כסף וניקוד', en: 'Money & score' },
    he: 'כסף מרוויחים מתשובות נכונות (מטופלים נדירים משלמים יותר) ומבוסטים: אבא נמלה (12%), אמא לוויתן (10%), ופרסי כוכב ג\'ורג\'.',
    en: 'You earn from correct answers (rarer callers pay more) and boosts: Daddy Ant (12%), Mama Whale (10%) and Planet George prizes.',
    fix: { he: 'בדקו בלוח המובילים שהניקוד מתעדכן.', en: 'Check the leaderboard is updating for them.' }
  },
  {
    id: 'sound', words: ['שמע', 'קול', 'סאונד', 'מוזיק', 'sound', 'music', 'volume', 'ווליום', 'שפה', 'language', 'english', 'אנגלית'],
    label: { he: 'הגדרות שמע ושפה', en: 'Sound & language settings' },
    he: 'באפליקציית "הגדרות" אפשר להדליק/לכבות אפקטים ומוזיקה, לשנות עוצמה ולהחליף שפה בין עברית לאנגלית.',
    en: 'In the "Settings" app you can toggle effects and music, change volume and switch between Hebrew and English.',
    fix: { he: 'בקשו מהשחקן ללחוץ פעם אחת על המסך (דפדפנים חוסמים שמע עד אינטראקציה).', en: 'Ask the player to tap the screen once (browsers block audio until interaction).' }
  },
  {
    id: 'chat', words: ['מושתק', 'השתק', 'mute', 'muted', 'kick', 'העיפו', 'הועפתי', 'צ\'אט', 'chat', 'report', 'דיווח', 'שם'],
    label: { he: 'צ\'אט, השתקות ודיווחים', en: 'Chat, mutes & reports' },
    he: 'השתקה היא זמנית ונקבעת על ידי המנהלים. אם שמך דווח — תתבקש לבחור שם חדש כדי להמשיך. צוות המנהלים קיבל את פנייתך.',
    en: 'Mutes are temporary and set by the managers. If your name was reported you must pick a new one to continue. The managers have received your request.',
    fix: { he: 'בדקו ברשימת החברים אם השחקן מושתק ולמה; שקלו להסיר השתקה.', en: 'Check the member list for the mute and its reason; consider unmuting.' }
  },
  {
    id: 'bug', words: ['באג', 'bug', 'תקוע', 'stuck', 'לא עובד', 'not working', 'נתקע', 'error', 'שגיאה', 'freeze'],
    label: { he: 'תקלה טכנית', en: 'Technical issue' },
    he: 'נסו לרענן את הדף — המערכת תחבר אתכם מחדש אוטומטית ותשמור על הכסף שלכם. אם זה חוזר, מנהל יבדוק בהקדם.',
    en: 'Try refreshing the page — the system reconnects you automatically and keeps your money. If it repeats, a manager will check soon.',
    fix: { he: 'בקשו רענון; אם תקוע בשיחה — המשחק יעביר שיחה חדשה אחרי רענון.', en: 'Ask for a refresh; a stuck call is replaced after reconnect.' }
  },
  {
    id: 'timer', words: ['זמן', 'טיימר', 'timer', 'time', 'נגמר', 'end', 'כמה זמן'],
    label: { he: 'זמן המשחק', en: 'Game time' },
    he: 'הטיימר בפינה העליונה מסונכרן לכל השחקנים. בסוף הזמן תוצג טבלת המנצחים.',
    en: 'The timer at the top is synced for all players. When it ends, the final standings are shown.',
    fix: { he: 'אין צורך בפעולה.', en: 'No action needed.' }
  }
];

function classifyHelp(text) {
  const t = String(text || '').toLowerCase();
  return HELP_TOPICS.find((h) => has(t, h.words)) || null;
}

async function helpReply({ text, lang, firstReply, playerName }) {
  const intro = L(lang, '🤖 שלום! אני עוזר בינה מלאכותית (AI) של המוקד — לא בן אדם. ', '🤖 Hi! I\'m the dispatch AI assistant — not a human. ');
  const tail = L(lang, ' פנייתך הועברה גם לצוות המנהלים.', ' Your request was also forwarded to the managers.');
  const topic = classifyHelp(text);
  const sys = `You are the AI help assistant inside "MEDI-OS", a retro medical-dispatch party game. Answer in ${lang === 'en' ? 'English' : 'Hebrew'}, in at most 2 short sentences. Game facts: players answer incoming calls in the Calls app and pick the correct first-aid treatment (MDA app has protocols); correct answers earn money, wrong ones cost $${C.ECON.wrongPenalty}. Daddy Ant (12%) and Mama Whale (10%) give money boosts. Mysterious George (10%) talks for 30s then offers a trip to Planet George (one call: Uncle Tzvi 40%, Strawberry Elephant 35%, Legendary George 25%). Settings app: sound effects, music, volume, language. Managers can mute/kick. If unsure, say a manager will help. Never claim to be human.`;
  let body = await callClaude(sys, `Player "${playerName}" asks: ${text}`, 200);
  if (!body) {
    body = topic ? L(lang, topic.he, topic.en)
      : L(lang, 'קיבלתי את השאלה. אני לא בטוח שיש לי תשובה מדויקת — מנהל אנושי יצטרף לשיחה בהקדם.', 'Got your question. I\'m not sure I have an exact answer — a human manager will join shortly.');
  }
  return (firstReply ? intro : '🤖 ') + body + (firstReply ? tail : '');
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

module.exports = { helpReply, helpBrief, lbReply, aiEnabled: () => !!API_KEY };
