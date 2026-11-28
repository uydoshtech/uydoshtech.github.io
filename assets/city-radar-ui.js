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
      deleteEvent: "Удалить мероприятие",
      confirmDelete: "Удалить мероприятие из афиши?",
      eventDeleted: "Мероприятие удалено из афиши.",
      title: "Куда пойдём?",
      more: "Показать ещё",
      details: "Подробнее",
      subtitle: "Куда сходить в Ташкенте",
      category: "Категория",
      from: "С даты",
      to: "По дату",
      apply: "Показать",
      retry: "Повторить",
      previous: "Назад",
      next: "Далее",
      back: "← Афиша",
      all: "Все",
      loading: "Загружаем…",
      empty: "Пока нет мероприятий в этой категории. Загляните позже.",
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
      deleteEvent: "Tadbirni o‘chirish",
      confirmDelete: "Tadbir afishadan o‘chirilsinmi?",
      eventDeleted: "Tadbir afishadan o‘chirildi.",
      title: "Qayerga boramiz?",
      more: "Yana ko‘rsatish",
      details: "Batafsil",
      subtitle: "Toshkentda qayerga borish mumkin",
      category: "Turkum",
      from: "Sanadan",
      to: "Sanagacha",
      apply: "Ko‘rsatish",
      retry: "Qayta urinish",
      previous: "Orqaga",
      next: "Keyingi",
      back: "← Afisha",
      all: "Barchasi",
      loading: "Yuklanmoqda…",
      empty: "Bu turkumda hozircha tadbirlar yo‘q. Keyinroq qayting.",
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
      deleteEvent: "Delete event",
      confirmDelete: "Remove this event from the feed?",
      eventDeleted: "Event removed from the feed.",
      title: "Where shall we go?",
      more: "Show more",
      details: "View details",
      subtitle: "Things to do in Tashkent",
      category: "Category",
      from: "From",
      to: "Through",
      apply: "Show events",
      retry: "Retry",
      previous: "Previous",
      next: "Next",
      back: "← Events",
      all: "All",
      loading: "Loading…",
      empty: "No events in this category yet. Check back later.",
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
    const el = node("article", null, "radar-card radar-event-card");
    if (event.photo_url) {
      try {
        const base = new URL(UyDosh.API_BASE || "https://api.uydosh.com");
        const url = new URL(base.href.replace(/\/$/, "") + event.photo_url);
        // Covers are served by the API with the same visibility checks as events.
        if (
          url.origin === base.origin &&
          /^\/events\/\d+\/photo$/.test(event.photo_url)
        ) {
          const img = node("img", null, "radar-cover");
          img.src = url.href;
          img.alt = event.title;
          img.loading = "lazy";
          img.decoding = "async";
          img.addEventListener("error", () => {
            img.hidden = true;
          });
          el.append(img);
        }
      } catch {
        /* Text-only card when a cover is unavailable. */
      }
    }
    const body = node("div", null, "radar-card-body");
    el.append(body);
    const meta = node("div", null, "radar-event-meta");
    const tag = node("span", category(event.category), "radar-tag");
    tag.dataset.category = categories.includes(event.category) ? event.category : "general_events";
    meta.append(tag);
    if (event.starts_at) {
      const date = new Date(event.starts_at);
      const options = { timeZone: "Asia/Tashkent" };
      const day = new Intl.DateTimeFormat(lang(), {
        ...options, day: "numeric", month: "long",
        ...(date.getUTCFullYear() !== new Date().getUTCFullYear() ? { year: "numeric" } : {}),
      }).format(date);
      const weekday = new Intl.DateTimeFormat(lang(), { ...options, weekday: "long" }).format(date);
      const clock = new Intl.DateTimeFormat(lang(), {
        ...options, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).format(date);
      const schedule = node("div", null, "radar-event-schedule");
      for (const [label, icon] of [[`${day}, ${weekday}`, UyDosh.iconCalendar?.()], [clock, UyDosh.iconClock?.()]]) {
        const time = node("time", null, "radar-event-time");
        time.dateTime = event.starts_at;
        if (icon) {
          const symbol = node("span", null, "radar-meta-icon");
          symbol.setAttribute("aria-hidden", "true");
          symbol.innerHTML = icon;
          time.append(symbol);
        }
        time.append(node("span", label));
        schedule.append(time);
      }
      meta.append(schedule);
    }
    body.append(meta);
    const heading = node(detail ? "h1" : "h2");
    if (detail) heading.textContent = event.title;
    else {
      const titleLink = node("a", event.title);
      titleLink.href = event.source_kind === "community"
        ? `/telegram/gathering.html?id=${encodeURIComponent(String(event.id).replace(/^community:/, ""))}`
        : `/telegram/event.html?id=${encodeURIComponent(event.id)}`;
      heading.append(titleLink);
    }
    body.append(heading);
    if (event.announcement_status === "rescheduled")
      body.append(node("p", t("rescheduled"), "radar-tag"));
    const venue = node("p", null, "radar-event-venue");
    if (event.venue && UyDosh.iconPin) {
      const pin = node("span", null, "radar-location-icon");
      pin.setAttribute("aria-hidden", "true");
      pin.innerHTML = UyDosh.iconPin();
      venue.append(pin);
    }
    venue.append(node("span", event.venue || t("venue")));
    body.append(venue);
    if (detail && event.ends_at)
      body.append(
        node(
          "p",
          "→ " +
            new Intl.DateTimeFormat(lang(), {
              timeZone: "Asia/Tashkent",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(event.ends_at)),
        ),
      );
    body.append(
      node(
        "strong",
        event.price == null
          ? t("unknown")
          : Number(event.price.amount) === 0
            ? t("free")
            : `${new Intl.NumberFormat(lang()).format(event.price.amount)} ${event.price.currency}`,
        "radar-event-price" + (event.price != null && Number(event.price.amount) === 0 ? " radar-price-free" : ""),
      ),
    );
    const actions = node("div", null, "radar-actions");
    if (detail) {
      for (const [label, url] of [
        [t("register"), event.registration_url],
        [t("source"), event.source_url],
      ]) {
        const a = link(label, url);
        if (a) actions.append(a);
      }
    } else {
      const more = node("a", t("details"));
      more.href = event.source_kind === "community"
        ? `/telegram/gathering.html?id=${encodeURIComponent(String(event.id).replace(/^community:/, ""))}`
        : `/telegram/event.html?id=${encodeURIComponent(event.id)}`;
      actions.append(more);
    }
    body.append(actions);
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
