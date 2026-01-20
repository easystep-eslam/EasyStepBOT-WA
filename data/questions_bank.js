// questions_bank.js

// 100 Arabic + 100 English Trivia Questions

// Format: { q, options: [a,b,c,d], correctIndex: 0..3 }

const AR_QUESTIONS = [

  { q: 'ما هي عاصمة مصر؟', options: ['القاهرة', 'الإسكندرية', 'أسوان', 'المنصورة'], correctIndex: 0 },

  { q: 'كم عدد قارات العالم؟', options: ['5', '6', '7', '8'], correctIndex: 2 },

  { q: 'أي كوكب أقرب للشمس؟', options: ['الزهرة', 'المريخ', 'عطارد', 'الأرض'], correctIndex: 2 },

  { q: 'كم عدد أيام السنة الكبيسة؟', options: ['365', '366', '364', '360'], correctIndex: 1 },

  { q: 'ما هو أكبر محيط في العالم؟', options: ['الأطلسي', 'الهندي', 'الهادئ', 'المتجمد الشمالي'], correctIndex: 2 },

  { q: 'ما هي عاصمة السعودية؟', options: ['الرياض', 'جدة', 'مكة', 'الدمام'], correctIndex: 0 },

  { q: 'ما هي عاصمة المغرب؟', options: ['الرباط', 'الدار البيضاء', 'مراكش', 'طنجة'], correctIndex: 0 },

  { q: 'ما هو الكوكب الأحمر؟', options: ['المريخ', 'الزهرة', 'عطارد', 'نبتون'], correctIndex: 0 },

  { q: 'ما هي عاصمة فرنسا؟', options: ['باريس', 'ليون', 'مرسيليا', 'نيس'], correctIndex: 0 },

  { q: 'ما هي عاصمة إيطاليا؟', options: ['روما', 'ميلانو', 'نابولي', 'فلورنسا'], correctIndex: 0 },

  { q: 'ما هي عاصمة تركيا؟', options: ['إسطنبول', 'أنقرة', 'إزمير', 'بورصة'], correctIndex: 1 },

  { q: 'ما هو أكبر كوكب في المجموعة الشمسية؟', options: ['زحل', 'المشتري', 'نبتون', 'أورانوس'], correctIndex: 1 },

  { q: 'ما هو أصغر كوكب في المجموعة الشمسية؟', options: ['عطارد', 'الزهرة', 'المريخ', 'الأرض'], correctIndex: 0 },

  { q: 'كم عدد الكواكب في المجموعة الشمسية؟', options: ['7', '8', '9', '10'], correctIndex: 1 },

  { q: 'أي دولة بها سور الصين العظيم؟', options: ['اليابان', 'الصين', 'كوريا', 'تايلاند'], correctIndex: 1 },

  { q: 'ما هو الحيوان الملقب بسفينة الصحراء؟', options: ['الجمل', 'الحصان', 'الأسد', 'النعامة'], correctIndex: 0 },

  { q: 'ما هو أكبر عضو في جسم الإنسان؟', options: ['القلب', 'الجلد', 'الكبد', 'المخ'], correctIndex: 1 },

  { q: 'كم عدد أسنان الإنسان البالغ عادة؟', options: ['28', '30', '32', '34'], correctIndex: 2 },

  { q: 'ما هي عاصمة الإمارات؟', options: ['دبي', 'أبوظبي', 'الشارقة', 'العين'], correctIndex: 1 },

  { q: 'ما هي عاصمة قطر؟', options: ['الدوحة', 'الريان', 'الوكرة', 'الخُور'], correctIndex: 0 },

  { q: 'ما هي عاصمة العراق؟', options: ['بغداد', 'البصرة', 'الموصل', 'أربيل'], correctIndex: 0 },

  { q: 'ما هي عاصمة الأردن؟', options: ['عمان', 'إربد', 'الزرقاء', 'العقبة'], correctIndex: 0 },

  { q: 'ما هي عاصمة لبنان؟', options: ['بيروت', 'طرابلس', 'صيدا', 'جبيل'], correctIndex: 0 },

  { q: 'ما هي عاصمة سوريا؟', options: ['دمشق', 'حلب', 'حمص', 'اللاذقية'], correctIndex: 0 },

  { q: 'ما هي عاصمة الجزائر؟', options: ['الجزائر', 'وهران', 'قسنطينة', 'عنابة'], correctIndex: 0 },

  { q: 'ما هي عاصمة تونس؟', options: ['تونس', 'صفاقس', 'سوسة', 'قابس'], correctIndex: 0 },

  { q: 'ما هي عاصمة ليبيا؟', options: ['طرابلس', 'بنغازي', 'مصراتة', 'سبها'], correctIndex: 0 },

  { q: 'ما هي عاصمة اليابان؟', options: ['طوكيو', 'أوساكا', 'كيوتو', 'ناغويا'], correctIndex: 0 },

  { q: 'ما هي عاصمة الصين؟', options: ['بكين', 'شنغهاي', 'هونغ كونغ', 'شينزين'], correctIndex: 0 },

  { q: 'كم عدد ألوان قوس قزح؟', options: ['5', '6', '7', '8'], correctIndex: 2 },

  { q: 'كم عدد أضلاع المثلث؟', options: ['2', '3', '4', '5'], correctIndex: 1 },

  { q: 'كم عدد أضلاع المربع؟', options: ['3', '4', '5', '6'], correctIndex: 1 },

  { q: 'ما ناتج 9×9؟', options: ['72', '81', '90', '99'], correctIndex: 1 },

  { q: 'أي عنصر رمزه Fe؟', options: ['الحديد', 'الفضة', 'الذهب', 'النحاس'], correctIndex: 0 },

  { q: 'أي مما يلي ليس من الحواس الخمس؟', options: ['الشم', 'اللمس', 'الذوق', 'الحدس'], correctIndex: 3 },

  { q: 'ما هو الغاز الضروري للتنفس؟', options: ['الأكسجين', 'الهيليوم', 'الهيدروجين', 'النيتروجين'], correctIndex: 0 },

  { q: 'ما هي أكبر قارة؟', options: ['آسيا', 'أفريقيا', 'أوروبا', 'أمريكا الجنوبية'], correctIndex: 0 },

  { q: 'ما هي أصغر قارة؟', options: ['أستراليا', 'أوروبا', 'أنتاركتيكا', 'أفريقيا'], correctIndex: 0 },

  { q: 'أكبر حيوان في العالم هو؟', options: ['الحوت الأزرق', 'الفيل', 'الزرافة', 'القرش الأبيض'], correctIndex: 0 },

  { q: 'لغة البرازيل الرسمية هي؟', options: ['البرتغالية', 'الإسبانية', 'الإنجليزية', 'الفرنسية'], correctIndex: 0 },

  { q: 'في أي قارة تقع مصر؟', options: ['أفريقيا', 'آسيا', 'أوروبا', 'أستراليا'], correctIndex: 0 },

  { q: 'أقرب نجم للأرض هو؟', options: ['الشمس', 'سيريوس', 'فيجا', 'نجم القطب'], correctIndex: 0 },

  { q: 'كم دقيقة في الساعة؟', options: ['30', '60', '90', '120'], correctIndex: 1 },

  { q: 'كم ثانية في الدقيقة؟', options: ['30', '45', '60', '90'], correctIndex: 2 },

  { q: 'ناتج 10+15؟', options: ['20', '25', '30', '35'], correctIndex: 1 },

  { q: 'ناتج 12-5؟', options: ['5', '6', '7', '8'], correctIndex: 2 },

  { q: 'عاصمة السودان؟', options: ['الخرطوم', 'أم درمان', 'بورسودان', 'كسلا'], correctIndex: 0 },

  { q: 'عاصمة فلسطين (حسب المتداول)؟', options: ['القدس', 'غزة', 'رام الله', 'الخليل'], correctIndex: 0 },

  { q: 'عاصمة الكويت؟', options: ['مدينة الكويت', 'الجهراء', 'حولي', 'الفروانية'], correctIndex: 0 },

  { q: 'عاصمة البحرين؟', options: ['المنامة', 'المحرق', 'الرفاع', 'سترة'], correctIndex: 0 },

  { q: 'عاصمة عُمان؟', options: ['مسقط', 'صلالة', 'صحار', 'نزوى'], correctIndex: 0 },

  { q: 'عاصمة اليمن؟', options: ['صنعاء', 'عدن', 'تعز', 'الحديدة'], correctIndex: 0 },

  { q: 'عاصمة إسبانيا؟', options: ['مدريد', 'برشلونة', 'إشبيلية', 'فالنسيا'], correctIndex: 0 },

  { q: 'عاصمة ألمانيا؟', options: ['برلين', 'ميونخ', 'هامبورغ', 'فرانكفورت'], correctIndex: 0 },

  { q: 'عاصمة روسيا؟', options: ['موسكو', 'سان بطرسبرغ', 'قازان', 'سوتشي'], correctIndex: 0 },

  { q: 'عاصمة كندا؟', options: ['أوتاوا', 'تورونتو', 'فانكوفر', 'مونتريال'], correctIndex: 0 },

  { q: 'عاصمة أستراليا؟', options: ['كانبرا', 'سيدني', 'ملبورن', 'بيرث'], correctIndex: 0 },

  { q: 'عاصمة الهند؟', options: ['نيودلهي', 'مومباي', 'بنغالور', 'كولكاتا'], correctIndex: 0 },

  { q: 'عاصمة باكستان؟', options: ['إسلام آباد', 'كراتشي', 'لاهور', 'فيصل آباد'], correctIndex: 0 },

  { q: 'عاصمة اليونان؟', options: ['أثينا', 'سالونيك', 'باتراس', 'هيراكليون'], correctIndex: 0 },

  { q: 'عاصمة السويد؟', options: ['ستوكهولم', 'غوتنبرغ', 'مالمو', 'أوبسالا'], correctIndex: 0 },

  { q: 'عاصمة النرويج؟', options: ['أوسلو', 'بيرغن', 'تروندهايم', 'ستافنغر'], correctIndex: 0 },

  { q: 'عاصمة الدنمارك؟', options: ['كوبنهاغن', 'أرهوس', 'أودنسه', 'ألبورغ'], correctIndex: 0 },

  { q: 'عاصمة فنلندا؟', options: ['هلسنكي', 'إسبو', 'تامبيري', 'توركو'], correctIndex: 0 },

  { q: 'عاصمة إيرلندا؟', options: ['دبلن', 'كورك', 'غالواي', 'ليمريك'], correctIndex: 0 },

  { q: 'عاصمة البرتغال؟', options: ['لشبونة', 'بورتو', 'براغا', 'كوامبرا'], correctIndex: 0 },

  { q: 'عاصمة بلجيكا؟', options: ['بروكسل', 'أنتويرب', 'بروج', 'غنت'], correctIndex: 0 },

  { q: 'عاصمة سويسرا؟', options: ['برن', 'زيورخ', 'جنيف', 'لوزان'], correctIndex: 0 },

  { q: 'عاصمة هولندا؟', options: ['أمستردام', 'روتردام', 'لاهاي', 'أوترخت'], correctIndex: 0 },

  { q: 'عاصمة النمسا؟', options: ['فيينا', 'غراتس', 'لينتس', 'سالزبورغ'], correctIndex: 0 },

  { q: 'عاصمة بولندا؟', options: ['وارسو', 'كراكوف', 'غدانسك', 'فروتسواف'], correctIndex: 0 },

  { q: 'عاصمة التشيك؟', options: ['براغ', 'برنو', 'أوسترافا', 'بلزن'], correctIndex: 0 },

  { q: 'عاصمة المجر؟', options: ['بودابست', 'ديبريسن', 'سيغيد', 'مشكولتس'], correctIndex: 0 },

  { q: 'عاصمة رومانيا؟', options: ['بوخارست', 'كلوج', 'تيميشوارا', 'ياش'], correctIndex: 0 },

  { q: 'عاصمة بلغاريا؟', options: ['صوفيا', 'فارنا', 'بلوفديف', 'بورغاس'], correctIndex: 0 },

  { q: 'عاصمة صربيا؟', options: ['بلغراد', 'نوفي ساد', 'نيش', 'كراغويفاتس'], correctIndex: 0 },

  { q: 'عاصمة كرواتيا؟', options: ['زغرب', 'سبليت', 'دوبروفنيك', 'رييكا'], correctIndex: 0 },

  { q: 'عاصمة سلوفاكيا؟', options: ['براتيسلافا', 'كوشيتسه', 'جليفينا', 'نيترا'], correctIndex: 0 },

  { q: 'عاصمة سلوفينيا؟', options: ['ليوبليانا', 'ماريبور', 'تسيله', 'كوبر'], correctIndex: 0 },

  { q: 'عاصمة ليتوانيا؟', options: ['فيلنيوس', 'كاوناس', 'كلايبيدا', 'شياولياي'], correctIndex: 0 },

  { q: 'عاصمة لاتفيا؟', options: ['ريغا', 'داوجافبيلس', 'ليبايا', 'ييلغافا'], correctIndex: 0 },

  { q: 'عاصمة إستونيا؟', options: ['تالين', 'تارتو', 'بارنو', 'نارفا'], correctIndex: 0 },

  { q: 'عاصمة أوكرانيا؟', options: ['كييف', 'خاركيف', 'أوديسا', 'لفيف'], correctIndex: 0 },

  { q: 'عاصمة بيلاروسيا؟', options: ['مينسك', 'غوميل', 'فيتبسك', 'موغيليف'], correctIndex: 0 },

  { q: 'عاصمة جورجيا؟', options: ['تبليسي', 'باتومي', 'كوتايسي', 'روستافي'], correctIndex: 0 },

  { q: 'عاصمة أرمينيا؟', options: ['يريفان', 'غيومري', 'فانادزور', 'أشتاراك'], correctIndex: 0 },

  { q: 'عاصمة أذربيجان؟', options: ['باكو', 'غانجا', 'سومغاييت', 'لنكران'], correctIndex: 0 },

  { q: 'عاصمة إيران؟', options: ['طهران', 'أصفهان', 'مشهد', 'شيراز'], correctIndex: 0 },

  { q: 'عاصمة أفغانستان؟', options: ['كابول', 'قندهار', 'هرات', 'مزار شريف'], correctIndex: 0 },

  { q: 'عاصمة سريلانكا (البرلمان)؟', options: ['سري جاياواردنابورا كوتي', 'كولومبو', 'كاندي', 'غال'], correctIndex: 0 },

  { q: 'عاصمة تايلاند؟', options: ['بانكوك', 'شيانغ ماي', 'فوكيت', 'بتايا'], correctIndex: 0 },

  { q: 'عاصمة فيتنام؟', options: ['هانوي', 'هو تشي منه', 'دا نانغ', 'هايفونغ'], correctIndex: 0 },

  { q: 'عاصمة كوريا الجنوبية؟', options: ['سيول', 'بوسان', 'إنتشون', 'دايغو'], correctIndex: 0 },

  { q: 'عاصمة إندونيسيا؟', options: ['جاكرتا', 'بالي', 'سورابايا', 'باندونغ'], correctIndex: 0 },

  { q: 'عاصمة ماليزيا؟', options: ['كوالالمبور', 'جورج تاون', 'جوهور', 'ملقا'], correctIndex: 0 },

  { q: 'عاصمة سنغافورة هي؟', options: ['سنغافورة', '—', '—', '—'], correctIndex: 0 },

  { q: 'عاصمة نيوزيلندا؟', options: ['ويلينغتون', 'أوكلاند', 'كرايستشيرش', 'هاميلتون'], correctIndex: 0 },

  { q: 'عاصمة جنوب أفريقيا (التنفيذية)؟', options: ['بريتوريا', 'كيب تاون', 'بلومفونتين', 'ديربان'], correctIndex: 0 },

  { q: 'أي حيوان يُعرف بأنه أذكى الثدييات البحرية؟', options: ['الدلفين', 'القرش', 'التونة', 'الأخطبوط'], correctIndex: 0 },

  { q: 'ما هي المادة التي تُكوّن طبقة خارجية صلبة للأسنان؟', options: ['المينا', 'الدم', 'الجلد', 'العظم'], correctIndex: 0 },

  { q: 'أي كوكب يُعرف بكوكب الحلقات؟', options: ['زحل', 'المريخ', 'عطارد', 'الزهرة'], correctIndex: 0 },

  { q: 'ما هو أطول نهر في العالم (حسب الشائع)؟', options: ['النيل', 'الأمازون', 'الدانوب', 'الكونغو'], correctIndex: 0 },

  { q: 'ما هو أكبر بحر داخلي؟', options: ['بحر قزوين', 'البحر الأسود', 'بحر البلطيق', 'بحر العرب'], correctIndex: 0 },

  { q: 'كم شهرًا في السنة؟', options: ['10', '11', '12', '13'], correctIndex: 2 },

  { q: 'ما اسم صوت القطة؟', options: ['مواء', 'نهيق', 'صهيل', 'زئير'], correctIndex: 0 },

  { q: 'ما اسم صوت الأسد؟', options: ['زئير', 'مواء', 'نعيب', 'صهيل'], correctIndex: 0 },

  { q: 'ما اسم جهاز قياس الحرارة؟', options: ['الترمومتر', 'البارومتر', 'الأنيمومتر', 'السونار'], correctIndex: 0 },

  { q: 'أكبر كوكب في المجموعة الشمسية هو؟', options: ['المشتري', 'زحل', 'نبتون', 'أورانوس'], correctIndex: 0 },

  { q: 'كم عدد حروف اللغة العربية؟', options: ['28', '26', '29', '30'], correctIndex: 0 },

  { q: 'كم عدد حروف اللغة الإنجليزية؟', options: ['26', '24', '25', '27'], correctIndex: 0 },

  { q: 'أي مما يلي طائر؟', options: ['النسر', 'التمساح', 'الحوت', 'الثعلب'], correctIndex: 0 },

  { q: 'أي مما يلي من الفواكه؟', options: ['التفاح', 'البصل', 'الجزر', 'الملح'], correctIndex: 0 },

];

const EN_QUESTIONS = [

  { q: 'What is the capital of the United Kingdom?', options: ['London', 'Manchester', 'Liverpool', 'Birmingham'], correctIndex: 0 },

  { q: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'], correctIndex: 1 },

  { q: 'How many continents are there?', options: ['5', '6', '7', '8'], correctIndex: 2 },

  { q: 'What is the largest ocean?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], correctIndex: 2 },

  { q: 'Who wrote “Romeo and Juliet”?', options: ['Shakespeare', 'Dickens', 'Hemingway', 'Tolkien'], correctIndex: 0 },

  { q: 'What is H2O?', options: ['Salt', 'Water', 'Oxygen', 'Hydrogen'], correctIndex: 1 },

  { q: 'Which animal is the fastest land animal?', options: ['Cheetah', 'Lion', 'Horse', 'Wolf'], correctIndex: 0 },

  { q: 'What is the capital of France?', options: ['Paris', 'Lyon', 'Marseille', 'Nice'], correctIndex: 0 },

  { q: 'What is the capital of Japan?', options: ['Osaka', 'Kyoto', 'Tokyo', 'Nagoya'], correctIndex: 2 },

  { q: 'Which gas do humans need to breathe?', options: ['Nitrogen', 'Oxygen', 'Helium', 'Carbon dioxide'], correctIndex: 1 },

  { q: 'How many days are in a leap year?', options: ['364', '365', '366', '367'], correctIndex: 2 },

  { q: 'Which is the largest planet?', options: ['Saturn', 'Jupiter', 'Neptune', 'Earth'], correctIndex: 1 },

  { q: 'What is the capital of Italy?', options: ['Milan', 'Rome', 'Naples', 'Venice'], correctIndex: 1 },

  { q: 'What is the smallest planet in our solar system?', options: ['Mars', 'Mercury', 'Venus', 'Earth'], correctIndex: 1 },

  { q: 'Which country built the Great Wall?', options: ['Japan', 'China', 'Korea', 'Thailand'], correctIndex: 1 },

  { q: 'How many letters are in the English alphabet?', options: ['24', '25', '26', '27'], correctIndex: 2 },

  { q: 'What is the largest mammal?', options: ['Elephant', 'Blue whale', 'Giraffe', 'Great white shark'], correctIndex: 1 },

  { q: 'Which continent is the largest?', options: ['Africa', 'Asia', 'Europe', 'South America'], correctIndex: 1 },

  { q: 'Which continent is the smallest?', options: ['Australia', 'Europe', 'Antarctica', 'Africa'], correctIndex: 0 },

  { q: 'What is 9 × 9?', options: ['72', '81', '90', '99'], correctIndex: 1 },

  { q: 'Which metal has the symbol Fe?', options: ['Gold', 'Iron', 'Silver', 'Copper'], correctIndex: 1 },

  { q: 'What is the boiling point of water (°C)?', options: ['90', '100', '110', '120'], correctIndex: 1 },

  { q: 'Which planet is closest to the sun?', options: ['Venus', 'Earth', 'Mercury', 'Mars'], correctIndex: 2 },

  { q: 'What is the capital of Canada?', options: ['Toronto', 'Vancouver', 'Ottawa', 'Montreal'], correctIndex: 2 },

  { q: 'What is the capital of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], correctIndex: 2 },

  { q: 'Which is the longest river (common trivia)?', options: ['Amazon', 'Nile', 'Danube', 'Congo'], correctIndex: 1 },

  { q: 'How many colors are in a rainbow?', options: ['5', '6', '7', '8'], correctIndex: 2 },

  { q: 'Which instrument has 88 keys?', options: ['Guitar', 'Piano', 'Violin', 'Drums'], correctIndex: 1 },

  { q: 'Which animal is known as the “King of the Jungle”?', options: ['Tiger', 'Lion', 'Elephant', 'Leopard'], correctIndex: 1 },

  { q: 'What is the capital of Spain?', options: ['Barcelona', 'Madrid', 'Seville', 'Valencia'], correctIndex: 1 },

  { q: 'Which planet has rings?', options: ['Mars', 'Saturn', 'Mercury', 'Venus'], correctIndex: 1 },

  { q: 'What is the largest bone in the human body?', options: ['Skull', 'Femur', 'Rib', 'Humerus'], correctIndex: 1 },

  { q: 'How many sides does a triangle have?', options: ['2', '3', '4', '5'], correctIndex: 1 },

  { q: 'How many sides does a square have?', options: ['3', '4', '5', '6'], correctIndex: 1 },

  { q: 'What is the capital of Germany?', options: ['Munich', 'Berlin', 'Hamburg', 'Frankfurt'], correctIndex: 1 },

  { q: 'What is the capital of Russia?', options: ['Moscow', 'Kazan', 'Sochi', 'Novosibirsk'], correctIndex: 0 },

  { q: 'What is the main language of Brazil?', options: ['Spanish', 'Portuguese', 'English', 'French'], correctIndex: 1 },

  { q: 'Which vitamin do we get from sunlight?', options: ['Vitamin A', 'Vitamin B', 'Vitamin C', 'Vitamin D'], correctIndex: 3 },

  { q: 'Which is the hardest natural substance?', options: ['Gold', 'Diamond', 'Iron', 'Silver'], correctIndex: 1 },

  { q: 'What do bees produce?', options: ['Milk', 'Honey', 'Oil', 'Water'], correctIndex: 1 },

  { q: 'Which animal is a mammal?', options: ['Shark', 'Dolphin', 'Octopus', 'Tuna'], correctIndex: 1 },

  { q: 'What is the capital of Turkey?', options: ['Istanbul', 'Ankara', 'Izmir', 'Bursa'], correctIndex: 1 },

  { q: 'Which is the tallest land animal?', options: ['Elephant', 'Giraffe', 'Horse', 'Camel'], correctIndex: 1 },

  { q: 'How many planets are in the solar system?', options: ['7', '8', '9', '10'], correctIndex: 1 },

  { q: 'Which country is known as the Land of the Rising Sun?', options: ['China', 'Japan', 'Korea', 'Thailand'], correctIndex: 1 },

  { q: 'What is the capital of Egypt?', options: ['Cairo', 'Alexandria', 'Giza', 'Aswan'], correctIndex: 0 },

  { q: 'How many minutes are in an hour?', options: ['30', '45', '60', '90'], correctIndex: 2 },

  { q: 'How many seconds are in a minute?', options: ['30', '45', '60', '120'], correctIndex: 2 },

  { q: 'Which ocean is off the California coast?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], correctIndex: 2 },

  { q: 'What is the capital of Portugal?', options: ['Lisbon', 'Porto', 'Braga', 'Coimbra'], correctIndex: 0 },

  { q: 'What is the capital of Ireland?', options: ['Dublin', 'Cork', 'Galway', 'Limerick'], correctIndex: 0 },

  { q: 'What is the capital of Netherlands?', options: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht'], correctIndex: 0 },

  { q: 'What is the capital of Switzerland?', options: ['Bern', 'Zurich', 'Geneva', 'Lausanne'], correctIndex: 0 },

  { q: 'What is the capital of Belgium?', options: ['Brussels', 'Antwerp', 'Bruges', 'Ghent'], correctIndex: 0 },

  { q: 'What is the capital of Austria?', options: ['Vienna', 'Graz', 'Linz', 'Salzburg'], correctIndex: 0 },

  { q: 'What is the capital of Poland?', options: ['Warsaw', 'Krakow', 'Gdansk', 'Wroclaw'], correctIndex: 0 },

  { q: 'What is the capital of Czech Republic?', options: ['Prague', 'Brno', 'Ostrava', 'Plzen'], correctIndex: 0 },

  { q: 'What is the capital of Hungary?', options: ['Budapest', 'Debrecen', 'Szeged', 'Miskolc'], correctIndex: 0 },

  { q: 'What is the capital of Romania?', options: ['Bucharest', 'Cluj', 'Timisoara', 'Iasi'], correctIndex: 0 },

  { q: 'What is the capital of Bulgaria?', options: ['Sofia', 'Varna', 'Plovdiv', 'Burgas'], correctIndex: 0 },

  { q: 'What is the capital of Serbia?', options: ['Belgrade', 'Novi Sad', 'Nis', 'Kragujevac'], correctIndex: 0 },

  { q: 'What is the capital of Croatia?', options: ['Zagreb', 'Split', 'Dubrovnik', 'Rijeka'], correctIndex: 0 },

  { q: 'What is the capital of Slovakia?', options: ['Bratislava', 'Kosice', 'Nitra', 'Zilina'], correctIndex: 0 },

  { q: 'What is the capital of Slovenia?', options: ['Ljubljana', 'Maribor', 'Celje', 'Koper'], correctIndex: 0 },

  { q: 'What is the capital of Lithuania?', options: ['Vilnius', 'Kaunas', 'Klaipeda', 'Siauliai'], correctIndex: 0 },

  { q: 'What is the capital of Latvia?', options: ['Riga', 'Daugavpils', 'Liepaja', 'Jelgava'], correctIndex: 0 },

  { q: 'What is the capital of Estonia?', options: ['Tallinn', 'Tartu', 'Parnu', 'Narva'], correctIndex: 0 },

  { q: 'What is the capital of Ukraine?', options: ['Kyiv', 'Kharkiv', 'Odesa', 'Lviv'], correctIndex: 0 },

  { q: 'What is the capital of Belarus?', options: ['Minsk', 'Gomel', 'Vitebsk', 'Mogilev'], correctIndex: 0 },

  { q: 'What is the capital of Georgia?', options: ['Tbilisi', 'Batumi', 'Kutaisi', 'Rustavi'], correctIndex: 0 },

  { q: 'What is the capital of Armenia?', options: ['Yerevan', 'Gyumri', 'Vanadzor', 'Ashtarak'], correctIndex: 0 },

  { q: 'What is the capital of Azerbaijan?', options: ['Baku', 'Ganja', 'Sumqayit', 'Lankaran'], correctIndex: 0 },

  { q: 'What is the capital of Iran?', options: ['Tehran', 'Isfahan', 'Mashhad', 'Shiraz'], correctIndex: 0 },

  { q: 'What is the capital of Afghanistan?', options: ['Kabul', 'Kandahar', 'Herat', 'Mazar-i-Sharif'], correctIndex: 0 },

  { q: 'What is the capital of Thailand?', options: ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya'], correctIndex: 0 },

  { q: 'What is the capital of Vietnam?', options: ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Haiphong'], correctIndex: 0 },

  { q: 'What is the capital of South Korea?', options: ['Seoul', 'Busan', 'Incheon', 'Daegu'], correctIndex: 0 },

  { q: 'What is the capital of Indonesia?', options: ['Jakarta', 'Bali', 'Surabaya', 'Bandung'], correctIndex: 0 },

  { q: 'What is the capital of Malaysia?', options: ['Kuala Lumpur', 'George Town', 'Johor Bahru', 'Malacca'], correctIndex: 0 },

  { q: 'Singapore is a (country/city) whose capital is?', options: ['Singapore', '—', '—', '—'], correctIndex: 0 },

  { q: 'What is the capital of New Zealand?', options: ['Wellington', 'Auckland', 'Christchurch', 'Hamilton'], correctIndex: 0 },

  { q: 'What is the executive capital of South Africa?', options: ['Pretoria', 'Cape Town', 'Bloemfontein', 'Durban'], correctIndex: 0 },

  { q: 'Which planet is famous for rings?', options: ['Saturn', 'Mars', 'Mercury', 'Venus'], correctIndex: 0 },

  { q: 'Which star is closest to Earth?', options: ['The Sun', 'Sirius', 'Vega', 'Polaris'], correctIndex: 0 },

  { q: 'How many months are in a year?', options: ['10', '11', '12', '13'], correctIndex: 2 },

  { q: 'Which of these is a fruit?', options: ['Apple', 'Onion', 'Salt', 'Carrot'], correctIndex: 0 },

  { q: 'Which of these is a bird?', options: ['Eagle', 'Shark', 'Whale', 'Fox'], correctIndex: 0 },

  { q: 'What is 15 + 10?', options: ['20', '25', '30', '35'], correctIndex: 1 },

  { q: 'What is 12 - 5?', options: ['5', '6', '7', '8'], correctIndex: 2 },

];

module.exports = { AR_QUESTIONS, EN_QUESTIONS };