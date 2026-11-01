export const ar = {
  app: {
    name: 'تربية',
    tagline: 'منصة الإرشاد',
  },
  nav: {
    admin: 'الإدارة',
    users: 'المستخدمون',
    mentorships: 'علاقات الإرشاد',
    groups: 'المجموعات',
    lookups: 'القوائم المرجعية',
    myMentees: 'متابَعيّ',
    menteeDashboard: 'لوحة المتابَعين',
    followUps: 'المتابعات والأنشطة',
    myJourney: 'رحلتي',
    myPlans: 'خطط تطويري',
    reportToMentor: 'التقرير إلى موجِّهي',
    myGroups: 'مجموعاتي',
  },
  header: {
    search: 'ابحث عن عضو بالاسم أو الجوال…',
    messages: 'الرسائل',
    notifications: 'الإشعارات',
    profile: 'الملف الشخصي',
    switchLanguage: 'English',
  },
  home: {
    title: 'مرحبًا بك في تربية',
    apiStatus: 'حالة الخادم',
    apiOk: 'متصل',
    apiDown: 'غير متصل',
  },
  login: {
    title: 'تسجيل الدخول',
  },
};

/** Shape every locale must match. */
export type Messages = typeof ar;
