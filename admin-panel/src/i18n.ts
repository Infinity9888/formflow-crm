import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  uk: {
    translation: {
      auth: {
        title: "Вхід в систему",
        subtitle: "Увійдіть, щоб отримати доступ до CRM",
        email: "Електронна пошта",
        password: "Пароль",
        login_btn: "Увійти за паролем",
        or_continue: "або продовжити через",
        google_btn: "Увійти через Google",
        apple_btn: "Увійти через Apple",
        error: "Помилка авторизації. Перевірте дані."
      },
      dashboard: {
        title: "Панель CRM",
        subtitle: "Управління вхідними заявками",
        new_leads: "Нові заявки",
        in_progress: "В роботі",
        completed: "Завершені",
        total_leads: "Всього лідів",
        waiting: "Очікують обробки",
        talking: "В процесі спілкування",
        done: "Успішно закриті",
        all_time: "За весь час",
        logout: "Вийти",
        view_list: "Список",
        view_kanban: "За статусами"
      },
      table: {
        title: "Список заявок",
        desc: "Натисніть на рядок, щоб відкрити деталі заявки.",
        showing: "Показано {{count}} з {{total}}",
        col_status: "Статус",
        col_date: "Дата",
        col_details: "Деталі заявки",
        col_actions: "Дії",
        loading: "Завантаження заявок...",
        empty: "Поки немає жодної заявки.",
        no_results: "Нічого не знайдено за вашим запитом.",
        change_status: "Змінити статус",
        just_now: "Щойно",
        more_fields: "полів"
      },
      status: {
        new: "Новий",
        in_progress: "В роботі",
        completed: "Завершено",
        rejected: "Відхилено"
      },
      dialog: {
        title: "Видалити заявку?",
        desc: "Ця дія незворотня. Заявку буде назавжди видалено з бази даних.",
        cancel: "Скасувати",
        confirm: "Так, видалити",
        deleting: "Видалення..."
      },
      search: {
        placeholder: "Пошук за ім'ям, телефоном...",
        filter_status: "Фільтр за статусом",
        all: "Усі статуси",
        filter_client: "Сайт / Клієнт",
        all_clients: "Усі сайти",
        export_csv: "Експорт у CSV"
      },
      detail: {
        title: "Деталі заявки",
        form_data: "Дані форми",
        source: "Джерело",
        notes: "Нотатки",
        notes_placeholder: "Додайте нотатку... (напр. 'Передзвонити о 15:00')",
        save_notes: "Зберегти нотатки",
        saving: "Збереження...",
        quick_connect: "Швидкий зв'язок",
        copied: "Скопійовано!",
        no_notes: "Нотаток немає"
      },
      kanban: {
        no_leads: "Немає заявок",
        move_left: "Назад",
        move_right: "Вперед"
      },
      notifications: {
        new_lead: "🔔 Нова заявка!",
        enabled: "Сповіщення увімкнено",
        disabled: "Сповіщення вимкнено"
      },
      theme: {
        light: "Світла",
        dark: "Темна",
        system: "Системна"
      },
      setup: {
        title: "Прив'язка сайту до акаунту",
        desc: "Щоб переглядати заявки, ваш акаунт має бути пов'язаний з ідентифікатором вашого сайту (Client ID).",
        select_existing: "Вибрати існуючий сайт з бази даних",
        or_create_new: "Або ввести новий ідентифікатор сайту",
        client_placeholder: "наприклад: whitefox",
        role_admin_opt: "Увійти в режим адміністратора платформи",
        save_btn: "Зберегти та продовжити",
        change_link: "Змінити сайт",
        current_site: "Сайт",
        enter_key: "Введіть секретний ключ доступу",
        key_placeholder: "Секретний ключ (8 символів)",
        master_key: "Введіть майстер-ключ адміністратора",
        master_placeholder: "Майстер-ключ",
        invalid_key: "❌ Неправильний секретний ключ доступу!",
        invalid_master: "❌ Неправильний майстер-ключ адміністратора!",
        new_key_title: "🎉 Сайт успішно створено!",
        new_key_desc: "Збережіть цей секретний ключ для доступу інших пристроїв/користувачів до цього сайту:",
        continue_btn: "Продовжити до панелі",
        add_site_btn: "+ Додати ще один сайт",
        site_id_label: "Ідентифікатор сайту (Client ID)",
        site_type_new: "Створити новий",
        site_type_existing: "Прив'язати існуючий",
        remove_site: "Видалити"
      }
    }
  },
  ru: {
    translation: {
      auth: {
        title: "Вход в систему",
        subtitle: "Войдите, чтобы получить доступ к CRM",
        email: "Электронная почта",
        password: "Пароль",
        login_btn: "Войти по паролю",
        or_continue: "или продолжить через",
        google_btn: "Войти через Google",
        apple_btn: "Войти через Apple",
        error: "Ошибка авторизации. Проверьте данные."
      },
      dashboard: {
        title: "Панель CRM",
        subtitle: "Управление входящими заявками",
        new_leads: "Новые заявки",
        in_progress: "В работе",
        completed: "Завершенные",
        total_leads: "Всего лидов",
        waiting: "Ожидают обработки",
        talking: "В процессе общения",
        done: "Успешно закрыты",
        all_time: "За все время",
        logout: "Выйти",
        view_list: "Список",
        view_kanban: "По статусам"
      },
      table: {
        title: "Список заявок",
        desc: "Нажмите на строку, чтобы открыть детали заявки.",
        showing: "Показано {{count}} из {{total}}",
        col_status: "Статус",
        col_date: "Дата",
        col_details: "Детали заявки",
        col_actions: "Действия",
        loading: "Загрузка заявок...",
        empty: "Пока нет ни одной заявки.",
        no_results: "Ничего не найдено по вашему запросу.",
        change_status: "Изменить статус",
        just_now: "Только что",
        more_fields: "полей"
      },
      status: {
        new: "Новый",
        in_progress: "В работе",
        completed: "Завершен",
        rejected: "Отклонен"
      },
      dialog: {
        title: "Удалить заявку?",
        desc: "Это действие необратимо. Заявка будет навсегда удалена из базы данных.",
        cancel: "Отмена",
        confirm: "Да, удалить",
        deleting: "Удаление..."
      },
      search: {
        placeholder: "Поиск по имени, телефону...",
        filter_status: "Фильтр по статусу",
        all: "Все статусы",
        filter_client: "Сайт / Клиент",
        all_clients: "Все сайты",
        export_csv: "Экспорт в CSV"
      },
      detail: {
        title: "Детали заявки",
        form_data: "Данные формы",
        source: "Источник",
        notes: "Заметки",
        notes_placeholder: "Добавьте заметку... (напр. 'Перезвонить в 15:00')",
        save_notes: "Сохранить заметки",
        saving: "Сохранение...",
        quick_connect: "Быстрая связь",
        copied: "Скопировано!",
        no_notes: "Заметок нет"
      },
      kanban: {
        no_leads: "Нет заявок",
        move_left: "Назад",
        move_right: "Вперед"
      },
      notifications: {
        new_lead: "🔔 Новая заявка!",
        enabled: "Уведомления включены",
        disabled: "Уведомления выключены"
      },
      theme: {
        light: "Светлая",
        dark: "Тёмная",
        system: "Системная"
      },
      setup: {
        title: "Привязка сайта к аккаунту",
        desc: "Чтобы просматривать заявки, ваш аккаунт должен быть связан с идентификатором вашего сайта (Client ID).",
        select_existing: "Выбрать существующий сайт из базы данных",
        or_create_new: "Или ввести новый идентификатор сайта",
        client_placeholder: "например: whitefox",
        role_admin_opt: "Войти в режим администратора платформы",
        save_btn: "Сохранить и продолжить",
        change_link: "Сменить сайт",
        current_site: "Сайт",
        enter_key: "Введите секретный ключ доступа",
        key_placeholder: "Секретный ключ (8 символов)",
        master_key: "Введите мастер-ключ администратора",
        master_placeholder: "Мастер-ключ",
        invalid_key: "❌ Неверный секретный ключ доступа!",
        invalid_master: "❌ Неверный мастер-ключ администратора!",
        new_key_title: "🎉 Сайт успешно создан!",
        new_key_desc: "Сохраните этот секретный ключ для доступа других устройств/пользователей к этому сайту:",
        continue_btn: "Перейти к панели",
        add_site_btn: "+ Добавить еще один сайт",
        site_id_label: "Идентификатор сайта (Client ID)",
        site_type_new: "Создать новый",
        site_type_existing: "Привязать существующий",
        remove_site: "Удалить"
      }
    }
  },
  en: {
    translation: {
      auth: {
        title: "Sign In",
        subtitle: "Log in to access your CRM",
        email: "Email address",
        password: "Password",
        login_btn: "Sign in with password",
        or_continue: "or continue with",
        google_btn: "Sign in with Google",
        apple_btn: "Sign in with Apple",
        error: "Authentication failed. Check your credentials."
      },
      dashboard: {
        title: "CRM Panel",
        subtitle: "Manage incoming leads",
        new_leads: "New Leads",
        in_progress: "In Progress",
        completed: "Completed",
        total_leads: "Total Leads",
        waiting: "Waiting for action",
        talking: "Currently talking",
        done: "Successfully closed",
        all_time: "All time",
        logout: "Log out",
        view_list: "List View",
        view_kanban: "By Status"
      },
      table: {
        title: "Leads List",
        desc: "Click on a row to open lead details.",
        showing: "Showing {{count}} of {{total}}",
        col_status: "Status",
        col_date: "Date",
        col_details: "Lead Details",
        col_actions: "Actions",
        loading: "Loading leads...",
        empty: "No leads found.",
        no_results: "No results match your search.",
        change_status: "Change status",
        just_now: "Just now",
        more_fields: "more fields"
      },
      status: {
        new: "New",
        in_progress: "In Progress",
        completed: "Completed",
        rejected: "Rejected"
      },
      dialog: {
        title: "Delete lead?",
        desc: "This action cannot be undone. The lead will be permanently deleted.",
        cancel: "Cancel",
        confirm: "Yes, delete",
        deleting: "Deleting..."
      },
      search: {
        placeholder: "Search by name, phone...",
        filter_status: "Filter by status",
        all: "All statuses",
        filter_client: "Site / Client",
        all_clients: "All sites",
        export_csv: "Export to CSV"
      },
      detail: {
        title: "Lead Details",
        form_data: "Form Data",
        source: "Source",
        notes: "Notes",
        notes_placeholder: "Add a note... (e.g. 'Call back at 3 PM')",
        save_notes: "Save notes",
        saving: "Saving...",
        quick_connect: "Quick Connect",
        copied: "Copied!",
        no_notes: "No notes"
      },
      kanban: {
        no_leads: "No leads",
        move_left: "Back",
        move_right: "Forward"
      },
      notifications: {
        new_lead: "🔔 New lead!",
        enabled: "Notifications enabled",
        disabled: "Notifications disabled"
      },
      theme: {
        light: "Light",
        dark: "Dark",
        system: "System"
      },
      setup: {
        title: "Link Website to Account",
        desc: "To view leads, your account must be associated with a Client ID.",
        select_existing: "Select an existing website from database",
        or_create_new: "Or enter a new Client ID",
        client_placeholder: "e.g. whitefox",
        role_admin_opt: "Enter platform administrator mode",
        save_btn: "Save and Continue",
        change_link: "Change site",
        current_site: "Site",
        enter_key: "Enter secret access key",
        key_placeholder: "Secret key (8 characters)",
        master_key: "Enter administrator master key",
        master_placeholder: "Master key",
        invalid_key: "❌ Incorrect secret access key!",
        invalid_master: "❌ Incorrect administrator master key!",
        new_key_title: "🎉 Website successfully registered!",
        new_key_desc: "Save this secret key for other devices/users to access this website:",
        continue_btn: "Continue to dashboard",
        add_site_btn: "+ Add another website",
        site_id_label: "Website ID (Client ID)",
        site_type_new: "Create new",
        site_type_existing: "Link existing",
        remove_site: "Remove"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'uk',
    interpolation: {
      escapeValue: false,
    }
  });

export default i18n;
