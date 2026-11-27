(() => {
  const R = CityRadarUI,
    $ = (id) => document.getElementById(id),
    api = UyDosh.cityRadarAdmin;
  const back = window.Telegram?.WebApp?.BackButton;
  back?.show();
  back?.onClick(() => {
    location.href = "/telegram/admin.html";
  });
  let section = "sources",
    offset = 0,
    generation = 0,
    busy = false;
  const statuses = {
    pending: "Ожидает проверки",
    approved: "Разрешено",
    denied: "Запрещено",
    accessible: "Доступен",
    unavailable: "Недоступен",
    needs_review: "На проверке",
    accepted: "Принят",
    rejected: "Отклонён",
    duplicate: "Дубликат",
    published: "Опубликован",
    withdrawn: "Снят с публикации",
    scheduled: "Запланировано",
    rescheduled: "Перенесено",
    cancelled: "Отменено",
    unknown: "Неизвестно",
  };
  const button = (label, fn) => {
    const b = R.node("button", label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  };
  const note = (text) => {
    $("radar-status").textContent = text;
  };
  function field(form, label, value, options) {
    const wrap = R.node("label", label),
      el = R.node(options ? "select" : "textarea");
    if (options)
      options.forEach((v) => {
        const o = R.node("option", statuses[v] || R.category(v));
        o.value = v;
        el.append(o);
      });
    el.value = value ?? "";
    wrap.append(el);
    form.append(wrap);
    return el;
  }
  function editor(title) {
    ++generation;
    const panel = R.node("section", null, "radar-card");
    panel.append(
      R.node("h2", title),
      button("Закрыть", () => {
        ++generation;
        $("radar-editor").replaceChildren();
      }),
    );
    $("radar-editor").replaceChildren(panel);
    panel.scrollIntoView?.({ behavior: "smooth", block: "start" });
    return panel;
  }
  function audit(panel, history) {
    if (!history?.length) return;
    const details = R.node("details");
    details.append(R.node("summary", "История изменений"));
    for (const row of history)
      details.append(R.node("pre", JSON.stringify(row, null, 2)));
    panel.append(details);
  }
  async function read(fn) {
    const ticket = ++generation;
    try {
      const data = await fn();
      if (ticket === generation) return data;
    } catch (e) {
      if (ticket === generation) note(R.error(e));
    }
    return null;
  }
  async function mutate(path, body, method = "POST") {
    if (busy) return;
    busy = true;
    const controls = [
      ...document.querySelectorAll(
        "#radar-admin button, #radar-admin input, #radar-admin select, #radar-admin textarea",
      ),
    ].map((el) => [el, el.disabled]);
    controls.forEach(([el]) => {
      el.disabled = true;
    });
    note("Сохраняем…");
    try {
      await api(path, { method, body });
      $("radar-editor").replaceChildren();
      await load();
      note("Изменения сохранены.");
    } catch (e) {
      note(R.error(e));
      if (e.status === 409) {
        $(
          "radar-editor",
        ).replaceChildren(); /* A fresh list is required before another mutation. */
      }
    } finally {
      busy = false;
      controls.forEach(([el, disabled]) => {
        if (el.isConnected) el.disabled = disabled;
      });
    }
  }
  function reason(form) {
    const el = field(form, "Причина действия (обязательно)", "");
    el.required = true;
    el.maxLength = 2000;
    return el;
  }
  function submit(form, label, fn) {
    const b = R.node("button", label);
    b.type = "submit";
    form.append(b);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (form.reportValidity()) fn();
    });
  }
  function sourceEditor(s) {
    const panel = editor("@" + s.handle),
      form = R.node("form", null, "radar-form");
    panel.append(
      R.node("p", `Ревизия ${s.revision}. ${R.category(s.category)}`),
      form,
    );
    const access = field(form, "Доступность", s.access_status, [
      "pending",
      "accessible",
      "unavailable",
    ]);
    const accessEvidence = field(
      form,
      "Подтверждение доступности",
      s.access_evidence,
    );
    const collection = field(
      form,
      "Разрешение на получение контента",
      s.collection_permission,
      ["pending", "approved", "denied"],
    );
    const evidence = field(
      form,
      "Подтверждение разрешения на получение",
      s.permission_evidence,
    );
    const ai = field(form, "Разрешение на AI-обработку", s.ai_permission, [
      "pending",
      "approved",
      "denied",
    ]);
    const aiEvidence = field(
      form,
      "Подтверждение разрешения на AI-обработку",
      s.ai_permission_evidence,
    );
    const enabledWrap = R.node("label", "Источник включён"),
      enabled = R.node("input");
    enabled.type = "checkbox";
    enabled.checked = s.enabled;
    enabledWrap.append(enabled);
    form.append(enabledWrap);
    submit(form, "Сохранить проверку", () => {
      if (
        (access.value === "accessible" && !accessEvidence.value.trim()) ||
        (collection.value === "approved" && !evidence.value.trim()) ||
        (ai.value === "approved" && !aiEvidence.value.trim()) ||
        (enabled.checked &&
          (access.value !== "accessible" || collection.value !== "approved"))
      ) {
        note(
          "Для разрешений нужны подтверждения. Включение требует доступности и разрешения на получение.",
        );
        return;
      }
      mutate(
        `/sources/${s.id}/review`,
        {
          expected_revision: s.revision,
          enabled: enabled.checked,
          access_status: access.value,
          access_evidence: accessEvidence.value.trim() || null,
          collection_permission: collection.value,
          permission_evidence: evidence.value.trim() || null,
          ai_permission: ai.value,
          ai_permission_evidence: aiEvidence.value.trim() || null,
        },
        "PATCH",
      );
    });
    panel.append(
      R.node("h3", "Разрешение на публикацию"),
      R.node(
        "p",
        "Сохранение разрешений не запускает сбор сообщений. Публикация требует отдельного согласия.",
      ),
    );
    const publication = R.node("form", null, "radar-form");
    panel.append(publication);
    const permission = field(
        publication,
        "Публикация",
        s.publication_permission,
        ["pending", "approved", "denied"],
      ),
      proof = field(
        publication,
        "Подтверждение разрешения на публикацию",
        s.publication_evidence,
      ),
      why = reason(publication);
    submit(publication, "Сохранить разрешение на публикацию", () => {
      if (permission.value === "approved" && !proof.value.trim()) {
        note("Укажите подтверждение разрешения.");
        return;
      }
      mutate(
        `/sources/${s.id}/publication-permission`,
        {
          expected_revision: s.revision,
          permission: permission.value,
          evidence: proof.value.trim() || null,
          reason: why.value.trim(),
        },
        "PATCH",
      );
    });
    if (s.last_error)
      panel.append(R.node("p", "Последняя ошибка: " + s.last_error));
    panel.append(
      R.node(
        "p",
        `Последняя проверка: ${s.access_checked_at || "не выполнена"} · ${s.access_check_result || "—"}`,
      ),
    );
  }
  async function draftEditor(id) {
    const d = await read(() => api(`/drafts/${encodeURIComponent(id)}`));
    if (!d) return;
    const panel = editor(d.event.title);
    panel.append(
      R.node(
        "p",
        `#${d.id} · ${statuses[d.status]} · @${d.source.handle} · ревизия ${d.revision}`,
      ),
    );
    panel.append(R.card(d.event, true));
    const original = R.node("details");
    original.append(
      R.node("summary", "Оригинал сообщения"),
      R.node("pre", d.text),
    );
    panel.append(original);
    const blockers = {
      INVALID_OR_UNGROUNDED_EVENT: "Поля не подтверждены исходным текстом",
      STALE_MESSAGE_REVISION: "Исходный пост изменился",
      SOURCE_PERMISSION_REQUIRED: "Нужны разрешения источника",
      START_TIME_REQUIRED: "Не указано время",
      EVENT_IN_PAST: "Событие уже прошло",
      VENUE_REQUIRED: "Не указано место",
      EVENT_CANCELLED: "Событие отменено",
      ANNOUNCEMENT_STATUS_UNKNOWN: "Статус события неизвестен",
    };
    panel.append(
      R.node(
        "p",
        d.verification.canAccept
          ? "Проверка соответствия исходному тексту пройдена. Это не независимое подтверждение мероприятия."
          : d.verification.blockers.map((b) => blockers[b] || b).join(" · "),
      ),
    );
    if (d.duplicate_of)
      panel.append(
        button("Открыть основной черновик #" + d.duplicate_of, () =>
          draftEditor(d.duplicate_of),
        ),
      );
    const quick = R.node("div", null, "radar-actions");
    if (d.status === "needs_review" && d.verification.canAccept)
      quick.append(
        button("Одобрить", () =>
          mutate(
            `/drafts/${d.id}/review`,
            {
              expected_revision: d.revision,
              decision: "accepted",
              reason: "Администратор одобрил событие после просмотра карточки.",
            },
            "PATCH",
          ),
        ),
      );
    if (d.status === "needs_review")
      quick.append(
        button("Отклонить", () =>
          mutate(
            `/drafts/${d.id}/review`,
            {
              expected_revision: d.revision,
              decision: "rejected",
              reason:
                "Администратор отклонил событие после просмотра карточки.",
            },
            "PATCH",
          ),
        ),
      );
    panel.append(quick);
    const editing = R.node("details");
    editing.append(R.node("summary", "Редактировать поля и подтверждения"));
    const form = R.node("form", null, "radar-form");
    editing.append(form);
    panel.append(editing);
    const title = field(form, "Название", d.event.title);
    title.required = true;
    title.maxLength = 200;
    const category = field(form, "Категория", d.event.category, R.categories);
    const announcement = field(
      form,
      "Статус анонса",
      d.event.announcement_status,
      ["scheduled", "rescheduled", "cancelled", "unknown"],
    );
    function dateField(label, value) {
      const wrap = R.node("label", label),
        input = R.node("input");
      input.type = "datetime-local";
      input.step = "1";
      input.value = value ? value.replace(/\+05:00$/, "") : "";
      wrap.append(input);
      form.append(wrap);
      return input;
    }
    const start = dateField("Начало · время Ташкента", d.event.starts_at);
    const end = dateField(
      "Окончание · время Ташкента (необязательно)",
      d.event.ends_at,
    );
    const timestamp = (input) =>
      input.value
        ? input.value + (input.value.length === 16 ? ":00" : "") + "+05:00"
        : null;
    const venue = field(form, "Место", d.event.venue),
      amount = field(
        form,
        "Стоимость · пусто, если неизвестна",
        d.event.price?.amount,
      ),
      currency = field(form, "Валюта", d.event.price?.currency || "UZS", [
        "UZS",
        "USD",
      ]);
    const registration = field(
      form,
      "Ссылка на регистрацию",
      d.event.registration_url,
    );
    const quotes = {};
    for (const [key, label] of Object.entries({
      title: "название",
      date: "дата",
      venue: "место",
      price: "цена",
    }))
      quotes[key] = field(
        form,
        "Дословная цитата: " + label,
        d.event.evidence[key],
      );
    quotes.title.required = true;
    const decision = field(
      form,
      "Решение",
      d.status === "duplicate" ? "needs_review" : d.status,
      ["needs_review", "accepted", "rejected"],
    );
    const why = reason(form);
    submit(form, "Сохранить решение", () => {
      const event = {
        title: title.value.trim(),
        category: category.value,
        announcement_status: announcement.value,
        timezone: "Asia/Tashkent",
        starts_at: timestamp(start),
        ends_at: timestamp(end),
        venue: venue.value.trim() || null,
        price:
          amount.value.trim() === ""
            ? null
            : { amount: Number(amount.value), currency: currency.value },
        registration_url: registration.value.trim() || null,
        evidence: Object.fromEntries(
          Object.entries(quotes).map(([k, v]) => [k, v.value.trim() || null]),
        ),
      };
      if (
        (event.price &&
          (!Number.isFinite(event.price.amount) || event.price.amount < 0)) ||
        [event.starts_at, event.ends_at].some(
          (v) =>
            v && (!v.endsWith("+05:00") || !Number.isFinite(Date.parse(v))),
        )
      ) {
        note("Проверьте цену и даты. Используйте часовой пояс +05:00.");
        return;
      }
      mutate(
        `/drafts/${d.id}/review`,
        {
          expected_revision: d.revision,
          decision: decision.value,
          reason: why.value.trim(),
          event,
        },
        "PATCH",
      );
    });
    panel.append(
      button("Найти возможные дубликаты", async () => {
        const result = await read(() => api(`/drafts/${d.id}/duplicates`));
        if (!result || !panel.isConnected) return;
        const matches = R.node("section");
        panel.append(matches);
        matches.append(R.node("h3", "Возможные дубликаты"));
        if (!result.candidates.length)
          matches.append(R.node("p", "Совпадений нет."));
        if (result.truncated)
          matches.append(R.node("p", "Показана только часть совпадений."));
        for (const c of result.candidates) {
          const f = R.node("form", null, "radar-form");
          f.append(
            R.node(
              "p",
              `#${c.id}: ${c.event.title} · ${c.event.starts_at} · ${c.event.venue}`,
            ),
          );
          matches.append(f);
          if (c.mergeable) {
            const r = reason(f);
            submit(f, "Связать как дубликат #" + c.id, () =>
              mutate(
                `/drafts/${d.id}/review`,
                {
                  expected_revision: d.revision,
                  decision: "duplicate",
                  duplicate_of: c.id,
                  target_expected_revision: c.revision,
                  reason: r.value.trim(),
                },
                "PATCH",
              ),
            );
          } else
            f.append(
              R.node(
                "p",
                "Связывание недоступно: " + (c.reasons || []).join(", "),
              ),
            );
        }
      }),
    );
    if (d.status === "accepted" && d.verification.canAccept) {
      const f = R.node("form", null, "radar-form");
      panel.append(
        R.node("h3", "Первая публикация"),
        R.node(
          "p",
          "Публикуется сохранённая версия. Сначала сохраните изменения выше. Для обновления существующей публикации откройте «Публикации».",
        ),
        f,
      );
      const r = reason(f);
      submit(f, "Опубликовать сохранённый черновик", () =>
        mutate(`/drafts/${d.id}/publish`, {
          expected_draft_revision: d.revision,
          expected_event_revision: 0,
          reason: r.value.trim(),
        }),
      );
    }
    audit(panel, d.history);
  }
  async function publicationEditor(id) {
    const detail = await read(() => api(`/events/${encodeURIComponent(id)}`));
    if (!detail) return;
    const e = detail.event;
    const panel = editor(e.event.title);
    panel.append(
      R.node(
        "p",
        `${statuses[e.status]} · ${e.visible ? "Виден пользователям" : "Не виден пользователям"} · ревизия ${e.revision}`,
      ),
      button("Открыть черновик", () => draftEditor(e.draft_id)),
    );
    const withdraw = R.node("form", null, "radar-form");
    panel.append(withdraw);
    const why = reason(withdraw);
    submit(withdraw, "Снять с публикации", () =>
      mutate(`/events/${e.id}/withdraw`, {
        expected_revision: e.revision,
        reason: why.value.trim(),
      }),
    );
    panel.append(
      button("Подготовить обновление публикации", async () => {
        const d = await read(() => api(`/drafts/${e.draft_id}`));
        if (!d || !panel.isConnected) return;
        const f = R.node("form", null, "radar-form");
        panel.append(f);
        f.append(R.card({ ...d.event, id: e.id }, true));
        if (d.status !== "accepted" || !d.verification.canAccept) {
          f.append(R.node("p", "Сначала примите актуальный черновик."));
          return;
        }
        const r = reason(f);
        submit(f, "Опубликовать эту версию", () =>
          mutate(`/drafts/${d.id}/publish`, {
            expected_draft_revision: d.revision,
            expected_event_revision: e.revision,
            reason: r.value.trim(),
          }),
        );
      }),
    );
    audit(panel, detail.history);
  }
  async function load() {
    const ticket = ++generation;
    note("Загружаем…");
    $("radar-list").replaceChildren();
    $("radar-editor").replaceChildren();
    $("radar-prev").disabled = true;
    $("radar-next").disabled = true;
    document
      .querySelectorAll("[data-section]")
      .forEach((b) =>
        b.setAttribute("aria-current", String(b.dataset.section === section)),
      );
    $("draft-filter-label").hidden = section !== "drafts";
    try {
      const result = await api("/" + section, {
        params: {
          limit: 20,
          offset,
          ...(section === "drafts" ? { status: $("draft-filter").value } : {}),
        },
      });
      if (ticket !== generation) return;
      const rows = result[section];
      for (const row of rows) {
        const card = R.node("article", null, "radar-card");
        card.append(
          R.node(
            "h2",
            section === "sources" ? "@" + row.handle : row.event.title,
          ),
        );
        card.append(
          R.node(
            "p",
            section === "sources"
              ? `${R.category(row.category)} · ${row.enabled ? "Включён" : "Выключен"} · ${statuses[row.collection_permission]}`
              : `#${row.id} · ${statuses[row.status]}${section === "events" ? " · " + (row.visible ? "Виден" : "Скрыт") : ""}`,
          ),
        );
        card.append(
          button("Открыть", () =>
            section === "sources"
              ? sourceEditor(row)
              : section === "drafts"
                ? draftEditor(row.id)
                : publicationEditor(row.id),
          ),
        );
        $("radar-list").append(card);
      }
      note(rows.length ? "" : "В этом разделе пока нет записей.");
      $("radar-page").textContent = String(offset / 20 + 1);
      $("radar-prev").disabled = offset === 0;
      $("radar-next").disabled = rows.length < 20;
    } catch (e) {
      if (ticket === generation) note(R.error(e));
    }
  }
  document.querySelectorAll("[data-section]").forEach((b) =>
    b.addEventListener("click", () => {
      section = b.dataset.section;
      offset = 0;
      load();
    }),
  );
  $("draft-filter").addEventListener("change", () => {
    offset = 0;
    load();
  });
  $("radar-retry").addEventListener("click", load);
  $("radar-prev").addEventListener("click", () => {
    offset = Math.max(0, offset - 20);
    load();
  });
  $("radar-next").addEventListener("click", () => {
    offset += 20;
    load();
  });
  (async () => {
    try {
      UyDosh.initTelegramMiniApp?.();
      if (!(await UyDosh.ensureTelegramMiniAppSession()) || !UyDosh.isAdmin()) {
        note("Доступ только для администратора. Откройте Mini App в Telegram.");
        return;
      }
      $("radar-admin").hidden = false;
      await load();
    } catch (e) {
      note(R.error(e));
    }
  })();
})();
