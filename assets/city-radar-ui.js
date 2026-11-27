/* Shared presentation only: source content is always rendered as text. */
window.CityRadarUI = (() => {
  const categories = [
    "general_events",
    "tech_and_startups",
    "board_games_and_social",
    "outdoor_and_travel",
    "cinema_and_entertainment",
    "education_and_volunteering",
    "sports_and_fitness",
  ];
  const strings = {
    ru: {
      title: "Афиша",
      subtitle: "Куда сходить в Ташкенте",
      category: "Категория",
      from: "С даты",
      to: "По дату",
      apply: "Показать",
      retry: "Повторить",
      previous: "Назад",
      next: "Далее",
      back: "← Афиша",
      all: "Все категории",
      loading: "Загружаем…",
      empty: "Пока нет мероприятий. Попробуйте другие даты или категорию.",
      unavailable: "Афиша пока недоступна. Загляните позже.",
      missing: "Мероприятие больше не доступно.",
      error: "Не удалось загрузить. Попробуйте ещё раз.",
      dates: "Дата окончания должна быть не раньше даты начала.",
      free: "Бесплатно",
      unknown: "Стоимость не указана",
      venue: "Место уточняется",
      source: "Публикация организатора",
      register: "Регистрация",
      rescheduled: "Дата изменена",
      cats: [
        "Городские события",
        "IT и стартапы",
        "Настолки и квизы",
        "Походы и путешествия",
        "Кино и развлечения",
        "Образование и волонтёрство",
        "Спорт",
      ],
    },
    uz: {
      title: "Afisha",
      subtitle: "Toshkentda qayerga borish mumkin",
      category: "Turkum",
      from: "Sanadan",
      to: "Sanagacha",
      apply: "Ko‘rsatish",
      retry: "Qayta urinish",
      previous: "Orqaga",
      next: "Keyingi",
      back: "← Afisha",
      all: "Barcha turkumlar",
      loading: "Yuklanmoqda…",
      empty: "Hozircha tadbirlar yo‘q. Boshqa sana yoki turkumni tanlang.",
      unavailable: "Afisha hozircha mavjud emas. Keyinroq qayting.",
      missing: "Tadbir endi mavjud emas.",
      error: "Yuklab bo‘lmadi. Qayta urinib ko‘ring.",
      dates: "Tugash sanasi boshlanish sanasidan oldin bo‘lmasligi kerak.",
      free: "Bepul",
      unknown: "Narx ko‘rsatilmagan",
      venue: "Joy aniqlashtirilmoqda",
      source: "Tashkilotchining e’loni",
      register: "Ro‘yxatdan o‘tish",
      rescheduled: "Sana o‘zgardi",
      cats: [
        "Shahar tadbirlari",
        "IT va startaplar",
        "Stol o‘yinlari va viktorinalar",
        "Sayohat va tog‘ yurishlari",
        "Kino va ko‘ngilochar tadbirlar",
        "Ta’lim va volontyorlik",
        "Sport",
      ],
    },
    en: {
      title: "Events",
      subtitle: "Things to do in Tashkent",
      category: "Category",
      from: "From",
      to: "Through",
      apply: "Show events",
      retry: "Retry",
      previous: "Previous",
      next: "Next",
      back: "← Events",
      all: "All categories",
      loading: "Loading…",
      empty: "No events yet. Try another date or category.",
      unavailable: "Events are currently unavailable. Check back later.",
      missing: "This event is no longer available.",
      error: "Could not load events. Please try again.",
      dates: "End date must not precede start date.",
      free: "Free",
      unknown: "Price not specified",
      venue: "Venue to be confirmed",
      source: "Organizer’s post",
      register: "Register",
      rescheduled: "Date changed",
      cats: [
        "City events",
        "Tech and startups",
        "Board games and quizzes",
        "Outdoors and travel",
        "Cinema and entertainment",
        "Education and volunteering",
        "Sports",
      ],
    },
  };
  const lang = () => (strings[UyDosh.getLang?.()] ? UyDosh.getLang() : "ru");
  const t = (key) => strings[lang()][key];
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const link = (text, url) => {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return null;
      const a = node("a", text);
      a.href = parsed.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      return a;
    } catch {
      return null;
    }
  };
  const category = (value) => t("cats")[categories.indexOf(value)] || value;
  function card(event, detail = false) {
    const el = node("article", null, "radar-card");
    el.append(node("span", category(event.category), "radar-tag"));
    const heading = node("h2");
    if (detail) heading.textContent = event.title;
    else {
      const a = node("a", event.title);
      a.href = `/telegram/event.html?id=${encodeURIComponent(event.id)}`;
      heading.append(a);
    }
    el.append(heading);
    if (event.announcement_status === "rescheduled")
      el.append(node("p", t("rescheduled"), "radar-tag"));
    const format = (value) =>
      new Intl.DateTimeFormat(lang(), {
        timeZone: "Asia/Tashkent",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    if (event.starts_at)
      el.append(
        node(
          "p",
          format(event.starts_at) +
            (event.ends_at ? " — " + format(event.ends_at) : "") +
            " · Ташкент (UTC+5)",
        ),
      );
    el.append(node("p", event.venue || t("venue")));
    el.append(
      node(
        "strong",
        event.price == null
          ? t("unknown")
          : Number(event.price.amount) === 0
            ? t("free")
            : `${new Intl.NumberFormat(lang()).format(event.price.amount)} ${event.price.currency}`,
      ),
    );
    if (detail) {
      const actions = node("div", null, "radar-actions");
      for (const [label, url] of [
        [t("register"), event.registration_url],
        [t("source"), event.source_url],
      ]) {
        const a = link(label, url);
        if (a) actions.append(a);
      }
      el.append(actions);
    }
    return el;
  }
  function error(error) {
    return (
      {
        401: "Откройте Mini App в Telegram и войдите снова.",
        403: "Нет доступа или необходимого разрешения источника.",
        409: "Данные изменились или операция уже выполняется. Обновите список перед повтором.",
        429: "Лимит запросов. Подождите перед повтором.",
        503: "Операция пока недоступна или отключена на сервере.",
      }[error.status] ||
      "Не удалось выполнить операцию. Проверьте заполненные поля и повторите."
    );
  }
  return { categories, t, node, link, category, card, error };
})();
