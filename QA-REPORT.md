# RASM Studio 5.2.2 QA Report

## Root cause identified
- The preview renderer compressed hand progress to 86% of the drawing interval (frac/.86).
- The original raster image reveal then continued independently until 96% of the drawing interval (frac/.96), with a dedicated final 10% pixel-reveal ramp. This allowed pixels to appear after the hand had left an element.
- The motion Worker request omitted each line's shapeId, the shape-group ownership metadata, and shapeSequence. The Worker therefore could not apply per-element completion windows even though the main thread had computed them.

## Fixes
- Hand progress is now strokeProgress(scene, frac), and the image reveal fraction follows motion.progress directly without a trailing reveal interval.
- Raster reveal uses the full 0–255 timeline range; each element's final pixels reach the end of its final hand stroke.
- Worker payload now includes line shape IDs, per-shape raster ownership labels, and sequence mode. The Worker constructs the same scheduling scene as the main thread.
- New scenes default to 0.2× drawing speed. Legacy projects carrying the old default 0.5× are migrated to 0.2× on import. Projects saved by 5.2.2 preserve subsequent explicit speed selections.

## Validation added
- Worker integration test with two separated image elements: verifies all pixels in element 1 are revealed before element 2 begins, element 1's last pixel is revealed at the end of its final hand stroke, and element 2 starts when the hand arrives at its first path.
- Schedule test validates the full 0–255 time range and element completion windows.
- Build checks ensure the hand and image do not use independent .86/.96 reveal clocks.
- Existing shape segmentation, directional routing, reliability, timeline, export, and development-server tests remain included.

## Known limitations
- Segmentation remains geometry-based. Visually touching letters or objects can be a single connected element and may need manual zones.
- Playback and export with the user's actual mobile project still require visual acceptance on the preview build.

# مراجعة رَسم Studio 5.2.1
يعتمد هذا الإصدار على مراجعة مستودع main 5.1.0 ودمج إصلاح 5.1.1 كتأسيس لفرع محرك الأشكال.

## تغييرات المحرك
- OpenCV.js 5.0.0 مثبت كاعتماد إنتاج، ويُنسخ محليًا إلى dist/vendor/opencv.js أثناء البناء. يستخدم عمليات morphological closing وconnected components لاستخراج مناطق الصورة المتقاربة.
- Paper.js 0.17.0 مثبت كاعتماد إنتاج ويُحمّل داخل worker لتحسين تبسيط المسارات، مع خوارزمية RDP احتياطية.
- dist/shape-engine.js يبني مجموعات للشكل، ويربط المسارات بالمكونات، ويصدر rasterLabels مضغوطة من نوع Uint16Array.
- dist/motion.js يرتّب جميع ضربات القلم داخل مجموعة الشكل قبل إتمام المجموعة التالية. جدول الألوان يقيد انتشار البكسلات بمعرّف الشكل، حتى لا يظهر شكل مجاور أثناء تنفيذ مسارات الشكل الحالي.
- لكل مجموعة شكل نافذة كشف مستقلة تبدأ عند وصول القلم لأول مسار فيها، وتنتهي عند نهاية آخر مسار. تم اختبار انتقال القلم بين شكلين مع مسافة رفع بينهما؛ لا يبدأ كشف الشكل التالي قبل اكتمال الأول.
- أضيف اختيار «تجميع ذكي» أو «مسارًا بمسار»، ويحفظ في .rasm. مناطق الرسم اليدوية ما زالت تتقدم على الترتيب التلقائي.

## ترقية تقسيم العناصر في 5.2.1
- تم تقليل إغلاق OpenCV المورفولوجي إلى نواة 3×3 حتى لا تندمج المكونات المتجاورة في عنصر واحد لمجرد قربها.
- المكون المتصل هو وحدة الرسم الأساسية؛ يتم إلحاق العلامات الصغيرة المنفصلة بالحرف الأقرب فقط عند تحقق الحجم والمحاذاة والمسافة.
- تم توحيد أرقام عناصر rasterLabels مع أرقام الملكية التي يحملها كل مسار. كان اختلاف هذين المستويين قد يجعل ظهور الصورة لا يتبع ترتيب اليد.
- أزيل اختيار أطول المسارات على مستوى الصورة؛ جميع مسارات العناصر متاحة للمحرك ولا تُحذف لمجرد قصرها.
- أصبح ترتيب العناصر حسب الصفوف، وداخل كل صف حسب اتجاه RTL أو LTR. يبدأ القلم داخل كل عنصر من حافته الموافقة لاتجاه القراءة ثم يختار أقرب مسار تالي.
- تحفظ خاصية elementDirection داخل ملف المشروع وتُستعاد عند فتحه.

## اختبارات أضيفت
- synthetic shape test لنقط التشكيل المنفصلة ومجموعة من الأشكال البعيدة.
- motion sequencing test للتحقق من إكمال كل مجموعة قبل المجموعة التالية.
- reveal isolation test للتحقق من أن كشف شكل لا ينتشر إلى بكسلات مجموعة أخرى.
- build vendor test للتحقق من نسخ OpenCV.js وPaper.js وإصداراتهما وتراخيصهما.
- تحقق worker dependency check وتحميل المكتبات المحلية دون CDN.

## حدود الدقة
- التجميع تلقائي هندسي مبني على connected components والإغلاق المورفولوجي ومسافات المكونات. ليس نموذجًا دلاليًا مدربًا لفهم أن عدة أجزاء متباعدة تمثل كائنًا واحدًا.
- الصور منخفضة التباين أو الفوتوغرافية قد لا تنتج قناعًا موثوقًا، وتستخدم محرك المكونات fallback.
- لم يتم بعد قبول التصدير النهائي على ملفات المستخدم الواقعية أو اختبار Safari/iPhone فعليًا. يلزم إجراء معاينة للتسلسل البصري على مشروع المستخدم قبل الدمج إلى main.
