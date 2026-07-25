// Makon3D web gallery — list recent scans, open one in <model-viewer>.
(() => {
  const API_BASE = window.UyDosh?.API_BASE || 'https://api.uydosh.com';
  const MODEL_VIEWER_SRC =
    'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js';
  // Backend may rewrite room_scan.glb in place — bump to bust caches.
  const GLB_CACHE_VERSION = '20260716-1';

  // --- i18n -----------------------------------------------------------------
  // Self-contained: the Makon3D mini app doesn't load uydosh-i18n.js (whose
  // dictionaries are UyDosh-page keys), but mirrors its uz/ru/en language set.
  const M3D_LANGS = ['uz', 'ru', 'en'];
  const M3D_LANG_STORAGE_KEY = 'makon3d:lang';
  const M3D_LANG_META = {
    uz: { flag: '🇺🇿', label: "O'zbekcha" },
    ru: { flag: '🇷🇺', label: 'Русский' },
    en: { flag: '🇬🇧', label: 'English' },
  };

  const M3D_I18N = {
    en: {
      tagline: 'Your space in 3D',
      'aria.menu': 'Menu',
      'aria.back': 'Back',
      'aria.close': 'Close',
      'aria.scans': 'Scans',
      'aria.view3d': '3D view',
      'drawer.scans': 'Scans',
      'drawer.contact': 'Contact',
      'drawer.privacy': 'Privacy Policy',
      'drawer.terms': 'Terms of Service',
      'drawer.language': 'Language',
      'list.loading': 'Loading scans',
      'list.empty': 'No projects yet. Tap + to create one.',
      'list.error': 'Could not load scans. Pull to refresh or try again later.',
      'scan.title': 'Scan #{id}',
      'scan.notFound': 'Scan not found.',
      'badge.ready': '3D ready',
      'badge.processing': 'Processing',
      'room.livingRoom': 'Living room',
      'room.bedroom': 'Bedroom',
      'room.kitchen': 'Kitchen',
      'room.bathroom': 'Bathroom',
      'room.hallway': 'Hallway',
      'room.other': 'Room',
      'list.projects': 'Projects',
      'list.myProjects': 'My projects',
      'project.scanCount': 'Scans: {count}',
      'project.mode.entireHousing': 'Entire home',
      'project.mode.roomByRoom': 'Room by room',
      'project.noScans': 'No scans in this project yet.',
      'project.noRooms': 'No rooms yet — add one to scan.',
      'project.addRoom': 'Add room',
      'project.scanRoom': 'Scan',
      'project.startScan': 'Start scan',
      'project.rescan': 'Rescan',
      'project.roomPending': 'Not scanned',
      'project.updateFailed': 'Could not save changes. Try again later.',
      'roomType.title': 'Select room type',
      'create.title': 'New project',
      'create.nameLabel': 'Project name',
      'create.namePlaceholder': 'e.g. My apartment',
      'create.addressLabel': 'Property address',
      'create.addressPlaceholder': 'Optional',
      'create.useLocation': 'Use current location',
      'create.locationFailed': 'Could not determine the address from your current location.',
      'create.locationDenied': 'Location permission is required to use current location.',
      'create.modeLabel': 'Scan mode',
      'create.cancel': 'Cancel',
      'create.submit': 'Create',
      'create.nameRequired': 'Enter a project name.',
      'create.failed': 'Could not create the project. Try again later.',
      'action.deleteScan': 'Delete scan',
      'action.deleteProject': 'Delete project',
      'confirm.deleteScan': 'Delete this scan? This cannot be undone.',
      'confirm.deleteProject': 'Delete this project and its scans? This cannot be undone.',
      'delete.failed': 'Could not delete. Try again later.',
      'unit.m': 'm',
      'unit.m2': 'm²',
      'dims.heightPrefix': 'H',
      'viewer.loadingModel': 'Loading 3D model',
      'viewer.processingNote': '3D preview is still processing — USDZ is available for the native app.',
      'viewer.noPreview': 'No web 3D preview yet for this scan.',
      'viewer.modelError': 'Could not load this 3D model.',
      'viewer.viewerError': 'Could not load the 3D viewer.',
      'share.gif': 'Share GIF',
      'share.link': 'Share link',
      'share.text': 'View this 3D scan in Makon3D:',
      'share.copied': 'Link copied to clipboard.',
      'share.prompt': 'Copy this link:',
      'share.ogDescription': 'View this 3D scan in Makon3D',
      'ctrl.fullRoom': 'Full room',
      'ctrl.floorFurniture': 'Floor and furniture',
      'ctrl.floorOnly': 'Floor only',
      'ctrl.viewMode': 'View mode',
      'ctrl.brickWalls': 'Brick walls',
      'ctrl.plasterWalls': 'Plaster walls',
      'ctrl.woodFloor': 'Wood floor',
      'ctrl.tileFloor': 'Tile floor',
      'ctrl.rotate': 'Rotate',
      'ctrl.pauseRotation': 'Pause rotation',
      'ctrl.zoom': 'Zoom',
      'mat.title': 'Material estimate',
      'mat.surface': 'Surface',
      'mat.floor': 'Floor',
      'mat.walls': 'Walls',
      'mat.measuredArea': 'Measured area',
      'mat.perimeterHeight': 'Perimeter: ~{len} m · Height: ~{h} m',
      'mat.noWallArea': 'No wall measurements for this scan.',
      'mat.noFloorArea': 'No floor area for this scan.',
      'mat.wallApprox': 'Door and window openings are not subtracted.',
      'mat.wallNetArea': 'Wall area: ~{net} m² (openings ~{open} m² subtracted).',
      'mat.wallNoOpenings': 'Wall area: ~{net} m²; no openings detected.',
      'mat.floorApprox': 'Using room length × width (approximate).',
      'mat.tileShape': 'Tile shape',
      'mat.square': 'Square',
      'mat.rectangle': 'Rectangle',
      'mat.tileSize': 'Tile size (cm)',
      'mat.width': 'Width',
      'mat.length': 'Length',
      'mat.rollSize': 'Roll size (m)',
      'mat.rollWidth': 'Width, m',
      'mat.rollLength': 'Length, m',
      'mat.patternRepeat': 'Pattern repeat, cm',
      'mat.waste': 'Waste',
      'mat.toBuy': 'To buy',
      'mat.tilesCount': '{count} tiles',
      'mat.buyArea': '~{area} m² of tiles',
      'mat.tileDetail': 'Tile {tile} m² · with waste ~{eff} m²',
      'mat.plinth': 'Plinth: ~{len} m · {count} pcs × {strip} m',
      'mat.plinthNote': 'Perimeter, door openings not subtracted.',
      'mat.plinthMinusDoorways': 'Wall perimeter ~{len} m minus ~{door} m of doorways.',
      'mat.plinthNoDoorways': 'Wall perimeter; no doorways detected.',
      'mat.rollsCount': '{count} rolls',
      'mat.strips': 'Strips: {count} × {len} m',
      'mat.stripsPerRoll': '{count} strips per roll',
      'mat.noEstimate': 'Nothing to estimate without measurements.',
      'cta.starting': 'Starting…',
      'cta.copied': 'Link copied',
      'cta.error': 'Could not start scanning. Try again later.',
      'cta.qrHint': 'Scan this code with an iPhone camera to start scanning.',
      'cta.building': 'Building the 3D model…',
      'cta.failed': 'Scan processing failed. Please try again.',
      'overlay.backToScans': 'Back to scans',
      'overlay.linkExpired': 'This scan link has expired.',
      'overlay.failed': 'Scan processing failed. Please try scanning again.',
      'overlay.sessionExpired': 'This scan session has expired.',
    },
    ru: {
      tagline: 'Ваше пространство в 3D',
      'aria.menu': 'Меню',
      'aria.back': 'Назад',
      'aria.close': 'Закрыть',
      'aria.scans': 'Сканы',
      'aria.view3d': '3D-просмотр',
      'drawer.scans': 'Сканы',
      'drawer.contact': 'Связаться',
      'drawer.privacy': 'Политика конфиденциальности',
      'drawer.terms': 'Условия использования',
      'drawer.language': 'Язык',
      'list.loading': 'Загрузка сканов',
      'list.empty': 'Пока нет проектов. Нажмите +, чтобы создать.',
      'list.error': 'Не удалось загрузить сканы. Попробуйте позже.',
      'scan.title': 'Скан #{id}',
      'scan.notFound': 'Скан не найден.',
      'badge.ready': '3D готов',
      'badge.processing': 'Обработка',
      'room.livingRoom': 'Гостиная',
      'room.bedroom': 'Спальня',
      'room.kitchen': 'Кухня',
      'room.bathroom': 'Ванная',
      'room.hallway': 'Прихожая',
      'room.other': 'Комната',
      'list.projects': 'Проекты',
      'list.myProjects': 'Мои проекты',
      'project.scanCount': 'Сканов: {count}',
      'project.mode.entireHousing': 'Всё жильё',
      'project.mode.roomByRoom': 'Комната за комнатой',
      'project.noScans': 'В этом проекте пока нет сканов.',
      'project.noRooms': 'Пока нет комнат — добавьте, чтобы сканировать.',
      'project.addRoom': 'Добавить комнату',
      'project.scanRoom': 'Сканировать',
      'project.startScan': 'Начать сканирование',
      'project.rescan': 'Пересканировать',
      'project.roomPending': 'Не отсканировано',
      'project.updateFailed': 'Не удалось сохранить изменения. Попробуйте позже.',
      'roomType.title': 'Выберите тип комнаты',
      'create.title': 'Новый проект',
      'create.nameLabel': 'Название проекта',
      'create.namePlaceholder': 'напр. Моя квартира',
      'create.addressLabel': 'Адрес объекта',
      'create.addressPlaceholder': 'Необязательно',
      'create.useLocation': 'Моя геолокация',
      'create.locationFailed': 'Не удалось определить адрес по текущему местоположению.',
      'create.locationDenied': 'Для текущего местоположения нужен доступ к геолокации.',
      'create.modeLabel': 'Режим сканирования',
      'create.cancel': 'Отмена',
      'create.submit': 'Создать',
      'create.nameRequired': 'Введите название проекта.',
      'create.failed': 'Не удалось создать проект. Попробуйте позже.',
      'action.deleteScan': 'Удалить скан',
      'action.deleteProject': 'Удалить проект',
      'confirm.deleteScan': 'Удалить этот скан? Это действие нельзя отменить.',
      'confirm.deleteProject': 'Удалить этот проект и его сканы? Это действие нельзя отменить.',
      'delete.failed': 'Не удалось удалить. Попробуйте позже.',
      'unit.m': 'м',
      'unit.m2': 'м²',
      'dims.heightPrefix': 'В',
      'viewer.loadingModel': 'Загрузка 3D-модели',
      'viewer.processingNote': '3D-превью ещё обрабатывается — USDZ доступен для приложения.',
      'viewer.noPreview': 'Для этого скана пока нет 3D-превью.',
      'viewer.modelError': 'Не удалось загрузить эту 3D-модель.',
      'viewer.viewerError': 'Не удалось загрузить 3D-просмотр.',
      'share.gif': 'Поделиться GIF',
      'share.link': 'Поделиться ссылкой',
      'share.text': 'Посмотрите этот 3D-скан в Makon3D:',
      'share.copied': 'Ссылка скопирована.',
      'share.prompt': 'Скопируйте ссылку:',
      'share.ogDescription': 'Посмотрите этот 3D-скан в Makon3D',
      'ctrl.fullRoom': 'Вся комната',
      'ctrl.floorFurniture': 'Пол и мебель',
      'ctrl.floorOnly': 'Только пол',
      'ctrl.viewMode': 'Режим просмотра',
      'ctrl.brickWalls': 'Кирпичные стены',
      'ctrl.plasterWalls': 'Оштукатуренные стены',
      'ctrl.woodFloor': 'Деревянный пол',
      'ctrl.tileFloor': 'Плиточный пол',
      'ctrl.rotate': 'Вращение',
      'ctrl.pauseRotation': 'Остановить вращение',
      'ctrl.zoom': 'Масштаб',
      'mat.title': 'Расчёт материалов',
      'mat.surface': 'Поверхность',
      'mat.floor': 'Пол',
      'mat.walls': 'Стены',
      'mat.measuredArea': 'Измеренная площадь',
      'mat.perimeterHeight': 'Периметр: ~{len} м · Высота: ~{h} м',
      'mat.noWallArea': 'Для этого скана нет замеров стен.',
      'mat.noFloorArea': 'Для этого скана нет площади пола.',
      'mat.wallApprox': 'Дверные и оконные проёмы не вычтены.',
      'mat.wallNetArea': 'Площадь стен: ~{net} м² (проёмы ~{open} м² вычтены).',
      'mat.wallNoOpenings': 'Площадь стен: ~{net} м²; проёмы не обнаружены.',
      'mat.floorApprox': 'Используется длина × ширина комнаты (приблизительно).',
      'mat.tileShape': 'Форма плитки',
      'mat.square': 'Квадратная',
      'mat.rectangle': 'Прямоугольная',
      'mat.tileSize': 'Размер плитки (см)',
      'mat.width': 'Ширина',
      'mat.length': 'Длина',
      'mat.rollSize': 'Размер рулона (м)',
      'mat.rollWidth': 'Ширина, м',
      'mat.rollLength': 'Длина, м',
      'mat.patternRepeat': 'Раппорт, см',
      'mat.waste': 'Запас',
      'mat.toBuy': 'К покупке',
      'mat.tilesCount': '{count} шт.',
      'mat.buyArea': '~{area} м² плитки',
      'mat.tileDetail': 'Плитка {tile} м² · с запасом ~{eff} м²',
      'mat.plinth': 'Плинтус: ~{len} м · {count} шт × {strip} м',
      'mat.plinthNote': 'Периметр, дверные проёмы не вычтены.',
      'mat.plinthMinusDoorways': 'Периметр стен ~{len} м минус ~{door} м дверных проёмов.',
      'mat.plinthNoDoorways': 'Периметр стен; дверные проёмы не обнаружены.',
      'mat.rollsCount': '{count} рул.',
      'mat.strips': 'Полосы: {count} × {len} м',
      'mat.stripsPerRoll': 'Полос в рулоне: {count}',
      'mat.noEstimate': 'Без замеров рассчитывать нечего.',
      'cta.starting': 'Запуск…',
      'cta.copied': 'Ссылка скопирована',
      'cta.error': 'Не удалось начать сканирование. Попробуйте позже.',
      'cta.qrHint': 'Отсканируйте этот код камерой iPhone, чтобы начать сканирование.',
      'cta.building': 'Строим 3D-модель…',
      'cta.failed': 'Обработка скана не удалась. Попробуйте ещё раз.',
      'overlay.backToScans': 'К сканам',
      'overlay.linkExpired': 'Срок действия ссылки на скан истёк.',
      'overlay.failed': 'Обработка скана не удалась. Попробуйте отсканировать ещё раз.',
      'overlay.sessionExpired': 'Сессия сканирования истекла.',
    },
    uz: {
      tagline: 'Makoningiz 3D ko‘rinishda',
      'aria.menu': 'Menyu',
      'aria.back': 'Orqaga',
      'aria.close': 'Yopish',
      'aria.scans': 'Skanlar',
      'aria.view3d': '3D ko‘rinish',
      'drawer.scans': 'Skanlar',
      'drawer.contact': 'Aloqa',
      'drawer.privacy': 'Maxfiylik siyosati',
      'drawer.terms': 'Foydalanish shartlari',
      'drawer.language': 'Til',
      'list.loading': 'Skanlar yuklanmoqda',
      'list.empty': 'Hozircha loyihalar yo‘q. Yaratish uchun + tugmasini bosing.',
      'list.error': 'Skanlarni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.',
      'scan.title': 'Skan #{id}',
      'scan.notFound': 'Skan topilmadi.',
      'badge.ready': '3D tayyor',
      'badge.processing': 'Ishlanmoqda',
      'room.livingRoom': 'Mehmonxona',
      'room.bedroom': 'Yotoqxona',
      'room.kitchen': 'Oshxona',
      'room.bathroom': 'Hammom',
      'room.hallway': 'Yo‘lak',
      'room.other': 'Xona',
      'list.projects': 'Loyihalar',
      'list.myProjects': 'Mening loyihalarim',
      'project.scanCount': 'Skanlar: {count}',
      'project.mode.entireHousing': 'Butun uy',
      'project.mode.roomByRoom': 'Xonama-xona',
      'project.noScans': 'Bu loyihada hali skanlar yo‘q.',
      'project.noRooms': 'Hozircha xonalar yo‘q — skanerlash uchun xona qo‘shing.',
      'project.addRoom': 'Xona qo‘shish',
      'project.scanRoom': 'Skanerlash',
      'project.startScan': 'Skanerlashni boshlash',
      'project.rescan': 'Qayta skanerlash',
      'project.roomPending': 'Skanerlanmagan',
      'project.updateFailed': 'O‘zgarishlarni saqlab bo‘lmadi. Keyinroq urinib ko‘ring.',
      'roomType.title': 'Xona turini tanlang',
      'create.title': 'Yangi loyiha',
      'create.nameLabel': 'Loyiha nomi',
      'create.namePlaceholder': 'masalan, Mening kvartiram',
      'create.addressLabel': 'Mulk manzili',
      'create.addressPlaceholder': 'Ixtiyoriy',
      'create.useLocation': 'Joriy joylashuv',
      'create.locationFailed': 'Joriy joylashuv bo‘yicha manzilni aniqlab bo‘lmadi.',
      'create.locationDenied': 'Joriy joylashuvdan foydalanish uchun joylashuv ruxsati kerak.',
      'create.modeLabel': 'Skanerlash rejimi',
      'create.cancel': 'Bekor qilish',
      'create.submit': 'Yaratish',
      'create.nameRequired': 'Loyiha nomini kiriting.',
      'create.failed': 'Loyiha yaratib bo‘lmadi. Keyinroq urinib ko‘ring.',
      'action.deleteScan': 'Skanni o‘chirish',
      'action.deleteProject': 'Loyihani o‘chirish',
      'confirm.deleteScan': 'Bu skan o‘chirilsinmi? Buni ortga qaytarib bo‘lmaydi.',
      'confirm.deleteProject': 'Bu loyiha va uning skanlari o‘chirilsinmi? Buni ortga qaytarib bo‘lmaydi.',
      'delete.failed': 'O‘chirib bo‘lmadi. Keyinroq urinib ko‘ring.',
      'unit.m': 'm',
      'unit.m2': 'm²',
      'dims.heightPrefix': 'B',
      'viewer.loadingModel': '3D model yuklanmoqda',
      'viewer.processingNote': '3D ko‘rinish hali tayyorlanmoqda — USDZ ilova uchun mavjud.',
      'viewer.noPreview': 'Bu skan uchun hali 3D ko‘rinish yo‘q.',
      'viewer.modelError': 'Bu 3D modelni yuklab bo‘lmadi.',
      'viewer.viewerError': '3D ko‘rish oynasini yuklab bo‘lmadi.',
      'share.gif': 'GIF ulashish',
      'share.link': 'Havolani ulashish',
      'share.text': 'Ushbu 3D skanni Makon3D’da ko‘ring:',
      'share.copied': 'Havola nusxalandi.',
      'share.prompt': 'Havolani nusxalang:',
      'share.ogDescription': 'Ushbu 3D skanni Makon3D’da ko‘ring',
      'ctrl.fullRoom': 'Butun xona',
      'ctrl.floorFurniture': 'Pol va mebel',
      'ctrl.floorOnly': 'Faqat pol',
      'ctrl.viewMode': 'Ko‘rish rejimi',
      'ctrl.brickWalls': 'G‘isht devorlar',
      'ctrl.plasterWalls': 'Suvoqli devorlar',
      'ctrl.woodFloor': 'Yog‘och pol',
      'ctrl.tileFloor': 'Plitka pol',
      'ctrl.rotate': 'Aylantirish',
      'ctrl.pauseRotation': 'Aylanishni to‘xtatish',
      'ctrl.zoom': 'Masshtab',
      'mat.title': 'Material hisob-kitobi',
      'mat.surface': 'Yuza',
      'mat.floor': 'Pol',
      'mat.walls': 'Devorlar',
      'mat.measuredArea': 'O‘lchangan maydon',
      'mat.perimeterHeight': 'Perimetr: ~{len} m · Balandlik: ~{h} m',
      'mat.noWallArea': 'Bu skan uchun devor o‘lchovlari yo‘q.',
      'mat.noFloorArea': 'Bu skan uchun pol maydoni yo‘q.',
      'mat.wallApprox': 'Eshik va deraza o‘rinlari ayirilmagan.',
      'mat.wallNetArea': 'Devor maydoni: ~{net} m² (o‘rinlar ~{open} m² ayirilgan).',
      'mat.wallNoOpenings': 'Devor maydoni: ~{net} m²; o‘rinlar topilmadi.',
      'mat.floorApprox': 'Xona uzunligi × eni ishlatildi (taxminiy).',
      'mat.tileShape': 'Plitka shakli',
      'mat.square': 'Kvadrat',
      'mat.rectangle': 'To‘g‘ri to‘rtburchak',
      'mat.tileSize': 'Plitka o‘lchami (sm)',
      'mat.width': 'Eni',
      'mat.length': 'Bo‘yi',
      'mat.rollSize': 'Rulon o‘lchami (m)',
      'mat.rollWidth': 'Eni, m',
      'mat.rollLength': 'Bo‘yi, m',
      'mat.patternRepeat': 'Naqsh qadami, sm',
      'mat.waste': 'Zaxira',
      'mat.toBuy': 'Sotib olish uchun',
      'mat.tilesCount': '{count} dona',
      'mat.buyArea': '~{area} m² plitka',
      'mat.tileDetail': 'Plitka {tile} m² · zaxira bilan ~{eff} m²',
      'mat.plinth': 'Plintus: ~{len} m · {count} dona × {strip} m',
      'mat.plinthNote': 'Perimetr, eshik o‘rinlari ayirilmagan.',
      'mat.plinthMinusDoorways': 'Devor perimetri ~{len} m minus eshik o‘rinlari ~{door} m.',
      'mat.plinthNoDoorways': 'Devor perimetri; eshik o‘rinlari topilmadi.',
      'mat.rollsCount': '{count} rulon',
      'mat.strips': 'Polosalar: {count} × {len} m',
      'mat.stripsPerRoll': 'Bir rulonda {count} polosa',
      'mat.noEstimate': 'O‘lchovlarsiz hisoblab bo‘lmaydi.',
      'cta.starting': 'Boshlanmoqda…',
      'cta.copied': 'Havola nusxalandi',
      'cta.error': 'Skanerlashni boshlab bo‘lmadi. Keyinroq urinib ko‘ring.',
      'cta.qrHint': 'Skanerlashni boshlash uchun bu kodni iPhone kamerasi bilan skanerlang.',
      'cta.building': '3D model tayyorlanmoqda…',
      'cta.failed': 'Skanni qayta ishlash muvaffaqiyatsiz. Qayta urinib ko‘ring.',
      'overlay.backToScans': 'Skanlarga qaytish',
      'overlay.linkExpired': 'Skan havolasining muddati tugagan.',
      'overlay.failed': 'Skanni qayta ishlash muvaffaqiyatsiz. Qayta skanerlab ko‘ring.',
      'overlay.sessionExpired': 'Skanerlash sessiyasining muddati tugagan.',
    },
  };

  function detectLang() {
    try {
      const saved = localStorage.getItem(M3D_LANG_STORAGE_KEY);
      if (M3D_LANGS.includes(saved)) return saved;
    } catch { /* storage blocked */ }
    try {
      const tgLang = String(
        window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || '',
      ).slice(0, 2);
      if (M3D_LANGS.includes(tgLang)) return tgLang;
    } catch { /* ignore */ }
    const nav = (navigator.language || '').slice(0, 2);
    if (M3D_LANGS.includes(nav)) return nav;
    return 'ru';
  }

  let currentLang = detectLang();

  function t(key) {
    return M3D_I18N[currentLang]?.[key] ?? M3D_I18N.en[key] ?? key;
  }

  /** t() + `{token}` substitution, e.g. tf('scan.title', { id: 12 }). */
  function tf(key, params) {
    let out = t(key);
    for (const [token, value] of Object.entries(params || {})) {
      out = out.replace(`{${token}}`, String(value));
    }
    return out;
  }

  function m3dLocale() {
    return currentLang === 'ru' ? 'ru-RU' : currentLang === 'uz' ? 'uz-UZ' : 'en-US';
  }

  const backEl = document.getElementById('m3d-back');
  const navTriggerEl = document.getElementById('m3d-nav-trigger');
  const drawerBackdropEl = document.getElementById('m3d-drawer-backdrop');
  const drawerHomeEl = document.getElementById('m3d-drawer-home');
  const avatarEl = document.getElementById('m3d-avatar');
  const drawerAvatarEl = document.getElementById('m3d-drawer-avatar');
  const drawerUsernameEl = document.getElementById('m3d-drawer-username');
  const statusEl = document.getElementById('m3d-status');
  const listEl = document.getElementById('m3d-list');
  const listPanelEl = document.getElementById('m3d-list-panel');
  const viewerPanelEl = document.getElementById('m3d-viewer-panel');
  const viewerWrapEl = document.getElementById('m3d-viewer-wrap');
  const viewerMetaEl = document.getElementById('m3d-viewer-meta');
  const materialsEl = document.getElementById('m3d-materials');

  /** All known scans — the flat public feed merged with every project's scans. */
  /** @type {any[]} */
  let scansCache = [];
  /** Public projects feed; each entry carries its resolved `scans` array. */
  /** @type {any[]} */
  let projectsCache = [];
  /** Projects owned by this browser (created via the FAB, keyed by the
   * localStorage device id) — shown first on home, empty ones included. */
  /** @type {any[]} */
  let myProjectsCache = [];
  /** @type {number|null} */
  let openScanId = null;
  /** The open scan's data — re-renders its meta panel on language change. */
  let openScanData = null;
  /** Open project view, or the project the current scan viewer came from. */
  /** @type {string|null} */
  let openProjectId = null;
  /** Guards renderHome() until the first feed fetch has populated the caches. */
  let feedLoaded = false;
  let modelViewerLoadPromise = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function photoUrl(relative) {
    if (typeof window.UyDosh?.photoUrl === 'function') {
      return window.UyDosh.photoUrl(relative);
    }
    if (!relative) return '';
    if (/^https?:\/\//i.test(relative)) return relative;
    return `${API_BASE}${relative.startsWith('/') ? '' : '/'}${relative}`;
  }

  function withCacheBust(url) {
    if (!url) return '';
    return `${url}${url.includes('?') ? '&' : '?'}v=${GLB_CACHE_VERSION}`;
  }

  function inTelegram() {
    try {
      return Boolean(window.Telegram?.WebApp?.initData);
    } catch {
      return false;
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(m3dLocale(), {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return d.toLocaleString();
    }
  }

  function formatMeters(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return null;
    return `${v.toFixed(v >= 10 ? 1 : 2)} ${t('unit.m')}`;
  }

  function formatArea(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return null;
    return `${v.toFixed(v >= 10 ? 1 : 2)} ${t('unit.m2')}`;
  }

  function scanDimensions(scan) {
    const parts = [];
    const long = formatMeters(scan.floorLongM);
    const short = formatMeters(scan.floorShortM);
    const height = formatMeters(scan.heightM);
    const area = formatArea(scan.floorAreaM2);
    if (long && short) parts.push(`${long} × ${short}`);
    else if (long) parts.push(long);
    if (height) parts.push(`${t('dims.heightPrefix')} ${height}`);
    if (area) parts.push(area);
    return parts;
  }

  function readRoute() {
    const qs = new URLSearchParams(location.search);
    let rawId = qs.get('id') || qs.get('scan');
    // Support path-style URLs: /makon3d/scans/123 (custom domain / SPA hosts).
    if (!rawId) {
      const pathMatch = location.pathname.match(/\/scans\/(\d+)\/?$/);
      if (pathMatch) rawId = pathMatch[1];
    }
    const id = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null;
    const token = (qs.get('token') || '').trim();
    const rawProject = (qs.get('project') || '').trim();
    const projectId = /^[A-Za-z0-9_-]{1,64}$/.test(rawProject) ? rawProject : null;
    return { id, token, projectId };
  }

  function setRoute({ scanId = null, projectId = null } = {}) {
    const qs = new URLSearchParams(location.search);
    // The gallery always shows every public scan — drop any legacy
    // device-scoped links.
    qs.delete('device_id');
    if (scanId) qs.set('id', String(scanId));
    else qs.delete('id');
    if (projectId) qs.set('project', String(projectId));
    else qs.delete('project');
    qs.delete('scan');
    const next = qs.toString();
    const url = `${location.pathname}${next ? `?${next}` : ''}${location.hash || ''}`;
    history.pushState({ scanId: scanId || null, projectId: projectId || null }, '', url);
  }

  // Remembers the i18n key of the visible status so a language switch can
  // re-render it (see rerenderForLangChange).
  let lastStatusKey = null;

  function showStatus(message, isError = false) {
    lastStatusKey = null;
    statusEl.hidden = false;
    statusEl.dataset.error = isError ? '1' : '';
    statusEl.removeAttribute('aria-label');
    statusEl.textContent = message;
    listEl.hidden = true;
  }

  function showStatusKey(key, isError = false) {
    showStatus(t(key), isError);
    lastStatusKey = key;
  }

  /** Spinning Makon mark (see .m3d-loading-spinner in makon3d.css) — the one
   * loader used everywhere across the mini app, like UyDosh's spinning "U". */
  function loadingSpinnerHtml() {
    return '<span class="m3d-loading-spinner" aria-hidden="true"></span>';
  }

  function showLoadingStatus(label) {
    lastStatusKey = null;
    statusEl.hidden = false;
    statusEl.dataset.error = '';
    statusEl.setAttribute('aria-label', label);
    statusEl.innerHTML = loadingSpinnerHtml();
    listEl.hidden = true;
  }

  function teardownViewer() {
    openScanId = null;
    openScanData = null;
    viewerPanelEl.hidden = true;
    viewerWrapEl.classList.remove('is-blueprint');
    delete viewerWrapEl.dataset.roomscanBlueprintAlignRad;
    viewerWrapEl.innerHTML = '';
    viewerMetaEl.innerHTML = '';
    if (materialsEl) {
      materialsEl.hidden = true;
      materialsEl.innerHTML = '';
    }
    clearShareOgTags();
  }

  /** Home: the projects list with ungrouped scans below (see renderHome). */
  function showListView() {
    teardownViewer();
    openProjectId = null;
    listPanelEl.hidden = false;
    backEl.hidden = true;
    navTriggerEl.hidden = false;
    // On the very first call the feeds are still loading — loadScans() shows
    // its own spinner and calls renderHome() itself.
    if (feedLoaded) renderHome();
  }

  function clearShareOgTags() {
    document.querySelectorAll('meta[data-m3d-og]').forEach((el) => el.remove());
  }

  function setShareOgTags({ title, description, imageUrl, pageUrl }) {
    clearShareOgTags();
    const tags = [
      ['og:title', title],
      ['og:description', description],
      ['og:image', imageUrl],
      ['og:url', pageUrl],
      ['twitter:card', 'summary_large_image'],
    ];
    for (const [property, content] of tags) {
      if (!content) continue;
      const meta = document.createElement('meta');
      meta.setAttribute('data-m3d-og', '1');
      if (property.startsWith('twitter:')) meta.setAttribute('name', property);
      else meta.setAttribute('property', property);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    }
  }

  function viewerShareUrl(scanId) {
    return `${location.origin}${location.pathname}?id=${scanId}`;
  }

  async function shareScan(scan) {
    const id = Number(scan.id);
    const shareUrl = scan.viewerUrl || viewerShareUrl(id);
    const text = `${t('share.text')}\n\n${shareUrl}`;
    const gifUrl = scan.rotationGifUrl ? photoUrl(scan.rotationGifUrl) : '';
    try {
      if (gifUrl && navigator.share && navigator.canShare) {
        const res = await fetch(gifUrl);
        const blob = await res.blob();
        const file = new File([blob], `makon3d-scan-${id}.gif`, {
          type: 'image/gif',
        });
        if (navigator.canShare({ files: [file], text, url: shareUrl })) {
          await navigator.share({ files: [file], text, url: shareUrl, title: 'Makon3D' });
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: 'Makon3D', text, url: shareUrl });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.warn('[Makon3D] share failed', err);
    }
    try {
      await navigator.clipboard.writeText(text);
      showStatusKey('share.copied');
    } catch {
      window.prompt(t('share.prompt'), shareUrl);
    }
  }

  function loadModelViewerScript() {
    if (window.customElements?.get('model-viewer')) return Promise.resolve();
    if (modelViewerLoadPromise) return modelViewerLoadPromise;
    modelViewerLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = MODEL_VIEWER_SRC;
      script.onload = () => resolve();
      script.onerror = () => {
        modelViewerLoadPromise = null;
        reject(new Error('Failed to load model-viewer'));
      };
      document.head.appendChild(script);
    });
    return modelViewerLoadPromise;
  }

  function createModelViewer(glbUrl, usdzUrl) {
    const el = document.createElement('model-viewer');
    el.setAttribute('src', glbUrl);
    // AR intents break inside Telegram's WebView — keep AR for regular browsers.
    if (!inTelegram()) {
      if (usdzUrl) el.setAttribute('ios-src', usdzUrl);
      el.setAttribute('ar', '');
      el.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
    }
    el.setAttribute('camera-controls', '');
    el.setAttribute('camera-orbit', '0deg 45deg 70%');
    el.setAttribute('min-field-of-view', '20deg');
    el.setAttribute('max-field-of-view', '90deg');
    el.setAttribute('interaction-prompt', 'auto');
    el.setAttribute('interaction-prompt-threshold', '0');
    el.setAttribute('auto-rotate', '');
    el.setAttribute('auto-rotate-delay', '0');
    el.setAttribute('rotation-per-second', '60deg');
    el.setAttribute('shadow-intensity', '0.9');
    el.setAttribute('exposure', '1.08');
    return el;
  }

  function haptic() {
    window.UyDosh?.haptic?.light?.();
  }

  // --- 3D scene controls, ported from UyDosh's room-scan viewer -------------
  // Source of truth: assets/listing-detail-roomscan.js (inline tile variant).
  // Same class names + behavior so the two stay easy to diff/sync; only the
  // UyDosh.t() localization and listing-specific bits are dropped.

  // Display mode: full room → floor + furniture → floor only.
  const ROOM_SCAN_MODE_SEQUENCE = ['fullRoom', 'floorAndFurniture', 'floorOnly'];

  function nextRoomScanMode(mode) {
    const idx = ROOM_SCAN_MODE_SEQUENCE.indexOf(mode);
    return ROOM_SCAN_MODE_SEQUENCE[(idx + 1) % ROOM_SCAN_MODE_SEQUENCE.length];
  }

  function roomScanModeIconHtml(mode) {
    if (mode === 'floorAndFurniture') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 18v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"></path>
        <path d="M4 18v2M20 18v2"></path>
        <path d="M6 12V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"></path>
      </svg>`;
    }
    if (mode === 'floorOnly') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" rx="2"></rect>
      </svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5"></path>
      <path d="M6 9.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1V9.5"></path>
    </svg>`;
  }

  function roomScanModeLabel(mode) {
    if (mode === 'floorAndFurniture') return t('ctrl.floorFurniture');
    if (mode === 'floorOnly') return t('ctrl.floorOnly');
    return t('ctrl.fullRoom');
  }

  /** Wall/ceiling/door/window/opening → 'wall'; floor → always shown;
   * everything else (furniture) → also hidden in floorOnly. */
  function classifyRoomScanMaterialName(name) {
    const n = (name || '').toLowerCase();
    if (!n) return 'other';
    if (
      n.startsWith('wall') || n.includes('ceiling') ||
      n.includes('door') || n.includes('window') || n.includes('opening')
    ) {
      return 'wall';
    }
    if (n.startsWith('floor') || n.includes('ground')) return 'floor';
    return 'furniture';
  }

  /** Hides/shows a Scene Graph material by driving its base color alpha to 0/1
   * (model-viewer has no per-mesh visibility toggle). Caches the original
   * alpha mode + color the first time it's hidden. */
  function setRoomScanMaterialHidden(material, hidden) {
    try {
      const pbr = material.pbrMetallicRoughness;
      if (!pbr) return;
      if (hidden) {
        if (!material.__m3dOriginalColor) {
          material.__m3dOriginalColor = pbr.baseColorFactor.slice();
          material.__m3dOriginalAlphaMode = material.getAlphaMode();
        }
        const base = material.__m3dOriginalColor;
        material.setAlphaMode('BLEND');
        pbr.setBaseColorFactor([base[0], base[1], base[2], 0]);
      } else if (material.__m3dOriginalColor) {
        pbr.setBaseColorFactor(material.__m3dOriginalColor);
        material.setAlphaMode(material.__m3dOriginalAlphaMode || 'OPAQUE');
      }
    } catch {
      // Scene Graph API unavailable / model not loaded yet — applies next call.
    }
  }

  /** Applies `mode` to every material on the loaded model. Safe to call before
   * the model finishes loading (silently does nothing). */
  function applyRoomScanDisplayMode(viewerEl, mode) {
    if (viewerEl) viewerEl.__m3dDisplayMode = mode;
    const model = viewerEl && viewerEl.model;
    if (!model || !Array.isArray(model.materials)) return;
    model.materials.forEach((material) => {
      const kind = classifyRoomScanMaterialName(material.name);
      let hidden = false;
      if (mode === 'floorAndFurniture') hidden = kind === 'wall';
      else if (mode === 'floorOnly') hidden = kind === 'wall' || kind === 'furniture';
      // In the top-down 2D view a ceiling mesh would lid the whole plan.
      if (viewerEl.__m3dPlanViewActive && (material.name || '').toLowerCase().includes('ceiling')) {
        hidden = true;
      }
      setRoomScanMaterialHidden(material, hidden);
    });
  }

  /** Creates the mode-cycling button and wires it to `viewerEl`. */
  function createRoomScanModeButton(viewerEl) {
    let mode = 'fullRoom';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roomscan-mode-btn';
    const updateAppearance = () => {
      btn.innerHTML = roomScanModeIconHtml(mode);
      btn.setAttribute('aria-label', roomScanModeLabel(mode));
    };
    updateAppearance();
    btn.addEventListener('click', () => {
      mode = nextRoomScanMode(mode);
      updateAppearance();
      haptic();
      applyRoomScanDisplayMode(viewerEl, mode);
    });
    viewerEl.addEventListener('load', () => applyRoomScanDisplayMode(viewerEl, mode));
    return btn;
  }

  // --- 2D floor plan (bird's-eye) toggle ------------------------------------
  // Locks the camera straight down (polar angle pinned to 0°) so dragging only
  // rotates/zooms the plan, and hides any ceiling mesh that would lid the room.

  function enterRoomScanPlanView(viewerEl) {
    if (viewerEl.__m3dPlanViewActive) return;
    viewerEl.__m3dPlanViewActive = true;
    viewerEl.__m3dPlanSavedOrbit = viewerEl.cameraOrbit;
    viewerEl.__m3dPlanResumeAutoRotate = viewerEl.hasAttribute('auto-rotate');
    viewerEl.removeAttribute('auto-rotate');
    viewerEl.dispatchEvent(new CustomEvent('m3d-autorotate-changed'));
    viewerEl.setAttribute('min-camera-orbit', '-Infinity 0deg auto');
    viewerEl.setAttribute('max-camera-orbit', 'Infinity 0deg auto');
    viewerEl.cameraOrbit = '0deg 0deg 105%';
    applyRoomScanDisplayMode(viewerEl, viewerEl.__m3dDisplayMode || 'fullRoom');
  }

  function exitRoomScanPlanView(viewerEl) {
    if (!viewerEl.__m3dPlanViewActive) return;
    viewerEl.__m3dPlanViewActive = false;
    viewerEl.removeAttribute('min-camera-orbit');
    viewerEl.removeAttribute('max-camera-orbit');
    viewerEl.cameraOrbit = viewerEl.__m3dPlanSavedOrbit || '0deg 45deg 70%';
    if (viewerEl.__m3dPlanResumeAutoRotate && !viewerEl.hasAttribute('auto-rotate')) {
      viewerEl.setAttribute('auto-rotate', '');
    }
    viewerEl.__m3dPlanResumeAutoRotate = false;
    viewerEl.dispatchEvent(new CustomEvent('m3d-autorotate-changed'));
    applyRoomScanDisplayMode(viewerEl, viewerEl.__m3dDisplayMode || 'fullRoom');
  }

  /** "3D | 2D" segmented pill, wired to `viewerEl`. Always starts on 3D.
   *
   * 2D first tries the vector blueprint overlay (walls/doors/furniture +
   * measurements extracted from the GLB — mountRoomScanBlueprint, shared with
   * listing.html via assets/listing-detail-floorplan.js), mounted into `host`
   * (the viewer wrap). The top-down camera lock is applied either way: it's
   * the visible fallback when the blueprint can't be built, and it stops the
   * hidden 3D render loop from spinning under the overlay when it can. */
  function createRoomScanPlanToggle(viewerEl, host, glbUrl) {
    const wrap = document.createElement('div');
    wrap.className = 'roomscan-plan-toggle';
    wrap.setAttribute('role', 'tablist');
    wrap.setAttribute('aria-label', t('ctrl.viewMode'));

    const makeBtn = (label, isPlan) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'roomscan-plan-toggle-btn';
      btn.setAttribute('role', 'tab');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-active')) return;
        haptic();
        if (isPlan) {
          enterRoomScanPlanView(viewerEl);
          if (typeof mountRoomScanBlueprint === 'function' && host && glbUrl) {
            mountRoomScanBlueprint(host, glbUrl);
          }
        } else {
          if (typeof unmountRoomScanBlueprint === 'function' && host) {
            unmountRoomScanBlueprint(host);
          }
          exitRoomScanPlanView(viewerEl);
        }
        updateSelection();
      });
      return btn;
    };
    const btn3d = makeBtn('3D', false);
    const btn2d = makeBtn('2D', true);
    const updateSelection = () => {
      const planActive = !!viewerEl.__m3dPlanViewActive;
      btn3d.classList.toggle('is-active', !planActive);
      btn2d.classList.toggle('is-active', planActive);
      btn3d.setAttribute('aria-selected', planActive ? 'false' : 'true');
      btn2d.setAttribute('aria-selected', planActive ? 'true' : 'false');
    };
    wrap.appendChild(btn3d);
    wrap.appendChild(btn2d);
    updateSelection();
    return wrap;
  }

  // --- Wall texture toggle (baked-in brick ⇄ generated plaster) --------------
  const ROOM_SCAN_WALL_TEXTURES = ['brick', 'plaster'];

  function nextRoomScanWallTexture(texture) {
    const idx = ROOM_SCAN_WALL_TEXTURES.indexOf(texture);
    return ROOM_SCAN_WALL_TEXTURES[(idx + 1) % ROOM_SCAN_WALL_TEXTURES.length];
  }

  function roomScanWallTextureIconHtml(texture) {
    if (texture === 'plaster') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="16" height="6" rx="2"></rect>
        <path d="M10 16v-2a2 2 0 0 1 2-2h8"></path>
        <path d="M18 12h2a2 2 0 0 1 2 2v2"></path>
        <rect x="8" y="16" width="4" height="6" rx="1"></rect>
      </svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="1"></rect>
      <path d="M2 9h20M2 15h20"></path>
      <path d="M8 4v5M16 9v6M8 15v5"></path>
    </svg>`;
  }

  // Texture swapping only ever touches actual wall surfaces (doors/windows/
  // ceiling keep their originally captured materials).
  function isRoomScanWallMaterialName(name) {
    return (name || '').toLowerCase().startsWith('wall');
  }

  let roomScanPlasterTextureDataUrl = null;

  /** Deterministic tileable plaster pattern rendered to a canvas once. */
  function getRoomScanPlasterTextureDataUrl() {
    if (roomScanPlasterTextureDataUrl) return roomScanPlasterTextureDataUrl;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#C7B896';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      const x = (i * 53) % size;
      const y = (i * 97) % size;
      const r = 6 + (i % 5);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 24; i++) {
      const y = (i / 24) * size + (i % 2) * 4;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + 10);
      ctx.stroke();
    }
    roomScanPlasterTextureDataUrl = canvas.toDataURL('image/png');
    return roomScanPlasterTextureDataUrl;
  }

  async function getRoomScanPlasterTexture(viewerEl) {
    if (viewerEl.__m3dPlasterTexture) return viewerEl.__m3dPlasterTexture;
    const texture = await viewerEl.createTexture(getRoomScanPlasterTextureDataUrl());
    viewerEl.__m3dPlasterTexture = texture;
    return texture;
  }

  async function applyRoomScanWallTexture(viewerEl, texture) {
    const model = viewerEl && viewerEl.model;
    if (!model || !Array.isArray(model.materials)) return;
    const plasterTexture = texture === 'plaster' ? await getRoomScanPlasterTexture(viewerEl) : null;
    model.materials.forEach((material) => {
      if (!isRoomScanWallMaterialName(material.name)) return;
      try {
        const pbr = material.pbrMetallicRoughness;
        if (!pbr || !pbr.baseColorTexture) return;
        if (!material.__m3dOriginalWallTexture) {
          material.__m3dOriginalWallTexture = pbr.baseColorTexture.texture;
        }
        pbr.baseColorTexture.setTexture(texture === 'plaster' ? plasterTexture : material.__m3dOriginalWallTexture);
      } catch {
        // Model not loaded yet — applies next call.
      }
    });
  }

  function createRoomScanWallTextureButton(viewerEl) {
    let texture = 'brick';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roomscan-texture-btn';
    const updateAppearance = () => {
      btn.innerHTML = roomScanWallTextureIconHtml(texture);
      btn.setAttribute('aria-label', texture === 'plaster' ? t('ctrl.plasterWalls') : t('ctrl.brickWalls'));
    };
    updateAppearance();
    btn.addEventListener('click', () => {
      texture = nextRoomScanWallTexture(texture);
      updateAppearance();
      haptic();
      applyRoomScanWallTexture(viewerEl, texture);
    });
    return btn;
  }

  // --- Floor texture toggle (baked-in wood ⇄ generated light tile) -----------
  const ROOM_SCAN_FLOOR_TEXTURES = ['wood', 'tile'];

  function nextRoomScanFloorTexture(texture) {
    const idx = ROOM_SCAN_FLOOR_TEXTURES.indexOf(texture);
    return ROOM_SCAN_FLOOR_TEXTURES[(idx + 1) % ROOM_SCAN_FLOOR_TEXTURES.length];
  }

  function roomScanFloorTextureIconHtml(texture) {
    if (texture === 'tile') {
      return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <path d="M3 12h18"></path>
        <path d="M12 3v18"></path>
      </svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="1"></rect>
      <path d="M3 8.5h18M3 13h18M3 17.5h18"></path>
    </svg>`;
  }

  function isRoomScanFloorMaterialName(name) {
    const n = (name || '').toLowerCase();
    return n.startsWith('floor') || n.includes('ground');
  }

  let roomScanTileTextureDataUrl = null;

  /** Deterministic tileable light-tile pattern rendered to a canvas once. */
  function getRoomScanTileTextureDataUrl() {
    if (roomScanTileTextureDataUrl) return roomScanTileTextureDataUrl;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const tiles = 4;
    const tileSize = size / tiles;
    const groutW = 6;
    const tileShades = ['#F1EEE4', '#E9E6DA', '#F6F3EA'];
    ctx.fillStyle = '#2E2E2E';
    ctx.fillRect(0, 0, size, size);
    for (let ty = 0; ty < tiles; ty++) {
      for (let tx = 0; tx < tiles; tx++) {
        const x = tx * tileSize;
        const y = ty * tileSize;
        const w = tileSize - groutW;
        ctx.fillStyle = tileShades[(tx + ty * tiles) % tileShades.length];
        ctx.fillRect(x + groutW / 2, y + groutW / 2, w, w);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x + groutW / 2, y + groutW / 2, w, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x + groutW / 2, y + groutW / 2 + w - 3, w, 3);
      }
    }
    roomScanTileTextureDataUrl = canvas.toDataURL('image/png');
    return roomScanTileTextureDataUrl;
  }

  async function getRoomScanTileTexture(viewerEl) {
    if (viewerEl.__m3dTileTexture) return viewerEl.__m3dTileTexture;
    const texture = await viewerEl.createTexture(getRoomScanTileTextureDataUrl());
    viewerEl.__m3dTileTexture = texture;
    return texture;
  }

  async function applyRoomScanFloorTexture(viewerEl, texture) {
    const model = viewerEl && viewerEl.model;
    if (!model || !Array.isArray(model.materials)) return;
    const tileTexture = texture === 'tile' ? await getRoomScanTileTexture(viewerEl) : null;
    model.materials.forEach((material) => {
      if (!isRoomScanFloorMaterialName(material.name)) return;
      try {
        const pbr = material.pbrMetallicRoughness;
        if (!pbr || !pbr.baseColorTexture) return;
        if (!material.__m3dOriginalFloorTexture) {
          material.__m3dOriginalFloorTexture = pbr.baseColorTexture.texture;
        }
        pbr.baseColorTexture.setTexture(texture === 'tile' ? tileTexture : material.__m3dOriginalFloorTexture);
      } catch {
        // Model not loaded yet — applies next call.
      }
    });
  }

  function createRoomScanFloorTextureButton(viewerEl) {
    let texture = 'wood';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roomscan-floor-texture-btn';
    const updateAppearance = () => {
      btn.innerHTML = roomScanFloorTextureIconHtml(texture);
      btn.setAttribute('aria-label', texture === 'tile' ? t('ctrl.tileFloor') : t('ctrl.woodFloor'));
    };
    updateAppearance();
    btn.addEventListener('click', () => {
      texture = nextRoomScanFloorTexture(texture);
      updateAppearance();
      haptic();
      applyRoomScanFloorTexture(viewerEl, texture);
    });
    return btn;
  }

  // --- Auto-rotate play/pause ------------------------------------------------
  function roomScanRotateIconHtml(isRotating) {
    if (isRotating) {
      return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1"></rect>
        <rect x="14" y="5" width="4" height="14" rx="1"></rect>
      </svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5-13-7.5Z"></path>
    </svg>`;
  }

  function createRoomScanRotateButton(viewerEl) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roomscan-rotate-btn';
    const updateAppearance = () => {
      const isRotating = viewerEl.hasAttribute('auto-rotate');
      btn.innerHTML = roomScanRotateIconHtml(isRotating);
      btn.setAttribute('aria-label', isRotating ? t('ctrl.pauseRotation') : t('ctrl.rotate'));
    };
    updateAppearance();
    btn.addEventListener('click', () => {
      haptic();
      if (viewerEl.hasAttribute('auto-rotate')) viewerEl.removeAttribute('auto-rotate');
      else viewerEl.setAttribute('auto-rotate', '');
      updateAppearance();
      viewerEl.dispatchEvent(new CustomEvent('m3d-autorotate-changed'));
    });
    // The 2D plan toggle also pauses/resumes auto-rotate and announces it via
    // this event so the play/pause icon here doesn't go stale.
    viewerEl.addEventListener('m3d-autorotate-changed', updateAppearance);
    return btn;
  }

  // --- Zoom slider (0…100 mapped onto camera field of view) -------------------
  const ROOM_SCAN_ZOOM_FOV_MIN_DEG = 28;
  const ROOM_SCAN_ZOOM_FOV_MAX_DEG = 82;
  const ROOM_SCAN_ZOOM_DEFAULT = 70;

  function roomScanZoomIconHtml(kind) {
    const glyph = kind === 'in'
      ? '<path d="M8 11h6M11 8v6"></path>'
      : '<path d="M8 11h6"></path>';
    return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7"></circle>
      ${glyph}
      <path d="M21 21l-4.3-4.3"></path>
    </svg>`;
  }

  function createRoomScanZoomSlider(viewerEl) {
    const wrap = document.createElement('div');
    wrap.className = 'roomscan-zoom-slider';

    const outIcon = document.createElement('span');
    outIcon.className = 'roomscan-zoom-icon';
    outIcon.innerHTML = roomScanZoomIconHtml('out');

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'roomscan-zoom-range';
    input.min = '0';
    input.max = '100';
    input.value = String(ROOM_SCAN_ZOOM_DEFAULT);
    input.setAttribute('aria-label', t('ctrl.zoom'));

    const inIcon = document.createElement('span');
    inIcon.className = 'roomscan-zoom-icon';
    inIcon.innerHTML = roomScanZoomIconHtml('in');

    const applyZoom = () => {
      const ratio = Number(input.value) / 100;
      const fov = ROOM_SCAN_ZOOM_FOV_MAX_DEG - ratio * (ROOM_SCAN_ZOOM_FOV_MAX_DEG - ROOM_SCAN_ZOOM_FOV_MIN_DEG);
      viewerEl.fieldOfView = `${fov.toFixed(2)}deg`;
    };
    // Coalesce rapid input ticks onto one fieldOfView write per frame —
    // model-viewer re-renders the whole scene on every write.
    let zoomRaf = 0;
    const scheduleApplyZoom = () => {
      if (zoomRaf) return;
      zoomRaf = requestAnimationFrame(() => {
        zoomRaf = 0;
        applyZoom();
      });
    };
    // Pause auto-rotate while dragging so the render loop serves the drag.
    let resumeAutoRotate = false;
    const pauseAutoRotateForDrag = () => {
      if (viewerEl.hasAttribute('auto-rotate')) {
        resumeAutoRotate = true;
        viewerEl.removeAttribute('auto-rotate');
        viewerEl.dispatchEvent(new CustomEvent('m3d-autorotate-changed'));
      }
    };
    const resumeAutoRotateAfterDrag = () => {
      if (!resumeAutoRotate) return;
      resumeAutoRotate = false;
      viewerEl.setAttribute('auto-rotate', '');
      viewerEl.dispatchEvent(new CustomEvent('m3d-autorotate-changed'));
    };
    input.addEventListener('pointerdown', pauseAutoRotateForDrag);
    input.addEventListener('pointerup', resumeAutoRotateAfterDrag);
    input.addEventListener('pointercancel', resumeAutoRotateAfterDrag);
    input.addEventListener('input', scheduleApplyZoom);

    wrap.appendChild(outIcon);
    wrap.appendChild(input);
    wrap.appendChild(inIcon);
    viewerEl.addEventListener('load', applyZoom);
    return wrap;
  }

  // Suppresses the browser's native double-tap-to-zoom on the viewer — iOS
  // WebViews ignore touch-action for that gesture, so the second tap's default
  // action is prevented directly via a touchend timestamp check.
  const ROOM_SCAN_DOUBLE_TAP_WINDOW_MS = 350;
  function preventRoomScanDoubleTapZoom(el) {
    if (!el || el.dataset.roomscanZoomGuardBound) return;
    el.dataset.roomscanZoomGuardBound = '1';
    el.addEventListener('gesturestart', (event) => event.preventDefault());
    let lastTouchEnd = 0;
    el.addEventListener('touchend', (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= ROOM_SCAN_DOUBLE_TAP_WINDOW_MS) event.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
  }

  function renderViewerMeta(scan) {
    const dims = scanDimensions(scan);
    const date = formatDate(scan.createdAt);
    const gifReady = scan.mediaGenerationStatus === 'ready' && scan.rotationGifUrl;
    const rows = [];
    const roomLabel = scanRoomLabel(scan);
    rows.push(
      `<div><strong>${roomLabel ? `${escapeHtml(roomLabel)} — ` : ''}${tf('scan.title', { id: escapeHtml(scan.id) })}</strong></div>`,
    );
    if (date) rows.push(`<div>${escapeHtml(date)}</div>`);
    if (dims.length) {
      rows.push(`<div class="m3d-dim-row">${dims.map((d) => `<span>${escapeHtml(d)}</span>`).join('')}</div>`);
    }
    if (!scan.glbUrl) {
      rows.push(`<div>${escapeHtml(t('viewer.processingNote'))}</div>`);
    }
    viewerMetaEl.innerHTML = `
      <div class="m3d-viewer-meta-row">
        <div class="m3d-viewer-meta-text">${rows.join('')}</div>
        <div class="m3d-viewer-actions">
          <button type="button" class="m3d-share-btn" id="m3d-share-btn">
            ${gifReady ? t('share.gif') : t('share.link')}
          </button>
          <button type="button" class="m3d-delete-btn" id="m3d-delete-btn">
            ${trashIconHtml()}<span>${t('action.deleteScan')}</span>
          </button>
        </div>
      </div>
    `;
    const btn = document.getElementById('m3d-share-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        void shareScan(scan);
      });
    }
    document.getElementById('m3d-delete-btn')?.addEventListener('click', () => {
      void deleteScanFlow(scan);
    });
    renderMaterialsPanel(scan);
  }

  // --- Material estimate (floor tiles + plinth / wallpaper) ------------------
  // Ported from makon3d_mobile's RoomMaterialsScreen + FloorTileEstimator:
  // same math, presets and defaults, so the app and mini app agree. One
  // improvement over the port: plinth prefers the backend-measured wall
  // perimeter minus doorway widths (wallPerimeterM / doorwayWidthM in the
  // scan payload) over the OBB approximation.

  const MATERIALS_PREFS_STORAGE_KEY = 'makon3d:tilePrefs';
  const MATERIALS_FLOOR_DEFAULTS = { widthCm: 40, heightCm: 40, wastePercent: 10 };
  /** Standard European wallpaper roll. */
  const MATERIALS_WALLS_DEFAULTS = { rollWidthM: 0.53, rollLengthM: 10.05, repeatCm: 0 };
  const MATERIALS_SQUARE_PRESETS = [[30, 30], [40, 40], [60, 60]];
  const MATERIALS_RECT_PRESETS = [[20, 30], [30, 60], [40, 50]];
  const WALLPAPER_ROLL_PRESETS = [[0.53, 10.05], [1.06, 10.05]];
  /** Standard skirting-board strip length. */
  const PLINTH_STRIP_M = 2.5;

  /** Prefer the polygon floor area; fall back to the OBB long × short. */
  function resolveFloorAreaM2(scan) {
    const area = Number(scan?.floorAreaM2);
    if (Number.isFinite(area) && area > 0) return area;
    const long = Number(scan?.floorLongM);
    const short = Number(scan?.floorShortM);
    if (long > 0 && short > 0) return long * short;
    return null;
  }

  function floorAreaUsedBoundingFallback(scan) {
    const area = Number(scan?.floorAreaM2);
    return !(Number.isFinite(area) && area > 0) && resolveFloorAreaM2(scan) != null;
  }

  /** Approximate footprint perimeter from the OBB dims: 2 × (long + short). */
  function resolvePerimeterM(scan) {
    const long = Number(scan?.floorLongM);
    const short = Number(scan?.floorShortM);
    if (!(long > 0) || !(short > 0)) return null;
    return 2 * (long + short);
  }

  /** True wall-run perimeter summed from the scan's wall meshes (backend's
   * computeRoomScanWallMetricsFromGlb.ts); null for scans that predate the
   * column and haven't been backfilled. */
  function resolveWallPerimeterM(scan) {
    const p = Number(scan?.wallPerimeterM);
    return Number.isFinite(p) && p > 0 ? p : null;
  }

  /** Door/opening + window face areas measured from the scan's GLB
   * (doorwayAreaM2 / windowAreaM2 in the scan payload); null for scans that
   * predate the columns and haven't been backfilled. */
  function resolveOpeningAreaM2(scan) {
    const door = scan?.doorwayAreaM2;
    const win = scan?.windowAreaM2;
    if (door == null && win == null) return null;
    return Math.max(0, (Number(door) || 0) + (Number(win) || 0));
  }

  /** Plinth run: wall perimeter minus door/opening widths when measured,
   * otherwise the OBB perimeter with doorways not subtracted. */
  function resolvePlinth(scan) {
    const wallPerimeter = resolveWallPerimeterM(scan);
    if (wallPerimeter != null) {
      const doorwayWidth = Math.max(0, Number(scan?.doorwayWidthM) || 0);
      return {
        lengthM: Math.max(0, wallPerimeter - doorwayWidth),
        note: doorwayWidth > 0
          ? tf('mat.plinthMinusDoorways', {
              len: wallPerimeter.toFixed(1),
              door: doorwayWidth.toFixed(1),
            })
          : t('mat.plinthNoDoorways'),
      };
    }
    const approx = resolvePerimeterM(scan);
    if (approx == null) return null;
    return { lengthM: approx, note: t('mat.plinthNote') };
  }

  /** Strip-based wallpaper math — computing rolls from m² is how people end
   * up one roll short. Each strip is cut to wall height plus one pattern
   * repeat for alignment. */
  function estimateWallpaper(perimeterM, wallHeightM, { rollWidthM, rollLengthM, repeatCm }) {
    if (!(perimeterM > 0) || !(wallHeightM > 0) || !(rollWidthM > 0) || !(rollLengthM > 0)) {
      return null;
    }
    const repeat = Math.min(500, Math.max(0, Number(repeatCm) || 0));
    const stripLengthM = wallHeightM + repeat / 100;
    const stripsNeeded = Math.max(1, Math.ceil(perimeterM / rollWidthM));
    const stripsPerRoll = Math.floor(rollLengthM / stripLengthM);
    // Roll shorter than one strip (very tall space): fall back to linear meters.
    const rollCount = stripsPerRoll >= 1
      ? Math.ceil(stripsNeeded / stripsPerRoll)
      : Math.ceil((stripsNeeded * stripLengthM) / rollLengthM);
    return { stripLengthM, stripsNeeded, stripsPerRoll, rollCount: Math.max(1, rollCount) };
  }

  function estimateTiles(areaM2, widthCm, heightCm, wastePercent) {
    if (!(areaM2 > 0) || !(widthCm > 0) || !(heightCm > 0)) return null;
    const waste = Math.min(100, Math.max(0, Number(wastePercent) || 0));
    const tileAreaM2 = (widthCm / 100) * (heightCm / 100);
    const effectiveAreaM2 = areaM2 * (1 + waste / 100);
    const tileCount = Math.max(1, Math.ceil(effectiveAreaM2 / tileAreaM2));
    return {
      tileAreaM2,
      effectiveAreaM2,
      tileCount,
      buyAreaM2: tileCount * tileAreaM2,
    };
  }

  function loadMaterialsPrefs() {
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(MATERIALS_PREFS_STORAGE_KEY) || 'null');
    } catch { /* ignore */ }
    const floorRaw = stored?.floor || {};
    // Older builds stored tile sizes under `walls` — unknown keys fall back
    // to the wallpaper defaults, so no migration is needed.
    const wallsRaw = stored?.walls || {};
    return {
      floor: {
        widthCm: Number(floorRaw.widthCm) > 0
          ? Number(floorRaw.widthCm) : MATERIALS_FLOOR_DEFAULTS.widthCm,
        heightCm: Number(floorRaw.heightCm) > 0
          ? Number(floorRaw.heightCm) : MATERIALS_FLOOR_DEFAULTS.heightCm,
        wastePercent: Number.isFinite(Number(floorRaw.wastePercent))
          ? Math.min(20, Math.max(0, Number(floorRaw.wastePercent)))
          : MATERIALS_FLOOR_DEFAULTS.wastePercent,
      },
      walls: {
        rollWidthM: Number(wallsRaw.rollWidthM) > 0
          ? Number(wallsRaw.rollWidthM) : MATERIALS_WALLS_DEFAULTS.rollWidthM,
        rollLengthM: Number(wallsRaw.rollLengthM) > 0
          ? Number(wallsRaw.rollLengthM) : MATERIALS_WALLS_DEFAULTS.rollLengthM,
        repeatCm: Number(wallsRaw.repeatCm) >= 0
          ? Math.min(500, Number(wallsRaw.repeatCm)) : MATERIALS_WALLS_DEFAULTS.repeatCm,
      },
    };
  }

  function saveMaterialsPrefs(prefs) {
    try {
      localStorage.setItem(MATERIALS_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch { /* private mode etc. — estimates still work, just not sticky */ }
  }

  /** Up to 2 decimals, trailing zeros stripped ("40", "0.53", "10.05"). */
  function formatNum(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return '';
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  }

  // Collapsed by default on every newly opened scan.
  let materialsExpanded = false;
  let materialsScanId = null;

  function renderMaterialsPanel(scan) {
    if (!materialsEl) return;
    const scanId = Number(scan?.id);
    if (scanId !== materialsScanId) {
      materialsScanId = scanId;
      materialsExpanded = false;
    }

    const prefs = loadMaterialsPrefs();
    let surface = 'floor';
    const floor = { ...prefs.floor };
    const walls = { ...prefs.walls };
    let isSquare = Math.abs(floor.widthCm - floor.heightCm) < 0.001;

    materialsEl.hidden = false;
    materialsEl.innerHTML = `
      <button type="button" class="m3d-mat-toggle" id="m3d-mat-toggle" aria-expanded="${materialsExpanded}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        <span>${t('mat.title')}</span>
        <span class="m3d-mat-toggle-chevron" aria-hidden="true">›</span>
      </button>
      <div class="m3d-mat-body" id="m3d-mat-body" ${materialsExpanded ? '' : 'hidden'}>
        <div class="m3d-seg" role="tablist" aria-label="${t('mat.surface')}" id="m3d-mat-surface">
          <button type="button" class="m3d-seg-btn" role="tab" data-surface="floor">${t('mat.floor')}</button>
          <button type="button" class="m3d-seg-btn" role="tab" data-surface="walls">${t('mat.walls')}</button>
        </div>
        <p class="m3d-mat-area" id="m3d-mat-area"></p>
        <p class="m3d-mat-approx" id="m3d-mat-approx" hidden></p>
        <div id="m3d-mat-floor-controls">
          <div class="m3d-mat-label">${t('mat.tileShape')}</div>
          <div class="m3d-seg" role="tablist" aria-label="${t('mat.tileShape')}" id="m3d-mat-shape">
            <button type="button" class="m3d-seg-btn" role="tab" data-square="1">${t('mat.square')}</button>
            <button type="button" class="m3d-seg-btn" role="tab" data-square="">${t('mat.rectangle')}</button>
          </div>
          <div class="m3d-mat-label">${t('mat.tileSize')}</div>
          <div class="m3d-chips" id="m3d-mat-presets"></div>
          <div class="m3d-mat-inputs">
            <label class="m3d-mat-input">
              <span>${t('mat.width')}</span>
              <input type="number" inputmode="decimal" min="1" step="0.1" id="m3d-mat-width" />
            </label>
            <label class="m3d-mat-input" id="m3d-mat-height-wrap">
              <span>${t('mat.length')}</span>
              <input type="number" inputmode="decimal" min="1" step="0.1" id="m3d-mat-height" />
            </label>
          </div>
          <div class="m3d-mat-label" id="m3d-mat-waste-label"></div>
          <input type="range" class="m3d-mat-range" id="m3d-mat-waste" min="0" max="20" step="1" />
          <div class="m3d-mat-waste-quick">
            <button type="button" data-waste="5">5%</button>
            <button type="button" data-waste="10">10%</button>
            <button type="button" data-waste="15">15%</button>
          </div>
        </div>
        <div id="m3d-mat-walls-controls" hidden>
          <div class="m3d-mat-label">${t('mat.rollSize')}</div>
          <div class="m3d-chips" id="m3d-mat-roll-presets"></div>
          <div class="m3d-mat-inputs">
            <label class="m3d-mat-input">
              <span>${t('mat.rollWidth')}</span>
              <input type="number" inputmode="decimal" min="0.1" step="0.01" id="m3d-mat-roll-width" />
            </label>
            <label class="m3d-mat-input">
              <span>${t('mat.rollLength')}</span>
              <input type="number" inputmode="decimal" min="1" step="0.05" id="m3d-mat-roll-length" />
            </label>
          </div>
          <div class="m3d-mat-inputs">
            <label class="m3d-mat-input">
              <span>${t('mat.patternRepeat')}</span>
              <input type="number" inputmode="decimal" min="0" step="1" id="m3d-mat-repeat" />
            </label>
          </div>
        </div>
        <div class="m3d-mat-result" id="m3d-mat-result"></div>
      </div>
    `;

    const toggleBtn = materialsEl.querySelector('#m3d-mat-toggle');
    const bodyEl = materialsEl.querySelector('#m3d-mat-body');
    const surfaceSegEl = materialsEl.querySelector('#m3d-mat-surface');
    const areaEl = materialsEl.querySelector('#m3d-mat-area');
    const approxEl = materialsEl.querySelector('#m3d-mat-approx');
    const floorControlsEl = materialsEl.querySelector('#m3d-mat-floor-controls');
    const shapeSegEl = materialsEl.querySelector('#m3d-mat-shape');
    const presetsEl = materialsEl.querySelector('#m3d-mat-presets');
    const widthInput = materialsEl.querySelector('#m3d-mat-width');
    const heightWrapEl = materialsEl.querySelector('#m3d-mat-height-wrap');
    const heightInput = materialsEl.querySelector('#m3d-mat-height');
    const wasteLabelEl = materialsEl.querySelector('#m3d-mat-waste-label');
    const wasteInput = materialsEl.querySelector('#m3d-mat-waste');
    const wallsControlsEl = materialsEl.querySelector('#m3d-mat-walls-controls');
    const rollPresetsEl = materialsEl.querySelector('#m3d-mat-roll-presets');
    const rollWidthInput = materialsEl.querySelector('#m3d-mat-roll-width');
    const rollLengthInput = materialsEl.querySelector('#m3d-mat-roll-length');
    const repeatInput = materialsEl.querySelector('#m3d-mat-repeat');
    const resultEl = materialsEl.querySelector('#m3d-mat-result');

    function persist() {
      prefs.floor = { ...floor };
      prefs.walls = { ...walls };
      saveMaterialsPrefs(prefs);
    }

    function renderPresets() {
      const presets = isSquare ? MATERIALS_SQUARE_PRESETS : MATERIALS_RECT_PRESETS;
      presetsEl.innerHTML = presets
        .map(([w, h]) => {
          const active =
            Math.abs(floor.widthCm - w) < 0.001 && Math.abs(floor.heightCm - h) < 0.001;
          return `<button type="button" class="m3d-chip${active ? ' is-active' : ''}" data-w="${w}" data-h="${h}">${formatNum(w)}×${formatNum(h)}</button>`;
        })
        .join('');
    }

    function renderRollPresets() {
      rollPresetsEl.innerHTML = WALLPAPER_ROLL_PRESETS
        .map(([w, l]) => {
          const active =
            Math.abs(walls.rollWidthM - w) < 0.001 && Math.abs(walls.rollLengthM - l) < 0.001;
          return `<button type="button" class="m3d-chip${active ? ' is-active' : ''}" data-roll-w="${w}" data-roll-l="${l}">${formatNum(w)} × ${formatNum(l)}</button>`;
        })
        .join('');
    }

    function updateFloor() {
      for (const btn of shapeSegEl.querySelectorAll('.m3d-seg-btn')) {
        const active = Boolean(btn.dataset.square) === isSquare;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      }
      heightWrapEl.hidden = isSquare;
      renderPresets();

      const area = resolveFloorAreaM2(scan);
      if (area != null) {
        areaEl.textContent = `${t('mat.measuredArea')}: ~${area.toFixed(1)} ${t('unit.m2')}`;
        areaEl.dataset.error = '';
      } else {
        areaEl.textContent = t('mat.noFloorArea');
        areaEl.dataset.error = '1';
      }
      const approxNote = floorAreaUsedBoundingFallback(scan)
        ? t('mat.floorApprox')
        : '';
      approxEl.hidden = !approxNote;
      approxEl.textContent = approxNote;

      wasteLabelEl.textContent = `${t('mat.waste')}: ${Math.round(floor.wastePercent)}%`;

      const estimate = area == null
        ? null
        : estimateTiles(area, floor.widthCm, floor.heightCm, floor.wastePercent);
      // Skirting board rides along with the floor tab only.
      const plinth = resolvePlinth(scan);
      const plinthHtml = plinth == null || !(plinth.lengthM > 0)
        ? ''
        : `
          <div class="m3d-mat-result-plinth">${tf('mat.plinth', {
            len: plinth.lengthM.toFixed(1),
            count: Math.ceil(plinth.lengthM / PLINTH_STRIP_M),
            strip: PLINTH_STRIP_M,
          })}</div>
          <div class="m3d-mat-result-detail">${plinth.note}</div>
        `;
      resultEl.innerHTML = estimate
        ? `
          <div class="m3d-mat-result-heading">${t('mat.toBuy')}</div>
          <div class="m3d-mat-result-count">${tf('mat.tilesCount', { count: estimate.tileCount })}</div>
          <div>${tf('mat.buyArea', { area: estimate.buyAreaM2.toFixed(1) })}</div>
          <div class="m3d-mat-result-detail">${tf('mat.tileDetail', {
            tile: estimate.tileAreaM2.toFixed(2),
            eff: estimate.effectiveAreaM2.toFixed(1),
          })}</div>
          ${plinthHtml}
        `
        : `<div class="m3d-mat-result-detail">${t('mat.noEstimate')}</div>`;
    }

    function updateWalls() {
      renderRollPresets();

      // Prefer the true wall-run perimeter measured from the GLB (same source
      // as the plinth) over the OBB 2 × (long + short) approximation.
      const perimeter = resolveWallPerimeterM(scan) ?? resolvePerimeterM(scan);
      const height = Number(scan?.heightM) > 0 ? Number(scan.heightM) : null;
      if (perimeter != null && height != null) {
        areaEl.textContent = tf('mat.perimeterHeight', {
          len: perimeter.toFixed(1),
          h: height.toFixed(2),
        });
        areaEl.dataset.error = '';
        approxEl.hidden = false;
        // Net wall area when opening areas were measured; the honest
        // "not subtracted" disclaimer for scans that predate the metric.
        // The roll count below stays strip-based over the full perimeter —
        // strips still run above doors and around windows.
        const openings = resolveOpeningAreaM2(scan);
        if (openings != null) {
          const net = Math.max(0, perimeter * height - openings);
          approxEl.textContent = openings > 0.05
            ? tf('mat.wallNetArea', { net: net.toFixed(1), open: openings.toFixed(1) })
            : tf('mat.wallNoOpenings', { net: net.toFixed(1) });
        } else {
          approxEl.textContent = t('mat.wallApprox');
        }
      } else {
        areaEl.textContent = t('mat.noWallArea');
        areaEl.dataset.error = '1';
        approxEl.hidden = true;
      }

      const estimate = (perimeter == null || height == null)
        ? null
        : estimateWallpaper(perimeter, height, walls);
      resultEl.innerHTML = estimate
        ? `
          <div class="m3d-mat-result-heading">${t('mat.toBuy')}</div>
          <div class="m3d-mat-result-count">${tf('mat.rollsCount', { count: estimate.rollCount })}</div>
          <div>${tf('mat.strips', {
            count: estimate.stripsNeeded,
            len: estimate.stripLengthM.toFixed(2),
          })}</div>
          ${estimate.stripsPerRoll >= 1
            ? `<div class="m3d-mat-result-detail">${tf('mat.stripsPerRoll', { count: estimate.stripsPerRoll })}</div>`
            : ''}
        `
        : `<div class="m3d-mat-result-detail">${t('mat.noEstimate')}</div>`;
    }

    function update() {
      for (const btn of surfaceSegEl.querySelectorAll('.m3d-seg-btn')) {
        const active = btn.dataset.surface === surface;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      }
      floorControlsEl.hidden = surface !== 'floor';
      wallsControlsEl.hidden = surface !== 'walls';
      if (surface === 'walls') updateWalls();
      else updateFloor();
    }

    function syncInputs() {
      widthInput.value = formatNum(floor.widthCm);
      heightInput.value = formatNum(floor.heightCm);
      wasteInput.value = String(Math.round(floor.wastePercent));
      rollWidthInput.value = formatNum(walls.rollWidthM);
      rollLengthInput.value = formatNum(walls.rollLengthM);
      repeatInput.value = formatNum(walls.repeatCm);
    }

    toggleBtn.addEventListener('click', () => {
      haptic();
      materialsExpanded = !materialsExpanded;
      bodyEl.hidden = !materialsExpanded;
      toggleBtn.setAttribute('aria-expanded', String(materialsExpanded));
    });

    surfaceSegEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-surface]');
      if (!btn || btn.dataset.surface === surface) return;
      haptic();
      surface = btn.dataset.surface;
      update();
    });

    shapeSegEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-square]');
      if (!btn) return;
      const nextSquare = Boolean(btn.dataset.square);
      if (nextSquare === isSquare) return;
      haptic();
      isSquare = nextSquare;
      if (isSquare) {
        floor.heightCm = floor.widthCm;
        heightInput.value = formatNum(floor.heightCm);
        persist();
      }
      update();
    });

    presetsEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-w]');
      if (!btn) return;
      haptic();
      floor.widthCm = Number(btn.dataset.w);
      floor.heightCm = Number(btn.dataset.h);
      isSquare = floor.widthCm === floor.heightCm;
      syncInputs();
      persist();
      update();
    });

    widthInput.addEventListener('input', () => {
      const parsed = Number(widthInput.value.replace(',', '.'));
      if (!(parsed > 0)) return;
      floor.widthCm = parsed;
      if (isSquare) {
        floor.heightCm = parsed;
        heightInput.value = formatNum(parsed);
      }
      persist();
      update();
    });

    heightInput.addEventListener('input', () => {
      const parsed = Number(heightInput.value.replace(',', '.'));
      if (!(parsed > 0)) return;
      floor.heightCm = parsed;
      isSquare = false;
      persist();
      update();
    });

    wasteInput.addEventListener('input', () => {
      floor.wastePercent = Number(wasteInput.value) || 0;
      persist();
      update();
    });

    materialsEl.querySelector('.m3d-mat-waste-quick').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-waste]');
      if (!btn) return;
      haptic();
      floor.wastePercent = Number(btn.dataset.waste);
      wasteInput.value = btn.dataset.waste;
      persist();
      update();
    });

    rollPresetsEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-roll-w]');
      if (!btn) return;
      haptic();
      walls.rollWidthM = Number(btn.dataset.rollW);
      walls.rollLengthM = Number(btn.dataset.rollL);
      syncInputs();
      persist();
      update();
    });

    rollWidthInput.addEventListener('input', () => {
      const parsed = Number(rollWidthInput.value.replace(',', '.'));
      if (!(parsed > 0)) return;
      walls.rollWidthM = parsed;
      persist();
      update();
    });

    rollLengthInput.addEventListener('input', () => {
      const parsed = Number(rollLengthInput.value.replace(',', '.'));
      if (!(parsed > 0)) return;
      walls.rollLengthM = parsed;
      persist();
      update();
    });

    repeatInput.addEventListener('input', () => {
      // Repeat may legitimately be 0 — accept any non-negative value.
      const parsed = Number(repeatInput.value.replace(',', '.'));
      if (!(parsed >= 0)) return;
      walls.repeatCm = Math.min(500, parsed);
      persist();
      update();
    });

    syncInputs();
    update();
  }

  async function mountViewer(scan) {
    // The blueprint overlay's host class/dataset must not survive from a
    // previously opened scan (innerHTML is cleared, but classes aren't).
    viewerWrapEl.classList.remove('is-blueprint');
    delete viewerWrapEl.dataset.roomscanBlueprintAlignRad;
    viewerWrapEl.innerHTML =
      `<div class="m3d-viewer-status" role="status" aria-label="${t('viewer.loadingModel')}">${loadingSpinnerHtml()}</div>`;
    renderViewerMeta(scan);

    const glb = scan.glbUrl ? withCacheBust(photoUrl(scan.glbUrl)) : '';
    const usdz = scan.usdzUrl ? photoUrl(scan.usdzUrl) : '';

    if (!glb) {
      viewerWrapEl.innerHTML =
        `<div class="m3d-viewer-status">${t('viewer.noPreview')}</div>`;
      return;
    }

    try {
      await loadModelViewerScript();
      preventRoomScanDoubleTapZoom(viewerWrapEl);
      const viewer = createModelViewer(glb, usdz);
      viewer.addEventListener(
        'error',
        () => {
          viewerWrapEl.innerHTML =
            `<div class="m3d-viewer-status">${t('viewer.modelError')}</div>`;
        },
        { once: true }
      );
      viewerWrapEl.innerHTML = '';
      viewerWrapEl.appendChild(viewer);

      // Bottom bar: rotate play/pause + zoom slider (mirrors UyDosh's inline tile).
      const controlsBar = document.createElement('div');
      controlsBar.className = 'roomscan-controls-bar';
      controlsBar.appendChild(createRoomScanRotateButton(viewer));
      controlsBar.appendChild(createRoomScanZoomSlider(viewer));
      viewerWrapEl.appendChild(controlsBar);
      // Top-right stacked toggles: display mode / wall texture / floor texture.
      viewerWrapEl.appendChild(createRoomScanModeButton(viewer));
      viewerWrapEl.appendChild(createRoomScanWallTextureButton(viewer));
      viewerWrapEl.appendChild(createRoomScanFloorTextureButton(viewer));
      // Top-left: 3D/2D toggle — 2D mounts the vector blueprint floor plan.
      viewerWrapEl.appendChild(createRoomScanPlanToggle(viewer, viewerWrapEl, glb));
    } catch (err) {
      console.error('[Makon3D] model-viewer failed', err);
      viewerWrapEl.innerHTML =
        `<div class="m3d-viewer-status">${t('viewer.viewerError')}</div>`;
    }
  }

  async function openScan(scanOrId, { pushHistory = true } = {}) {
    let scan = typeof scanOrId === 'object' && scanOrId ? scanOrId : null;
    const id = scan ? Number(scan.id) : Number(scanOrId);
    if (!Number.isInteger(id) || id <= 0) return;

    if (!scan) {
      scan = scansCache.find((s) => Number(s.id) === id) || null;
    }
    if (!scan) {
      try {
        const { token } = readRoute();
        const qs = token ? `?token=${encodeURIComponent(token)}` : '';
        const res = await fetch(`${API_BASE}/makon3d/scans/${id}${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        scan = await res.json();
      } catch (err) {
        console.error('[Makon3D] fetch scan failed', err);
        showListView();
        showStatusKey('scan.notFound', true);
        return;
      }
    }

    openScanId = id;
    openScanData = scan;
    listPanelEl.hidden = true;
    viewerPanelEl.hidden = false;
    backEl.hidden = false;
    if (fabEl) fabEl.hidden = true;
    // The burger yields its spot to the back button — two buttons before the
    // brand would crowd the header on narrow phones.
    navTriggerEl.hidden = true;
    if (pushHistory) setRoute({ scanId: id, projectId: openProjectId });
    renderViewerMeta(scan);
    const pageUrl = scan.viewerUrl || viewerShareUrl(id);
    const imageUrl = scan.rotationGifUrl
      ? photoUrl(scan.rotationGifUrl)
      : scan.posterImageUrl
        ? photoUrl(scan.posterImageUrl)
        : '';
    setShareOgTags({
      title: `Makon3D scan #${id}`,
      description: t('share.ogDescription'),
      imageUrl,
      pageUrl,
    });
    await mountViewer(scan);
  }

  // Room-type badge icons — wire values mirror makon3d_mobile's RoomType enum
  // (the backend infers them from RoomPlan objects in the GLB, see
  // inferRoomTypesFromGlb.ts in uydosh_backend).
  const ROOM_TYPE_ICONS = {
    livingRoom: {
      labelKey: 'room.livingRoom',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 11V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" />
        <rect x="3" y="11" width="18" height="6" rx="2" />
        <path d="M5 17v2M19 17v2" />
      </svg>`,
    },
    bedroom: {
      labelKey: 'room.bedroom',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7" />
        <path d="M3 18h18" />
        <path d="M6 9V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
      </svg>`,
    },
    kitchen: {
      labelKey: 'room.kitchen',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="6" y="3" width="12" height="18" rx="2" />
        <path d="M6 10h12" />
        <path d="M9 6v1.5M9 13v3" />
      </svg>`,
    },
    bathroom: {
      labelKey: 'room.bathroom',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12V6a2 2 0 0 1 4 0" />
        <path d="M3 12h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" />
        <path d="M6 18l-1 2M18 18l1 2" />
      </svg>`,
    },
  };

  /** Icon-pill replacement for the "3D ready" badge; '' when no types known. */
  function roomTypeBadgeHtml(scan) {
    const types = Array.isArray(scan.roomTypes) ? scan.roomTypes : [];
    const known = types.filter((type) => ROOM_TYPE_ICONS[type]);
    if (!known.length) return '';
    const labels = known.map((type) => t(ROOM_TYPE_ICONS[type].labelKey));
    const icons = known
      .map((type) => `<span class="m3d-room-icon" title="${escapeHtml(t(ROOM_TYPE_ICONS[type].labelKey))}">${ROOM_TYPE_ICONS[type].svg}</span>`)
      .join('');
    return `<span class="m3d-badge m3d-badge-ready m3d-badge-rooms" role="img" aria-label="${escapeHtml(labels.join(', '))}">${icons}</span>`;
  }

  function scanBadgeHtml(scan) {
    // Room-type icons when the backend knows them; plain "3D ready" for
    // scans that predate room-type inference.
    return scan.glbUrl
      ? roomTypeBadgeHtml(scan) ||
          `<span class="m3d-badge m3d-badge-ready">${t('badge.ready')}</span>`
      : `<span class="m3d-badge m3d-badge-pending">${t('badge.processing')}</span>`;
  }

  /** One scan row. `titleHtml` (pre-escaped) overrides the "Scan #id" title —
   * project views pass the room label. */
  function scanItemHtml(scan, titleHtml = '') {
    const dims = scanDimensions(scan);
    const date = formatDate(scan.createdAt);
    const metaBits = [date, ...dims].filter(Boolean);
    return `
      <li>
        <button type="button" class="m3d-item" data-scan-id="${escapeHtml(scan.id)}">
          <span class="m3d-item-body">
            <span class="m3d-item-top">
              <span class="m3d-item-title">${titleHtml || tf('scan.title', { id: escapeHtml(scan.id) })}</span>
              ${scanBadgeHtml(scan)}
            </span>
            <span class="m3d-item-meta">
              ${metaBits.map((b) => `<span>${escapeHtml(b)}</span>`).join('')}
            </span>
          </span>
          <span class="m3d-item-chevron" aria-hidden="true">›</span>
        </button>
      </li>
    `;
  }

  /** Localized label for a RoomType wire value (mirrors makon3d_mobile). */
  function roomTypeLabel(type) {
    const key = `room.${type}`;
    const label = t(key);
    return label === key ? t('room.other') : label;
  }

  /** Label for a project room's scan: the user-given room name, else the
   * localized room type (wire values mirror makon3d_mobile's RoomType). */
  function scanRoomLabel(scan) {
    if (typeof scan.roomName === 'string' && scan.roomName.trim()) {
      return scan.roomName.trim();
    }
    if (scan.roomType) return roomTypeLabel(scan.roomType);
    return '';
  }

  function projectModeLabel(mode) {
    if (mode === 'roomByRoom') return t('project.mode.roomByRoom');
    if (mode === 'entireHousing') return t('project.mode.entireHousing');
    return '';
  }

  function projectItemHtml(project) {
    const metaBits = [
      formatDate(project.createdAt || project.updatedAt),
      projectModeLabel(project.scanMode),
      project.address || '', // owned projects only — the public feed strips it
    ].filter(Boolean);
    return `
      <li>
        <button type="button" class="m3d-item m3d-project-item" data-project-id="${escapeHtml(project.projectId)}">
          <span class="m3d-item-body">
            <span class="m3d-item-top">
              <span class="m3d-item-title">${escapeHtml(project.name)}</span>
              <span class="m3d-badge m3d-badge-ready">${tf('project.scanCount', { count: project.scans.length })}</span>
            </span>
            <span class="m3d-item-meta">
              ${metaBits.map((b) => `<span>${escapeHtml(b)}</span>`).join('')}
            </span>
          </span>
          <span class="m3d-item-chevron" aria-hidden="true">›</span>
        </button>
      </li>
    `;
  }

  /** Updates the caches. Project scans are merged into scansCache so
   * openScan() resolves them without extra fetches. `myRows` is the raw
   * device-scoped GET /makon3d/projects payload for this browser. */
  function setFeeds(scans, projects, myRows = []) {
    projectsCache = Array.isArray(projects)
      ? projects.filter((p) => p && p.projectId && Array.isArray(p.scans) && p.scans.length)
      : [];
    const merged = Array.isArray(scans) ? [...scans] : [];
    const known = new Set(merged.map((s) => Number(s.id)));
    for (const project of projectsCache) {
      for (const scan of project.scans) {
        if (!known.has(Number(scan.id))) {
          known.add(Number(scan.id));
          merged.push(scan);
        }
      }
    }
    scansCache = merged;
    // Normalized after scansCache — my projects resolve scans from the caches.
    myProjectsCache = (Array.isArray(myRows) ? myRows : []).flatMap((row) => {
      const entry = normalizeMyProject(row);
      return entry ? [entry] : [];
    });
    feedLoaded = true;
  }

  /** Resolves a room's HousingScan JSON to a renderable scan object: prefer
   * the fresher feed row, else rebuild from the stored JSON (it carries the
   * same field names the backend serializes — enough to render and open). */
  function resolveHousingScan(scanJson, roomType, roomName) {
    const remoteScanId = Number(scanJson?.remoteScanId);
    if (!Number.isInteger(remoteScanId) || remoteScanId <= 0) return null;
    const cached = scansCache.find((s) => Number(s.id) === remoteScanId);
    if (cached) return { ...cached, roomType, roomName };
    return {
      id: remoteScanId,
      usdzUrl: scanJson.usdzUrl || null,
      glbUrl: scanJson.glbUrl || null,
      floorLongM: scanJson.floorLongM ?? null,
      floorShortM: scanJson.floorShortM ?? null,
      heightM: scanJson.heightM ?? null,
      floorAreaM2: scanJson.floorAreaM2 ?? null,
      wallPerimeterM: scanJson.wallPerimeterM ?? null,
      doorwayWidthM: scanJson.doorwayWidthM ?? null,
      doorwayAreaM2: scanJson.doorwayAreaM2 ?? null,
      windowAreaM2: scanJson.windowAreaM2 ?? null,
      worldPlusXBearingDeg: scanJson.worldPlusXBearingDeg ?? null,
      createdAt: scanJson.capturedAt || null,
      roomType,
      roomName,
    };
  }

  /** Shapes a device-scoped project row (raw app/web MakonProject JSON in
   * `data`) into the same {projectId, name, scans, ...} form as the feed.
   * Owned projects additionally keep `raw` (the full MakonProject JSON, for
   * PUT round trips), `rooms` (including pending, scanless ones) and
   * `entireHousingScan` so the project view can mirror the app's dashboard. */
  function normalizeMyProject(row) {
    const data = row?.data;
    if (!row?.projectId || data == null || typeof data !== 'object') return null;
    const entireHousingScan = resolveHousingScan(data.entireHousingScan, null, null);
    const rooms = [];
    if (Array.isArray(data.rooms)) {
      for (const roomJson of data.rooms) {
        if (roomJson == null || typeof roomJson !== 'object') continue;
        const roomType = typeof roomJson.roomType === 'string' ? roomJson.roomType : 'other';
        const roomName =
          typeof roomJson.name === 'string' && roomJson.name.trim() ? roomJson.name.trim() : null;
        rooms.push({
          id: typeof roomJson.id === 'string' && roomJson.id ? roomJson.id : null,
          roomType,
          name: roomName,
          scan: resolveHousingScan(roomJson.scan, roomType, roomName),
        });
      }
    }
    const scans = [entireHousingScan, ...rooms.map((r) => r.scan)].filter(Boolean);
    return {
      projectId: String(row.projectId),
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Project',
      scanMode: typeof data.scanMode === 'string' ? data.scanMode : null,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
      updatedAt: row.updatedAt || null,
      address:
        typeof data.address === 'string' && data.address.trim() ? data.address.trim() : null,
      scans,
      rooms,
      entireHousingScan,
      raw: data,
      isMine: true,
    };
  }

  function findProject(projectId) {
    return (
      myProjectsCache.find((p) => p.projectId === projectId) ||
      projectsCache.find((p) => p.projectId === projectId) ||
      null
    );
  }

  /** Scans that belong to no project — shown as single-scan cards on home. */
  function ungroupedScans() {
    const grouped = new Set();
    for (const project of [...myProjectsCache, ...projectsCache]) {
      for (const scan of project.scans) grouped.add(Number(scan.id));
    }
    return scansCache.filter((scan) => !grouped.has(Number(scan.id)));
  }

  /** Home is a list of projects: this browser's own first, then the public
   * feed. Scans outside any project trail as single-scan cards. */
  function renderHome() {
    if (fabEl) fabEl.hidden = false;
    const mineIds = new Set(myProjectsCache.map((p) => p.projectId));
    const publicProjects = projectsCache.filter((p) => !mineIds.has(p.projectId));
    const looseScans = ungroupedScans();
    if (!myProjectsCache.length && !publicProjects.length && !looseScans.length) {
      showStatusKey('list.empty');
      return;
    }
    statusEl.hidden = true;
    listEl.hidden = false;
    const parts = [];
    if (myProjectsCache.length) {
      parts.push(`<li class="m3d-section-title">${escapeHtml(t('list.myProjects'))}</li>`);
      for (const project of myProjectsCache) parts.push(projectItemHtml(project));
    }
    if (publicProjects.length || looseScans.length) {
      if (myProjectsCache.length) {
        parts.push(`<li class="m3d-section-title">${escapeHtml(t('list.projects'))}</li>`);
      }
      for (const project of publicProjects) parts.push(projectItemHtml(project));
      for (const scan of looseScans) parts.push(scanItemHtml(scan));
    }
    listEl.innerHTML = parts.join('');
  }

  /** Pending (scanless) room row for an owned room-by-room project — the
   * mini-app counterpart of the app dashboard's "Start scan" room card. */
  function pendingRoomItemHtml(room, canScan) {
    const label = room.name || roomTypeLabel(room.roomType);
    const scanBtn =
      canScan && room.id
        ? `<button type="button" class="m3d-scan-cta-btn m3d-room-scan-btn"
             data-room-scan="${escapeHtml(room.id)}" data-room-type="${escapeHtml(room.roomType)}">
             ${escapeHtml(t('project.scanRoom'))}
           </button>`
        : '';
    return `
      <li>
        <div class="m3d-item m3d-room-pending">
          <span class="m3d-item-body">
            <span class="m3d-item-top">
              <span class="m3d-item-title">${escapeHtml(label)}</span>
              <span class="m3d-badge m3d-badge-pending">${escapeHtml(t('project.roomPending'))}</span>
            </span>
          </span>
          ${scanBtn}
        </div>
      </li>
    `;
  }

  /** Project view. Owned projects mirror the app's dashboard: room-by-room
   * shows the room list (scan per room, add-room below), entire-home shows
   * the single scan plus a Start scan/Rescan action. Public feed projects
   * stay a read-only list of their scans. */
  function openProject(projectId, { pushHistory = true } = {}) {
    const project = findProject(projectId);
    if (!project) {
      showListView();
      return;
    }
    teardownViewer();
    openProjectId = project.projectId;
    listPanelEl.hidden = false;
    backEl.hidden = false;
    navTriggerEl.hidden = true;
    if (fabEl) fabEl.hidden = true;
    if (pushHistory) setRoute({ projectId: project.projectId });
    statusEl.hidden = true;
    listEl.hidden = false;
    const metaBits = [
      formatDate(project.createdAt || project.updatedAt),
      projectModeLabel(project.scanMode),
      project.address || '', // owned projects only — the public feed strips it
      tf('project.scanCount', { count: project.scans.length }),
    ].filter(Boolean);
    const parts = [
      `<li class="m3d-project-head">
        <span class="m3d-project-head-name">${escapeHtml(project.name)}</span>
        <span class="m3d-item-meta">${metaBits.map((b) => `<span>${escapeHtml(b)}</span>`).join('')}</span>
        <button type="button" class="m3d-delete-btn m3d-project-delete" id="m3d-project-delete-btn">
          ${trashIconHtml()}<span>${escapeHtml(t('action.deleteProject'))}</span>
        </button>
      </li>`,
    ];
    const canScan = canStartScanHere();
    if (project.isMine && project.scanMode === 'roomByRoom') {
      if (project.rooms.length) {
        for (const room of project.rooms) {
          if (room.scan) {
            const label = room.name || roomTypeLabel(room.roomType);
            parts.push(scanItemHtml(room.scan, escapeHtml(label)));
          } else {
            parts.push(pendingRoomItemHtml(room, canScan));
          }
        }
      } else {
        parts.push(`<li class="m3d-project-empty">${escapeHtml(t('project.noRooms'))}</li>`);
      }
      parts.push(`
        <li class="m3d-project-action">
          <button type="button" class="m3d-add-room-btn" id="m3d-add-room-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>${escapeHtml(t('project.addRoom'))}</span>
          </button>
        </li>
      `);
    } else if (project.isMine && project.scanMode === 'entireHousing') {
      if (project.entireHousingScan) {
        parts.push(scanItemHtml(project.entireHousingScan));
      } else if (!canScan) {
        parts.push(`<li class="m3d-project-empty">${escapeHtml(t('project.noScans'))}</li>`);
      }
      if (canScan) {
        parts.push(`
          <li class="m3d-project-action">
            <button type="button" class="m3d-scan-cta-btn m3d-project-scan-btn" id="m3d-entire-scan-btn">
              ${escapeHtml(t(project.entireHousingScan ? 'project.rescan' : 'project.startScan'))}
            </button>
          </li>
        `);
      }
    } else if (project.scans.length) {
      for (const scan of project.scans) {
        const label = scanRoomLabel(scan);
        parts.push(scanItemHtml(scan, label ? escapeHtml(label) : ''));
      }
    } else {
      parts.push(`<li class="m3d-project-empty">${escapeHtml(t('project.noScans'))}</li>`);
    }
    listEl.innerHTML = parts.join('');
    document.getElementById('m3d-project-delete-btn')?.addEventListener('click', () => {
      void deleteProjectFlow(project);
    });
    document.getElementById('m3d-add-room-btn')?.addEventListener('click', () => {
      haptic();
      openRoomTypeDialog(project);
    });
    document.getElementById('m3d-entire-scan-btn')?.addEventListener('click', (event) => {
      void startScanFlow({ projectId: project.projectId }, event.currentTarget);
    });
    for (const btn of listEl.querySelectorAll('[data-room-scan]')) {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        void startScanFlow(
          {
            projectId: project.projectId,
            roomId: btn.getAttribute('data-room-scan'),
            roomType: btn.getAttribute('data-room-type') || 'other',
          },
          btn,
        );
      });
    }
  }

  // --- Deleting scans and projects --------------------------------------------
  // Every gallery item is deletable: scans from their viewer, projects (and
  // their scans) from the project view. The backend endpoints are open, the
  // same anonymous trust model as scan uploads; web-owned projects also pass
  // the browser's device id so only the matching backup row is removed.

  function trashIconHtml() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 6h18"></path>
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6M14 11v6"></path>
    </svg>`;
  }

  /** Native Telegram confirm when available, window.confirm otherwise. */
  function confirmAction(message) {
    return new Promise((resolve) => {
      const tg = window.Telegram?.WebApp;
      if (inTelegram() && typeof tg?.showConfirm === 'function') {
        try {
          tg.showConfirm(message, (ok) => resolve(Boolean(ok)));
          return;
        } catch { /* older Telegram client — fall back below */ }
      }
      resolve(window.confirm(message));
    });
  }

  function notifyError(message) {
    const tg = window.Telegram?.WebApp;
    if (inTelegram() && typeof tg?.showAlert === 'function') {
      try {
        tg.showAlert(message);
        return;
      } catch { /* fall back below */ }
    }
    window.alert(message);
  }

  function removeScanFromCaches(scanId) {
    const id = Number(scanId);
    scansCache = scansCache.filter((s) => Number(s.id) !== id);
    for (const project of [...projectsCache, ...myProjectsCache]) {
      project.scans = project.scans.filter((s) => Number(s.id) !== id);
    }
    // Owned projects: the room stays (back to pending), only its scan goes.
    for (const project of myProjectsCache) {
      if (Number(project.entireHousingScan?.id) === id) project.entireHousingScan = null;
      for (const room of project.rooms || []) {
        if (Number(room.scan?.id) === id) room.scan = null;
      }
    }
    // Feed projects with no public scans left vanish, same as on the server.
    projectsCache = projectsCache.filter((p) => p.scans.length > 0);
  }

  /** Clears deleted-scan references from owned projects' raw JSON and syncs
   * them, so the backup doesn't resurrect a scan whose files are gone. */
  async function detachScanFromMyProjects(scanId) {
    const id = Number(scanId);
    for (const project of myProjectsCache) {
      const data = project.raw;
      if (data == null || typeof data !== 'object') continue;
      let changed = false;
      if (Number(data.entireHousingScan?.remoteScanId) === id) {
        data.entireHousingScan = null;
        changed = true;
      }
      if (Array.isArray(data.rooms)) {
        for (const room of data.rooms) {
          if (room && Number(room.scan?.remoteScanId) === id) {
            room.scan = null;
            changed = true;
          }
        }
      }
      if (!changed) continue;
      try {
        await pushProjectData(project.projectId, data);
      } catch (err) {
        console.warn('[Makon3D] project sync after scan delete failed', err);
      }
    }
  }

  function removeProjectFromCaches(projectId) {
    projectsCache = projectsCache.filter((p) => p.projectId !== projectId);
    myProjectsCache = myProjectsCache.filter((p) => p.projectId !== projectId);
  }

  async function deleteScanRequest(scanId) {
    const res = await fetch(`${API_BASE}/makon3d/scans/${Number(scanId)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    // 404 = already gone — that's the outcome we wanted.
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
  }

  /** Viewer delete button: confirm, delete, return to the project or home. */
  async function deleteScanFlow(scan) {
    if (!(await confirmAction(t('confirm.deleteScan')))) return;
    const btn = document.getElementById('m3d-delete-btn');
    if (btn) btn.disabled = true;
    try {
      await deleteScanRequest(scan.id);
      haptic();
      removeScanFromCaches(scan.id);
      await detachScanFromMyProjects(scan.id);
      if (openProjectId && findProject(openProjectId)) {
        openProject(openProjectId);
      } else {
        showListView();
        setRoute({});
      }
    } catch (err) {
      console.error('[Makon3D] delete scan failed', err);
      if (btn) btn.disabled = false;
      notifyError(t('delete.failed'));
    }
  }

  /** Project-view delete button: removes the project's scans, then the
   * project itself, and lands back on home. */
  async function deleteProjectFlow(project) {
    if (!(await confirmAction(t('confirm.deleteProject')))) return;
    const btn = document.getElementById('m3d-project-delete-btn');
    if (btn) btn.disabled = true;
    try {
      for (const scan of [...project.scans]) {
        await deleteScanRequest(scan.id);
        removeScanFromCaches(scan.id);
      }
      const deviceId = project.isMine ? webDeviceId() : null;
      const qs = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
      const res = await fetch(
        `${API_BASE}/makon3d/projects/${encodeURIComponent(project.projectId)}${qs}`,
        { method: 'DELETE', headers: { Accept: 'application/json' } },
      );
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      haptic();
      removeProjectFromCaches(project.projectId);
      showListView();
      setRoute({});
    } catch (err) {
      console.error('[Makon3D] delete project failed', err);
      if (btn) btn.disabled = false;
      notifyError(t('delete.failed'));
    }
  }

  /** Fetches the public feeds plus this browser's own projects. Throws only
   * when the scans feed fails — the rest is additive and must never blank
   * the whole gallery. */
  async function fetchFeeds() {
    const deviceId = webDeviceId();
    const [scansRes, projectsRes, mineRes] = await Promise.all([
      fetch(`${API_BASE}/makon3d/scans`),
      fetch(`${API_BASE}/makon3d/projects/feed`),
      deviceId
        ? fetch(`${API_BASE}/makon3d/projects?device_id=${encodeURIComponent(deviceId)}`).catch(() => null)
        : Promise.resolve(null),
    ]);
    if (!scansRes.ok) throw new Error(`HTTP ${scansRes.status}`);
    const scansData = await scansRes.json();
    let projects = [];
    if (projectsRes.ok) {
      try {
        projects = (await projectsRes.json())?.projects || [];
      } catch { /* additive — a bad projects payload must not break scans */ }
    }
    let mine = [];
    if (mineRes?.ok) {
      try {
        mine = (await mineRes.json())?.projects || [];
      } catch { /* additive */ }
    }
    setFeeds(scansData.scans || [], projects, mine);
  }

  async function loadScans() {
    const { id, projectId } = readRoute();
    showListView();
    showLoadingStatus(t('list.loading'));

    try {
      await fetchFeeds();
      renderHome();
      if (id) {
        // Deep link into a scan; remember its project so Back lands there.
        openProjectId = projectId && findProject(projectId) ? projectId : null;
        await openScan(id, { pushHistory: false });
      } else if (projectId) {
        openProject(projectId, { pushHistory: false });
      }
    } catch (err) {
      console.error('[Makon3D] list failed', err);
      showStatusKey('list.error', true);
      if (id) await openScan(id, { pushHistory: false });
    }
  }

  // --- New project (floating + button) ----------------------------------------
  // Mirrors the app's create-project sheet: name + scan mode, saved through the
  // same PUT /makon3d/projects/:id backup endpoint the app syncs through. The
  // browser owns its projects via a random localStorage device id (the web
  // counterpart of the app's Keychain-backed DeviceIdentity).

  const fabEl = document.getElementById('m3d-fab');
  const createBackdropEl = document.getElementById('m3d-create-backdrop');
  const createNameEl = document.getElementById('m3d-create-name');
  const createAddressEl = document.getElementById('m3d-create-address');
  const createLocateEl = document.getElementById('m3d-create-locate');
  const createModeEl = document.getElementById('m3d-create-mode');
  const createErrorEl = document.getElementById('m3d-create-error');
  const createSubmitEl = document.getElementById('m3d-create-submit');
  const WEB_DEVICE_ID_STORAGE_KEY = 'makon3d:webDeviceId';
  let createSelectedMode = 'entireHousing';

  function webDeviceId() {
    try {
      let id = localStorage.getItem(WEB_DEVICE_ID_STORAGE_KEY) || '';
      if (!/^[a-f0-9]{32}$/.test(id)) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(WEB_DEVICE_ID_STORAGE_KEY, id);
      }
      return id;
    } catch {
      return null; // storage blocked — creating/owning projects is unavailable
    }
  }

  /** Same shape as the app's project ids: time hex + '-' + random hex. */
  function newProjectId() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const rand = Array.from(bytes, (b) => (b % 16).toString(16)).join('');
    return `${Date.now().toString(16)}-${rand}`;
  }

  function setCreateMode(mode) {
    createSelectedMode = mode;
    for (const btn of createModeEl.querySelectorAll('[data-mode]')) {
      const active = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }

  function openCreateDialog() {
    if (!createBackdropEl) return;
    createErrorEl.hidden = true;
    createNameEl.value = '';
    if (createAddressEl) createAddressEl.value = '';
    setCreateMode('entireHousing');
    createBackdropEl.hidden = false;
    createBackdropEl.setAttribute('aria-hidden', 'false');
    createNameEl.focus();
  }

  function closeCreateDialog() {
    if (!createBackdropEl) return;
    createBackdropEl.hidden = true;
    createBackdropEl.setAttribute('aria-hidden', 'true');
  }

  function showCreateError(key) {
    createErrorEl.textContent = t(key);
    createErrorEl.hidden = false;
  }

  /** Upserts a project's raw MakonProject JSON through the same backup
   * endpoint the app syncs through (owned via the browser's device id). */
  async function pushProjectData(projectId, data) {
    const deviceId = webDeviceId();
    if (!deviceId) throw new Error('device id unavailable');
    const res = await fetch(`${API_BASE}/makon3d/projects/${encodeURIComponent(projectId)}`, {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, data }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  async function submitCreateProject() {
    const name = createNameEl.value.trim();
    if (!name) {
      showCreateError('create.nameRequired');
      return;
    }
    const deviceId = webDeviceId();
    if (!deviceId) {
      showCreateError('create.failed');
      return;
    }
    const projectId = newProjectId();
    const createdAt = new Date().toISOString();
    const address = createAddressEl ? createAddressEl.value.trim() : '';
    // Same JSON shape as the app's MakonProject.toJson — scans join later
    // (via the app) or stay empty; either way the project shows on home.
    const data = {
      id: projectId,
      name,
      scanMode: createSelectedMode,
      createdAt,
      address: address || null,
      rooms: [],
    };
    createErrorEl.hidden = true;
    createSubmitEl.disabled = true;
    try {
      await pushProjectData(projectId, data);
      haptic();
      closeCreateDialog();
      myProjectsCache.unshift({
        projectId,
        name,
        scanMode: createSelectedMode,
        createdAt,
        updatedAt: createdAt,
        address: address || null,
        scans: [],
        rooms: [],
        entireHousingScan: null,
        raw: data,
        isMine: true,
      });
      // Straight into the new project, like the app after "Create".
      openProject(projectId);
    } catch (err) {
      console.error('[Makon3D] create project failed', err);
      showCreateError('create.failed');
    } finally {
      createSubmitEl.disabled = false;
    }
  }

  /** navigator.geolocation as a promise; `denied` marks permission refusals. */
  function browserGeolocate() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('geolocation unavailable'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(Object.assign(new Error('geolocation failed'), { denied: err?.code === 1 })),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
      );
    });
  }

  /** Device position: Telegram's LocationManager inside the Mini App (its
   * native permission prompt), the browser geolocation API elsewhere. */
  async function currentDevicePosition() {
    if (inTelegram()) {
      const loc = await initTelegramLocationManager();
      if (loc?.isLocationAvailable) {
        try {
          return await getTelegramLocationData(loc);
        } catch (err) {
          throw Object.assign(err instanceof Error ? err : new Error('telegram location'), {
            denied: true,
          });
        }
      }
      // LocationManager missing (old client) — fall through to the browser API.
    }
    return browserGeolocate();
  }

  /** Coordinates → human-readable address via the backend's anonymous Yandex
   * proxy — the same endpoint the app's NewProjectScreen uses. */
  async function reverseGeocodeAddress(latitude, longitude) {
    const qs = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      lang: currentLang,
    });
    const res = await fetch(`${API_BASE}/makon3d/geocode/reverse?${qs}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const address = (await res.json())?.addressText;
    return typeof address === 'string' && address.trim() ? address.trim() : null;
  }

  /** Fills the create dialog's address input from the device location. */
  async function useCurrentLocationForCreate() {
    if (!createAddressEl || !createLocateEl || createLocateEl.disabled) return;
    haptic();
    createErrorEl.hidden = true;
    createLocateEl.disabled = true;
    const iconHtml = createLocateEl.innerHTML;
    createLocateEl.innerHTML = loadingSpinnerHtml();
    try {
      const position = await currentDevicePosition();
      const address = await reverseGeocodeAddress(position.latitude, position.longitude);
      if (!address) {
        showCreateError('create.locationFailed');
        return;
      }
      createAddressEl.value = address;
    } catch (err) {
      console.warn('[Makon3D] use current location failed', err);
      showCreateError(err?.denied ? 'create.locationDenied' : 'create.locationFailed');
    } finally {
      createLocateEl.disabled = false;
      createLocateEl.innerHTML = iconHtml;
    }
  }

  function initCreateProject() {
    if (!fabEl || !createBackdropEl) return;
    fabEl.addEventListener('click', () => {
      haptic();
      openCreateDialog();
    });
    createBackdropEl.addEventListener('click', (event) => {
      if (event.target === createBackdropEl) closeCreateDialog();
    });
    document.getElementById('m3d-create-cancel')?.addEventListener('click', closeCreateDialog);
    createSubmitEl.addEventListener('click', () => {
      void submitCreateProject();
    });
    createModeEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-mode]');
      if (btn) {
        haptic();
        setCreateMode(btn.getAttribute('data-mode'));
      }
    });
    createNameEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void submitCreateProject();
    });
    createAddressEl?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void submitCreateProject();
    });
    createLocateEl?.addEventListener('click', () => {
      void useCurrentLocationForCreate();
    });
  }

  // --- Add room (room-by-room projects) ---------------------------------------
  // Mirrors the app's RoomTypeSelectionScreen: pick a type, the room appears
  // as a pending row, then its "Scan" button drives the App Clip flow.

  const roomTypeBackdropEl = document.getElementById('m3d-roomtype-backdrop');
  const roomTypeOptionsEl = document.getElementById('m3d-roomtype-options');
  // Wire values mirror makon3d_mobile's RoomType enum; livingRoom..bathroom
  // reuse the badge icons (ROOM_TYPE_ICONS), hallway/other are picker-only.
  const ROOM_TYPE_PICKER_EXTRA_ICONS = {
    hallway: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 21h16" />
      <path d="M7 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M14 11.5v1" />
    </svg>`,
    other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.33c-.55.21-.9.72-.9 1.31v.36" />
      <path d="M12 16.4v.1" />
    </svg>`,
  };
  const ROOM_TYPE_WIRE_VALUES = ['livingRoom', 'bedroom', 'kitchen', 'bathroom', 'hallway', 'other'];
  /** The project the open picker adds a room to. */
  let roomTypeDialogProject = null;

  function roomTypePickerIcon(type) {
    return ROOM_TYPE_ICONS[type]?.svg || ROOM_TYPE_PICKER_EXTRA_ICONS[type] || '';
  }

  function openRoomTypeDialog(project) {
    if (!roomTypeBackdropEl || !roomTypeOptionsEl) return;
    roomTypeDialogProject = project;
    // Rebuilt on every open so labels track the current language.
    roomTypeOptionsEl.innerHTML = ROOM_TYPE_WIRE_VALUES.map(
      (type) => `
        <button type="button" class="m3d-roomtype-btn" data-room-type="${type}">
          <span class="m3d-roomtype-btn-icon">${roomTypePickerIcon(type)}</span>
          <span>${escapeHtml(roomTypeLabel(type))}</span>
        </button>
      `,
    ).join('');
    roomTypeBackdropEl.hidden = false;
    roomTypeBackdropEl.setAttribute('aria-hidden', 'false');
  }

  function closeRoomTypeDialog() {
    if (!roomTypeBackdropEl) return;
    roomTypeDialogProject = null;
    roomTypeBackdropEl.hidden = true;
    roomTypeBackdropEl.setAttribute('aria-hidden', 'true');
  }

  /** Appends a pending room (no scan yet) to the project's raw JSON — same
   * shape as the app's ProjectRoom — and syncs it to the backend. */
  async function addRoomToProject(project, roomType) {
    const data = project.raw;
    if (!data || typeof data !== 'object') {
      notifyError(t('project.updateFailed'));
      return;
    }
    if (!Array.isArray(data.rooms)) data.rooms = [];
    const roomJson = {
      id: newProjectId(),
      roomType,
      createdAt: new Date().toISOString(),
      name: roomTypeLabel(roomType),
    };
    data.rooms.push(roomJson);
    try {
      await pushProjectData(project.projectId, data);
      haptic();
      project.rooms.push({
        id: roomJson.id,
        roomType,
        name: roomJson.name,
        scan: null,
      });
      if (openProjectId === project.projectId) {
        openProject(project.projectId, { pushHistory: false });
      }
    } catch (err) {
      console.error('[Makon3D] add room failed', err);
      data.rooms = data.rooms.filter((r) => r !== roomJson);
      notifyError(t('project.updateFailed'));
    }
  }

  function initRoomTypeDialog() {
    if (!roomTypeBackdropEl) return;
    roomTypeBackdropEl.addEventListener('click', (event) => {
      if (event.target === roomTypeBackdropEl) closeRoomTypeDialog();
    });
    document
      .getElementById('m3d-roomtype-cancel')
      ?.addEventListener('click', closeRoomTypeDialog);
    roomTypeOptionsEl?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-room-type]');
      if (!btn) return;
      const project = roomTypeDialogProject;
      const type = btn.getAttribute('data-room-type');
      haptic();
      closeRoomTypeDialog();
      if (project && ROOM_TYPE_WIRE_VALUES.includes(type)) {
        void addRoomToProject(project, type);
      }
    });
  }

  // --- Scanning (UyDosh App Clip, always project-scoped) ----------------------
  // Scans are started from inside an owned project — per pending room in
  // room-by-room projects, or via Start scan/Rescan in entire-home ones —
  // mirroring the app's dashboard. POST /makon3d/scan-sessions mints a
  // short-lived invocation URL, the iOS App Clip scans with RoomPlan and
  // uploads, the backend feeds the result into makon3d_scans, and the clip
  // deep-links back here with a `scan_<token>` start_param (handled by
  // restoreScanSessionFromStartParam). The project/room the session belongs
  // to is remembered in localStorage (survives the App Clip round trip) and
  // written into the project's JSON once the scan completes.

  const scanCtaEl = document.getElementById('m3d-scan-cta');
  const SCAN_SESSION_STORAGE_KEY = 'makon3d:activeScanSession';
  const SCAN_TARGETS_STORAGE_KEY = 'makon3d:scanTargets';
  const SCAN_SESSION_TTL_MS = 60 * 60 * 1000;
  let scanPollTimer = null;

  /** token → {projectId, roomId?, roomType?, createdAt} map in localStorage;
   * entries older than the session TTL are pruned on every read. */
  function loadScanTargets() {
    let map = {};
    try {
      map = JSON.parse(localStorage.getItem(SCAN_TARGETS_STORAGE_KEY) || '{}') || {};
    } catch { /* storage blocked or corrupt — start fresh */ }
    const now = Date.now();
    for (const [token, entry] of Object.entries(map)) {
      if (!entry || now - (Number(entry.createdAt) || 0) > SCAN_SESSION_TTL_MS) {
        delete map[token];
      }
    }
    return map;
  }

  function storeScanTargets(map) {
    try { localStorage.setItem(SCAN_TARGETS_STORAGE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
  }

  function saveScanTarget(token, target) {
    const map = loadScanTargets();
    map[token] = { ...target, createdAt: Date.now() };
    storeScanTargets(map);
  }

  /** Reads and removes the target for a finished session. */
  function takeScanTarget(token) {
    const map = loadScanTargets();
    const entry = map[token] || null;
    if (entry) {
      delete map[token];
      storeScanTargets(map);
    }
    return entry;
  }

  /** Lazy-loaded QR generator, same CDN pattern as model-viewer above. */
  const QRCODE_LIB_SRC = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.5.0/qrcode.js';
  let qrCodeLibPromise = null;

  function loadQrCodeLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (qrCodeLibPromise) return qrCodeLibPromise;
    qrCodeLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = QRCODE_LIB_SRC;
      script.async = true;
      script.onload = () => {
        if (window.qrcode) resolve(window.qrcode);
        else {
          qrCodeLibPromise = null;
          reject(new Error('qrcode lib missing after load'));
        }
      };
      script.onerror = () => {
        qrCodeLibPromise = null;
        reject(new Error('Failed to load qrcode lib'));
      };
      document.head.appendChild(script);
    });
    return qrCodeLibPromise;
  }

  /**
   * Portrait CSS screen profiles unique to iPhones that certainly have no
   * LiDAR (LiDAR starts with the iPhone 12 Pro). Copied from the UyDosh Mini
   * App's device pre-filter (telegram-create.js) — intentionally optimistic;
   * the App Clip's real RoomCaptureSession.isSupported check is the authority.
   */
  const NON_LIDAR_IPHONE_SCREENS = new Set([
    '320x568',
    '375x667',
    '414x736',
    '375x812',
    '414x896',
  ]);

  function isLikelyRoomScanCapableDevice() {
    const ua = navigator.userAgent || '';
    const osMatch = /OS (\d+)_/.exec(ua);
    if (osMatch && Number(osMatch[1]) < 16) return false;
    const shortSide = Math.min(screen.width, screen.height);
    const longSide = Math.max(screen.width, screen.height);
    return !NON_LIDAR_IPHONE_SCREENS.has(`${shortSide}x${longSide}`);
  }

  function isIosClient() {
    const tgPlatform = String(window.Telegram?.WebApp?.platform || '').toLowerCase();
    if (tgPlatform === 'ios') return true;
    if (tgPlatform && tgPlatform !== 'unknown') return false;
    return /iPhone|iPad|iPod/.test(navigator.userAgent || '');
  }

  async function createScanSession() {
    const res = await fetch(`${API_BASE}/makon3d/scan-sessions`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch { /* ignore */ }
    if (!res.ok) {
      const err = new Error(payload?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  }

  async function fetchScanSession(token) {
    const res = await fetch(`${API_BASE}/scan-sessions/${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' },
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch { /* ignore */ }
    if (!res.ok) {
      const err = new Error(payload?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  }

  /** Mirror the UyDosh Mini App's pre-filter: hide scan affordances entirely
   * on iPhones that certainly can't scan; keep the QR/copy-link path
   * everywhere else (the link can be opened on another device). */
  function canStartScanHere() {
    return !(isIosClient() && !isLikelyRoomScanCapableDevice());
  }

  /** The fixed bottom banner now only hosts scan-flow feedback (status text,
   * QR code) while a session is live — the actions live in the project view. */
  function ensureScanBanner() {
    if (!scanCtaEl) return;
    if (!document.getElementById('m3d-scan-cta-status')) {
      scanCtaEl.innerHTML = '<p class="m3d-scan-cta-status" id="m3d-scan-cta-status" hidden></p>';
    }
    scanCtaEl.hidden = false;
    // Reserves list-panel space for the fixed bottom banner (see makon3d.css).
    document.body.classList.add('m3d-has-scan-banner');
  }

  function hideScanBanner() {
    if (!scanCtaEl) return;
    scanCtaEl.hidden = true;
    scanCtaEl.innerHTML = '';
    document.body.classList.remove('m3d-has-scan-banner');
  }

  function setScanCtaStatus(message) {
    if (message) ensureScanBanner();
    const el = document.getElementById('m3d-scan-cta-status');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
    // Drop the banner when there's nothing left to show in it.
    if (!message && !document.getElementById('m3d-scan-cta-qr')) hideScanBanner();
  }

  async function showScanQrCode(invocationUrl) {
    if (!scanCtaEl) return;
    ensureScanBanner();
    let wrap = document.getElementById('m3d-scan-cta-qr');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'm3d-scan-cta-qr';
      wrap.className = 'm3d-scan-cta-qr';
      scanCtaEl.appendChild(wrap);
    }
    try {
      const qrcode = await loadQrCodeLib();
      const qr = qrcode(0, 'M');
      qr.addData(invocationUrl);
      qr.make();
      const img = document.createElement('img');
      img.src = qr.createDataURL(5, 4);
      img.alt = invocationUrl;
      img.decoding = 'async';
      wrap.innerHTML = '';
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'm3d-scan-cta-qr-close';
      closeBtn.setAttribute('aria-label', t('aria.close'));
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', () => {
        haptic();
        wrap.remove();
        const status = document.getElementById('m3d-scan-cta-status');
        if (!status || status.hidden) hideScanBanner();
      });
      wrap.appendChild(closeBtn);
      wrap.appendChild(img);
      const hint = document.createElement('p');
      hint.className = 'm3d-scan-cta-qr-hint';
      hint.textContent = t('cta.qrHint');
      wrap.appendChild(hint);
    } catch (err) {
      console.error('[Makon3D] QR render failed', err);
      wrap.remove();
    }
  }

  /**
   * Starts a scan session for a project target: `{projectId}` scans the
   * entire home, `{projectId, roomId, roomType}` scans one room. On iOS the
   * App Clip opens directly; elsewhere the invocation link shows as QR +
   * clipboard copy so it can be opened on an iPhone.
   */
  async function startScanFlow(target, button) {
    const isIos = isIosClient();
    const originalLabel = button ? button.textContent : '';
    if (button) {
      button.disabled = true;
      button.textContent = t('cta.starting');
    }
    haptic();
    try {
      const session = await createScanSession();
      saveScanTarget(session.scanSessionId, target);
      try {
        sessionStorage.setItem(
          SCAN_SESSION_STORAGE_KEY,
          JSON.stringify({ token: session.scanSessionId, createdAt: Date.now() }),
        );
      } catch { /* ignore */ }

      if (isIos) {
        const tg = window.Telegram?.WebApp;
        if (tg?.openLink) tg.openLink(session.invocationUrl);
        else window.open(session.invocationUrl, '_blank');
        watchScanSession(session.scanSessionId);
      } else {
        // Desktop/Android: QR first (clipboard writes can reject in some
        // Telegram webviews and must not kill the flow), then copy.
        showScanQrCode(session.invocationUrl);
        watchScanSession(session.scanSessionId);
        try {
          await navigator.clipboard?.writeText?.(session.invocationUrl);
          setScanCtaStatus(t('cta.copied'));
        } catch { /* clipboard unavailable — the QR still carries the link */ }
      }
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    } catch (err) {
      console.error('[Makon3D] scan session create failed', err);
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
      notifyError(t('cta.error'));
    }
  }

  /** The HousingScan JSON the app stores in project rooms, rebuilt from the
   * backend's scan row (the field names already match — see makon_project
   * models in makon3d_mobile and Makon3dScanController.serialize). */
  function housingScanFromRemote(scan) {
    return {
      id: newProjectId(),
      localUsdzPath: null,
      remoteScanId: Number(scan.id),
      usdzUrl: scan.usdzUrl || null,
      glbUrl: scan.glbUrl || null,
      floorLongM: scan.floorLongM ?? null,
      floorShortM: scan.floorShortM ?? null,
      heightM: scan.heightM ?? null,
      floorAreaM2: scan.floorAreaM2 ?? null,
      wallPerimeterM: scan.wallPerimeterM ?? null,
      doorwayWidthM: scan.doorwayWidthM ?? null,
      doorwayAreaM2: scan.doorwayAreaM2 ?? null,
      windowAreaM2: scan.windowAreaM2 ?? null,
      worldPlusXBearingDeg: scan.worldPlusXBearingDeg ?? null,
      capturedAt: scan.createdAt || new Date().toISOString(),
    };
  }

  /**
   * Writes a completed scan into its project's JSON (room's `scan` for
   * room-by-room targets, `entireHousingScan` otherwise) and PUTs the update.
   * Works from a fresh device-scoped fetch — after the App Clip round trip
   * the in-memory caches may not be populated yet.
   */
  async function attachScanToProjectTarget(target, makon3dScanId) {
    const deviceId = webDeviceId();
    if (!deviceId || !target?.projectId) return;
    const rowsRes = await fetch(
      `${API_BASE}/makon3d/projects?device_id=${encodeURIComponent(deviceId)}`,
    );
    if (!rowsRes.ok) throw new Error(`HTTP ${rowsRes.status}`);
    const rows = (await rowsRes.json())?.projects || [];
    const row = rows.find((r) => String(r?.projectId) === String(target.projectId));
    const data = row?.data;
    if (data == null || typeof data !== 'object') return;

    const scanRes = await fetch(`${API_BASE}/makon3d/scans/${Number(makon3dScanId)}`);
    if (!scanRes.ok) throw new Error(`HTTP ${scanRes.status}`);
    const housing = housingScanFromRemote(await scanRes.json());

    if (target.roomId) {
      if (!Array.isArray(data.rooms)) data.rooms = [];
      const room = data.rooms.find((r) => r && r.id === target.roomId);
      if (room) {
        room.scan = housing;
      } else {
        // The room row vanished (e.g. deleted from the app mid-scan) — keep
        // the result anyway, matching the app's append-on-capture behavior.
        data.rooms.push({
          id: target.roomId,
          roomType: target.roomType || 'other',
          createdAt: new Date().toISOString(),
          name: roomTypeLabel(target.roomType || 'other'),
          scan: housing,
        });
      }
    } else {
      data.entireHousingScan = housing;
    }
    await pushProjectData(target.projectId, data);
  }

  /** Terminal "completed" handler shared by the poller and the App Clip
   * return leg: attach to the target project, refresh, open the scan. */
  async function handleScanSessionCompleted(token, makon3dScanId) {
    const target = takeScanTarget(token);
    if (target?.projectId) {
      try {
        await attachScanToProjectTarget(target, makon3dScanId);
      } catch (err) {
        // The scan still exists as a loose gallery item — don't block on it.
        console.error('[Makon3D] attaching scan to project failed', err);
      }
    }
    await openCompletedScan(makon3dScanId, target?.projectId || null);
  }

  /** Re-fetches the feeds, then opens the freshly created scan (with Back
   * leading to its project when the scan was project-scoped). */
  async function openCompletedScan(makon3dScanId, projectId = null) {
    try {
      await fetchFeeds();
      if (projectId && findProject(projectId)) openProjectId = projectId;
      // Refresh whichever list view is visible; leave an open viewer alone.
      if (!listPanelEl.hidden) {
        if (openProjectId && findProject(openProjectId)) {
          openProject(openProjectId, { pushHistory: false });
        } else {
          renderHome();
        }
      }
    } catch { /* list refresh is best-effort */ }
    if (Number.isInteger(makon3dScanId) && makon3dScanId > 0) {
      await openScan(makon3dScanId);
    }
  }

  /**
   * Polls the scan session while the page is visible; stops on any terminal
   * status. Used both after tapping the CTA and when resuming a session
   * persisted in sessionStorage.
   */
  function watchScanSession(token) {
    const stop = () => {
      if (scanPollTimer) {
        clearInterval(scanPollTimer);
        scanPollTimer = null;
      }
    };
    const clearStored = () => {
      try { sessionStorage.removeItem(SCAN_SESSION_STORAGE_KEY); } catch { /* ignore */ }
    };

    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      let session;
      try {
        session = await fetchScanSession(token);
      } catch (err) {
        if (err?.status === 404 || err?.status === 410) {
          stop();
          clearStored();
          takeScanTarget(token);
        }
        return;
      }
      if (session.status === 'processing') {
        setScanCtaStatus(t('cta.building'));
      } else if (session.status === 'completed') {
        stop();
        clearStored();
        document.getElementById('m3d-scan-cta-qr')?.remove();
        hideScanBanner();
        haptic();
        await handleScanSessionCompleted(token, Number(session.makon3dScanId));
      } else if (session.status === 'failed' || session.status === 'expired') {
        stop();
        clearStored();
        takeScanTarget(token);
        document.getElementById('m3d-scan-cta-qr')?.remove();
        hideScanBanner();
        if (session.status === 'failed') notifyError(t('cta.failed'));
      }
    };

    stop();
    scanPollTimer = setInterval(poll, 4000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && scanPollTimer) poll();
    });
    poll();
  }

  /** Resumes polling a scan session persisted before the App Clip hop. */
  function resumeStoredScanSession() {
    let stored = null;
    try {
      stored = JSON.parse(sessionStorage.getItem(SCAN_SESSION_STORAGE_KEY) || 'null');
    } catch { /* ignore */ }
    if (!stored?.token) return;
    if (Date.now() - (Number(stored.createdAt) || 0) > SCAN_SESSION_TTL_MS) {
      try { sessionStorage.removeItem(SCAN_SESSION_STORAGE_KEY); } catch { /* ignore */ }
      return;
    }
    watchScanSession(stored.token);
  }

  // --- Return leg from the App Clip (start_param) ----------------------------
  // After uploading, the clip opens t.me/<bot>/<app>?startapp=scan_<token>;
  // Telegram passes that through as initDataUnsafe.start_param. Show a
  // blocking overlay while the backend converts, then open the scan.

  function scanReturnOverlay() {
    let overlay = document.getElementById('m3d-scan-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'm3d-scan-overlay';
    overlay.className = 'm3d-scan-overlay';
    overlay.innerHTML = `
      <div class="m3d-scan-overlay-card">
        ${loadingSpinnerHtml()}
        <p id="m3d-scan-overlay-text">${t('cta.building')}</p>
        <button type="button" class="m3d-scan-cta-btn" id="m3d-scan-overlay-close" hidden>
          ${t('overlay.backToScans')}
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#m3d-scan-overlay-close')?.addEventListener('click', () => {
      overlay.remove();
    });
    return overlay;
  }

  function failScanReturnOverlay(message) {
    const overlay = document.getElementById('m3d-scan-overlay');
    if (!overlay) return;
    overlay.querySelector('.m3d-loading-spinner')?.remove();
    const text = overlay.querySelector('#m3d-scan-overlay-text');
    if (text) text.textContent = message;
    const close = overlay.querySelector('#m3d-scan-overlay-close');
    if (close) close.hidden = false;
  }

  async function restoreScanSessionFromStartParam() {
    let startParam = '';
    try {
      startParam = String(window.Telegram?.WebApp?.initDataUnsafe?.start_param || '');
    } catch { /* ignore */ }
    const match = /^scan_([A-Za-z0-9_-]{4,64})$/.exec(startParam);
    if (!match) return false;
    const token = match[1];

    const overlay = scanReturnOverlay();
    const finish = () => overlay.remove();

    const poll = async () => {
      let session;
      try {
        session = await fetchScanSession(token);
      } catch (err) {
        if (err?.status === 404 || err?.status === 410) {
          takeScanTarget(token);
          failScanReturnOverlay(t('overlay.linkExpired'));
          return true;
        }
        return false; // transient — keep polling
      }
      if (session.status === 'completed') {
        finish();
        haptic();
        await handleScanSessionCompleted(token, Number(session.makon3dScanId));
        return true;
      }
      if (session.status === 'failed') {
        takeScanTarget(token);
        failScanReturnOverlay(t('overlay.failed'));
        return true;
      }
      if (session.status === 'expired') {
        takeScanTarget(token);
        failScanReturnOverlay(t('overlay.sessionExpired'));
        return true;
      }
      return false; // created / uploading / processing — keep waiting
    };

    if (await poll()) return true;
    const timer = setInterval(async () => {
      if (!document.getElementById('m3d-scan-overlay')) {
        clearInterval(timer);
        return;
      }
      if (await poll()) clearInterval(timer);
    }, 3000);
    return true;
  }

  // --- Location permission (Telegram LocationManager) ------------------------
  // Same first-visit prompt pattern as the UyDosh Mini App (see
  // requestAndReportUserLocation in uydosh-map-pins.js): `getLocation` only
  // surfaces Telegram's native location permission prompt the very first time
  // it's ever called for this user; once answered (granted or denied), later
  // calls resolve/reject silently with no repeat prompt. The resolved position
  // is reported to the same backend endpoint as UyDosh's map view, which
  // verifies this app's initData against the Makon 3D bot token.

  function initTelegramLocationManager() {
    const loc = window.Telegram?.WebApp?.LocationManager;
    if (!loc || typeof loc.init !== 'function') return Promise.resolve(null);
    if (loc.isInited) return Promise.resolve(loc);
    return new Promise((resolve) => {
      loc.init(() => resolve(loc));
    });
  }

  /** Wraps `LocationManager.getLocation` in a promise resolving to `{ latitude, longitude }`. */
  function getTelegramLocationData(loc) {
    return new Promise((resolve, reject) => {
      loc.getLocation((data) => {
        const latitude = Number(data?.latitude);
        const longitude = Number(data?.longitude);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          resolve({ latitude, longitude });
          return;
        }
        reject(new Error('telegram_location_denied'));
      });
    });
  }

  /** Fire-and-forget: requests location permission on open, reports the position. */
  async function requestAndReportUserLocation() {
    if (!inTelegram()) return;
    try {
      const loc = await initTelegramLocationManager();
      if (!loc?.isLocationAvailable) return;
      const position = await getTelegramLocationData(loc);
      await fetch(`${API_BASE}/app/telegram-mini-app-location`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          init_data: window.Telegram.WebApp.initData,
          latitude: position.latitude,
          longitude: position.longitude,
        }),
      });
    } catch (err) {
      console.warn('[Makon3D] location request failed', err);
    }
  }

  // --- Language switcher (drawer) --------------------------------------------

  /** Static markup translations: [data-i18n] → textContent, or the attribute
   * named by [data-i18n-attr] (e.g. aria-label). */
  function applyStaticI18n() {
    document.documentElement.lang = currentLang;
    for (const el of document.querySelectorAll('[data-i18n]')) {
      const key = el.getAttribute('data-i18n');
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) el.setAttribute(attr, t(key));
      else el.textContent = t(key);
    }
  }

  function syncDrawerLangButtons() {
    for (const btn of document.querySelectorAll('#m3d-drawer-lang-options [data-lang]')) {
      const active = btn.getAttribute('data-lang') === currentLang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    }
  }

  /** Re-renders every dynamic panel in the new language, in place — the
   * drawer stays open so the switch is visible immediately. */
  function rerenderForLangChange() {
    applyStaticI18n();
    syncDrawerLangButtons();
    if (openScanId != null && openScanData) {
      renderViewerMeta(openScanData);
    } else if (!listEl.hidden) {
      if (openProjectId && findProject(openProjectId)) {
        openProject(openProjectId, { pushHistory: false });
      } else {
        renderHome();
      }
    } else if (!statusEl.hidden && lastStatusKey) {
      showStatusKey(lastStatusKey, statusEl.dataset.error === '1');
    }
  }

  function setM3dLang(lang) {
    if (!M3D_LANGS.includes(lang) || lang === currentLang) return;
    currentLang = lang;
    try { localStorage.setItem(M3D_LANG_STORAGE_KEY, lang); } catch { /* ignore */ }
    rerenderForLangChange();
  }

  function initDrawerLangPicker() {
    const wrap = document.getElementById('m3d-drawer-lang-options');
    if (!wrap) return;
    wrap.innerHTML = M3D_LANGS
      .map((lang) => {
        const meta = M3D_LANG_META[lang];
        return `
          <button type="button" class="m3d-drawer-lang-btn" role="radio" data-lang="${lang}">
            <span class="m3d-drawer-lang-flag" aria-hidden="true">${meta.flag}</span>
            <span>${meta.label}</span>
            <span class="m3d-drawer-lang-check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
          </button>
        `;
      })
      .join('');
    wrap.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-lang]');
      if (!btn) return;
      haptic();
      setM3dLang(btn.getAttribute('data-lang'));
    });
    syncDrawerLangButtons();
  }

  const DRAWER_TRANSITION_MS = 220;
  let drawerCloseTimer = null;

  function openDrawer() {
    if (!drawerBackdropEl) return;
    clearTimeout(drawerCloseTimer);
    drawerBackdropEl.hidden = false;
    drawerBackdropEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => drawerBackdropEl.classList.add('is-open'));
    navTriggerEl?.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    if (!drawerBackdropEl || drawerBackdropEl.hidden) return;
    drawerBackdropEl.classList.remove('is-open');
    drawerBackdropEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    navTriggerEl?.setAttribute('aria-expanded', 'false');
    drawerCloseTimer = setTimeout(() => {
      drawerBackdropEl.hidden = true;
    }, DRAWER_TRANSITION_MS);
  }

  /** Telegram user's photo + display name into the header/drawer avatars. */
  function initTelegramUserChrome() {
    let user = null;
    try {
      user = window.Telegram?.WebApp?.initDataUnsafe?.user || null;
    } catch {
      user = null;
    }
    if (!user) return;
    const photoUrl = typeof user.photo_url === 'string' ? user.photo_url : '';
    if (photoUrl) {
      for (const holder of [avatarEl, drawerAvatarEl]) {
        if (!holder) continue;
        const img = document.createElement('img');
        img.className = 'm3d-avatar-img';
        img.src = photoUrl;
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.onerror = () => {
          holder.classList.remove('has-avatar');
          img.remove();
        };
        holder.classList.add('has-avatar');
        holder.appendChild(img);
      }
    }
    const displayName =
      [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
      (user.username ? `@${user.username}` : '');
    if (displayName && drawerUsernameEl) {
      drawerUsernameEl.textContent = displayName;
      drawerUsernameEl.hidden = false;
    }
  }

  // Same fix as UyDosh's mini app (see applyTelegramSafeAreaInsets in
  // uydosh-mini-app.js): inside Telegram's WebView env(safe-area-inset-*)
  // reports 0, so Telegram's own Close/menu buttons float over the app's
  // header. Read the insets from the WebApp API instead and publish them as
  // CSS vars that makon3d.css prefers over env().
  const TELEGRAM_MOBILE_PLATFORMS = new Set(['ios', 'android', 'android_x']);
  /** Minimum space below Telegram mobile header chrome (Close + title bar). */
  const TELEGRAM_MOBILE_HEADER_MIN_TOP = 72;

  function isTelegramMobile(tg) {
    return TELEGRAM_MOBILE_PLATFORMS.has(String(tg?.platform || 'unknown').toLowerCase());
  }

  function applyTelegramSafeAreaInsets(tg) {
    const root = document.documentElement;
    const device = tg?.safeAreaInset ?? {};
    const content = tg?.contentSafeAreaInset ?? {};
    // Sum device + content insets (Telegram docs); content-only top under-reports on mobile.
    let top = (Number(device.top) || 0) + (Number(content.top) || 0);
    const bottom = (Number(device.bottom) || 0) + (Number(content.bottom) || 0);
    if (isTelegramMobile(tg)) {
      top = Math.max(top, TELEGRAM_MOBILE_HEADER_MIN_TOP);
    }
    root.style.setProperty('--uydosh-tg-inset-top', `${top}px`);
    root.style.setProperty('--uydosh-tg-inset-bottom', `${bottom}px`);
  }

  function initTelegramChrome() {
    try {
      const tg = window.Telegram?.WebApp;
      if (!tg) return;
      tg.ready?.();
      tg.expand?.();
      // Dragging the 3D viewer downward to orbit the camera is otherwise
      // interpreted as Telegram's swipe-down-to-close gesture, collapsing the
      // Mini App mid-rotation. In-page scrolling keeps working; users can
      // still close via the header button. No-op on clients < Bot API 7.7.
      tg.disableVerticalSwipes?.();
      document.documentElement.style.setProperty('--tg-bg', tg.backgroundColor || '');
      document.documentElement.style.setProperty('--tg-fg', tg.textColor || '');
      applyTelegramSafeAreaInsets(tg);
      if (typeof tg.onEvent === 'function') {
        for (const event of ['safeAreaChanged', 'contentSafeAreaChanged', 'viewportChanged']) {
          tg.onEvent(event, () => applyTelegramSafeAreaInsets(tg));
        }
      }
      // Insets are often still 0 on the very first tick — re-apply once the
      // client has settled (same rAF + 150ms retry as uydosh-mini-app.js).
      requestAnimationFrame(() => applyTelegramSafeAreaInsets(tg));
      setTimeout(() => applyTelegramSafeAreaInsets(tg), 150);
    } catch {
      /* ignore */
    }
  }

  listEl.addEventListener('click', (event) => {
    const projectBtn = event.target.closest('[data-project-id]');
    if (projectBtn) {
      haptic();
      openProject(projectBtn.getAttribute('data-project-id'));
      return;
    }
    const btn = event.target.closest('[data-scan-id]');
    if (!btn) return;
    const id = Number(btn.getAttribute('data-scan-id'));
    if (Number.isInteger(id) && id > 0) openScan(id);
  });

  backEl.addEventListener('click', () => {
    // From a scan viewer opened inside a project, Back returns to that
    // project; everything else returns home.
    if (!viewerPanelEl.hidden && openProjectId && findProject(openProjectId)) {
      openProject(openProjectId);
      return;
    }
    showListView();
    setRoute({});
  });

  navTriggerEl?.addEventListener('click', openDrawer);

  drawerBackdropEl?.addEventListener('click', (event) => {
    // Only the dimmed area closes; navigation links close via page unload,
    // except the SPA-style "Scans" home link handled below.
    if (event.target === drawerBackdropEl) closeDrawer();
  });

  drawerHomeEl?.addEventListener('click', (event) => {
    event.preventDefault();
    closeDrawer();
    showListView();
    setRoute({});
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDrawer();
      closeCreateDialog();
      closeRoomTypeDialog();
    }
  });

  window.addEventListener('popstate', () => {
    const { id, projectId } = readRoute();
    if (id) {
      openProjectId = projectId && findProject(projectId) ? projectId : null;
      openScan(id, { pushHistory: false });
    } else if (projectId) {
      openProject(projectId, { pushHistory: false });
    } else {
      showListView();
    }
  });

  initTelegramChrome();
  initTelegramUserChrome();
  applyStaticI18n();
  initDrawerLangPicker();
  initCreateProject();
  initRoomTypeDialog();
  requestAndReportUserLocation();
  loadScans();
  // The App Clip return leg (`scan_<token>` start_param) takes precedence
  // over resuming a stored session — both would poll the same session anyway.
  restoreScanSessionFromStartParam().then((handled) => {
    if (!handled) resumeStoredScanSession();
  });
})();
