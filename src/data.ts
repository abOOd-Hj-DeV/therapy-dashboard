export type Session = {
  name: string
  date: string
  time: string
  status: 'ready' | 'canceled' | 'unsure'
  image: string
  crop?: string
}

export const sessions: Session[] = [
  {
    name: 'سعد الشيخ علي',
    date: '14 نيسان 2026',
    time: '09:12',
    status: 'ready',
    image: 'dashboard-imgContainer1.png',
    crop: 'portrait',
  },
  {
    name: 'أحمد سويد',
    date: '15 نيسان 2026',
    time: '11:45',
    status: 'ready',
    image: 'dashboard-imgContainer2.png',
    crop: 'portrait',
  },
  {
    name: 'سارة محمد',
    date: '16 نيسان 2026',
    time: '08:30',
    status: 'canceled',
    image: 'dashboard-imgContainer3.png',
  },
  {
    name: 'خالد الجابري',
    date: '17 نيسان 2026',
    time: '14:00',
    status: 'unsure',
    image: 'dashboard-imgContainer4.png',
    crop: 'khaled',
  },
  {
    name: 'جاد ماتشا',
    date: '18 نيسان 2026',
    time: '10:15',
    status: 'unsure',
    image: 'dashboard-imgContainer4.png',
    crop: 'jad',
  },
  {
    name: 'مروان السالم',
    date: '19 نيسان 2026',
    time: '09:00',
    status: 'ready',
    image: 'dashboard-imgContainer5.png',
  },
  {
    name: 'فهد العلي',
    date: '20 نيسان 2026',
    time: '13:30',
    status: 'ready',
    image: 'dashboard-imgContainer6.png',
    crop: 'fahad',
  },
]

export const metrics = [
  { label: 'ساعات هذا الشهر', value: 33, change: '+23%', icon: 'dashboard-imgClockThree.svg' },
  {
    label: 'رسائل غير مقروءة',
    value: 8,
    change: '+14%',
    icon: 'dashboard-imgIconGlass.svg',
    glass: true,
  },
  {
    label: 'جلسات هذا الأسبوع',
    value: 12,
    change: '+33%',
    icon: 'dashboard-imgIcon3.svg',
    negative: true,
  },
  { label: 'مستخدمون نشطون', value: 77, change: '+33%', icon: 'dashboard-imgIcon4.svg' },
]

export const menu = [
  { label: 'لوحة التحكم', icon: 'dashboard-imgDashboardIcon.svg' },
  { label: 'المرضى', icon: 'dashboard-imgSquareUserCheck.svg' },
  { label: 'الجلسات', icon: 'dashboard-imgCalendarAlt.svg' },
  { label: 'الرسائل', icon: 'dashboard-imgMessageCircleLinesAlt.svg', badge: 5 },
  { label: 'المحتوى الإضافي', icon: 'dashboard-imgStars.svg' },
  { label: 'المحفظة', icon: 'dashboard-imgWallet.svg' },
  { label: 'حالات الخطر', icon: 'dashboard-imgStars.svg' },
]

export const notifications = [
  {
    id: 1,
    title: 'حدّدت د. هاربر موعداً',
    detail: 'موعداً جديداً: «جلسة تنبّه ذهني».',
    time: 'قبل 20 دقيقة',
    description: 'أُضيف إلى تقويمك يوم الثلاثاء الساعة 2:00 ظهراً.',
    image: 'notification-imgImage.png',
    icon: 'notification-imgHeroiconsMiniVideoCamera.svg',
  },
  {
    id: 2,
    title: 'شارك عميل ملاحظة تقدّم',
    detail: 'عن «العلاج المعرفي السلوكي».',
    time: 'قبل 35 دقيقة',
    description: 'الملاحظات والتغذية الراجعة متاحة الآن.',
    image: 'notification-imgImage1.png',
    icon: 'notification-imgHeroiconsMiniDocumentText.svg',
  },
  {
    id: 3,
    title: 'محضر الجلسة',
    detail: 'لجلسة «إدارة القلق رقم 3» جاهز.',
    time: 'قبل 10 دقائق',
    description: 'يمكنك مراجعة أبرز الملاحظات أو إبرازها.',
    action: 'فتح المحضر',
    image: 'notification-imgImage2.png',
    icon: 'notification-imgHeroiconsMiniSparkles.svg',
  },
  {
    id: 4,
    title: 'ذكرك عميل',
    detail: 'في «مراجعة العلاج الأسبوعية».',
    time: 'قبل 15 دقيقة',
    description: '@harper يرجى تأكيد تحديثات خطة العلاج.',
    image: 'notification-imgImage3.png',
    icon: 'notification-imgHeroiconsMiniChatBubbleOvalLeft.svg',
  },
  {
    id: 5,
    title: 'دعاك أليكس',
    detail: 'للتعاون في ملاحظات العملاء ضمن مجلد «ملخصات الجلسات».',
    time: 'قبل 25 دقيقة',
    description: 'يمكنك الآن عرض ملفات العملاء المشتركة وتعديلها.',
    action: 'قبول',
    image: 'notification-imgImage4.png',
    icon: 'notification-imgHeroiconsMiniFolder.svg',
  },
  {
    id: 6,
    title: 'أسندت إليك د. لي',
    detail: 'مهمة جديدة: «مراجعة تقارير تقدّم العملاء».',
    time: 'قبل 40 دقيقة',
    description: 'تستحق الاثنين 6 تشرين الثاني.',
    action: 'عرض المهمة',
    image: 'notification-imgImage.png',
    icon: 'notification-imgHeroiconsMiniQueueList.svg',
  },
]
