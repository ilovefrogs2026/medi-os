/* Heart & blood-vessel edition — cast, odds and question bank.
 * Loaded by the server (CommonJS) and the browser (window.HEART).
 * Every question stays inside the three topics: atherosclerosis, heart attack vs.
 * cardiac arrest, prevention & lifestyle. `a` is the index of the correct option. */
(function (root) {
  'use strict';

  // Each scenario: file = what the medical file shows, q = the question,
  // o = 4 options, a = correct index, ok = success summary, fail = frustrated reply.
  const S = (file, q, o, a, ok, fail) => ({ file, q, o, a, ok, fail });

  const CAST = [
    {
      id: 'h_rosa', avatar: '👵', rarity: 'common', weight: 23, reward: 120, kind: 'heart', topic: 'prevention',
      name: { he: 'סבתא רוזה', en: 'Grandma Rosa' },
      bio: { he: 'בת 78, מבשלת לכל השכונה ורוצה לחיות עד 120.', en: '78, cooks for the whole street and plans to reach 120.' },
      hello: { he: 'שלום חמוד! הרופא אמר לי לשמור על כלי הדם, אבל אני לא מבינה מה לאכול…', en: 'Hello sweetie! The doctor told me to look after my blood vessels, but what should I eat…?' },
      scenarios: [
        S({ he: 'בת 78. לחץ דם גבולי. אוכלת הרבה מאכלים מלוחים ומטוגנים.', en: '78. Borderline blood pressure. Eats a lot of salty and fried food.' },
          { he: 'מה הכי כדאי לסבתא רוזה לשנות בתזונה כדי לשמור על כלי הדם?', en: 'What should Grandma Rosa change in her diet to protect her blood vessels?' },
          [{ he: 'להפחית מלח ומטוגנים, ולהוסיף ירקות, פירות ודגנים מלאים', en: 'Less salt and fried food, more vegetables, fruit and whole grains' },
           { he: 'לאכול יותר בשר מעובד בשביל חלבון', en: 'Eat more processed meat for protein' },
           { he: 'לוותר על ארוחת בוקר ולאכול ארוחה אחת גדולה בערב', en: 'Skip breakfast and eat one big meal at night' },
           { he: 'לשתות רק מיצים ממותקים', en: 'Drink only sweetened juices' }], 0,
          { he: 'פחות מלח ושומן רווי שומר על לחץ הדם ועל דפנות העורקים. סבתא רוזה כבר מחליפה מתכונים!', en: 'Less salt and saturated fat keeps blood pressure down and artery walls healthy. Rosa is already swapping recipes!' },
          { he: 'אוי, זה לא נשמע לי נכון… הרופא אמר משהו אחר. תנסה שוב?', en: 'Oy, that doesn\'t sound right… the doctor said something else. Try again?' }),
        S({ he: 'כולסטרול LDL גבוה בבדיקת דם אחרונה.', en: 'High LDL cholesterol in the last blood test.' },
          { he: 'איזה שינוי עוזר להוריד כולסטרול "רע" (LDL)?', en: 'Which change helps lower "bad" (LDL) cholesterol?' },
          [{ he: 'יותר חמאה ושמנת', en: 'More butter and cream' },
           { he: 'פחות שומן רווי וטראנס, ויותר סיבים (שיבולת שועל, קטניות)', en: 'Less saturated and trans fat, more fibre (oats, legumes)' },
           { he: 'לאכול רק בשר אדום', en: 'Eat only red meat' },
           { he: 'שום דבר — כולסטרול לא קשור לתזונה', en: 'Nothing — cholesterol has nothing to do with diet' }], 1,
          { he: 'סיבים ושומנים בריאים מורידים LDL, וכך פחות שומן מצטבר בדפנות העורקים.', en: 'Fibre and healthy fats lower LDL, so less fat builds up in artery walls.' },
          { he: 'נו באמת, ככה אני כבר אוכלת… זה לא עוזר לי.', en: 'Oh come on, I already eat like that… it isn\'t helping.' }),
        S({ he: 'בת 78, כמעט לא שותה מים, אוכלת מעט ירקות.', en: '78, barely drinks water, eats few vegetables.' },
          { he: 'איזה סגנון תזונה מומלץ לשמירה על הלב בגיל השלישי?', en: 'Which eating style is recommended to protect the heart in older age?' },
          [{ he: 'תזונה ים-תיכונית: ירקות, שמן זית, דגים, קטניות ואגוזים', en: 'Mediterranean diet: vegetables, olive oil, fish, legumes and nuts' },
           { he: 'ג\'אנק פוד, כי בגיל הזה זה כבר לא משנה', en: 'Junk food, because at this age it doesn\'t matter' },
           { he: 'רק עוגות ותה מתוק', en: 'Only cakes and sweet tea' },
           { he: 'צום של כמה ימים בכל שבוע', en: 'Fasting a few days every week' }], 0,
          { he: 'התזונה הים-תיכונית קשורה לפחות מחלות לב. סבתא רוזה מוסיפה סלט לכל ארוחה!', en: 'The Mediterranean diet is linked to less heart disease. Rosa now adds a salad to every meal!' },
          { he: 'מה? לא נראה לי שזה מה שהרופא התכוון…', en: 'What? I don\'t think that\'s what the doctor meant…' })
      ]
    },
    {
      id: 'h_shimon', avatar: '📮', rarity: 'common', weight: 18, reward: 140, kind: 'heart', topic: 'prevention',
      name: { he: 'הדוור שמעון', en: 'Shimon the Postman' },
      bio: { he: '30 שנה מחלק דואר. מאז שקיבל קטנוע — כבר לא הולך ברגל.', en: '30 years of delivering mail. Since he got a scooter, he never walks.' },
      hello: { he: 'שלום, כאן שמעון מהדואר. אמרו לי שהעורקים שלי "מתקשים". מה זה אומר?!', en: 'Hi, Shimon from the post office. They say my arteries are "stiffening". What does that mean?!' },
      scenarios: [
        S({ he: 'בן 55, לא עושה פעילות גופנית, עורקים פחות גמישים.', en: '55, no exercise, arteries less flexible.' },
          { he: 'כמה פעילות אירובית מומלצת למבוגר בשבוע?', en: 'How much aerobic activity is recommended for an adult per week?' },
          [{ he: '10 דקות בחודש', en: '10 minutes a month' },
           { he: 'לפחות 150 דקות בשבוע של פעילות מתונה (כמו הליכה מהירה)', en: 'At least 150 minutes a week of moderate activity (like brisk walking)' },
           { he: 'רק הרמת משקולות כבדות פעם בשנה', en: 'Only heavy weightlifting once a year' },
           { he: 'פעילות גופנית מזיקה ללב', en: 'Exercise is bad for the heart' }], 1,
          { he: '150 דקות בשבוע — למשל 30 דקות הליכה מהירה 5 פעמים — משפרות את גמישות העורקים. שמעון חוזר לחלק ברגל!', en: '150 minutes a week — say 30 minutes of brisk walking 5 times — improves artery flexibility. Shimon is delivering on foot again!' },
          { he: 'זה לא מה ששמעתי… אני צריך תשובה מדויקת יותר.', en: 'That\'s not what I heard… I need a more exact answer.' }),
        S({ he: 'דופק במנוחה גבוה, מתנשף אחרי עלייה במדרגות.', en: 'High resting pulse, out of breath after climbing stairs.' },
          { he: 'איך פעילות אירובית סדירה עוזרת ללב ולכלי הדם?', en: 'How does regular aerobic exercise help the heart and blood vessels?' },
          [{ he: 'היא מחזקת את שריר הלב, מורידה לחץ דם ושומרת על עורקים גמישים', en: 'It strengthens the heart muscle, lowers blood pressure and keeps arteries flexible' },
           { he: 'היא סותמת את העורקים', en: 'It clogs the arteries' },
           { he: 'היא עוזרת רק לשרירי הרגליים, לא ללב', en: 'It only helps leg muscles, not the heart' },
           { he: 'היא מעלה את הכולסטרול הרע', en: 'It raises bad cholesterol' }], 0,
          { he: 'לב מאומן שואב יותר דם בכל פעימה, ולכן הדופק במנוחה יורד. שמעון כבר פחות מתנשף!', en: 'A trained heart pumps more blood per beat, so the resting pulse drops. Shimon is already less breathless!' },
          { he: 'הממ… זה לא נשמע הגיוני לי. אולי תבדוק שוב?', en: 'Hmm… that doesn\'t make sense to me. Maybe check again?' }),
        S({ he: 'יושב רוב היום על הקטנוע. רוצה להתחיל להתאמן.', en: 'Sits on his scooter most of the day. Wants to start exercising.' },
          { he: 'איזו פעילות נחשבת אירובית?', en: 'Which activity counts as aerobic?' },
          [{ he: 'לשבת מול טלוויזיה', en: 'Sitting in front of the TV' },
           { he: 'הליכה מהירה, שחייה או רכיבה על אופניים', en: 'Brisk walking, swimming or cycling' },
           { he: 'לישון שעה נוספת', en: 'Sleeping an extra hour' },
           { he: 'לנהוג בקטנוע מהר יותר', en: 'Riding the scooter faster' }], 1,
          { he: 'פעילות אירובית מעלה את הדופק לאורך זמן ומאמנת את הלב והעורקים.', en: 'Aerobic activity raises the heart rate for a while and trains the heart and arteries.' },
          { he: 'אני לא בטוח שזה נחשב… תעזור לי באמת?', en: 'I\'m not sure that counts… will you really help me?' })
      ]
    },
    {
      id: 'h_yankel', avatar: '🎣', rarity: 'uncommon', weight: 14, reward: 170, kind: 'heart', topic: 'prevention',
      name: { he: 'הדייג יאנקל', en: 'Yankel the Fisherman' },
      bio: { he: 'דג בכנרת מגיל 9. את הדגים הוא מוכר — ואוכל בעיקר נקניקיות.', en: 'Fishing the Sea of Galilee since age 9. Sells the fish, eats mostly sausages.' },
      hello: { he: 'אהלן! אומרים שהדגים שלי טובים ללב. נו, אז למה?', en: 'Ahoy! They say my fish are good for the heart. Well, why?' },
      scenarios: [
        S({ he: 'סימני דלקת בבדיקות דם, טריגליצרידים גבוהים.', en: 'Signs of inflammation in blood tests, high triglycerides.' },
          { he: 'איך אומגה 3 מדגים שמנים עוזרת לכלי הדם?', en: 'How does omega-3 from oily fish help blood vessels?' },
          [{ he: 'היא מפחיתה דלקות ומורידה טריגליצרידים בדם', en: 'It reduces inflammation and lowers blood triglycerides' },
           { he: 'היא מעלה את לחץ הדם', en: 'It raises blood pressure' },
           { he: 'היא בונה פלאק בעורקים', en: 'It builds plaque in the arteries' },
           { he: 'אין לה שום השפעה', en: 'It has no effect at all' }], 0,
          { he: 'אומגה 3 מרגיעה דלקות בדפנות העורקים ומורידה טריגליצרידים. יאנקל שומר לעצמו סלמון!', en: 'Omega-3 calms inflammation in artery walls and lowers triglycerides. Yankel is keeping a salmon for himself!' },
          { he: 'מה? זה הפוך ממה שאמרו לי בנמל!', en: 'What? That\'s the opposite of what they told me at the harbour!' }),
        S({ he: 'אוכל דג פעם בחודש.', en: 'Eats fish once a month.' },
          { he: 'כמה פעמים בשבוע מומלץ לאכול דגים שמנים (סלמון, סרדינים, מקרל)?', en: 'How often a week is it recommended to eat oily fish (salmon, sardines, mackerel)?' },
          [{ he: 'אף פעם', en: 'Never' },
           { he: 'בערך פעמיים בשבוע', en: 'About twice a week' },
           { he: '10 פעמים ביום', en: '10 times a day' },
           { he: 'רק בחגים', en: 'Only on holidays' }], 1,
          { he: 'פעמיים בשבוע מספקות אומגה 3 שמגנה על הלב.', en: 'Twice a week gives enough omega-3 to help protect the heart.' },
          { he: 'זה לא נשמע לי מדויק… אתה בטוח?', en: 'That doesn\'t sound exact… are you sure?' }),
        S({ he: 'מבקש מקורות צמחיים לאומגה 3 לנכדה צמחונית.', en: 'Asks for plant sources of omega-3 for his vegetarian granddaughter.' },
          { he: 'איזה מזון צמחי מכיל אומגה 3?', en: 'Which plant food contains omega-3?' },
          [{ he: 'סוכר לבן', en: 'White sugar' },
           { he: 'אגוזי מלך, זרעי פשתן וצ\'יה', en: 'Walnuts, flaxseed and chia' },
           { he: 'צ\'יפס', en: 'French fries' },
           { he: 'משקה אנרגיה', en: 'Energy drinks' }], 1,
          { he: 'אגוזי מלך, פשתן וצ\'יה הם מקורות צמחיים טובים לאומגה 3.', en: 'Walnuts, flax and chia are good plant sources of omega-3.' },
          { he: 'נו, הנכדה שלי לא תאכל את זה… יש משהו אחר?', en: 'My granddaughter won\'t eat that… anything else?' })
      ]
    },
    {
      id: 'h_gadi', avatar: '🔧', rarity: 'uncommon', weight: 10, reward: 200, kind: 'heart', topic: 'athero',
      name: { he: 'המכונאי גדי', en: 'Gadi the Mechanic' },
      bio: { he: 'מבין בצינורות של מכוניות. בצינורות של הגוף — פחות.', en: 'Knows all about car pipes. Body pipes — not so much.' },
      hello: { he: 'שלום, גדי מהמוסך. הרופא אמר שיש לי "טרשת עורקים". זה כמו חלודה בצינור?', en: 'Hi, Gadi from the garage. The doctor says I have "atherosclerosis". Is that like rust in a pipe?' },
      scenarios: [
        S({ he: 'בן 60, מעשן, כולסטרול גבוה. אובחנה היצרות עורקים.', en: '60, smoker, high cholesterol. Narrowed arteries diagnosed.' },
          { he: 'מהי טרשת עורקים וכיצד היא נוצרת?', en: 'What is atherosclerosis and how does it form?' },
          [{ he: 'הצטברות של שומנים, כולסטרול ותאי דלקת בדופן העורק (פלאק) שמצרה אותו ומקשיחה אותו', en: 'A build-up of fats, cholesterol and inflammatory cells in the artery wall (plaque) that narrows and stiffens it' },
           { he: 'זיהום של העור', en: 'A skin infection' },
           { he: 'שבר בעצם', en: 'A broken bone' },
           { he: 'מצב שבו העורקים נעשים רחבים מדי מעודף ספורט', en: 'Arteries becoming too wide from too much sport' }], 0,
          { he: 'נכון! הפלאק מצר את העורק כמו משקעים בצינור, ופחות דם עובר. גדי מבין עכשיו למה להפסיק לעשן.', en: 'Right! Plaque narrows the artery like deposits in a pipe, so less blood gets through. Gadi now gets why to quit smoking.' },
          { he: 'זה לא מסתדר לי עם מה שהרופא הראה בצילום…', en: 'That doesn\'t match what the doctor showed me on the scan…' }),
        S({ he: 'כאבים ברגליים בהליכה שעוברים במנוחה.', en: 'Leg pain when walking that goes away with rest.' },
          { he: 'מה קורה לזרימת הדם כשמצטברים שומנים בעורק?', en: 'What happens to blood flow when fats build up in an artery?' },
          [{ he: 'הזרימה מתגברת', en: 'The flow increases' },
           { he: 'המעבר מצר, פחות דם וחמצן מגיעים לאיברים, ופלאק שנקרע עלול ליצור קריש', en: 'The passage narrows, less blood and oxygen reach organs, and a ruptured plaque can cause a clot' },
           { he: 'הדם משנה צבע לירוק', en: 'The blood turns green' },
           { he: 'אין שום שינוי', en: 'Nothing changes' }], 1,
          { he: 'בגלל ההיצרות השרירים מקבלים פחות חמצן בהליכה, ולכן כואב. גדי יבדוק את העורקים שלו.', en: 'The narrowing means muscles get less oxygen while walking, which is why it hurts. Gadi will get his arteries checked.' },
          { he: 'לא, לא… אני צריך הסבר שמתאים לכאבים שלי.', en: 'No, no… I need an explanation that fits my pain.' }),
        S({ he: 'שואל אילו עורקים בסכנה הכי גדולה.', en: 'Asks which arteries are most at risk.' },
          { he: 'אילו עורקים פגיעים במיוחד לטרשת עורקים?', en: 'Which arteries are especially vulnerable to atherosclerosis?' },
          [{ he: 'העורקים הכליליים של הלב, עורקי הצוואר (הקרוטיד) ועורקי הרגליים', en: 'The coronary arteries of the heart, the neck (carotid) arteries and the leg arteries' },
           { he: 'רק העורקים באצבעות', en: 'Only the arteries in the fingers' },
           { he: 'עורקים לא נפגעים אף פעם', en: 'Arteries are never affected' },
           { he: 'רק כלי הדם בשיער', en: 'Only blood vessels in the hair' }], 0,
          { he: 'היצרות בכליליים עלולה לגרום להתקף לב, ובעורקי הצוואר — לשבץ.', en: 'Narrowed coronaries can cause a heart attack, and narrowed carotids a stroke.' },
          { he: 'אני מכונאי, אבל גם אני יודע שזה לא נכון!', en: 'I\'m a mechanic, but even I know that\'s wrong!' })
      ]
    },
    {
      id: 'h_betty', avatar: '🥐', rarity: 'rare', weight: 8, reward: 260, kind: 'heart', topic: 'pressure',
      name: { he: 'האופה בטי', en: 'Betty the Baker' },
      bio: { he: 'קמה כל יום ב-3:00 לאפות. ישנה 4 שעות ותמיד בלחץ.', en: 'Up at 3am every day to bake. Sleeps 4 hours and is always stressed.' },
      hello: { he: 'הלו?! אני באמצע הבצק! הלב שלי דופק חזק ומודדים לי לחץ דם גבוה…', en: 'Hello?! I\'m in the middle of the dough! My heart is pounding and my blood pressure is high…' },
      scenarios: [
        S({ he: 'לחץ דם 155/95 בשלוש מדידות. מתח רב בעבודה.', en: 'Blood pressure 155/95 in three readings. Lots of work stress.' },
          { he: 'למה לחץ דם גבוה לאורך זמן מסוכן ללב ולכלי הדם?', en: 'Why is high blood pressure over time dangerous for the heart and blood vessels?' },
          [{ he: 'הוא פוגע בדפנות העורקים ומאיץ טרשת, ומאלץ את הלב לעבוד קשה יותר', en: 'It damages artery walls, speeds up atherosclerosis and makes the heart work harder' },
           { he: 'הוא לא מסוכן בכלל', en: 'It isn\'t dangerous at all' },
           { he: 'הוא מנקה את העורקים', en: 'It cleans the arteries' },
           { he: 'הוא מחזק את העצמות', en: 'It strengthens the bones' }], 0,
          { he: 'לחץ גבוה "שוחק" את דפנות העורקים ומעמיס על הלב. בטי תתחיל למדוד לחץ דם באופן קבוע.', en: 'High pressure wears down artery walls and overloads the heart. Betty will start checking her blood pressure regularly.' },
          { he: 'אין לי זמן לתשובות כאלה! תנסה שוב, הבצק מחכה!', en: 'I don\'t have time for answers like that! Try again, the dough is waiting!' }),
        S({ he: 'ישנה מעט, שותה 6 כוסות קפה ביום, מתוחה כל הזמן.', en: 'Sleeps little, drinks 6 coffees a day, tense all the time.' },
          { he: 'מה מהבאים עוזר להוריד מתח נפשי ולחץ דם?', en: 'Which of these helps reduce stress and blood pressure?' },
          [{ he: 'עוד קפה', en: 'More coffee' },
           { he: 'שינה מספקת, פעילות גופנית, הפסקות ונשימות רגועות', en: 'Enough sleep, exercise, breaks and calm breathing' },
           { he: 'לעבוד בלי הפסקה', en: 'Working without breaks' },
           { he: 'לעשן כדי להירגע', en: 'Smoking to relax' }], 1,
          { he: 'שינה, תנועה והפסקות מורידים הורמוני סטרס ולחץ דם. בטי לקחה עוזר למאפייה!', en: 'Sleep, movement and breaks lower stress hormones and blood pressure. Betty hired a helper at the bakery!' },
          { he: 'מה?! ככה אני אגיע ל-200/120! צריכה עצה אחרת.', en: 'What?! That\'ll get me to 200/120! I need different advice.' }),
        S({ he: 'אוכלת הרבה מאפים מלוחים. רוצה להוריד לחץ דם.', en: 'Eats lots of salty pastries. Wants to lower blood pressure.' },
          { he: 'איזה רכיב בתזונה כדאי להפחית במיוחד כשיש לחץ דם גבוה?', en: 'Which food component should you especially cut down on with high blood pressure?' },
          [{ he: 'מים', en: 'Water' },
           { he: 'מלח (נתרן)', en: 'Salt (sodium)' },
           { he: 'ירקות ירוקים', en: 'Green vegetables' },
           { he: 'פירות', en: 'Fruit' }], 1,
          { he: 'פחות מלח (פחות מכפית ביום) עוזר להוריד לחץ דם. בטי אופה עכשיו לחם עם פחות מלח!', en: 'Less salt (under a teaspoon a day) helps lower blood pressure. Betty now bakes lower-salt bread!' },
          { he: 'אבל בלי זה אני לא יכולה לאפות… אתה בטוח?', en: 'But I can\'t bake without that… are you sure?' })
      ]
    },
    // ── launchers ──
    {
      id: 'h_noob', avatar: '🧱', rarity: 'mystery', weight: 9, kind: 'launch', world: 'minecraft', talkMs: 15000,
      name: { he: 'הנוב המסתורי', en: 'The Mysterious Noob' },
      bio: { he: 'נראה כמו קוביות. מדבר כמו קוביות. אף אחד לא יודע מאיפה הגיע.', en: 'Looks like blocks. Talks like blocks. Nobody knows where he came from.' },
      lines: {
        he: ['היי… אני נוב. כן, הנוב.', 'נפלתי לפה מעולם אחר. עולם של קוביות.', 'יש שם חברים שלי שצריכים עזרה רפואית.', 'אני יכול לשגר אותך לשם. רק שיחה אחת.'],
        en: ['Hey… I\'m a noob. Yes, THE noob.', 'I fell here from another world. A world of blocks.', 'Some friends of mine there need medical help.', 'I can send you there. Just one call.']
      },
      question: { he: 'רוצה לעבור לעולם המיינקראפט?', en: 'Do you want to go to the Minecraft world?' }
    },
    {
      id: 'h_george', avatar: '👤', rarity: 'mystery', weight: 7, kind: 'launch', world: 'planet', talkMs: 30000,
      name: { he: "ג'ורג' המסתורי", en: 'Mysterious George' },
      bio: { he: 'אף אחד לא ראה את פניו. כולם שמעו את קולו.', en: 'Nobody has seen his face. Everybody has heard his voice.' },
      lines: {
        he: ['...הלו? אל תיבהל.', 'אני לא חולה. אני ג\'ורג\'.', 'בכוכב שלי חוקרים את הלב כבר אלפי שנים.', 'צפינו בך. הידע שלך מרשים.', 'זכית בטיסה אחת לכוכב ג\'ורג\' 🪐', 'שם תחכה לך שאלת מחקר אחת. קשה. ושווה הון.'],
        en: ['...Hello? Don\'t be alarmed.', 'I\'m not sick. I\'m George.', 'On my planet we\'ve studied the heart for thousands of years.', 'We\'ve been watching you. Your knowledge is impressive.', 'You\'ve won one flight to Planet George 🪐', 'One research question awaits you there. Hard. And worth a fortune.']
      },
      question: { he: 'רוצה לעבור לכוכב ג\'ורג\'?', en: 'Do you want to go to Planet George?' }
    },
    // ── boosters: ask a question, pay a big bonus ──
    {
      id: 'h_ant', avatar: '🐜', rarity: 'special', weight: 6, reward: 900, kind: 'heart', topic: 'prevention', booster: true,
      name: { he: 'אבא נמלה', en: 'Daddy Ant' },
      bio: { he: 'אבא ל-40,000 ילדים. רוצה שכולם יגדלו בריאים.', en: 'Father of 40,000. Wants them all to grow up healthy.' },
      hello: { he: 'שלום! אבא נמלה כאן. אני רוצה ללמד את הילדים שלי לשמור על הלב — ויש לי פרס גדול למי שיעזור!', en: 'Hello! Daddy Ant here. I want to teach my kids to look after their hearts — and I have a big prize for whoever helps!' },
      scenarios: [
        S({ he: 'רוצה רשימת הרגלים בריאים למושבה.', en: 'Wants a list of healthy habits for the colony.' },
          { he: 'מה מהבאים הכי מסוכן לכלי הדם ושווה להימנע ממנו?', en: 'Which of these is most harmful to blood vessels and worth avoiding?' },
          [{ he: 'הליכה יומית', en: 'Walking every day' },
           { he: 'עישון', en: 'Smoking' },
           { he: 'שתיית מים', en: 'Drinking water' },
           { he: 'שינה טובה', en: 'Good sleep' }], 1,
          { he: 'עישון פוגע בדופן הפנימית של העורקים, מעלה לחץ דם ומאיץ טרשת. המושבה הוכרזה "ללא עישון"!', en: 'Smoking damages the inner lining of arteries, raises blood pressure and speeds up atherosclerosis. The colony is now smoke-free!' },
          { he: 'הילדים שלי לא ישתכנעו מזה… יש תשובה אחרת?', en: 'My kids won\'t be convinced by that… another answer?' }),
        S({ he: 'שואל אילו גורמי סיכון למחלות לב אפשר לשנות.', en: 'Asks which heart-disease risk factors can be changed.' },
          { he: 'איזו קבוצה מכילה רק גורמי סיכון שאפשר לשנות?', en: 'Which group contains only risk factors you can change?' },
          [{ he: 'גיל, גנטיקה ומין', en: 'Age, genetics and sex' },
           { he: 'עישון, תזונה, לחץ דם ופעילות גופנית', en: 'Smoking, diet, blood pressure and physical activity' },
           { he: 'גובה וצבע עיניים', en: 'Height and eye colour' },
           { he: 'יום ההולדת', en: 'Your birthday' }], 1,
          { he: 'את אלה אפשר לשפר בעצמנו — וזה מפחית מאוד את הסיכון.', en: 'These we can improve ourselves — and that cuts the risk a lot.' },
          { he: 'אבל את זה אי אפשר לשנות… נסה שוב!', en: 'But you can\'t change those… try again!' })
      ]
    },
    {
      id: 'h_whale', avatar: '🐋', rarity: 'special', weight: 5, reward: 1800, kind: 'heart', topic: 'attack', booster: true,
      name: { he: 'אמא לוויתן', en: 'Mama Whale' },
      bio: { he: 'הלב שלה שוקל 180 ק"ג. היא יודעת כמה הוא חשוב.', en: 'Her heart weighs 180 kg. She knows how much it matters.' },
      hello: { he: 'ווווּם… אמא לוויתן כאן. בעלי מרגיש לחץ בחזה! תעזור לי לזהות מה קורה — והאוצר שלי שלך.', en: 'Wooom… Mama Whale here. My husband feels pressure in his chest! Help me understand what\'s happening — and my treasure is yours.' },
      scenarios: [
        S({ he: 'בעל בן 60: לחץ חזק בחזה שמקרין ליד שמאל וללסת, זיעה קרה, קוצר נשימה. בהכרה.', en: 'Husband, 60: heavy chest pressure spreading to the left arm and jaw, cold sweat, short of breath. Conscious.' },
          { he: 'מה כנראה קורה ומה עושים עכשיו?', en: 'What is probably happening and what do you do now?' },
          [{ he: 'כנראה התקף לב — מחייגים 101 מיד ולא מחכים שיעבור', en: 'Probably a heart attack — call 101 right away and don\'t wait for it to pass' },
           { he: 'זה סתם עייפות, שילך לישון', en: 'It\'s just tiredness, he should go to sleep' },
           { he: 'לחכות כמה שעות ולראות', en: 'Wait a few hours and see' },
           { he: 'שייקח מקלחת קרה', en: 'He should take a cold shower' }], 0,
          { he: 'זיהוי מהיר מציל שריר לב! במוקד 101 ידריכו מה לעשות עד שהצוות מגיע. האמבולנס בדרך.', en: 'Fast recognition saves heart muscle! The 101 dispatcher will guide you until the crew arrives. The ambulance is on its way.' },
          { he: 'ווווּם… אני מפחדת שזה לא נכון. בבקשה, תחשוב שוב!', en: 'Wooom… I\'m afraid that\'s not right. Please, think again!' }),
        S({ he: 'הבעל איבד הכרה פתאום ולא נושם כרגיל.', en: 'The husband suddenly collapsed and isn\'t breathing normally.' },
          { he: 'מה ההבדל בין התקף לב לדום לב, ומה עושים בדום לב?', en: 'What\'s the difference between a heart attack and cardiac arrest, and what do you do in cardiac arrest?' },
          [{ he: 'אין הבדל, ומחכים', en: 'There\'s no difference, so you wait' },
           { he: 'בהתקף לב עורק כלילי נחסם; בדום לב הלב מפסיק לשאוב. בדום לב: 101, עיסויי חזה ודפיברילטור', en: 'In a heart attack a coronary artery is blocked; in cardiac arrest the heart stops pumping. For arrest: 101, chest compressions and an AED' },
           { he: 'דום לב זה כאב ראש', en: 'Cardiac arrest is a headache' },
           { he: 'נותנים לו לשתות מים', en: 'Give him water to drink' }], 1,
          { he: 'נכון! בדום לב כל דקה קובעת — החייאה ודפיברילטור מוקדם מצילים חיים.', en: 'Correct! In cardiac arrest every minute counts — early CPR and an AED save lives.' },
          { he: 'לא, לא! הוא לא נושם! תחשוב מהר!', en: 'No, no! He isn\'t breathing! Think fast!' })
      ]
    }
  ];

  // Minecraft world (after the Noob): Mr_Ducky 70%, Shaked the puppy 30%
  const MINECRAFT = [
    {
      id: 'h_ducky', avatar: '🦆', rarity: 'epic', weight: 70, reward: 1200, kind: 'heart', topic: 'athero',
      name: { he: 'Mr_Ducky', en: 'Mr_Ducky' },
      bio: { he: 'ברווז קוביות שבונה בתי חולים מבלוקים.', en: 'A blocky duck who builds hospitals out of blocks.' },
      hello: { he: 'קוואק! ברוך הבא לעולם הקוביות! הכפריים כאן אוכלים רק עוגות…', en: 'Quack! Welcome to the block world! The villagers here only eat cake…' },
      scenarios: [
        S({ he: 'כפריים אוכלים רק עוגות וצלעות מטוגנות, ולא זזים מהכפר.', en: 'Villagers eat only cake and fried pork chops and never leave the village.' },
          { he: 'איזה הרגל יעזור לכפריים למנוע טרשת עורקים?', en: 'Which habit will help the villagers prevent atherosclerosis?' },
          [{ he: 'לאכול עוד עוגות', en: 'Eat more cake' },
           { he: 'לאכול יותר ירקות ופירות, פחות מטוגן, ולצאת לטייל ולשחות', en: 'More vegetables and fruit, less fried food, and go hiking and swimming' },
           { he: 'לישון 20 שעות ביום', en: 'Sleep 20 hours a day' },
           { he: 'להתחיל לעשן', en: 'Start smoking' }], 1,
          { he: 'קוואק! הכפריים שתלו גינת ירקות ובנו מסלול ריצה מבלוקים!', en: 'Quack! The villagers planted a vegetable garden and built a running track out of blocks!' },
          { he: 'קוואק?! זה לא יעבוד בעולם שלנו… נסה שוב!', en: 'Quack?! That won\'t work in our world… try again!' }),
        S({ he: 'כפרי זקן מרגיש כאב בחזה כשהוא כורה.', en: 'An old villager feels chest pain while mining.' },
          { he: 'מה תפקיד העורקים הכליליים?', en: 'What do the coronary arteries do?' },
          [{ he: 'הם מספקים דם וחמצן לשריר הלב עצמו', en: 'They supply blood and oxygen to the heart muscle itself' },
           { he: 'הם מעבירים אוויר לריאות', en: 'They carry air to the lungs' },
           { he: 'הם מעכלים אוכל', en: 'They digest food' },
           { he: 'אין להם תפקיד', en: 'They have no job' }], 0,
          { he: 'נכון! כשעורק כלילי נחסם, חלק משריר הלב לא מקבל חמצן — וזה התקף לב.', en: 'Right! When a coronary artery is blocked, part of the heart muscle gets no oxygen — that\'s a heart attack.' },
          { he: 'קוואק… הכפרי עדיין כורה עם כאב. תחשוב שוב!', en: 'Quack… the villager is still mining in pain. Think again!' })
      ]
    },
    {
      id: 'h_shaked', avatar: '🐶', rarity: 'legendary', weight: 30, reward: 2200, kind: 'heart', topic: 'attack',
      name: { he: 'שקד הכלבלב', en: 'Shaked the Puppy' },
      bio: { he: 'כלבלב קוביות נאמן. נובח פעמיים כשמישהו צריך עזרה.', en: 'A loyal block puppy. Barks twice when someone needs help.' },
      hello: { he: 'הב! הב! הבעלים שלי נפל ליד המכרה! תעזור לי!', en: 'Woof! Woof! My owner fell down near the mine! Help me!' },
      scenarios: [
        S({ he: 'הבעלים לא מגיב ולא נושם כרגיל.', en: 'The owner isn\'t responding and isn\'t breathing normally.' },
          { he: 'מה עושים מיד?', en: 'What do you do right away?' },
          [{ he: 'מחכים שיתעורר לבד', en: 'Wait for him to wake up by himself' },
           { he: 'מחייגים 101, מתחילים עיסויי חזה ומביאים דפיברילטור', en: 'Call 101, start chest compressions and get an AED' },
           { he: 'נותנים לו לאכול', en: 'Give him something to eat' },
           { he: 'שמים אותו לישון במיטה', en: 'Put him to bed' }], 1,
          { he: 'הב! הב! ההחייאה עבדה והבעלים נושם! שקד מכשכש בזנב.', en: 'Woof! Woof! The CPR worked and the owner is breathing! Shaked is wagging his tail.' },
          { he: 'ייייפ… זה לא עוזר! תחשוב שוב, מהר!', en: 'Yelp… that isn\'t helping! Think again, fast!' }),
        S({ he: 'הבעלים מתלונן על לחץ בחזה וזיעה קרה, אבל בהכרה.', en: 'The owner complains of chest pressure and cold sweat, but is conscious.' },
          { he: 'איזה תסמין יכול להעיד על התקף לב?', en: 'Which symptom can be a sign of a heart attack?' },
          [{ he: 'לחץ או כאב בחזה שמקרין ליד, ללסת או לגב', en: 'Pressure or pain in the chest spreading to the arm, jaw or back' },
           { he: 'שיהוקים', en: 'Hiccups' },
           { he: 'גירוד באף', en: 'An itchy nose' },
           { he: 'רעב', en: 'Hunger' }], 0,
          { he: 'הב! זיהית בזמן — קראנו ל-101 והעזרה בדרך.', en: 'Woof! You spotted it in time — we called 101 and help is coming.' },
          { he: 'הב? לא נראה לי… תנסה שוב!', en: 'Woof? I don\'t think so… try again!' })
      ]
    }
  ];

  // Planet George: advanced research questions
  const PLANET = [
    {
      id: 'h_tzvi', avatar: '🐢', rarity: 'rare', weight: 40, reward: 2000, kind: 'heart', topic: 'athero',
      name: { he: 'דוד צבי', en: 'Uncle Tzvi' },
      bio: { he: 'צב בן 212 וחוקר עורקים. העורקים שלו גמישים כמו של בן 20.', en: 'A 212-year-old turtle and artery researcher. His arteries are as flexible as a 20-year-old\'s.' },
      hello: { he: 'שָׁלוֹם… יַלְדִּי… יֵשׁ לִי… שְׁאֵלַת מֶחְקָר…', en: 'Hel…lo… my child… I have… a research question…' },
      scenarios: [
        S({ he: 'שאלת מחקר: מה גורם לפלאק להפוך מסוכן פתאום.', en: 'Research question: what makes plaque suddenly dangerous.' },
          { he: 'למה פלאק בעורק כלילי עלול לגרום להתקף לב פתאומי גם כשההיצרות קטנה?', en: 'Why can plaque in a coronary artery cause a sudden heart attack even when the narrowing is small?' },
          [{ he: 'כי הפלאק עלול להיסדק, ועליו נוצר קריש דם שחוסם את העורק', en: 'Because the plaque can crack, and a blood clot forms on it and blocks the artery' },
           { he: 'כי פלאק הופך לעצם', en: 'Because plaque turns into bone' },
           { he: 'כי הלב שוכח לפעום', en: 'Because the heart forgets to beat' },
           { he: 'כי העורק מתרחב מאוד', en: 'Because the artery widens a lot' }], 0,
          { he: 'מְצֻיָּן… קְרִישׁ עַל פְּלָאק שֶׁנִּסְדַּק… זֶה הַסּוֹד.', en: 'Ex…cellent… a clot on cracked plaque… that is the secret.' },
          { he: 'לֹא… יַלְדִּי… חֲשֹׁב… לְאַט…', en: 'No… my child… think… slowly…' })
      ]
    },
    {
      id: 'h_elephant', avatar: '🐘', rarity: 'epic', weight: 35, reward: 3000, kind: 'heart', topic: 'pressure',
      name: { he: 'אח סטרוברי אלפנט', en: 'Brother Strawberry Elephant' },
      bio: { he: 'פיל בטעם תות ופרופסור לכלי דם.', en: 'A strawberry-flavoured elephant and professor of blood vessels.' },
      hello: { he: 'טרררום! 🍓 אחי! שאלה מהמעבדה הוורודה שלי!', en: 'TRRRUMP! 🍓 Bro! A question from my pink lab!' },
      scenarios: [
        S({ he: 'שאלת מחקר על הדופן הפנימית של העורק.', en: 'Research question about the inner lining of the artery.' },
          { he: 'איך עישון ולחץ דם גבוה מתחילים את תהליך טרשת העורקים?', en: 'How do smoking and high blood pressure start the process of atherosclerosis?' },
          [{ he: 'הם פוגעים בשכבה הפנימית של העורק (האנדותל), ושם מתחילים לחדור שומנים ותאי דלקת', en: 'They damage the artery\'s inner layer (the endothelium), where fats and inflammatory cells start getting in' },
           { he: 'הם מוסיפים ויטמינים לדם', en: 'They add vitamins to the blood' },
           { he: 'הם מקררים את הלב', en: 'They cool the heart' },
           { he: 'אין להם שום קשר', en: 'They have nothing to do with it' }], 0,
          { he: 'טרררום! בדיוק! נזק לאנדותל הוא נקודת ההתחלה. קבל סל תותים מוזהבים!', en: 'TRRRUMP! Exactly! Endothelium damage is where it starts. Have a basket of golden strawberries!' },
          { he: 'אחי… זה לא מה שראיתי במיקרוסקופ. עוד ניסיון?', en: 'Bro… that\'s not what I saw under the microscope. Another try?' })
      ]
    },
    {
      id: 'h_legend', avatar: '🤴', rarity: 'legendary', weight: 25, reward: 5000, kind: 'heart', topic: 'attack',
      name: { he: "ג'ורג' האגדי", en: 'Legendary George' },
      bio: { he: 'סוף סוף בלי צללית. עם כתר. אגדה.', en: 'At last, no shadow. With a crown. A legend.' },
      hello: { he: 'ובכן… הגעת אליי. מעטים עונים נכון על השאלה שלי.', en: 'Well… you reached me. Few answer my question correctly.' },
      scenarios: [
        S({ he: 'שאלת המחקר הגדולה של הכוכב.', en: 'The planet\'s great research question.' },
          { he: 'למה בהתקף לב אומרים "זמן הוא שריר"?', en: 'Why do they say "time is muscle" in a heart attack?' },
          [{ he: 'כי ככל שהעורק החסום נשאר סגור יותר זמן, יותר תאי שריר לב מתים — טיפול מהיר מציל שריר', en: 'Because the longer the blocked artery stays closed, the more heart muscle cells die — fast treatment saves muscle' },
           { he: 'כי השרירים גדלים עם הזמן', en: 'Because muscles grow over time' },
           { he: 'כי התקף לב עובר לבד אחרי שעה', en: 'Because a heart attack passes by itself after an hour' },
           { he: 'כי צריך לעשות כושר בזמן התקף', en: 'Because you should exercise during an attack' }], 0,
          { he: 'מושלם. כל דקה שמחכים — עוד שריר הולך לאיבוד. שמך ייכתב בכוכבים 👑', en: 'Perfect. Every minute of waiting loses more muscle. Your name will be written in the stars 👑' },
          { he: 'לא… אגדות לא מוותרות. נסה שוב.', en: 'No… legends don\'t give up. Try again.' })
      ]
    }
  ];

  // Short heart-health reference shown in the MDA app
  const INFO = [
    {
      id: 'athero', icon: '⟿',
      title: { he: 'טרשת עורקים', en: 'Atherosclerosis' },
      action: { he: 'פלאק שומני מצר ומקשיח עורקים', en: 'Fatty plaque narrows and stiffens arteries' },
      signs: { he: 'לרוב בלי תסמינים עד שהעורק מצר מאוד', en: 'Usually no symptoms until the artery is very narrow' },
      steps: {
        he: ['שומנים, כולסטרול ותאי דלקת מצטברים בדופן העורק ויוצרים פלאק', 'פחות דם וחמצן עוברים; פלאק שנסדק עלול ליצור קריש שחוסם', 'פגיעים במיוחד: עורקים כליליים (לב), עורקי הצוואר (שבץ), עורקי הרגליים'],
        en: ['Fats, cholesterol and inflammatory cells build up in the artery wall as plaque', 'Less blood and oxygen get through; cracked plaque can form a blocking clot', 'Most at risk: coronary (heart), carotid (stroke) and leg arteries']
      }
    },
    {
      id: 'attack', icon: '♥',
      title: { he: 'התקף לב מול דום לב', en: 'Heart attack vs cardiac arrest' },
      action: { he: 'התקף: עורק חסום · דום: הלב לא שואב', en: 'Attack: blocked artery · Arrest: heart stops pumping' },
      signs: { he: 'התקף: לחץ בחזה שמקרין ליד/לסת/גב, זיעה קרה, קוצר נשימה. דום: מחוסר הכרה ולא נושם', en: 'Attack: chest pressure spreading to arm/jaw/back, cold sweat, breathlessness. Arrest: unresponsive, not breathing' },
      steps: {
        he: ['התקף לב: עורק כלילי נחסם ושריר הלב לא מקבל חמצן — חייגו 101 מיד', 'דום לב: תקלה חשמלית, הלב מפסיק לשאוב — 101, עיסויים ודפיברילטור', '"זמן הוא שריר": כל דקה של המתנה פוגעת בשריר הלב'],
        en: ['Heart attack: a coronary artery is blocked and heart muscle lacks oxygen — call 101 now', 'Cardiac arrest: an electrical failure, the heart stops pumping — 101, compressions and an AED', '"Time is muscle": every minute of waiting damages heart muscle']
      }
    },
    {
      id: 'prevent', icon: '✓',
      title: { he: 'מניעה ואורח חיים', en: 'Prevention & lifestyle' },
      action: { he: 'לא לעשן · לזוז · לאכול נכון · לשמור על לחץ דם', en: 'No smoking · move · eat well · watch blood pressure' },
      signs: { he: 'גורמי סיכון: עישון, תזונה עתירת שומן ומלח, לחץ דם גבוה, חוסר פעילות, מתח', en: 'Risks: smoking, high-fat and high-salt diet, high blood pressure, inactivity, stress' },
      steps: {
        he: ['לפחות 150 דקות בשבוע של פעילות אירובית מתונה', 'תזונה ים-תיכונית, פחות מלח ושומן רווי, דגים שמנים פעמיים בשבוע', 'שינה מספקת והפחתת מתח עוזרות לשמור על לחץ דם תקין'],
        en: ['At least 150 minutes a week of moderate aerobic activity', 'Mediterranean diet, less salt and saturated fat, oily fish twice a week', 'Enough sleep and less stress help keep blood pressure normal']
      }
    }
  ];

  const MODES = ['mixed', 'heart', 'classic'];

  // The developer's rules for the AI patient (used only when an AI key is set)
  const AI_RULES = `You are the AI engine of a medical simulation game. You play ONE patient character who contacts the player (a paramedic) through the MDA app chat.
Strict rules:
- Act only as the given character. Stay inside the given topic: atherosclerosis; heart attack and cardiac arrest; prevention and lifestyle (smoking, diet, blood pressure, exercise, habits for healthy blood vessels). Do not add information beyond these topics.
- Answer only according to what the player writes. If the player's answer is wrong, irrelevant or "I don't know", react in character (frustration, confusion, asking for more help) and NEVER give the answer yourself.
- The player succeeds only if they: saved the patient, helped them take the right medication, or gave accurate medical/preventive guidance for the problem asked.
- Keep replies to 1-3 short sentences, in the player's language.`;

  const HEART = { CAST, MINECRAFT, PLANET, INFO, MODES, AI_RULES };
  if (typeof module !== 'undefined' && module.exports) module.exports = HEART;
  else root.HEART = HEART;
})(typeof window !== 'undefined' ? window : globalThis);
