// UyDosh Web — uz/ru/en translation dictionary, t(), applyI18n(), the
// language switcher UI, the light/dark theme toggle button, and escapeHtml().
// Depends on uydosh-core.js (getLang/setLang). Load after it.

const I18N = {
  uz: {
    'brand.tagline': 'Keling Birga Yashaymiz!',
    'nav.listings': 'E’lonlar',
    'nav.home': 'Asosiy',
    'nav.privacy': 'Maxfiylik',
    'nav.terms': 'Foydalanish shartlari',
    'nav.delete': 'Akkauntni o‘chirish',
    'nav.contact': 'Aloqa',
    'feed.title': 'Yangi e’lonlar',
    'feed.subtitle': 'Haqiqiy uy-joy va xonadoshlar — eng yangisi yuqorida.',
    'feed.loading': 'Yuklanmoqda…',
    'feed.empty': 'Hozircha e’lonlar yo‘q.',
    'feed.error': 'Ma’lumotlarni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.',
    'feed.retry': 'Qayta urinish',
    'feed.end': 'Hammasi shu. Yangilari uchun ilovamizni oching.',
    'feed.scrollToTop': 'Yuqoriga',
    'card.featured': 'Yuqoriga chiqarilgan',
    'card.privateRoom': 'Alohida xona',
    'card.rooms': 'xona',
    'card.perMonth': '/oy',
    'card.type.roommateNeededMale': 'Hamkor kerak',
    'card.type.roommateNeededFemale': 'Ayol hamkor kerak',
    'card.genderBadge.male': 'Yigit',
    'card.genderBadge.female': 'Qiz',
    'detail.back': '← E’lonlar',
    'detail.loading': 'Yuklanmoqda…',
    'detail.notFound': 'E’lon topilmadi yoki olib tashlangan.',
    'detail.description': 'Tavsif',
    'detail.amenities': 'Qulayliklar',
    'detail.openInApp': 'Ilovada ochish',
    'detail.downloadApk': 'APK yuklab olish',
    'detail.author': 'Muallif',
    'detail.posted': 'Joylangan',
    'detail.moveIn': 'Ko‘chib o‘tish',
    'detail.type': 'Turi',
    'detail.location': 'Joylashuv',
    'detail.address': 'Manzil',
    'detail.metro': 'Metro',
    'detail.metroWalkInfo': '{km} km, {minutes} daq. piyoda',
    'detail.map': 'Xarita',
    'detail.showMap': 'Xaritani ko‘rsatish',
    'detail.hideMap': 'Xaritani yashirish',
    'detail.openMapView': 'Xaritani ochish',
    'detail.mapUnavailable': 'Xarita uchun joylashuv aniqlanmadi.',
    'detail.mapLoadError': 'Xaritani yuklab bo‘lmadi.',
    'detail.roomScan': '3D xona skani',
    'detail.roomScanDimensions': 'O‘lchamlar',
    'detail.roomScanHeight': 'Balandlik',
    'detail.roomScanArea': 'Maydon',
    'detail.roomScanFullscreen': 'To‘liq ekran',
    'detail.roomScanLoadError': '3D modelni yuklab bo‘lmadi.',
    'detail.gallery.dots': 'Rasmlar',
    'detail.gallery.photo': 'Rasm',
    'detail.contactTelegram': 'Telegram orqali bog‘lanish',
    'detail.contactPhone': 'Qo‘ng‘iroq qilish',
    'detail.contactMessage': 'Salom! Sizning e’loningiz bo‘yicha yozyapman:',
    'detail.share': 'Ulashish',
    'detail.favorite.add': 'Sevimlilarga qo‘shish',
    'detail.favorite.remove': 'Sevimlilardan olib tashlash',
    'detail.report': 'Shikoyat qilish',
    'detail.claim.title': 'Bu sizning e’loningizmi?',
    'detail.claim.subtitle': 'Telegram hisobingiz mos keldi — uni profilingizga bog‘lang.',
    'detail.claim.button': 'Talab qilish',
    'detail.claim.pending': 'Bajarilmoqda…',
    'detail.claim.confirm': 'Bu e’lon hisobingizga o‘tkaziladi va uni tahrirlay olasiz. Davom etasizmi?',
    'detail.claim.success': 'E’lon muvaffaqiyatli sizga o‘tkazildi',
    'detail.claim.error': 'E’lonni talab qilib bo‘lmadi. Keyinroq urinib ko‘ring.',
    'complaint.title': 'Shikoyat qilish',
    'complaint.reasonLabel': 'Sabab',
    'complaint.loadingReasons': 'Sabablar yuklanmoqda…',
    'complaint.loadError': 'Sabablarni yuklab bo‘lmadi. Qayta urinib ko‘ring.',
    'complaint.detailsLabel': 'Tafsilotlar (ixtiyoriy)',
    'complaint.detailsPlaceholder': 'Qo‘shimcha ma’lumot qo‘shing…',
    'complaint.submit': 'Yuborish',
    'complaint.submitting': 'Yuborilmoqda…',
    'complaint.cancel': 'Bekor qilish',
    'complaint.selectReason': 'Sababni tanlang',
    'complaint.success': 'Shikoyat yuborildi',
    'complaint.errorGeneric': 'Shikoyatni yuborib bo‘lmadi. Qayta urinib ko‘ring.',
    'complaint.errorDuplicate': 'Siz bu e’lon haqida allaqachon shikoyat qilgansiz.',
    'complaint.errorAuth': 'Telegram orqali kirish amalga oshmadi. Mini ilovani qayta oching.',
    'complaints.viewButton': 'Shikoyatlarni ko‘rish',
    'complaints.title': 'Shikoyatlar',
    'complaints.loading': 'Shikoyatlar yuklanmoqda…',
    'complaints.loadError': 'Shikoyatlarni yuklab bo‘lmadi. Qayta urinib ko‘ring.',
    'complaints.empty': 'Bu e’lon bo‘yicha hali shikoyatlar yo‘q',
    'complaints.anonymous': 'Foydalanuvchi',
    'view.list': 'Ro‘yxat',
    'view.map': 'Xarita',
    'map.loading': 'Xarita yuklanmoqda…',
    'map.empty': 'Tanlangan filtrlarda xaritada ko‘rsatish uchun e’lon yo‘q.',
    'map.error': 'Xaritani yuklab bo‘lmadi.',
    'map.retry': 'Qayta urinish',
    'theme.toggleLight': 'Yorug‘ rejimga o‘tish',
    'theme.toggleDark': 'Tungi rejimga o‘tish',
    'map.tooltip.close': 'Yopish',
    'map.carousel.dots': 'E’lonlar',
    'map.resultsCountAria': 'Xaritada {count} ta e’lon topildi',
    'map.layers.districts.show': 'Tumanlarni ko‘rsatish',
    'map.layers.districts.hide': 'Tumanlarni yashirish',
    'map.layers.metro.show': 'Metro bekatlarini ko‘rsatish',
    'map.layers.metro.line': 'Metro: {line} liniyasi',
    'map.layers.metro.all': 'Metro: barcha liniyalar',
    'map.locate.cta': 'Joylashuvimni ko‘rsatish',
    'cta.openListings': 'E’lonlarni ko‘rish',
    'filter.type.all': 'Hammasi',
    'filter.type.roomNeeded': 'Xona qidiryapman',
    'filter.type.roommateNeeded': 'Xonadosh qidiramiz',
    'filter.type.groupForming': 'Guruh yigamiz',
    'filter.type.aria': 'E’lon turi',
    'filter.type.label': 'Tur:',
    'filter.gender.label': 'Jins:',
    'filter.gender.any': 'Hammasi',
    'filter.gender.male': 'Erkak',
    'filter.gender.female': 'Ayol',
    'filter.gender.aria': 'Jins bo‘yicha filtr',
    'filter.photo.label': 'Surat:',
    'filter.photo.withPhoto': 'Suratli',
    'filter.photo.aria': 'Suratli e’lonlar',
    'filter.line.aria': 'Metro liniyasi',
    'filter.district.aria': 'Tuman bo‘yicha filtr',
    'filter.period.30': '30 kun',
    'filter.period.90': '90 kun',
    'filter.period.all': 'Hammasi',
    'filter.period.aria': 'Muddat bo‘yicha filtr',
    'filter.collapse.aria': 'Filtrlarni yig‘ish',
    'filter.expand.aria': 'Filtrlarni ochish',
    'create.title': 'E’lon joylash',
    'create.step.typeLocation': 'Tur va joy',
    'create.step.details': 'Tafsilotlar',
    'create.step.description': 'Matn va surat',
    'create.step.review': 'Tekshirish',
    'create.stepCounter': '{current} / {total}',
    'create.listingType': 'E’lon turi',
    'create.locationMode': 'Qidiruv hududi',
    'create.locationMetro': 'Metro',
    'create.locationDistrict': 'Tuman',
    'create.metroLine': 'Metro liniyasi',
    'create.metroStation': 'Bekat',
    'create.metroStations': 'Bekatlar',
    'create.selectAllStations': 'Barcha {count} bekat',
    'create.district': 'Tuman',
    'create.districts': 'Tumanlar',
    'create.selectAllDistricts': 'Barcha {count} tuman',
    'create.address': 'Manzil',
    'create.addressOptional': 'Manzil (ixtiyoriy)',
    'create.addressPlaceholder': 'Ko‘cha, uy raqami',
    'create.useCurrentLocation': 'Mening joylashuvim',
    'create.locatingAddress': 'Aniqlanmoqda…',
    'create.errorLocationFailed': 'Joylashuvni aniqlab bo‘lmadi. Manzilni qo‘lda kiriting.',
    'create.findNearbyMetro': 'Yaqin atrofdagi metro',
    'create.walkRadiusOption': '{count} daq.',
    'create.nearbyStations': 'Sizga yaqin bekatlar',
    'create.nearbyStationsFallback': 'Eng yaqin bekat (tanlangan radiusdan tashqarida)',
    'create.nearbyStationsEmpty': '{minutes} daqiqalik piyoda masofada metro bekati topilmadi',
    'create.walkMinutes': '{count} daq. piyoda',
    'create.price': 'Narx',
    'create.priceRange': 'Byudjet',
    'create.gender': 'Kim uchun',
    'create.amenities': 'Qulayliklar',
    'create.moveInDate': 'Ko‘chib o‘tish',
    'create.moveInAny': 'Istalgan sana',
    'create.privateRoom': 'Alohida xona',
    'create.titleLabel': 'Sarlavha',
    'create.titlePlaceholder': 'Masalan: Yunusobod yaqinida xona',
    'create.descriptionLabel': 'Tavsif',
    'create.descriptionPlaceholder': 'Uy, qoidalar, qo‘shimcha shartlar…',
    'create.photos': 'Suratlar',
    'create.addPhoto': 'Surat qo‘shish',
    'create.next': 'Keyingi',
    'create.back': 'Orqaga',
    'create.publish': 'Joylash',
    'create.publishing': 'Joylanmoqda…',
    'create.success': 'E’lon yuborildi!',
    'create.successHint': 'Moderatsiyadan so‘ng e’lonlar ro‘yxatida paydo bo‘ladi.',
    'create.successPhotoWarning': 'Ba’zi suratlarni yuklab bo‘lmadi. Ularni e’lon sahifasidan qo‘shishga urinib ko‘ring.',
    'create.viewListing': 'E’longa o‘tish',
    'create.backToFeed': 'E’lonlarga qaytish',
    'create.errorAuth': 'Telegram orqali kirish amalga oshmadi. Mini ilovani qayta oching.',
    'create.errorGeneric': 'E’lonni joylab bo‘lmadi. Qayta urinib ko‘ring.',
    'create.errorPhotoProcess': 'Suratni qayta ishlab bo‘lmadi. Boshqa surat tanlang.',
    'create.errorTitleRequired': 'Sarlavha majburiy',
    'create.errorTitleTooLong': 'Sarlavha juda uzun (maks. 50 belgi)',
    'create.errorDescriptionRequired': 'Tavsif majburiy',
    'create.errorDescriptionTooLong': 'Tavsif juda uzun (maks. 1000 belgi)',
    'create.errorLocationRequired': 'Joylashuvni tanlang',
    'create.errorPriceRequired': 'Narxni ko‘rsating',
    'create.errorGenderRequired': 'Jinsni tanlang',
    'create.reviewType': 'Tur',
    'create.reviewLocation': 'Joy',
    'create.reviewPrice': 'Narx',
    'create.reviewGender': 'Jins',
    'create.reviewAmenities': 'Qulayliklar',
    'create.reviewMoveIn': 'Ko‘chib o‘tish',
    'create.reviewPrivateRoom': 'Alohida xona',
    'create.reviewPhone': 'Telefon',
    'create.sharePhoneCta': 'Telefon raqamimni ulashish',
    'create.reviewYes': 'Ha',
    'create.reviewNo': 'Yo‘q',
    'create.reviewNotSet': 'Ko‘rsatilmagan',
    'create.perMonth': '/oy',
    'create.postListing': 'E’lon joylash',
    'create.priceMin': 'Min',
    'create.priceMax': 'Maks',
    'create.descriptionTemplateLabel': 'Shablon',
    'create.descriptionTemplate.roomNeeded': 'Xona/qo‘shilish qidiryapman.\nFormat: (alohida/qo‘shilish).\nMuddat: (kirish sanasi + qancha).\nMuhim: (tinchlik/mehmon/uy hayvoni).',
    'create.descriptionTemplate.roommateNeededMale': 'Qo‘shni yigit qidiryapman.\nFormat: (xonada 1–2).\nKim yashaydi: (necha kishi).\nSharoit: (xo‘jayinsiz/xo‘jayinli), (alohida/umumiy xona).\nMuddat: (kirish) + (qancha).',
    'create.descriptionTemplate.roommateNeededFemale': 'Qo‘shni qiz qidiryapman.\nFormat: (xonada 1–2).\nKim yashaydi: (necha kishi).\nSharoit: (xo‘jayinsiz/xo‘jayinli), (alohida/umumiy xona).\nMuddat: (kirish) + (qancha).',
    'create.descriptionTemplate.groupForming': 'Guruh bo‘lib ijara olish uchun odam yig‘yapmiz.\nKim kerak: (1–2 kishi, jins/yosh).\nHar kishi budjeti: (summa).\nHudud/metro: (qayerdan qidiramiz).\nFormat: (alohida/umumiy xonalar).\nKirish: (sana + muddat).\nMuhim: (tozalik/tinchlik/mehmon/uy hayvoni).',
    'create.presetTitle.maleRoommate': '#YigitXonadoshQidiramiz',
    'create.presetTitle.femaleRoommate': '#QizXonadoshQidiramiz',
    'create.presetTitle.maleRoom': '#YigitXonadonQidiramiz',
    'create.presetTitle.femaleRoom': '#QizXonadonQidiramiz',
    'create.presetTitle.groupForming': 'Guruh Yigamiz',
    'create.editTitle': 'E’lonni tahrirlash',
    'create.save': 'Saqlash',
    'create.saving': 'Saqlanmoqda…',
    'create.editSuccess': 'E’lon yangilandi!',
    'create.editSuccessHint': 'O‘zgarishlar darhol qo‘llanildi.',
    'create.errorNotOwner': 'Bu e’lon sizga tegishli emas.',
    'create.errorLoadListing': 'E’lonni yuklab bo‘lmadi.',
    'create.backToAccount': 'Mening e’lonlarimga qaytish',
    'account.menuLabel': 'Hisob menyusi',
    'account.menuAccount': 'Hisobim',
    'account.title': 'Mening e’lonlarim',
    'account.subtitle': 'Mening e’lonlarim',
    'account.tabs.mine': 'Mening e’lonlarim',
    'account.tabs.favorites': 'Sevimlilar',
    'account.empty': 'Sizda hali e’lonlar yo‘q.',
    'account.favoritesEmpty': 'Sizda hali sevimli e’lonlar yo‘q.',
    'account.edit': 'Tahrirlash',
    'account.deactivate': 'Yashirish',
    'account.activate': 'Ko‘rsatish',
    'account.statusPending': 'Moderatsiyada',
    'account.statusInactive': 'Faol emas',
    'account.renew': 'Yangilash',
    'account.renewInOneDay': '1 kundan keyin',
    'account.renewInDays': '{days} kundan keyin',
    'account.renewSuccess': 'E’lon yangilandi',
    'account.renewError': 'E’lonni yangilab bo‘lmadi. Qayta urinib ko‘ring.',
    'account.delete': 'O‘chirish',
    'account.deleteConfirm': 'Bu e’lonni butunlay o‘chirmoqchimisiz? Bu amalni ortga qaytarib bo‘lmaydi.',
    'account.deleteSuccess': 'E’lon o‘chirildi',
    'account.deleteError': 'E’lonni o‘chirib bo‘lmadi. Qayta urinib ko‘ring.',
    'profile.menuLabel': 'Profil',
    'profile.title': 'Profil',
    'profile.subtitle': 'O‘zingiz haqingizda ma’lumot qoldiring',
    'profile.studentQuestion': 'Talabamisiz?',
    'profile.studentYes': 'Ha',
    'profile.studentNo': 'Yo‘q',
    'profile.universityLabel': 'Universitet',
    'profile.universitySearchPlaceholder': 'Universitetni qidirish…',
    'profile.universityNotFound': 'Hech narsa topilmadi',
    'profile.universityNotSelected': 'Universitetni tanlang',
    'profile.errorStudentRequired': 'Savolga javob bering',
    'profile.save': 'Saqlash',
    'profile.saving': 'Saqlanmoqda…',
    'profile.saved': 'Saqlandi ✅',
    'profile.moreComingSoon': 'Tez orada profilga yana ma’lumotlar qo‘shamiz.',
    'profile.errorAuth': 'Telegram orqali kirish amalga oshmadi. Mini ilovani qayta oching.',
    'profile.errorLoad': 'Profilni yuklab bo‘lmadi. Qayta urinib ko‘ring.',
    'profile.errorSave': 'Saqlab bo‘lmadi. Qayta urinib ko‘ring.',
    'profile.noProfileYet': 'Avval UyDosh ilovasida yoki mini-ilovada bitta e’lon joylab profilingizni yarating, so‘ng bu yerga qayting.',
    'profile.noProfileCta': '+ E’lon joylash',
    'profile.nudgeText': 'Universitetingizni ko‘rsating — bu boshqalarga sizni topishga yordam beradi.',
    'profile.nudgeCta': 'To‘ldirish',
    'profile.nudgeDismiss': 'Yopish',
    'profile.tabs.basic': 'Asosiy',
    'profile.tabs.lifestyle': 'Turmush tarzi',
    'profile.lifestyle.notSpecified': 'Ko‘rsatilmagan',
    'profile.lifestyle.moreComingSoon': 'Tez orada profilga yana ma’lumotlar qo‘shamiz.',
    'profile.lifestyle.employed': 'Ishlaysizmi?',
    'profile.lifestyle.employedYes': 'Ishlayman',
    'profile.lifestyle.employedNo': 'Ishlamayman',
    'profile.lifestyle.wakeupTime': 'Uyg‘onish vaqti',
    'profile.lifestyle.sleepTime': 'Uxlash vaqti',
    'profile.lifestyle.morning': 'Ertalab',
    'profile.lifestyle.evening': 'Kechqurun',
    'profile.lifestyle.night': 'Tun',
    'profile.lifestyle.cleanliness': 'Tozalik',
    'profile.lifestyle.veryMessy': 'Juda iflos',
    'profile.lifestyle.messy': 'Iflos',
    'profile.lifestyle.average': 'O‘rtacha',
    'profile.lifestyle.clean': 'Toza',
    'profile.lifestyle.veryClean': 'Juda toza',
    'profile.lifestyle.noiseLevel': 'Shovqin darajasi',
    'profile.lifestyle.veryQuiet': 'Juda jim',
    'profile.lifestyle.quiet': 'Jim',
    'profile.lifestyle.loud': 'Baland',
    'profile.lifestyle.veryLoud': 'Juda baland',
    'profile.lifestyle.sociability': 'Ijtimoiylik',
    'profile.lifestyle.veryIntroverted': 'Juda ichkariga qarab',
    'profile.lifestyle.introverted': 'Ichkariga qarab',
    'profile.lifestyle.balanced': 'Muvozanatli',
    'profile.lifestyle.extroverted': 'Tashqariga qarab',
    'profile.lifestyle.veryExtroverted': 'Juda tashqariga qarab',
    'profile.lifestyle.guestsAllowed': 'Mehmonlar ruxsat etilganmi?',
    'profile.lifestyle.guestsYes': 'Ruxsat berilgan',
    'profile.lifestyle.guestsNo': 'Ruxsat berilmagan',
    'profile.lifestyle.smokingPreference': 'Chekish',
    'profile.lifestyle.nonSmoker': 'Chekmayman',
    'profile.lifestyle.occasionalSmoker': 'Ba’zan chekaman',
    'profile.lifestyle.regularSmoker': 'Muntazam chekaman',
    'profile.lifestyle.alcoholPreference': 'Alkogol',
    'profile.lifestyle.nonDrinker': 'Ichmayman',
    'profile.lifestyle.occasionalDrinker': 'Ba’zan ichaman',
    'profile.lifestyle.regularDrinker': 'Muntazam ichaman',
    'profile.lifestyle.cookingHabits': 'Ovqat pishirish',
    'profile.lifestyle.cook': 'Uyda pishiraman',
    'profile.lifestyle.dontCook': 'Pishirmayman',
    'profile.lifestyle.petsPreference': 'Hayvonlarga munosabat',
    'profile.lifestyle.dontLikePets': 'Hayvonlarni yoqtirmayman',
    'profile.lifestyle.likePets': 'Hayvonlarni yaxshi ko‘raman',
    'profile.lifestyle.haveCat': 'Menda mushuk bor',
    'profile.lifestyle.haveDog': 'Menda it bor',
    'compat.title': 'Moslik',
    'compat.match': 'Moslik: {percent}%',
    'compat.notAvailable': 'Mavjud emas',
    'compat.loading': 'Moslik hisoblanmoqda…',
    'compat.matches': 'Mos jihatlar',
    'compat.differences': 'Farqlar',
    'compat.dealbreakers': 'Muhim farqlar',
    'compat.basedOn': '{total} tadan {scored} tasi asosida',
    'compat.incompleteTitle': 'Profilni to‘ldiring',
    'compat.incompleteBody': 'E’lon egasi bilan moslikni ko‘rish uchun turmush tarzi afzalliklaringizni to‘ldiring.',
    'compat.completeCta': 'Profilni to‘ldirish',
    'compat.region': 'Hudud',
    'compat.language': 'Til',
    'compat.dimGender': 'Xonadosh jinsi',
    'compat.dimAge': 'Yosh',
    'compat.dimBudget': 'Byudjet',
    'compat.male': 'Yigit',
    'compat.female': 'Qiz',
    'compat.any': 'Har qanday',
  },
  ru: {
    'brand.tagline': 'Давайте Жить Вместе!',
    'nav.listings': 'Объявления',
    'nav.home': 'Главная',
    'nav.privacy': 'Конфиденциальность',
    'nav.terms': 'Условия',
    'nav.delete': 'Удалить аккаунт',
    'nav.contact': 'Контакты',
    'feed.title': 'Свежие объявления',
    'feed.subtitle': 'Реальное жильё и соседи — самые новые сверху.',
    'feed.loading': 'Загрузка…',
    'feed.empty': 'Пока нет объявлений.',
    'feed.error': 'Не удалось загрузить данные. Попробуйте позже.',
    'feed.retry': 'Попробовать ещё раз',
    'feed.end': 'Это всё. За новыми — в приложение.',
    'feed.scrollToTop': 'Наверх',
    'card.featured': 'В топе',
    'card.privateRoom': 'Отдельная комната',
    'card.rooms': 'комн.',
    'card.perMonth': '/мес',
    'card.type.roommateNeededMale': 'Ищем соседа',
    'card.type.roommateNeededFemale': 'Ищем соседку',
    'card.genderBadge.male': 'Парню',
    'card.genderBadge.female': 'Девушку',
    'detail.back': '← Объявления',
    'detail.loading': 'Загрузка…',
    'detail.notFound': 'Объявление не найдено или удалено.',
    'detail.description': 'Описание',
    'detail.amenities': 'Удобства',
    'detail.openInApp': 'Открыть в приложении',
    'detail.downloadApk': 'Скачать APK',
    'detail.author': 'Автор',
    'detail.posted': 'Опубликовано',
    'detail.moveIn': 'Заселение',
    'detail.type': 'Тип',
    'detail.location': 'Район',
    'detail.address': 'Адрес',
    'detail.metro': 'Метро',
    'detail.metroWalkInfo': '{km} км, {minutes} мин пешком',
    'detail.map': 'Карта',
    'detail.showMap': 'Показать карту',
    'detail.hideMap': 'Скрыть карту',
    'detail.openMapView': 'Открыть карту',
    'detail.mapUnavailable': 'Не удалось определить местоположение для карты.',
    'detail.mapLoadError': 'Не удалось загрузить карту.',
    'detail.roomScan': '3D-скан комнаты',
    'detail.roomScanDimensions': 'Размеры',
    'detail.roomScanHeight': 'Высота',
    'detail.roomScanArea': 'Площадь',
    'detail.roomScanFullscreen': 'На весь экран',
    'detail.roomScanLoadError': 'Не удалось загрузить 3D-модель.',
    'detail.gallery.dots': 'Фото',
    'detail.gallery.photo': 'Фото',
    'detail.contactTelegram': 'Telegram',
    'detail.contactPhone': 'Позвонить',
    'detail.contactMessage': 'Здравствуйте! Пишу по вашему объявлению:',
    'detail.share': 'Поделиться',
    'detail.favorite.add': 'Добавить в избранное',
    'detail.favorite.remove': 'Убрать из избранного',
    'detail.report': 'Пожаловаться',
    'detail.claim.title': 'Это ваше объявление?',
    'detail.claim.subtitle': 'Ваш Telegram-аккаунт совпадает — привяжите его к своему профилю.',
    'detail.claim.button': 'Забрать себе',
    'detail.claim.pending': 'Выполняется…',
    'detail.claim.confirm': 'Объявление будет передано в ваш аккаунт, и вы сможете его редактировать. Продолжить?',
    'detail.claim.success': 'Объявление успешно передано вам',
    'detail.claim.error': 'Не удалось забрать объявление. Попробуйте позже.',
    'complaint.title': 'Пожаловаться',
    'complaint.reasonLabel': 'Причина',
    'complaint.loadingReasons': 'Загрузка причин…',
    'complaint.loadError': 'Не удалось загрузить причины. Попробуйте ещё раз.',
    'complaint.detailsLabel': 'Детали (необязательно)',
    'complaint.detailsPlaceholder': 'Добавьте подробности…',
    'complaint.submit': 'Отправить',
    'complaint.submitting': 'Отправка…',
    'complaint.cancel': 'Отмена',
    'complaint.selectReason': 'Выберите причину',
    'complaint.success': 'Жалоба отправлена',
    'complaint.errorGeneric': 'Не удалось отправить жалобу. Попробуйте ещё раз.',
    'complaint.errorDuplicate': 'Вы уже пожаловались на это объявление.',
    'complaint.errorAuth': 'Не удалось войти через Telegram. Откройте мини-приложение заново.',
    'complaints.viewButton': 'Показать жалобы',
    'complaints.title': 'Жалобы',
    'complaints.loading': 'Загрузка жалоб…',
    'complaints.loadError': 'Не удалось загрузить жалобы. Попробуйте ещё раз.',
    'complaints.empty': 'Жалоб по этому объявлению пока нет',
    'complaints.anonymous': 'Пользователь',
    'view.list': 'Список',
    'view.map': 'Карта',
    'map.loading': 'Загрузка карты…',
    'map.empty': 'Нет объявлений для карты с выбранными фильтрами.',
    'map.error': 'Не удалось загрузить карту.',
    'map.retry': 'Попробовать ещё раз',
    'theme.toggleLight': 'Включить светлую тему',
    'theme.toggleDark': 'Включить тёмную тему',
    'map.tooltip.close': 'Закрыть',
    'map.carousel.dots': 'Объявления',
    'map.resultsCountAria': 'На карте найдено объявлений: {count}',
    'map.layers.districts.show': 'Показать районы',
    'map.layers.districts.hide': 'Скрыть районы',
    'map.layers.metro.show': 'Показать станции метро',
    'map.layers.metro.line': 'Метро: линия «{line}»',
    'map.layers.metro.all': 'Метро: все линии',
    'map.locate.cta': 'Показать моё местоположение',
    'cta.openListings': 'Смотреть объявления',
    'filter.type.all': 'Все',
    'filter.type.roomNeeded': 'Ищу комнату',
    'filter.type.roommateNeeded': 'Ищем соседа',
    'filter.type.groupForming': 'Собираем группу',
    'filter.type.aria': 'Тип объявления',
    'filter.type.label': 'Тип:',
    'filter.gender.label': 'Пол:',
    'filter.gender.any': 'Любой',
    'filter.gender.male': 'М',
    'filter.gender.female': 'Ж',
    'filter.gender.aria': 'Фильтр по полу',
    'filter.photo.label': 'Фото:',
    'filter.photo.withPhoto': 'С фото',
    'filter.photo.aria': 'Только с фото',
    'filter.line.aria': 'Линия метро',
    'filter.district.aria': 'Фильтр по району',
    'filter.period.30': '30 дней',
    'filter.period.90': '90 дней',
    'filter.period.all': 'Все',
    'filter.period.aria': 'Фильтр по периоду',
    'filter.collapse.aria': 'Свернуть фильтры',
    'filter.expand.aria': 'Развернуть фильтры',
    'create.title': 'Разместить объявление',
    'create.step.typeLocation': 'Тип и место',
    'create.step.details': 'Детали',
    'create.step.description': 'Текст и фото',
    'create.step.review': 'Проверка',
    'create.stepCounter': '{current} / {total}',
    'create.listingType': 'Тип объявления',
    'create.locationMode': 'Зона поиска',
    'create.locationMetro': 'Метро',
    'create.locationDistrict': 'Район',
    'create.metroLine': 'Линия метро',
    'create.metroStation': 'Станция',
    'create.metroStations': 'Станции',
    'create.selectAllStations': 'Все {count} станций',
    'create.district': 'Район',
    'create.districts': 'Районы',
    'create.selectAllDistricts': 'Все {count} районов',
    'create.address': 'Адрес',
    'create.addressOptional': 'Адрес (необязательно)',
    'create.addressPlaceholder': 'Улица, дом',
    'create.useCurrentLocation': 'Моя локация',
    'create.locatingAddress': 'Определяем…',
    'create.errorLocationFailed': 'Не удалось определить местоположение. Введите адрес вручную.',
    'create.findNearbyMetro': 'Метро поблизости',
    'create.walkRadiusOption': '{count} мин',
    'create.nearbyStations': 'Станции рядом с вами',
    'create.nearbyStationsFallback': 'Ближайшая станция (за пределами выбранного радиуса)',
    'create.nearbyStationsEmpty': 'В радиусе {minutes} минут пешком станций метро нет',
    'create.walkMinutes': '{count} мин пешком',
    'create.price': 'Цена',
    'create.priceRange': 'Бюджет',
    'create.gender': 'Для кого',
    'create.amenities': 'Удобства',
    'create.moveInDate': 'Заселение',
    'create.moveInAny': 'Любая дата',
    'create.privateRoom': 'Отдельная комната',
    'create.titleLabel': 'Заголовок',
    'create.titlePlaceholder': 'Например: Комната у метро Юнусабад',
    'create.descriptionLabel': 'Описание',
    'create.descriptionPlaceholder': 'О квартире, правилах, условиях…',
    'create.photos': 'Фото',
    'create.addPhoto': 'Добавить фото',
    'create.next': 'Далее',
    'create.back': 'Назад',
    'create.publish': 'Опубликовать',
    'create.publishing': 'Публикация…',
    'create.success': 'Объявление отправлено!',
    'create.successHint': 'После модерации оно появится в ленте.',
    'create.successPhotoWarning': 'Не удалось загрузить некоторые фото. Попробуйте добавить их со страницы объявления.',
    'create.viewListing': 'Открыть объявление',
    'create.backToFeed': 'К объявлениям',
    'create.errorAuth': 'Не удалось войти через Telegram. Откройте мини-приложение заново.',
    'create.errorGeneric': 'Не удалось опубликовать. Попробуйте ещё раз.',
    'create.errorPhotoProcess': 'Не удалось обработать фото. Выберите другое изображение.',
    'create.errorTitleRequired': 'Укажите заголовок',
    'create.errorTitleTooLong': 'Заголовок слишком длинный (макс. 50 символов)',
    'create.errorDescriptionRequired': 'Укажите описание',
    'create.errorDescriptionTooLong': 'Описание слишком длинное (макс. 1000 символов)',
    'create.errorLocationRequired': 'Выберите местоположение',
    'create.errorPriceRequired': 'Укажите цену',
    'create.errorGenderRequired': 'Выберите пол',
    'create.reviewType': 'Тип',
    'create.reviewLocation': 'Место',
    'create.reviewPrice': 'Цена',
    'create.reviewGender': 'Пол',
    'create.reviewAmenities': 'Удобства',
    'create.reviewMoveIn': 'Заселение',
    'create.reviewPrivateRoom': 'Отдельная комната',
    'create.reviewPhone': 'Телефон',
    'create.sharePhoneCta': 'Поделиться номером телефона',
    'create.reviewYes': 'Да',
    'create.reviewNo': 'Нет',
    'create.reviewNotSet': 'Не указано',
    'create.perMonth': '/мес',
    'create.postListing': 'Разместить',
    'create.priceMin': 'Мин',
    'create.priceMax': 'Макс',
    'create.descriptionTemplateLabel': 'Шаблон',
    'create.descriptionTemplate.roomNeeded': 'Ищу комнату/подселение.\nФормат: (отдельная/подселение).\nСрок: (заезд + на сколько).\nВажно: (тихо/гости/животные).',
    'create.descriptionTemplate.roommateNeededMale': 'Ищу соседа.\nФормат: (1–2 в комнате).\nКто уже живёт: (сколько человек).\nУсловия: (с хозяйкой/без), (отдельная/общая комната).\nСрок: (заезд) + (на сколько).',
    'create.descriptionTemplate.roommateNeededFemale': 'Ищу соседку.\nФормат: (1–2 в комнате).\nКто уже живёт: (сколько человек).\nУсловия: (с хозяйкой/без), (отдельная/общая комната).\nСрок: (заезд) + (на сколько).',
    'create.descriptionTemplate.groupForming': 'Собираем группу для совместной аренды.\nКого ищем: (1–2 человека, пол/возраст).\nБюджет на человека: (сумма).\nРайон/метро: (где ищем).\nФормат: (отдельные/общие комнаты).\nЗаезд: (дата + срок).\nВажно: (чистота/тишина/гости/животные).',
    'create.presetTitle.maleRoommate': '#ИщемСоседа',
    'create.presetTitle.femaleRoommate': '#ИщемСоседку',
    'create.presetTitle.maleRoom': '#ИщуКомнату',
    'create.presetTitle.femaleRoom': '#ИщуКомнату',
    'create.presetTitle.groupForming': 'Собираем Группу',
    'create.editTitle': 'Редактирование объявления',
    'create.save': 'Сохранить',
    'create.saving': 'Сохранение…',
    'create.editSuccess': 'Объявление обновлено!',
    'create.editSuccessHint': 'Изменения уже применены.',
    'create.errorNotOwner': 'Это объявление вам не принадлежит.',
    'create.errorLoadListing': 'Не удалось загрузить объявление.',
    'create.backToAccount': 'К моим объявлениям',
    'account.menuLabel': 'Меню аккаунта',
    'account.menuAccount': 'Аккаунт',
    'account.title': 'Мои объявления',
    'account.subtitle': 'Мои объявления',
    'account.tabs.mine': 'Мои объявления',
    'account.tabs.favorites': 'Избранное',
    'account.empty': 'У вас пока нет объявлений.',
    'account.favoritesEmpty': 'У вас пока нет избранных объявлений.',
    'account.edit': 'Редактировать',
    'account.deactivate': 'Скрыть',
    'account.activate': 'Показать',
    'account.statusPending': 'На модерации',
    'account.statusInactive': 'Неактивно',
    'account.renew': 'Поднять',
    'account.renewInOneDay': 'Поднять через 1 день',
    'account.renewInDays': 'Поднять через {days} дн.',
    'account.renewSuccess': 'Объявление обновлено',
    'account.renewError': 'Не удалось обновить объявление. Попробуйте ещё раз.',
    'account.delete': 'Удалить',
    'account.deleteConfirm': 'Удалить это объявление без возможности восстановления?',
    'account.deleteSuccess': 'Объявление удалено',
    'account.deleteError': 'Не удалось удалить объявление. Попробуйте ещё раз.',
    'profile.menuLabel': 'Профиль',
    'profile.title': 'Профиль',
    'profile.subtitle': 'Расскажите немного о себе',
    'profile.studentQuestion': 'Вы студент?',
    'profile.studentYes': 'Да',
    'profile.studentNo': 'Нет',
    'profile.universityLabel': 'Университет',
    'profile.universitySearchPlaceholder': 'Поиск университета…',
    'profile.universityNotFound': 'Ничего не найдено',
    'profile.universityNotSelected': 'Выберите университет',
    'profile.errorStudentRequired': 'Ответьте на вопрос',
    'profile.save': 'Сохранить',
    'profile.saving': 'Сохранение…',
    'profile.saved': 'Сохранено ✅',
    'profile.moreComingSoon': 'Скоро добавим в профиль ещё больше полей.',
    'profile.errorAuth': 'Не удалось войти через Telegram. Откройте мини-приложение заново.',
    'profile.errorLoad': 'Не удалось загрузить профиль. Попробуйте ещё раз.',
    'profile.errorSave': 'Не удалось сохранить. Попробуйте ещё раз.',
    'profile.noProfileYet': 'Сначала создайте профиль — разместите объявление в приложении или мини-приложении UyDosh, затем возвращайтесь сюда.',
    'profile.noProfileCta': '+ Разместить объявление',
    'profile.nudgeText': 'Укажите свой университет — это поможет другим найти вас.',
    'profile.nudgeCta': 'Заполнить',
    'profile.nudgeDismiss': 'Закрыть',
    'profile.tabs.basic': 'Основное',
    'profile.tabs.lifestyle': 'Образ жизни',
    'profile.lifestyle.notSpecified': 'Не указано',
    'profile.lifestyle.moreComingSoon': 'Скоро добавим в профиль ещё больше полей.',
    'profile.lifestyle.employed': 'Работаете?',
    'profile.lifestyle.employedYes': 'Работаю',
    'profile.lifestyle.employedNo': 'Не работаю',
    'profile.lifestyle.wakeupTime': 'Время подъёма',
    'profile.lifestyle.sleepTime': 'Время сна',
    'profile.lifestyle.morning': 'Утро',
    'profile.lifestyle.evening': 'Вечер',
    'profile.lifestyle.night': 'Ночь',
    'profile.lifestyle.cleanliness': 'Чистоплотность',
    'profile.lifestyle.veryMessy': 'Грязный',
    'profile.lifestyle.messy': 'Неопрятный',
    'profile.lifestyle.average': 'Средне',
    'profile.lifestyle.clean': 'Чистоплотный',
    'profile.lifestyle.veryClean': 'Очень чистоплотный',
    'profile.lifestyle.noiseLevel': 'Уровень шума',
    'profile.lifestyle.veryQuiet': 'Очень тихий',
    'profile.lifestyle.quiet': 'Тихий',
    'profile.lifestyle.loud': 'Громкий',
    'profile.lifestyle.veryLoud': 'Очень шумный',
    'profile.lifestyle.sociability': 'Общительность',
    'profile.lifestyle.veryIntroverted': 'Необщительный',
    'profile.lifestyle.introverted': 'Интроверт',
    'profile.lifestyle.balanced': 'Средне',
    'profile.lifestyle.extroverted': 'Экстраверт',
    'profile.lifestyle.veryExtroverted': 'Очень общительный',
    'profile.lifestyle.guestsAllowed': 'Гости разрешены?',
    'profile.lifestyle.guestsYes': 'Разрешены',
    'profile.lifestyle.guestsNo': 'Не разрешены',
    'profile.lifestyle.smokingPreference': 'Курение',
    'profile.lifestyle.nonSmoker': 'Не курю',
    'profile.lifestyle.occasionalSmoker': 'Курю иногда',
    'profile.lifestyle.regularSmoker': 'Курю регулярно',
    'profile.lifestyle.alcoholPreference': 'Алкоголь',
    'profile.lifestyle.nonDrinker': 'Не пью',
    'profile.lifestyle.occasionalDrinker': 'Пью иногда',
    'profile.lifestyle.regularDrinker': 'Пью регулярно',
    'profile.lifestyle.cookingHabits': 'Готовка',
    'profile.lifestyle.cook': 'Готовлю дома',
    'profile.lifestyle.dontCook': 'Не готовлю',
    'profile.lifestyle.petsPreference': 'Отношение к животным',
    'profile.lifestyle.dontLikePets': 'Не люблю животных',
    'profile.lifestyle.likePets': 'Люблю животных',
    'profile.lifestyle.haveCat': 'Есть кот',
    'profile.lifestyle.haveDog': 'Есть собака',
    'compat.title': 'Совместимость',
    'compat.match': 'Совпадение: {percent}%',
    'compat.notAvailable': 'Н/Д',
    'compat.loading': 'Расчёт совместимости…',
    'compat.matches': 'Совпадения',
    'compat.differences': 'Отличия',
    'compat.dealbreakers': 'Критические отличия',
    'compat.basedOn': 'На основе {scored} из {total} параметров',
    'compat.incompleteTitle': 'Заполните профиль',
    'compat.incompleteBody': 'Укажите свои предпочтения в профиле, чтобы увидеть совместимость с автором объявления.',
    'compat.completeCta': 'Заполнить профиль',
    'compat.region': 'Регион',
    'compat.language': 'Язык',
    'compat.dimGender': 'Пол соседа',
    'compat.dimAge': 'Возраст',
    'compat.dimBudget': 'Бюджет',
    'compat.male': 'Парень',
    'compat.female': 'Девушка',
    'compat.any': 'Любой',
  },
  en: {
    'brand.tagline': "Let's Live Together!",
    'nav.listings': 'Listings',
    'nav.home': 'Home',
    'nav.privacy': 'Privacy',
    'nav.terms': 'Terms',
    'nav.delete': 'Delete account',
    'nav.contact': 'Contact',
    'feed.title': 'Fresh listings',
    'feed.subtitle': 'Real rentals and roommates — newest first.',
    'feed.loading': 'Loading…',
    'feed.empty': 'No listings yet.',
    'feed.error': 'Could not load listings. Please try again later.',
    'feed.retry': 'Try again',
    'feed.end': 'That’s everything. Get the app for alerts on new ones.',
    'feed.scrollToTop': 'Scroll to top',
    'card.featured': 'Featured',
    'card.privateRoom': 'Private room',
    'card.rooms': 'rooms',
    'card.perMonth': '/mo',
    'card.type.roommateNeededMale': 'Roommate needed',
    'card.type.roommateNeededFemale': 'Female roommate needed',
    'card.genderBadge.male': 'Guy',
    'card.genderBadge.female': 'Girl',
    'detail.back': '← Listings',
    'detail.loading': 'Loading…',
    'detail.notFound': 'Listing not found or removed.',
    'detail.description': 'Description',
    'detail.amenities': 'Amenities',
    'detail.openInApp': 'Open in app',
    'detail.downloadApk': 'Download APK',
    'detail.author': 'Author',
    'detail.posted': 'Posted',
    'detail.moveIn': 'Move-in',
    'detail.type': 'Type',
    'detail.location': 'Area',
    'detail.address': 'Address',
    'detail.metro': 'Metro',
    'detail.metroWalkInfo': '{km} km, {minutes} min walk',
    'detail.map': 'Map',
    'detail.showMap': 'Show map',
    'detail.hideMap': 'Hide map',
    'detail.openMapView': 'Open map view',
    'detail.mapUnavailable': 'Could not determine a map location.',
    'detail.mapLoadError': 'Could not load the map.',
    'detail.roomScan': '3D room scan',
    'detail.roomScanDimensions': 'Dimensions',
    'detail.roomScanHeight': 'Height',
    'detail.roomScanArea': 'Area',
    'detail.roomScanFullscreen': 'Fullscreen',
    'detail.roomScanLoadError': 'Could not load the 3D model.',
    'detail.gallery.dots': 'Photos',
    'detail.gallery.photo': 'Photo',
    'detail.contactTelegram': 'Contact on Telegram',
    'detail.contactPhone': 'Call',
    'detail.contactMessage': 'Hi! I\u2019m messaging about your listing:',
    'detail.share': 'Share',
    'detail.favorite.add': 'Add to favorites',
    'detail.favorite.remove': 'Remove from favorites',
    'detail.report': 'Report',
    'detail.claim.title': 'Is this your listing?',
    'detail.claim.subtitle': 'Your Telegram account matches — link it to your profile.',
    'detail.claim.button': 'Claim it',
    'detail.claim.pending': 'Working…',
    'detail.claim.confirm': 'This listing will be transferred to your account and you\u2019ll be able to edit it. Continue?',
    'detail.claim.success': 'Listing successfully transferred to you',
    'detail.claim.error': 'Could not claim this listing. Please try again later.',
    'complaint.title': 'Report listing',
    'complaint.reasonLabel': 'Reason',
    'complaint.loadingReasons': 'Loading reasons…',
    'complaint.loadError': 'Could not load reasons. Please try again.',
    'complaint.detailsLabel': 'Details (optional)',
    'complaint.detailsPlaceholder': 'Add more details…',
    'complaint.submit': 'Submit',
    'complaint.submitting': 'Submitting…',
    'complaint.cancel': 'Cancel',
    'complaint.selectReason': 'Select a reason',
    'complaint.success': 'Complaint submitted',
    'complaint.errorGeneric': 'Could not submit the complaint. Please try again.',
    'complaint.errorDuplicate': 'You have already complained about this listing.',
    'complaint.errorAuth': 'Telegram sign-in failed. Reopen the mini app.',
    'complaints.viewButton': 'View complaints',
    'complaints.title': 'Complaints',
    'complaints.loading': 'Loading complaints…',
    'complaints.loadError': 'Could not load complaints. Please try again.',
    'complaints.empty': 'No complaints for this listing yet',
    'complaints.anonymous': 'User',
    'view.list': 'List',
    'view.map': 'Map',
    'map.loading': 'Loading map…',
    'map.empty': 'No listings to show on the map for these filters.',
    'map.error': 'Could not load the map.',
    'map.retry': 'Try again',
    'theme.toggleLight': 'Switch to light mode',
    'theme.toggleDark': 'Switch to dark mode',
    'map.tooltip.close': 'Close',
    'map.carousel.dots': 'Listings',
    'map.resultsCountAria': 'Found {count} listings on the map',
    'map.layers.districts.show': 'Show districts',
    'map.layers.districts.hide': 'Hide districts',
    'map.layers.metro.show': 'Show metro stations',
    'map.layers.metro.line': 'Metro: {line} line',
    'map.layers.metro.all': 'Metro: all lines',
    'map.locate.cta': 'Show my location',
    'cta.openListings': 'Browse listings',
    'filter.type.all': 'All',
    'filter.type.roomNeeded': 'Need room',
    'filter.type.roommateNeeded': 'Need roommate',
    'filter.type.groupForming': 'Forming group',
    'filter.type.aria': 'Listing type',
    'filter.type.label': 'Type:',
    'filter.gender.label': 'Gender:',
    'filter.gender.any': 'Any',
    'filter.gender.male': 'M',
    'filter.gender.female': 'F',
    'filter.gender.aria': 'Gender filter',
    'filter.photo.label': 'Photo:',
    'filter.photo.withPhoto': 'Photos',
    'filter.photo.aria': 'Listings with photos',
    'filter.line.aria': 'Metro line',
    'filter.district.aria': 'District filter',
    'filter.period.30': '30 days',
    'filter.period.90': '90 days',
    'filter.period.all': 'All time',
    'filter.period.aria': 'Time period filter',
    'filter.collapse.aria': 'Collapse filters',
    'filter.expand.aria': 'Expand filters',
    'create.title': 'Post a listing',
    'create.step.typeLocation': 'Type & area',
    'create.step.details': 'Details',
    'create.step.description': 'Text & photos',
    'create.step.review': 'Review',
    'create.stepCounter': '{current} / {total}',
    'create.listingType': 'Listing type',
    'create.locationMode': 'Search area',
    'create.locationMetro': 'Metro',
    'create.locationDistrict': 'District',
    'create.metroLine': 'Metro line',
    'create.metroStation': 'Station',
    'create.metroStations': 'Stations',
    'create.selectAllStations': 'All {count} stations',
    'create.district': 'District',
    'create.districts': 'Districts',
    'create.selectAllDistricts': 'All {count} districts',
    'create.address': 'Address',
    'create.addressOptional': 'Address (optional)',
    'create.addressPlaceholder': 'Street, building number',
    'create.useCurrentLocation': 'My location',
    'create.locatingAddress': 'Locating…',
    'create.errorLocationFailed': 'Could not determine your location. Enter the address manually.',
    'create.findNearbyMetro': 'Nearby metro',
    'create.walkRadiusOption': '{count} min',
    'create.nearbyStations': 'Stations near you',
    'create.nearbyStationsFallback': 'Closest station (outside your selected radius)',
    'create.nearbyStationsEmpty': 'No metro stations within a {minutes}-minute walk',
    'create.walkMinutes': '{count} min walk',
    'create.price': 'Price',
    'create.priceRange': 'Budget',
    'create.gender': 'For',
    'create.amenities': 'Amenities',
    'create.moveInDate': 'Move-in',
    'create.moveInAny': 'Any date',
    'create.privateRoom': 'Private room',
    'create.titleLabel': 'Title',
    'create.titlePlaceholder': 'e.g. Room near Yunusabad metro',
    'create.descriptionLabel': 'Description',
    'create.descriptionPlaceholder': 'About the home, rules, conditions…',
    'create.photos': 'Photos',
    'create.addPhoto': 'Add photo',
    'create.next': 'Next',
    'create.back': 'Back',
    'create.publish': 'Publish',
    'create.publishing': 'Publishing…',
    'create.success': 'Listing submitted!',
    'create.successHint': 'It will appear in the feed after moderation.',
    'create.successPhotoWarning': 'Some photos could not be uploaded. Try adding them from the listing page.',
    'create.viewListing': 'View listing',
    'create.backToFeed': 'Back to feed',
    'create.errorAuth': 'Telegram sign-in failed. Reopen the mini app.',
    'create.errorGeneric': 'Could not publish. Please try again.',
    'create.errorPhotoProcess': 'Could not process the photo. Choose another image.',
    'create.errorTitleRequired': 'Title is required',
    'create.errorTitleTooLong': 'Title is too long (max 50 characters)',
    'create.errorDescriptionRequired': 'Description is required',
    'create.errorDescriptionTooLong': 'Description is too long (max 1000 characters)',
    'create.errorLocationRequired': 'Select a location',
    'create.errorPriceRequired': 'Set a price',
    'create.errorGenderRequired': 'Select gender',
    'create.reviewType': 'Type',
    'create.reviewLocation': 'Location',
    'create.reviewPrice': 'Price',
    'create.reviewGender': 'Gender',
    'create.reviewAmenities': 'Amenities',
    'create.reviewMoveIn': 'Move-in',
    'create.reviewPrivateRoom': 'Private room',
    'create.reviewPhone': 'Phone',
    'create.sharePhoneCta': 'Share my phone number',
    'create.reviewYes': 'Yes',
    'create.reviewNo': 'No',
    'create.reviewNotSet': 'Not set',
    'create.perMonth': '/mo',
    'create.postListing': 'Post listing',
    'create.priceMin': 'Min',
    'create.priceMax': 'Max',
    'create.descriptionTemplateLabel': 'Template',
    'create.descriptionTemplate.roomNeeded': 'Looking for a room/flatshare.\nFormat: (private/shared).\nTimeline: (move-in + duration).\nMust-haves: (quiet/guests/pets).',
    'create.descriptionTemplate.roommateNeededMale': 'Looking for a male roommate.\nFormat: (1–2 per room).\nWho lives there: (how many people).\nConditions: (with/without landlord), (private/shared room).\nTimeline: (move-in + duration).',
    'create.descriptionTemplate.roommateNeededFemale': 'Looking for a female roommate.\nFormat: (1–2 per room).\nWho lives there: (how many people).\nConditions: (with/without landlord), (private/shared room).\nTimeline: (move-in + duration).',
    'create.descriptionTemplate.groupForming': 'Forming a group to rent together.\nLooking for: (1–2 people, gender/age).\nBudget per person: (amount).\nArea/metro: (where to search).\nFormat: (private/shared rooms).\nMove-in: (date + duration).\nImportant: (cleanliness/quiet/guests/pets).',
    'create.presetTitle.maleRoommate': '#NeedRoommate',
    'create.presetTitle.femaleRoommate': '#NeedRoommate',
    'create.presetTitle.maleRoom': '#NeedRoom',
    'create.presetTitle.femaleRoom': '#NeedRoom',
    'create.presetTitle.groupForming': 'Forming Group',
    'create.editTitle': 'Edit listing',
    'create.save': 'Save',
    'create.saving': 'Saving…',
    'create.editSuccess': 'Listing updated!',
    'create.editSuccessHint': 'Your changes are now live.',
    'create.errorNotOwner': "This listing doesn't belong to you.",
    'create.errorLoadListing': 'Could not load the listing.',
    'create.backToAccount': 'Back to my listings',
    'account.menuLabel': 'Account menu',
    'account.menuAccount': 'Account',
    'account.title': 'My listings',
    'account.subtitle': 'My listings',
    'account.tabs.mine': 'My listings',
    'account.tabs.favorites': 'Favorites',
    'account.empty': "You don't have any listings yet.",
    'account.favoritesEmpty': "You don't have any favorite listings yet.",
    'account.edit': 'Edit',
    'account.deactivate': 'Hide',
    'account.activate': 'Show',
    'account.statusPending': 'Pending review',
    'account.statusInactive': 'Inactive',
    'account.renew': 'Renew',
    'account.renewInOneDay': 'In 1 day',
    'account.renewInDays': 'In {days} days',
    'account.renewSuccess': 'Listing renewed',
    'account.renewError': 'Could not renew the listing. Please try again.',
    'account.delete': 'Delete',
    'account.deleteConfirm': 'Delete this listing permanently? This cannot be undone.',
    'account.deleteSuccess': 'Listing deleted',
    'account.deleteError': 'Could not delete the listing. Please try again.',
    'profile.menuLabel': 'Profile',
    'profile.title': 'Profile',
    'profile.subtitle': 'Tell us a bit about yourself',
    'profile.studentQuestion': 'Are you a student?',
    'profile.studentYes': 'Yes',
    'profile.studentNo': 'No',
    'profile.universityLabel': 'University',
    'profile.universitySearchPlaceholder': 'Search university…',
    'profile.universityNotFound': 'Nothing found',
    'profile.universityNotSelected': 'Select your university',
    'profile.errorStudentRequired': 'Please answer this question',
    'profile.save': 'Save',
    'profile.saving': 'Saving…',
    'profile.saved': 'Saved ✅',
    'profile.moreComingSoon': "We'll add more profile fields soon.",
    'profile.errorAuth': 'Telegram sign-in failed. Reopen the mini app.',
    'profile.errorLoad': 'Could not load your profile. Please try again.',
    'profile.errorSave': 'Could not save. Please try again.',
    'profile.noProfileYet': 'Create your profile first — post a listing in the UyDosh app or mini app, then come back here.',
    'profile.noProfileCta': '+ Post a listing',
    'profile.nudgeText': 'Add your university — it helps others find you.',
    'profile.nudgeCta': 'Fill in',
    'profile.nudgeDismiss': 'Dismiss',
    'profile.tabs.basic': 'Basic',
    'profile.tabs.lifestyle': 'Lifestyle',
    'profile.lifestyle.notSpecified': 'Not specified',
    'profile.lifestyle.moreComingSoon': "We'll add more profile fields soon.",
    'profile.lifestyle.employed': 'Are you employed?',
    'profile.lifestyle.employedYes': 'Employed',
    'profile.lifestyle.employedNo': 'Not working',
    'profile.lifestyle.wakeupTime': 'Wake-up time',
    'profile.lifestyle.sleepTime': 'Sleep time',
    'profile.lifestyle.morning': 'Morning',
    'profile.lifestyle.evening': 'Evening',
    'profile.lifestyle.night': 'Night',
    'profile.lifestyle.cleanliness': 'Cleanliness',
    'profile.lifestyle.veryMessy': 'Very messy',
    'profile.lifestyle.messy': 'Messy',
    'profile.lifestyle.average': 'Average',
    'profile.lifestyle.clean': 'Clean',
    'profile.lifestyle.veryClean': 'Very clean',
    'profile.lifestyle.noiseLevel': 'Noise level',
    'profile.lifestyle.veryQuiet': 'Very quiet',
    'profile.lifestyle.quiet': 'Quiet',
    'profile.lifestyle.loud': 'Loud',
    'profile.lifestyle.veryLoud': 'Very loud',
    'profile.lifestyle.sociability': 'Sociability',
    'profile.lifestyle.veryIntroverted': 'Very introverted',
    'profile.lifestyle.introverted': 'Introverted',
    'profile.lifestyle.balanced': 'Balanced',
    'profile.lifestyle.extroverted': 'Extroverted',
    'profile.lifestyle.veryExtroverted': 'Very extroverted',
    'profile.lifestyle.guestsAllowed': 'Guests allowed?',
    'profile.lifestyle.guestsYes': 'Allowed',
    'profile.lifestyle.guestsNo': 'Not allowed',
    'profile.lifestyle.smokingPreference': 'Smoking',
    'profile.lifestyle.nonSmoker': 'Non-smoker',
    'profile.lifestyle.occasionalSmoker': 'Occasional smoker',
    'profile.lifestyle.regularSmoker': 'Regular smoker',
    'profile.lifestyle.alcoholPreference': 'Alcohol',
    'profile.lifestyle.nonDrinker': 'Non-drinker',
    'profile.lifestyle.occasionalDrinker': 'Occasional drinker',
    'profile.lifestyle.regularDrinker': 'Regular drinker',
    'profile.lifestyle.cookingHabits': 'Cooking',
    'profile.lifestyle.cook': 'I cook at home',
    'profile.lifestyle.dontCook': "Don't cook",
    'profile.lifestyle.petsPreference': 'Pets preference',
    'profile.lifestyle.dontLikePets': "Don't like pets",
    'profile.lifestyle.likePets': 'Like pets',
    'profile.lifestyle.haveCat': 'Have a cat',
    'profile.lifestyle.haveDog': 'Have a dog',
    'compat.title': 'Compatibility',
    'compat.match': 'Match: {percent}%',
    'compat.notAvailable': 'N/A',
    'compat.loading': 'Calculating compatibility…',
    'compat.matches': 'Matches',
    'compat.differences': 'Differences',
    'compat.dealbreakers': 'Critical differences',
    'compat.basedOn': 'Based on {scored} of {total} preferences',
    'compat.incompleteTitle': 'Complete your profile',
    'compat.incompleteBody': 'Fill out your lifestyle preferences to see your compatibility with the listing owner.',
    'compat.completeCta': 'Complete profile',
    'compat.region': 'Region',
    'compat.language': 'Language',
    'compat.dimGender': 'Roommate gender',
    'compat.dimAge': 'Age',
    'compat.dimBudget': 'Budget',
    'compat.male': 'Male',
    'compat.female': 'Female',
    'compat.any': 'Any',
  },
};

function t(key, lang = getLang()) {
  return I18N[lang]?.[key] ?? I18N.uz[key] ?? key;
}

function ensureLangSwitcherStyles() {
  if (document.getElementById(LANG_SWITCHER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LANG_SWITCHER_STYLE_ID;
  style.textContent = `
    .lang.lang-dropdown {
      position: relative;
      display: inline-flex;
      padding: 4px;
      gap: 0;
      border-radius: 999px;
      border: 1px solid var(--stroke, rgba(127, 127, 127, 0.35));
      background: rgba(127, 127, 127, 0.08);
      flex-shrink: 0;
    }
    .lang.lang-dropdown > .lang-trigger {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--muted, rgba(255, 255, 255, 0.7));
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 9px 6px 8px;
      border-radius: 999px;
      font: inherit;
      font-weight: 700;
      line-height: 1;
    }
    .lang.lang-dropdown > .lang-trigger:hover {
      color: var(--fg, rgba(255, 255, 255, 0.92));
    }
    .lang.lang-dropdown > .lang-trigger .flag {
      font-size: 14px;
      line-height: 1;
    }
    .lang.lang-dropdown > .lang-trigger .flag.flag-avatar {
      width: 29px;
      height: 29px;
      border-radius: 50%;
      border: 1.5px solid var(--stroke, rgba(127, 127, 127, 0.45));
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0;
      flex-shrink: 0;
    }
    .lang.lang-dropdown > .lang-trigger .flag.flag-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .lang.lang-dropdown .lang-chevron {
      display: inline-flex;
      align-items: center;
      opacity: 0.65;
      transition: transform 0.15s ease;
    }
    .lang.lang-dropdown.lang-open .lang-chevron {
      transform: rotate(180deg);
    }
    .lang.lang-dropdown .lang-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 148px;
      padding: 4px;
      border-radius: 12px;
      border: 1px solid var(--stroke, rgba(127, 127, 127, 0.35));
      background: var(--card, rgba(15, 23, 42, 0.98));
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      z-index: 100;
    }
    .lang.lang-dropdown .lang-menu button {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--muted, rgba(255, 255, 255, 0.7));
      width: 100%;
      text-align: left;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: normal;
    }
    .lang.lang-dropdown .lang-menu button:hover {
      background: rgba(127, 127, 127, 0.12);
      color: var(--fg, rgba(255, 255, 255, 0.92));
    }
    .lang.lang-dropdown .lang-menu button[aria-selected="true"] {
      color: var(--fg, rgba(255, 255, 255, 0.92));
      background: rgba(127, 127, 127, 0.16);
    }
    .lang.lang-dropdown .lang-menu .lang-label {
      flex: 1 1 auto;
      min-width: 0;
    }
  `;
  document.head.appendChild(style);
}

function buildLangDropdown(group) {
  if (group.querySelector('.lang-trigger')) return group;
  group.classList.add('lang-dropdown');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'lang-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const flagSpan = document.createElement('span');
  flagSpan.className = 'flag';
  flagSpan.setAttribute('aria-hidden', 'true');

  const chevron = document.createElement('span');
  chevron.className = 'lang-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">' +
    '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '</svg>';

  trigger.append(flagSpan, chevron);

  const menu = document.createElement('div');
  menu.className = 'lang-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;

  for (const lang of LANGS) {
    const meta = LANG_META[lang];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-lang', lang);
    btn.setAttribute('data-haptic', 'selection');
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-label', meta.label);
    btn.innerHTML =
      `<span class="flag" aria-hidden="true">${meta.flag}</span>` +
      `<span class="lang-label">${meta.label}</span>`;
    menu.appendChild(btn);
  }

  group.replaceChildren(trigger, menu);
  return group;
}

/** Telegram profile photo of the current Mini App user, if Telegram exposed one. */
function telegramMiniAppUserAvatarUrl() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url || '';
  } catch {
    return '';
  }
}

function syncLangDropdown(group, lang) {
  const meta = LANG_META[lang];
  if (!meta) return;
  const trigger = group.querySelector('.lang-trigger');
  if (!trigger) return;
  const flag = trigger.querySelector('.flag');
  if (flag) {
    // Inside Telegram, the trigger shows the user's own avatar instead of the
    // currently selected language's flag — the flag list only appears once
    // the dropdown is opened.
    const avatarUrl = telegramMiniAppUserAvatarUrl();
    const currentAvatarImg = flag.querySelector('img.lang-avatar-img');
    if (avatarUrl) {
      if (currentAvatarImg?.getAttribute('src') !== avatarUrl) {
        flag.classList.add('flag-avatar');
        flag.innerHTML = `<img class="lang-avatar-img" src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.parentElement.classList.remove('flag-avatar'); this.parentElement.textContent='${meta.flag}';" />`;
      }
    } else if (currentAvatarImg || flag.textContent !== meta.flag) {
      flag.classList.remove('flag-avatar');
      flag.textContent = meta.flag;
    }
  }
  trigger.setAttribute('aria-label', meta.label);
  for (const opt of group.querySelectorAll('.lang-menu button[data-lang]')) {
    opt.setAttribute(
      'aria-selected',
      opt.getAttribute('data-lang') === lang ? 'true' : 'false',
    );
  }
}

function closeLangDropdown(group) {
  const menu = group.querySelector('.lang-menu');
  const trigger = group.querySelector('.lang-trigger');
  if (!menu || !trigger) return;
  menu.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  group.classList.remove('lang-open');
}

function applyI18n(root = document) {
  const lang = getLang();
  root.documentElement && (root.documentElement.lang = lang);
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const value = t(key, lang);
    if (attr) el.setAttribute(attr, value);
    else el.textContent = value;
  }
  for (const group of root.querySelectorAll('.lang.lang-dropdown')) {
    syncLangDropdown(group, lang);
  }
}

function initLangSwitcher() {
  ensureLangSwitcherStyles();
  for (const group of document.querySelectorAll('.lang')) {
    buildLangDropdown(group);
  }

  if (!document.documentElement.dataset.uydoshLangBound) {
    document.documentElement.dataset.uydoshLangBound = '1';
    document.addEventListener('click', (e) => {
      for (const group of document.querySelectorAll('.lang.lang-open')) {
        if (!group.contains(e.target)) closeLangDropdown(group);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      for (const group of document.querySelectorAll('.lang.lang-open')) {
        closeLangDropdown(group);
      }
    });
  }

  for (const group of document.querySelectorAll('.lang.lang-dropdown')) {
    const trigger = group.querySelector('.lang-trigger');
    const menu = group.querySelector('.lang-menu');
    if (!trigger || !menu || trigger.dataset.bound) continue;
    trigger.dataset.bound = '1';
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = group.classList.contains('lang-open');
      for (const other of document.querySelectorAll('.lang.lang-open')) {
        closeLangDropdown(other);
      }
      if (!open) {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        group.classList.add('lang-open');
      }
    });
    for (const btn of group.querySelectorAll('.lang-menu button[data-lang]')) {
      if (btn.dataset.bound) continue;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setLang(btn.getAttribute('data-lang'));
        applyI18n();
        closeLangDropdown(group);
      });
    }
  }
  applyI18n();
}

/** Sun/moon glyph for the header app-theme toggle (matches the old map control's icon). */
function themeToggleButtonIconSvg(isDark) {
  return isDark
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"></path></svg>`;
}

/**
 * Sync every header theme-toggle button's icon/label with the current app UI theme (not the
 * map's theme — the map deliberately ignores this toggle, see prefersDarkMapPins()).
 */
function refreshThemeToggleButtons() {
  const isDark = currentUiTheme() === 'dark';
  // Button shows the *target* mode's icon, so the label names the mode it switches to.
  const label = t(isDark ? 'theme.toggleLight' : 'theme.toggleDark');
  for (const btn of document.querySelectorAll('[data-uydosh-theme-toggle]')) {
    btn.innerHTML = themeToggleButtonIconSvg(isDark);
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
}

/** Wire up header theme-toggle button(s) — mirrors the map's old sun/moon control. */
function initThemeToggle() {
  for (const btn of document.querySelectorAll('[data-uydosh-theme-toggle]')) {
    if (btn.dataset.bound) continue;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      toggleManualTheme();
    });
  }
  refreshThemeToggleButtons();
}

if (typeof document !== 'undefined') {
  document.addEventListener('uydosh:themechange', refreshThemeToggleButtons);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

Object.assign(window.UyDosh, {
  applyI18n,
  initLangSwitcher,
  initThemeToggle,
  escapeHtml,
  t,
});
