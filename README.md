# Layout Generator

Интерактивный генератор композиций из квадратов с обводкой и цветных блоков.

## Возможности

- Настраиваемый размер холста (до 1920×1080)
- Регулируемое количество цветных квадратов
- Пользовательский текст для двух обведённых квадратов
- Настраиваемый размер шрифта
- Кнопка Random для пересборки композиции

## Локальный запуск

Скачайте файлы и откройте `index.html` в браузере. Никакой сборки не требуется.

```bash
# Или запустите локальный сервер (не обязательно):
python3 -m http.server 8000
# Откройте http://localhost:8000
```

## Публикация на GitHub Pages

### Через веб-интерфейс GitHub

1. Создайте новый репозиторий на [github.com/new](https://github.com/new), например `layout-generator`.
2. На странице нового репозитория нажмите **"uploading an existing file"** и загрузите все 4 файла (`index.html`, `styles.css`, `app.js`, `README.md`).
3. Зафиксируйте изменения (Commit).
4. Перейдите в **Settings → Pages**.
5. В разделе **Source** выберите ветку **main** и папку **/ (root)**, затем **Save**.
6. Через 1–2 минуты ваш сайт будет доступен по адресу:
   `https://<ваш-логин>.github.io/layout-generator/`

### Через командную строку

```bash
# В папке проекта
git init
git add .
git commit -m "Initial commit"
git branch -M main

# Замените YOUR_USERNAME на ваш логин GitHub
git remote add origin https://github.com/YOUR_USERNAME/layout-generator.git
git push -u origin main
```

Затем повторите шаги 4–6 из инструкции выше, чтобы включить GitHub Pages.

## Структура

```
layout-generator/
├── index.html    # разметка и элементы управления
├── styles.css    # стили
├── app.js        # логика генерации
└── README.md
```
