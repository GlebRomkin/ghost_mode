# GM — Ghost Mode

Ежедневник с делами, статистикой, фокус-таймером, альбомом мыслей и достижениями.
Разработано [Veraxis](https://veraxis-h0kw.onrender.com/).

## Структура

```
index.html            — разметка страницы
sw.js                 — service worker: push-уведомления при закрытом сайте
manifest.webmanifest  — установка как приложения (иконка, название)
css/styles.css        — все стили и 5 цветовых тем
js/auth.js            — вход, регистрация, подтверждение почты, сброс пароля, синхронизация
js/core.js            — данные, даты, экран «День», список дел
js/stats.js           — статистика и диаграммы
js/profile.js         — профиль, аватары, достижения, альбом, напоминания
js/push.js            — подписка на push и серверные напоминания
js/main.js            — серия, календарь, заметки, таймер фокуса
js/social.js          — друзья, заявки, поиск, Тандем, общий альбом, рейтинг
js/quests.js          — ежедневные квесты
js/import.js          — безопасный импорт дел из .txt
js/settings.js        — настройки профиля, темы, закреплённая панель вкладок
js/tour.js            — обучение при первом входе
supabase/*.sql        — схема базы (запускать по порядку: schema → social → duo_album → friends_push)
supabase/functions/   — серверная функция send-push
supabase/email/       — шаблоны писем (подтверждение почты, новый пароль)
assets/               — иконки
```

Сервер — Supabase (база, вход, push). Инструкция по настройке — `supabase/НАСТРОЙКА.md`.

## Публикация на Render

1. Залить эту папку в репозиторий на GitHub.
2. На render.com: **New → Static Site** → выбрать репозиторий.
3. Build Command — оставить пустым, Publish Directory — `.`
4. Deploy. После каждого `git push` сайт обновляется сам.

(Либо **New → Blueprint** — Render сам возьмёт настройки из `render.yaml`.)
