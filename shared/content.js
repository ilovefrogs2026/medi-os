/* Shared game content — loaded by the server (CommonJS) and the browser (window.CONTENT). */
(function (root) {
  'use strict';

  // ───────────────────────── MDA protocols (concise first-aid info) ─────────────────────────
  const PROTOCOLS = [
    {
      id: 'cpr', icon: '♥',
      title: { he: 'החייאה (CPR)', en: 'CPR' },
      action: { he: 'עיסויי חזה + דפיברילטור', en: 'Chest compressions + AED' },
      signs: { he: 'מחוסר הכרה ולא נושם כרגיל', en: 'Unresponsive and not breathing normally' },
      steps: {
        he: ['חייגו 101 והפעילו רמקול', 'עיסויים במרכז החזה: 100–120 בדקה, עומק 5–6 ס"מ', 'הביאו דפיברילטור (AED) מוקדם ככל האפשר ופעלו לפי ההנחיות הקוליות'],
        en: ['Call 101 (EMS) on speaker', 'Push hard in the centre of the chest: 100–120/min, 5–6 cm deep', 'Get an AED as early as possible and follow its voice prompts']
      }
    },
    {
      id: 'bleeding', icon: '✚',
      title: { he: 'דימום חמור', en: 'Severe bleeding' },
      action: { he: 'לחץ ישיר וחזק על הפצע', en: 'Firm direct pressure on the wound' },
      signs: { he: 'דם רב שאינו נעצר', en: 'Heavy bleeding that will not stop' },
      steps: {
        he: ['לחצו חזק ישירות על הפצע עם בד נקי', 'תחבושת ספוגה? אל תסירו — הוסיפו מעליה', 'דימום מסכן חיים בגפה: חוסם עורקים מעל הפצע'],
        en: ['Press firmly on the wound with a clean cloth', 'Soaked through? Don\'t remove it — add more on top', 'Life-threatening limb bleeding: tourniquet above the wound']
      }
    },
    {
      id: 'choking', icon: '◎',
      title: { he: 'חנק', en: 'Choking' },
      action: { he: '5 טפיחות גב + 5 לחיצות בטן', en: '5 back blows + 5 abdominal thrusts' },
      signs: { he: 'לא מצליח לדבר, להשתעל או לנשום', en: 'Cannot speak, cough or breathe' },
      steps: {
        he: ['אם משתעל — עודדו להמשיך להשתעל', '5 טפיחות בין השכמות, ואז 5 לחיצות בטן (היימליך)', 'איבד הכרה? חייגו 101 והתחילו החייאה'],
        en: ['If they can cough — encourage coughing', '5 back blows between the shoulder blades, then 5 abdominal thrusts', 'Loses consciousness? Call 101 and start CPR']
      }
    },
    {
      id: 'burns', icon: '♨',
      title: { he: 'כוויות', en: 'Burns' },
      action: { he: 'קירור במים זורמים 20 דקות', en: 'Cool under running water 20 min' },
      signs: { he: 'עור אדום, שלפוחיות, כאב', en: 'Red skin, blisters, pain' },
      steps: {
        he: ['קררו במים זורמים קרירים 20 דקות', 'הסירו תכשיטים ובגדים שאינם דבוקים', 'כסו בבד נקי שאינו נדבק. בלי קרח, חמאה או משחת שיניים'],
        en: ['Cool under cool running water for 20 minutes', 'Remove jewellery and clothing that is not stuck', 'Cover with clean non-stick material. No ice, butter or toothpaste']
      }
    },
    {
      id: 'stroke', icon: '◐',
      title: { he: 'שבץ מוחי', en: 'Stroke' },
      action: { he: 'בדיקת FAST וחיוג 101 מיידי', en: 'FAST check + call 101 now' },
      signs: { he: 'צניחת פנים, חולשת יד, דיבור משובש', en: 'Face droop, arm weakness, slurred speech' },
      steps: {
        he: ['F – פנים: חיוך עקום?  A – ידיים: יד נופלת?', 'S – דיבור: משובש?  T – זמן: חייגו 101 מיד', 'רשמו את שעת תחילת התסמינים. לא לתת לאכול או לשתות'],
        en: ['F – Face drooping?  A – Arm weakness?', 'S – Speech slurred?  T – Time: call 101 now', 'Note when symptoms started. Nothing to eat or drink']
      }
    },
    {
      id: 'allergy', icon: '✶',
      title: { he: 'תגובה אלרגית קשה', en: 'Severe allergic reaction' },
      action: { he: 'מזרק אפינפרין (אפיפן) בירך', en: 'Epinephrine auto-injector in the thigh' },
      signs: { he: 'נפיחות בפנים/בגרון, קוצר נשימה, פריחה', en: 'Swollen face/throat, short of breath, rash' },
      steps: {
        he: ['הזריקו אפיפן בצד החיצוני של הירך', 'חייגו 101', 'השכיבו עם רגליים מורמות; קשיי נשימה — ישיבה'],
        en: ['Inject the auto-injector into the outer thigh', 'Call 101', 'Lie down with legs raised; if breathing is hard — let them sit']
      }
    },
    {
      id: 'hypo', icon: '◆',
      title: { he: 'היפוגליקמיה (סוכר נמוך)', en: 'Low blood sugar' },
      action: { he: 'לתת סוכר — מיץ או ממתק', en: 'Give sugar — juice or sweets' },
      signs: { he: 'סוכרתי, מזיע, רועד, מבולבל', en: 'Diabetic, sweaty, shaky, confused' },
      steps: {
        he: ['בהכרה ומסוגל לבלוע: מיץ ממותק או ממתק', 'המתינו 10–15 דקות ובדקו שוב', 'מחוסר הכרה: לא לתת דבר בפה — חייגו 101'],
        en: ['Conscious and can swallow: sweet juice or sweets', 'Wait 10–15 minutes and reassess', 'Unconscious: nothing by mouth — call 101']
      }
    },
    {
      id: 'fracture', icon: '▱',
      title: { he: 'חשד לשבר', en: 'Suspected fracture' },
      action: { he: 'קיבוע במנח שבו נמצא', en: 'Immobilise as found' },
      signs: { he: 'כאב, נפיחות, עיוות בגפה', en: 'Pain, swelling, deformed limb' },
      steps: {
        he: ['אל תנסו ליישר את הגפה', 'קבעו במנח שבו היא נמצאת', 'קר עטוף בבד והקפידו לבדוק תחושה ודופק מתחת לפגיעה'],
        en: ['Don\'t try to straighten the limb', 'Support it in the position found', 'Wrapped cold pack; check feeling and pulse below the injury']
      }
    },
    {
      id: 'heat', icon: '☀',
      title: { he: 'מכת חום', en: 'Heatstroke' },
      action: { he: 'צל, קירור במים ואוורור', en: 'Shade, cool with water, fan' },
      signs: { he: 'עור חם, בלבול, בחילה ביום חם', en: 'Hot skin, confusion, nausea on a hot day' },
      steps: {
        he: ['העבירו לצל ושחררו בגדים', 'הרטיבו במים ואווררו', 'בהכרה — לגימות מים. מבולבל — חייגו 101'],
        en: ['Move to shade and loosen clothing', 'Wet the skin and fan', 'Conscious — sips of water. Confused — call 101']
      }
    },
    {
      id: 'faint', icon: '▽',
      title: { he: 'התעלפות', en: 'Fainting' },
      action: { he: 'להשכיב ולהרים רגליים', en: 'Lay down, raise the legs' },
      signs: { he: 'איבוד הכרה קצר, חיוורון', en: 'Brief loss of consciousness, pale' },
      steps: {
        he: ['השכיבו על הגב והרימו רגליים', 'שחררו בגדים צמודים ודאגו לאוויר', 'לא מתאושש תוך דקה? חייגו 101'],
        en: ['Lay them on their back and raise the legs', 'Loosen tight clothing, get fresh air', 'Not recovering within a minute? Call 101']
      }
    },
    {
      id: 'seizure', icon: '≈',
      title: { he: 'פרכוס', en: 'Seizure' },
      action: { he: 'להגן על הראש, לא לרסן', en: 'Protect the head, don\'t restrain' },
      signs: { he: 'רעד לא רצוני של כל הגוף', en: 'Uncontrolled shaking of the whole body' },
      steps: {
        he: ['פנו חפצים מסביב ושימו משהו רך מתחת לראש', 'אל תרסנו ואל תכניסו דבר לפה', 'מדדו זמן; מעל 5 דקות — 101. אחרי — תנוחת התאוששות'],
        en: ['Clear the area and cushion the head', 'Don\'t restrain, put nothing in the mouth', 'Time it; over 5 min — call 101. Afterwards — recovery position']
      }
    }
  ];

  const RARITY = {
    common:    { he: 'נפוץ',     en: 'Common',    color: '#7dffb0' },
    uncommon:  { he: 'לא שכיח',  en: 'Uncommon',  color: '#4fd3ff' },
    rare:      { he: 'נדיר',     en: 'Rare',      color: '#b38cff' },
    epic:      { he: 'אפי',      en: 'Epic',      color: '#ff7ae0' },
    legendary: { he: 'אגדי',     en: 'Legendary', color: '#ffd23f' },
    special:   { he: 'מיוחד',    en: 'Special',   color: '#ff9a3c' },
    mystery:   { he: '???',      en: '???',       color: '#9aa7a0' }
  };

  // ───────────────────────── Regular callers (68% total) ─────────────────────────
  // weight = percent chance per call. reward = $ for a correct answer.
  const REGULARS = [
    {
      id: 'grandma_rina', avatar: '👵', rarity: 'common', weight: 12, reward: 100,
      name: { he: 'סבתא רינה', en: 'Grandma Rina' },
      bio: { he: 'יודעת הכל על כולם בבניין. מתקשרת למוקד יותר מלנכדים.', en: 'Knows everything about everyone in the building. Calls dispatch more than her grandkids.' },
      scenarios: [
        { p: 'stroke', he: 'השכן ממול, מר כהן, פתאום מדבר מוזר והפה שלו עקום לצד אחד! והיד שלו לא עולה!', en: 'Mr. Cohen across the hall suddenly talks funny and his mouth droops to one side! He can\'t lift his arm!' },
        { p: 'burns', he: 'אוי ואבוי, שפכתי מרק רותח על היד. עשיתי גלד אדום ענק!', en: 'Oy vey, I spilled boiling soup on my hand. It\'s all red and blistering!' }
      ]
    },
    {
      id: 'moshe_runner', avatar: '🏃', rarity: 'common', weight: 11, reward: 100,
      name: { he: 'משה הרץ', en: 'Moshe the Runner' },
      bio: { he: 'רץ מרתונים בצהרי אוגוסט. כי למה לא.', en: 'Runs marathons at noon in August. Because why not.' },
      scenarios: [
        { p: 'heat', he: 'רצתי 20 ק"מ בשמש, הראש מסתובב לי, העור לוהט ואני מבולבל קצת...', en: 'Ran 20 km in the sun, my head is spinning, my skin is burning and I\'m a bit confused...' },
        { p: 'fracture', he: 'נפלתי בבור על המסלול, הקרסול נראה עקום ונפוח מאוד!', en: 'I fell into a pothole on the track — my ankle looks bent and very swollen!' }
      ]
    },
    {
      id: 'noa_student', avatar: '🎒', rarity: 'common', weight: 10, reward: 120,
      name: { he: 'נועה הסטודנטית', en: 'Noa the Student' },
      bio: { he: 'סטודנטית לסיעוד בשנה א\'. כבר יודעת יותר מחצי מהמוקד.', en: 'First-year nursing student. Already knows more than half the dispatch room.' },
      scenarios: [
        { p: 'faint', he: 'חברה שלי התעלפה בתור לקפטריה. היא חיוורת אבל נושמת.', en: 'My friend fainted in the cafeteria line. She\'s pale but breathing.' },
        { p: 'hypo', he: 'השותף שלי סוכרתי, הוא מזיע, רועד ומדבר שטויות. הוא עוד בהכרה.', en: 'My roommate is diabetic — he\'s sweaty, shaky and talking nonsense. He\'s still conscious.' }
      ]
    },
    {
      id: 'chef_avi', avatar: '👨‍🍳', rarity: 'uncommon', weight: 9, reward: 150,
      name: { he: 'השף אבי', en: 'Chef Avi' },
      bio: { he: 'מכין את השקשוקה הכי טובה בעיר. הסכינים פחות אוהבים אותו.', en: 'Makes the best shakshuka in town. His knives are less fond of him.' },
      scenarios: [
        { p: 'bleeding', he: 'החתכתי עמוק באצבע עם סכין השף, הדם לא מפסיק!', en: 'I sliced deep into my finger with the chef\'s knife — it won\'t stop bleeding!' },
        { p: 'choking', he: 'סועד במסעדה נחנק מכדור פלאפל! הוא מחזיק את הגרון ולא מוציא מילה!', en: 'A diner is choking on a falafel ball! He\'s clutching his throat and can\'t speak!' }
      ]
    },
    {
      id: 'yossi_builder', avatar: '👷', rarity: 'uncommon', weight: 8, reward: 160,
      name: { he: 'יוסי הקבלן', en: 'Yossi the Builder' },
      bio: { he: '"עוד שבועיים זה מוכן." — יוסי, 2019.', en: '"Two more weeks and it\'s done." — Yossi, 2019.' },
      scenarios: [
        { p: 'fracture', he: 'פועל נפל מהפיגום, הזרוע שלו בזווית מוזרה לגמרי.', en: 'A worker fell off the scaffold — his arm is at a totally weird angle.' },
        { p: 'cpr', he: 'אחד הפועלים קרס! הוא לא מגיב ולא נושם כמו שצריך!', en: 'One of the workers collapsed! He\'s not responding and not breathing properly!' }
      ]
    },
    {
      id: 'tourist_kevin', avatar: '🧳', rarity: 'uncommon', weight: 6, reward: 200,
      name: { he: 'קווין התייר', en: 'Kevin the Tourist' },
      bio: { he: 'הגיע לחופשה של שבוע. נשאר שלושה חודשים בגלל החומוס.', en: 'Came for a week. Stayed three months for the hummus.' },
      scenarios: [
        { p: 'allergy', he: 'Hello?! אכלתי משהו עם בוטנים, הפנים שלי מתנפחות וקשה לי לנשום! יש לי אפיפן בתיק!', en: 'Hello?! I ate something with peanuts, my face is swelling and it\'s hard to breathe! I have an EpiPen in my bag!' },
        { p: 'heat', he: 'הייתי שלוש שעות במצדה בלי כובע. אני מרגיש חם מאוד ומבולבל...', en: 'I was at Masada for three hours without a hat. I feel very hot and confused...' }
      ]
    },
    {
      id: 'dr_pigeon', avatar: '🐦', rarity: 'rare', weight: 5, reward: 300,
      name: { he: 'ד"ר יונה', en: 'Dr. Pigeon' },
      bio: { he: 'יונה שסיימה תואר ברפואה על גג בית החולים. לא רשמית.', en: 'A pigeon who studied medicine on a hospital roof. Unofficially.' },
      scenarios: [
        { p: 'seizure', he: 'קוּ-קוּ! אדם בכיכר רועד בכל הגוף ונפל על הרצפה. היונים בפאניקה!', en: 'Coo-coo! A man in the square is shaking all over and fell down. The pigeons are panicking!' },
        { p: 'choking', he: 'קוּ! ילד נחנק מגרעין של חמנייה שזרקו לנו. הוא לא מצליח לנשום!', en: 'Coo! A kid is choking on a sunflower seed someone threw for us. He can\'t breathe!' }
      ]
    },
    {
      id: 'captain_falafel', avatar: '🧆', rarity: 'rare', weight: 4, reward: 350,
      name: { he: 'קפטן פלאפל', en: 'Captain Falafel' },
      bio: { he: 'גיבור-על עשוי חומוס מטוגן. חולשתו: טחינה.', en: 'A superhero made of fried chickpeas. Weakness: tahini.' },
      scenarios: [
        { p: 'burns', he: 'נלחמתי בסיר שמן רותח! הרסיס פגע בזרוע של העוזר שלי, יש שלפוחיות!', en: 'I battled a pot of boiling oil! A splash hit my sidekick\'s arm — there are blisters!' },
        { p: 'bleeding', he: 'הנבל פיתה-מן נפצע מזכוכית שבורה, דם רב זורם מהרגל!', en: 'The villain Pita-Man got cut by broken glass — lots of blood pouring from his leg!' }
      ]
    },
    {
      id: 'robot_rx7', avatar: '🤖', rarity: 'epic', weight: 2, reward: 600,
      name: { he: 'רובוט RX-7', en: 'Robot RX-7' },
      bio: { he: 'רובוט ניקיון שהתעורר למודעות. עדיין מנקה, אבל עם רגשות.', en: 'A cleaning robot that became self-aware. Still cleans, now with feelings.' },
      scenarios: [
        { p: 'cpr', he: 'בִּיפּ. זוהה אדם מחוסר תגובה. נשימה: לא תקינה. מבקש פרוטוקול. בִּיפּ.', en: 'BEEP. Unresponsive human detected. Breathing: abnormal. Requesting protocol. BEEP.' },
        { p: 'stroke', he: 'בִּיפּ. משתמש מציג אסימטריה פנים וחוסר קוהרנטיות לשונית. ניתוח: דחוף.', en: 'BEEP. User shows facial asymmetry and verbal incoherence. Analysis: urgent.' }
      ]
    },
    {
      id: 'ghost_ezra', avatar: '👻', rarity: 'legendary', weight: 1, reward: 1000,
      name: { he: 'עזרא הרוח', en: 'Ezra the Ghost' },
      bio: { he: 'מתקשר מקו טלפון של 1987. איש לא יודע איך.', en: 'Calls from a 1987 phone line. Nobody knows how.' },
      scenarios: [
        { p: 'hypo', he: 'אוווו... החבר שלי לבית הקברות... סליחה, לבית הספר, סוכרתי ונראה מבולבל ומזיע... אוווו...', en: 'Ooooh... my friend from the graveyard... sorry, the schoolyard, is diabetic, sweaty and confused... ooooh...' },
        { p: 'faint', he: 'אוווו... מישהו ראה אותי והתעלף. הוא שוכב על הרצפה וחיוור כמוני...', en: 'Ooooh... someone saw me and fainted. He\'s lying on the floor, pale as me...' }
      ]
    }
  ];

  // ───────────────────────── Special callers (32% total) ─────────────────────────
  const SPECIALS = [
    {
      id: 'ant_dad', avatar: '🐜', rarity: 'special', weight: 12, boost: 800, kind: 'boost',
      name: { he: 'אבא נמלה', en: 'Daddy Ant' },
      bio: { he: 'אבא ל-40,000 ילדים. סוחב פי 50 ממשקלו — כולל ארנקים.', en: 'Father of 40,000. Carries 50× his body weight — including wallets.' },
      lines: {
        he: ['שלום! כאן אבא נמלה מהמושבה ברחוב ויצמן.', 'שמעתי שאתה המוקדן הכי חרוץ בעיר — בדיוק כמונו!', 'אספנו פירורים כל הקיץ... והנה, מתנה בשבילך! 🐜💰'],
        en: ['Hello! Daddy Ant here, from the colony on Weizmann St.', 'I hear you\'re the hardest-working dispatcher in town — just like us!', 'We collected crumbs all summer... here, a gift for you! 🐜💰']
      }
    },
    {
      id: 'whale_mom', avatar: '🐋', rarity: 'special', weight: 10, boost: 1500, kind: 'boost',
      name: { he: 'אמא לוויתן', en: 'Mama Whale' },
      bio: { he: 'שרה שירים באורך 30 דקות. מתקשרת מהים התיכון.', en: 'Sings 30-minute songs. Calls from the Mediterranean.' },
      lines: {
        he: ['ווווווּוּם... כאן אמא לוויתן, מעומק הים.', 'הבן שלי בלע בטעות אוצר של ספינה טבועה...', 'ואני רוצה שהוא יגיע לידיים טובות. קח, יקירי! 🐋💎'],
        en: ['Woooooom... Mama Whale here, from the deep sea.', 'My son accidentally swallowed a sunken ship\'s treasure...', 'I want it to go to good hands. Take it, dear! 🐋💎']
      }
    },
    {
      id: 'george', avatar: '👤', rarity: 'mystery', weight: 10, kind: 'george',
      name: { he: "ג'ורג' המסתורי", en: 'Mysterious George' },
      bio: { he: 'אף אחד לא ראה את פניו. כולם שמעו את קולו.', en: 'Nobody has seen his face. Everybody has heard his voice.' },
      // 30 seconds of dialogue — 6 lines × 5s
      lines: {
        he: [
          '...הלו? אתה שומע אותי? אל תיבהל.',
          'אני לא חולה. אני לא פצוע. אני... ג\'ורג\'.',
          'אני מתקשר מאוד, מאוד רחוק. ממקום שאין בו תורים לקופת חולים.',
          'צפינו בך. המשמרות שלך, ההחלטות שלך... מרשים.',
          'ובגלל זה — זכית. טיסה אחת, הלוך בלבד... לכוכב ג\'ורג\'. 🪐',
          'שם מחכה לך שיחה אחת. רק אחת. ומי יודע מי יענה...'
        ],
        en: [
          '...Hello? Can you hear me? Don\'t be alarmed.',
          'I\'m not sick. I\'m not hurt. I\'m... George.',
          'I\'m calling from very, very far away. A place with no waiting rooms.',
          'We\'ve been watching you. Your shifts, your decisions... impressive.',
          'And so — you\'ve won. One flight... to Planet George. 🪐',
          'One call awaits you there. Only one. And who knows who will answer...'
        ]
      }
    }
  ];

  // ───────────────────────── Planet George (one call) ─────────────────────────
  const PLANET = [
    {
      id: 'uncle_tzvi', avatar: '🐢', rarity: 'rare', weight: 40, boost: 1200,
      name: { he: 'דוד צבי', en: 'Uncle Tzvi' },
      bio: { he: 'צב בן 212. ממהר לשום מקום מאז 1814.', en: 'A 212-year-old turtle. In no hurry since 1814.' },
      lines: {
        he: ['שָׁלוֹם... יַלְדִּי...', 'לָקַח לִי... שְׁלוֹשָׁה שָׁבוּעוֹת... לְחַיֵּג...', 'קַח אֶת הַחִסָּכוֹן שֶׁלִּי... אַל תְּמַהֵר לְבַזְבֵּז. 🐢'],
        en: ['Hel...lo... my... child...', 'It took me... three weeks... to dial...', 'Take my savings... don\'t rush to spend it. 🐢']
      }
    },
    {
      id: 'strawberry_elephant', avatar: '🐘', rarity: 'epic', weight: 35, boost: 2000,
      name: { he: 'אח סטרוברי אלפנט', en: 'Brother Strawberry Elephant' },
      bio: { he: 'פיל בטעם תות. מריח נהדר, שוקל 4 טון.', en: 'A strawberry-flavoured elephant. Smells amazing, weighs 4 tons.' },
      lines: {
        he: ['טרררררום! 🍓 אחי! הגעת לכוכב ג\'ורג\'!', 'פה הכל ורוד, מתוק ועם קצפת.', 'הנה סל תותים מוזהבים — כל אחד שווה הון! 🐘🍓'],
        en: ['TRRRRRUMP! 🍓 Bro! You made it to Planet George!', 'Everything here is pink, sweet and comes with whipped cream.', 'Here\'s a basket of golden strawberries — each worth a fortune! 🐘🍓']
      }
    },
    {
      id: 'legendary_george', avatar: '🤴', rarity: 'legendary', weight: 25, boost: 5000,
      name: { he: "ג'ורג' האגדי", en: 'Legendary George' },
      bio: { he: 'סוף סוף, בלי צללית. עם כתר. אגדה.', en: 'At last — no shadow. With a crown. A legend.' },
      lines: {
        he: ['ובכן... הגעת אליי. מעטים מאוד הגיעו עד כאן.', 'הנה פניי האמיתיות. והכתר — אמיתי לגמרי.', 'קח את אוצר הכוכב. השם שלך ייכתב בכוכבים. 👑'],
        en: ['Well... you reached me. Very few have come this far.', 'Behold my true face. And the crown — entirely real.', 'Take the planet\'s treasure. Your name will be written in the stars. 👑']
      }
    }
  ];

  const ECON = { wrongPenalty: 40, georgeTalkMs: 30000 };

  // Preset prompts for the Leaderboards channel
  const LB_PRESETS = [
    { id: 'top3', he: 'מי בטופ 3?', en: 'Who is in the top 3?' },
    { id: 'myrank', he: 'מה המקום שלי?', en: 'What is my rank?' },
    { id: 'gap', he: 'כמה חסר לי למקום הראשון?', en: 'How far am I from first place?' },
    { id: 'next', he: 'את מי אני צריך לעקוף?', en: 'Who do I need to overtake next?' },
    { id: 'all', he: 'הראה את כל הטבלה', en: 'Show the full table' },
    { id: 'tips', he: 'איך מרוויחים יותר?', en: 'How do I earn more?' }
  ];

  const CONTENT = { PROTOCOLS, RARITY, REGULARS, SPECIALS, PLANET, ECON, LB_PRESETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = CONTENT;
  else root.CONTENT = CONTENT;
})(typeof window !== 'undefined' ? window : globalThis);
