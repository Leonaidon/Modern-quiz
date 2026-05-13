/**
 * Telegram Web App — квиз с переменными-результатами.
 *
 * @typedef {{ id: string, title: string, description?: string, source: 'official'|'community', resultTexts?: Record<string, string>, questions: Array<{ text: string, answers: Array<{ text: string, scores: Record<string, number> }> }> }} Quiz
 */

import {
  getFirestoreDb,
  subscribeQuizzes,
  saveQuizRemote,
  deleteQuizRemote,
  migrateLocalToFirestoreOnce,
} from './firebase-quiz.js';

const STORAGE_KEY = 'twa_quiz_community_v1';

/** @type {(() => void) | null} */
let unsubscribeCommunity = null;

/** @type {Quiz[]} */
const OFFICIAL_QUIZZES = [

  {
    id: 'meme-knowledge-pro',
    title: '🧠 Экзамен по Мемологии',
    description: 'Кто ты: легендарный олд, мемный эксперт или просто нормис.',
    source: 'official',
    resultTexts: {
      old: 'Древний Шифр. Ты помнишь мемы, которые еще высекали на камнях. Твой уровень иронии запределен.',
      expert: 'Мемный Сомелье. Ты в курсе всех трендов и не путаешь постиронию с шизопостингом. Уважаемо.',
      normie: 'Типичный Нормис. Твои любимые мемы — картинки с котами из 2017-го. Ну, хотя бы ты счастливый человек.',
      underground: 'Гений Абсурда. Твои мемы не понимает никто, даже ты сам. Ты живешь на 10 слоях иронии.'
    },
    questions: [
      {
        text: 'Какое число самое смешное?',
        answers: [
          { text: '69 (Nice)', scores: { normie: 5, expert: 2 } },
          { text: '1488 (Осуждаю, но мем помню)', scores: { old: 5, expert: 1 } },
          { text: '1000-7 (Я гуль)', scores: { expert: 5, underground: 2 } },
          { text: '52 (Да здравствует Санкт-Петербург!)', scores: { expert: 5, normie: 1 } },
          { text: '42 (Ответ на вопрос жизни)', scores: { old: 4, underground: 2 } }
        ]
      },
      {
        text: 'Рикардо Милос — это...',
        answers: [
          { text: 'Известный бразильский танцор (серьезно)', scores: { normie: 5 } },
          { text: 'Символ эпохи и эталон мужской красоты в бандане', scores: { old: 5, expert: 2 } },
          { text: 'Персонаж из Гачимучи (deep dark fantasies)', scores: { old: 3, expert: 5 } },
          { text: 'Мой батя', scores: { underground: 5 } }
        ]
      },
      {
        text: 'В чем сила, брат?',
        answers: [
          { text: 'В правде', scores: { normie: 5, old: 1 } },
          { text: 'В ньюфагах', scores: { expert: 5 } },
          { text: 'В гигачадах и скуфах', scores: { expert: 3, normie: 2 } },
          { text: 'Сила в массе, умноженной на ускорение', scores: { underground: 5 } }
        ]
      },
      {
        text: 'Какое животное самое вежливое в мемах?',
        answers: [
          { text: 'Кот, который просит рыбов', scores: { expert: 5, normie: 2 } },
          { text: 'Шлёпа (большой русский кот)', scores: { expert: 4, old: 2 } },
          { text: 'Доге (тот самый сиба-ину)', scores: { old: 5, normie: 1 } },
          { text: 'Капибара (она просто чиллит)', scores: { expert: 3, normie: 4 } }
        ]
      },
      {
        text: 'Что такое "Альт-ушка"?',
        answers: [
          { text: 'Новая модель наушников', scores: { normie: 5 } },
          { text: 'Стиль жизни, скуфы поймут', scores: { expert: 5 } },
          { text: 'Персонаж из доты', scores: { expert: 1, normie: 2 } },
          { text: 'Это состояние души после 3-х часов в тиктоке', scores: { underground: 5, expert: 2 } }
        ]
      }
    ]
  },
  {
    id: 'dog-master-test',
    title: '🐕 Кто ты из собак на самом деле?',
    description: 'Глубокий психологический разбор: от элитных пород до фанатов Геншина.',
    source: 'official',
    resultTexts: {
      doberman: 'Вы — Доберман. Элита, грация и стальные нервы. Выглядите дорого, кусаете больно.',
      samoyed: 'Вы — Самоед. Облако оптимизма. Ваша главная суперспособность — делать вид, что вы не понимаете команду "Фу".',
      minecraft: 'Вы — Собака из Майнкрафта. Квадратный, верный и сидите на одном месте годами, пока хозяин не зайдет в онлайн.',
      slouchy: 'Вы — Сутулая собака. Легенда мемов. Ваша спина — знак вопроса, ваш девиз — "Ну и ладно".',
      life_dog: 'Вы — Собака по жизни. Тяжелая судьба, вечный поиск косточки и грустные глаза в очереди за шаурмой.'
    },
    questions: [
      {
        text: 'Ваш обычный уровень энергии в 2 часа дня?',
        answers: [
          { text: 'Готов бежать за лисой через лес', scores: { doberman: 5, samoyed: 2 } },
          { text: 'Радостно прыгаю на месте без причины', scores: { samoyed: 5, minecraft: 1 } },
          { text: 'Сижу и жду команды', scores: { minecraft: 5 } },
          { text: 'Ищу, на что бы облокотиться, чтобы не упасть', scores: { slouchy: 5, life_dog: 2 } },
          { text: 'Смотрю в пустоту с экзистенциальным кризисом', scores: { life_dog: 5, slouchy: 2 } }
        ]
      },
      {
        text: 'Что вы сделаете, если увидите врага?',
        answers: [
          { text: 'Рыкну так, что он сменит фамилию', scores: { doberman: 5 } },
          { text: 'Залижу его до смерти', scores: { samoyed: 5 } },
          { text: 'Начну телепортироваться за спину', scores: { minecraft: 5 } },
          { text: 'Сутуло уйду в закат', scores: { slouchy: 5 } },
          { text: 'Попрошу мелочи на пропитание', scores: { life_dog: 5 } }
        ]
      },
      {
        text: 'Ваше идеальное жилье?',
        answers: [
          { text: 'Минималистичный особняк с охраной', scores: { doberman: 5 } },
          { text: 'Снежная равнина и куча снега', scores: { samoyed: 5 } },
          { text: 'Будка из 4-х блоков дуба', scores: { minecraft: 5 } },
          { text: 'Кресло, в котором можно свернуться в букву "С"', scores: { slouchy: 5 } },
          { text: 'Где ночь застанет, там и дом', scores: { life_dog: 5 } }
        ]
      },
      {
        text: 'Как вы относитесь к парикмахерским?',
        answers: [
          { text: 'Только лучший груминг-салон', scores: { doberman: 2, samoyed: 4 } },
          { text: 'Меня стрижет админ ножницами', scores: { minecraft: 5 } },
          { text: 'Расческа? Это инструмент пыток?', scores: { slouchy: 5, life_dog: 3 } },
          { text: 'Я сам себе парикмахер (вылизываюсь)', scores: { life_dog: 5 } }
        ]
      },
      {
        text: 'Ваш девиз по жизни?',
        answers: [
          { text: 'Властвуй и доминируй', scores: { doberman: 5 } },
          { text: 'Гав-гав! Все друзья!', scores: { samoyed: 5 } },
          { text: 'Гав! (Хруст кости)', scores: { minecraft: 5 } },
          { text: 'Спина болит, но я держусь', scores: { slouchy: 5 } },
          { text: 'Работаю за еду и поглаживания', scores: { life_dog: 5 } }
        ]
      }
    ]
  },
  {
    id: 'subscriber-check',
    title: '🚩 Тест на хорошего подписчика',
    description: 'Насколько ты лоялен системе? Проверка на благонадежность.',
    source: 'official',
    resultTexts: {
      zealot: 'Преданный Фанатик. Ваша вера в контент абсолютна. Админ вами гордится.',
      lurker: 'Тихий Наблюдатель. Вы смотрите всё, но не оставляете следов. Мы за вами следим.',
      foreign_agent: 'Иноагент. Вы подписаны на конкурентов и не ставите лайки. Подозрительно.',
      rebel: 'Мятежник. Вы пишете "первый" и "отписался" под каждым постом. Хаос — ваша стихия.'
    },
    questions: [
      {
        text: 'Колокольчик уведомлений включен?',
        answers: [
          { text: 'Включен на все публикации и сторис!', scores: { zealot: 5 } },
          { text: 'Включен, но я его боюсь', scores: { lurker: 3, zealot: 1 } },
          { text: 'Выключен, я люблю сюрпризы', scores: { foreign_agent: 5 } },
          { text: 'Я сам решаю, когда смотреть!', scores: { rebel: 5 } }
        ]
      },
      {
        text: 'Ваша реакция на рекламный пост?',
        answers: [
          { text: 'Покупаю сразу два, чтобы поддержать автора', scores: { zealot: 5 } },
          { text: 'Быстро пролистываю, делая вид, что не видел', scores: { lurker: 5 } },
          { text: 'Пишу в комментариях, что автор продался', scores: { rebel: 5, foreign_agent: 2 } },
          { text: 'Скидываю ссылку конкурентам', scores: { foreign_agent: 5 } }
        ]
      },
      {
        text: 'Как часто вы ставите лайки?',
        answers: [
          { text: 'Автоматически, даже не глядя на пост', scores: { zealot: 5 } },
          { text: 'Раз в год по обещанию', scores: { lurker: 5, foreign_agent: 1 } },
          { text: 'Только если пост реально шедевр (никогда)', scores: { foreign_agent: 5, rebel: 2 } },
          { text: 'Ставлю лайк, а потом сразу убираю', scores: { rebel: 5 } }
        ]
      },
      {
        text: 'Вы состоите в других похожих сообществах?',
        answers: [
          { text: 'Нет, это моя единственная любовь', scores: { zealot: 5 } },
          { text: 'Я просто мимо проходил', scores: { lurker: 5 } },
          { text: 'Я там в администрации', scores: { foreign_agent: 5 } },
          { text: 'Состою везде, чтобы везде спорить', scores: { rebel: 5 } }
        ]
      },
      {
        text: 'Что вы скажете другу про этот канал?',
        answers: [
          { text: 'Это лучшее, что есть в интернете!', scores: { zealot: 5 } },
          { text: 'Ничего, я интроверт', scores: { lurker: 5 } },
          { text: 'Скажу, что раньше было лучше', scores: { rebel: 5, foreign_agent: 1 } },
          { text: 'Скину жалобу на канал', scores: { foreign_agent: 5 } }
        ]
      }
    ]
  }
];

function initTelegram() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  tg.ready();
  tg.expand?.();
  document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams?.bg_color || '#0f172a');
}

/** Парсинг строки баллов: JSON или список key:+n */
function parseScoresInput(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return {};
  try {
    const j = JSON.parse(s);
    if (j && typeof j === 'object' && !Array.isArray(j)) {
      const out = {};
      for (const [k, v] of Object.entries(j)) {
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        out[String(k).trim()] = n;
      }
      return out;
    }
  } catch {
    /* fallthrough */
  }
  const out = {};
  const parts = s.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^([^:]+):\s*([+-]?\d+(?:\.\d+)?)$/);
    if (m) {
      const key = m[1].trim();
      const val = Number(m[2]);
      if (key && Number.isFinite(val)) out[key] = val;
    }
  }
  return out;
}

/** Парсинг блока «ключ | текст» */
function parseResultTextsBlock(text) {
  const lines = String(text ?? '').split('\n');
  const map = {};
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const sep = t.indexOf('|');
    if (sep === -1) continue;
    const key = t.slice(0, sep).trim();
    const msg = t.slice(sep + 1).trim();
    if (key) map[key] = msg;
  }
  return map;
}

function loadCommunity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveCommunity(quizzes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quizzes));
}

/** Локальный кэш: добавить или заменить по id */
function upsertLocalQuiz(quiz) {
  const list = loadCommunity().filter((x) => x.id !== quiz.id);
  list.unshift(quiz);
  saveCommunity(list);
}

function setCommunityStatus(text, variant = 'muted') {
  const el = document.getElementById('community-sync-status');
  if (!el) return;
  el.textContent = text;
  if (variant === 'error') {
    el.className = 'text-xs text-amber-400';
  } else if (variant === 'ok') {
    el.className = 'text-xs text-emerald-400/90';
  } else {
    el.className = 'text-xs text-slate-500';
  }
}

function quizCard(quiz, onPlay, onDelete) {
  const el = document.createElement('div');
  el.className =
    'rounded-2xl border border-white/5 bg-card p-4 shadow-inner transition hover:border-violet-500/20 hover:shadow-glow';
  el.innerHTML = `
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 class="font-semibold text-white">${escapeHtml(quiz.title)}</h3>
        <p class="mt-1 text-sm text-slate-400 line-clamp-2">${escapeHtml(quiz.description || '')}</p>
        <p class="mt-2 text-xs text-slate-500">${quiz.questions?.length ?? 0} вопросов · ${quiz.source === 'official' ? 'официально' : 'сообщество'}</p>
      </div>
      <div class="flex shrink-0 gap-2 pt-2 sm:pt-0">
        ${onDelete ? `<button type="button" class="btn-del rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 hover:border-rose-500/40 hover:text-rose-300">Удалить</button>` : ''}
        <button type="button" class="btn-play rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:opacity-95">Играть</button>
      </div>
    </div>
  `;
  el.querySelector('.btn-play')?.addEventListener('click', () => onPlay(quiz));
  el.querySelector('.btn-del')?.addEventListener('click', () => onDelete(quiz));
  return el;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* --- Tabs --- */
function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  function activate(name) {
    buttons.forEach((b) => {
      const active = b.getAttribute('data-tab') === name;
      b.classList.toggle('tab-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach((p) => {
      p.classList.toggle('hidden', p.getAttribute('data-panel') !== name);
    });
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.getAttribute('data-tab')));
  });
  activate('official');
}

/* --- Create form --- */
const MAX_ANSWERS = 8;

function cloneTemplate(id) {
  const t = document.getElementById(id);
  return t.content.firstElementChild.cloneNode(true);
}

function addAnswerRow(container) {
  const rows = container.querySelectorAll('.answer-row');
  if (rows.length >= MAX_ANSWERS) return;
  const row = cloneTemplate('tpl-answer-row');
  container.appendChild(row);
}

function addQuestionBlock(container, index) {
  const block = cloneTemplate('tpl-question-block');
  block.querySelector('.question-index').textContent = `Вопрос ${index + 1}`;
  const answersWrap = block.querySelector('.answers-wrap');
  addAnswerRow(answersWrap);
  addAnswerRow(answersWrap);

  block.querySelector('.add-answer').addEventListener('click', () => addAnswerRow(answersWrap));

  block.querySelector('.remove-question').addEventListener('click', () => {
    const all = container.querySelectorAll('.question-block');
    if (all.length <= 1) return;
    block.remove();
    renumberQuestions(container);
  });

  container.appendChild(block);
  renumberQuestions(container);
}

function renumberQuestions(container) {
  container.querySelectorAll('.question-block').forEach((block, i) => {
    block.querySelector('.question-index').textContent = `Вопрос ${i + 1}`;
  });
}

function collectFormQuiz() {
  const form = document.getElementById('create-form');
  const title = form.title.value.trim();
  const description = form.description.value.trim();
  const resultTextsRaw = document.getElementById('result-texts').value;
  const resultTexts = parseResultTextsBlock(resultTextsRaw);

  const blocks = document.querySelectorAll('#questions-container .question-block');
  const questions = [];
  for (const block of blocks) {
    const qText = block.querySelector('.q-text').value.trim();
    const answerRows = block.querySelectorAll('.answer-row');
    const answers = [];
    for (const row of answerRows) {
      const text = row.querySelector('.a-text').value.trim();
      const scoresRaw = row.querySelector('.a-scores').value;
      const scores = parseScoresInput(scoresRaw);
      if (!text) continue;
      answers.push({ text, scores });
    }
    if (!qText || answers.length === 0) continue;
    questions.push({ text: qText, answers });
  }

  if (!title) throw new Error('Укажите название');
  if (questions.length === 0) throw new Error('Добавьте хотя бы один вопрос с ответами');

  return {
    id: `community-${Date.now()}`,
    title,
    description,
    source: 'community',
    resultTexts,
    questions,
  };
}

function setupCreateForm(onSaved) {
  const container = document.getElementById('questions-container');
  addQuestionBlock(container, 0);

  document.getElementById('add-question').addEventListener('click', () => {
    const n = container.querySelectorAll('.question-block').length;
    addQuestionBlock(container, n);
  });

  document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fb = document.getElementById('create-feedback');
    try {
      const quiz = collectFormQuiz();
      const dbOk = !!getFirestoreDb();
      if (dbOk) {
        await saveQuizRemote(quiz);
        upsertLocalQuiz(quiz);
        fb.textContent = 'Сохранено в облаке и в разделе «Сообщество».';
      } else {
        const list = loadCommunity();
        list.unshift(quiz);
        saveCommunity(list);
        fb.textContent = 'Сохранено локально (Firebase недоступен). Откройте список «Сообщество».';
        onSaved?.();
      }
      fb.classList.remove('hidden');
      fb.classList.remove('text-rose-400');
      fb.classList.add('text-emerald-400');
      setTimeout(() => fb.classList.add('hidden'), 3500);
    } catch (err) {
      fb.textContent = err.message || 'Ошибка';
      fb.classList.remove('hidden');
      fb.classList.remove('text-emerald-400');
      fb.classList.add('text-rose-400');
    }
  });

  document.getElementById('export-json').addEventListener('click', () => {
    try {
      const quiz = collectFormQuiz();
      const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${quiz.title.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert(err.message || 'Заполните форму для экспорта');
    }
  });
}

/* --- Play overlay --- */
function mergeScores(total, delta) {
  const next = { ...total };
  for (const [k, v] of Object.entries(delta)) {
    next[k] = (next[k] ?? 0) + v;
  }
  return next;
}

function winnerKeys(totals) {
  const entries = Object.entries(totals);
  if (entries.length === 0) return [];
  let max = -Infinity;
  for (const [, v] of entries) if (v > max) max = v;
  return entries.filter(([, v]) => v === max).map(([k]) => k);
}

function renderPlay(quiz) {
  const overlay = document.getElementById('play-overlay');
  const content = document.getElementById('play-content');
  const progress = document.getElementById('play-progress');

  let idx = 0;
  /** @type {Record<string, number>} */
  let totals = {};

  function showQuestion() {
    const q = quiz.questions[idx];
    progress.textContent = `${idx + 1} / ${quiz.questions.length}`;
    content.innerHTML = `
      <div class="flex flex-1 flex-col justify-center">
        <p class="mb-6 text-lg font-semibold leading-snug text-white">${escapeHtml(q.text)}</p>
        <div class="flex flex-col gap-3" id="answers-buttons"></div>
      </div>
    `;
    const wrap = content.querySelector('#answers-buttons');
    q.answers.forEach((ans, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'rounded-2xl border border-white/10 bg-card px-4 py-4 text-left text-sm font-medium text-slate-100 transition hover:border-violet-400/50 hover:bg-white/5 active:scale-[0.99]';
      btn.textContent = ans.text;
      btn.addEventListener('click', () => {
        totals = mergeScores(totals, ans.scores || {});
        idx += 1;
        if (idx < quiz.questions.length) showQuestion();
        else showResult();
      });
      wrap.appendChild(btn);
    });
  }

  function showResult() {
    const keys = winnerKeys(totals);
    progress.textContent = 'Результат';
    const texts = quiz.resultTexts || {};
    if (keys.length === 0) {
      content.innerHTML = `
        <div class="flex flex-1 flex-col justify-center py-6 text-center">
          <p class="text-slate-400">Нет начисленных баллов — проверьте поля «Баллы к результатам» у ответов.</p>
          <button type="button" id="play-empty-close" class="mt-8 rounded-2xl border border-white/15 py-3 text-sm font-semibold text-white hover:bg-white/5">Закрыть</button>
        </div>
      `;
      document.getElementById('play-empty-close').addEventListener('click', closePlay);
      return;
    }
    const lines = keys.map((k) => {
      const label = texts[k] ?? k;
      const pts = totals[k] ?? 0;
      return `<li class="rounded-xl border border-white/5 bg-card px-4 py-3"><span class="font-semibold text-violet-200">${escapeHtml(k)}</span> · ${pts} очков<p class="mt-2 text-sm text-slate-300">${escapeHtml(label)}</p></li>`;
    });

    const tieNote =
      keys.length > 1
        ? `<p class="mb-4 text-center text-xs text-amber-300/90">Несколько лидеров с одинаковым счётом.</p>`
        : '';

    content.innerHTML = `
      <div class="flex flex-1 flex-col justify-center py-4">
        <p class="mb-2 text-center text-xs font-bold uppercase tracking-widest text-cyan-400/90">Итог</p>
        ${tieNote}
        <ul class="flex flex-col gap-3">${lines.join('')}</ul>
        <button type="button" id="play-again" class="mt-8 rounded-2xl border border-white/15 py-3 text-sm font-semibold text-white hover:bg-white/5">Закрыть</button>
      </div>
    `;
    document.getElementById('play-again').addEventListener('click', () => closePlay());
  }

  function closePlay() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  document.getElementById('play-close').onclick = closePlay;

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  showQuestion();
}

function openPlay(quiz) {
  renderPlay(quiz);
}

function renderOfficialList() {
  const officialList = document.getElementById('official-list');
  officialList.innerHTML = '';
  OFFICIAL_QUIZZES.forEach((q) => {
    officialList.appendChild(quizCard(q, openPlay, null));
  });
}

function renderCommunityEmptyHint() {
  const communityList = document.getElementById('community-list');
  communityList.innerHTML =
    '<p class="rounded-2xl border border-dashed border-white/10 bg-card/50 px-4 py-8 text-center text-sm text-slate-500">Пока пусто — создайте тест во вкладке «Создать».</p>';
}

function renderCommunityFromLocal() {
  const communityList = document.getElementById('community-list');
  communityList.innerHTML = '';
  const community = loadCommunity();
  if (community.length === 0) {
    renderCommunityEmptyHint();
    return;
  }
  community.forEach((q) => {
    communityList.appendChild(
      quizCard(q, openPlay, async (quiz) => {
        try {
          if (getFirestoreDb()) await deleteQuizRemote(quiz.id);
          const next = loadCommunity().filter((x) => x.id !== quiz.id);
          saveCommunity(next);
          if (!getFirestoreDb()) renderCommunityFromLocal();
        } catch (err) {
          alert(err.message || 'Не удалось удалить');
        }
      })
    );
  });
}

/**
 * @param {Quiz[]} list
 */
function renderCommunityList(list) {
  const communityList = document.getElementById('community-list');
  communityList.innerHTML = '';
  if (list.length === 0) {
    renderCommunityEmptyHint();
    return;
  }
  list.forEach((q) => {
    communityList.appendChild(
      quizCard(q, openPlay, async (quiz) => {
        try {
          if (getFirestoreDb()) {
            await deleteQuizRemote(quiz.id);
            const next = loadCommunity().filter((x) => x.id !== quiz.id);
            saveCommunity(next);
          } else {
            const next = loadCommunity().filter((x) => x.id !== quiz.id);
            saveCommunity(next);
            renderCommunityFromLocal();
          }
        } catch (err) {
          alert(err.message || 'Не удалось удалить');
        }
      })
    );
  });
}

async function initCommunitySync() {
  setCommunityStatus('Подключение к Firebase…', 'muted');
  const db = getFirestoreDb();
  if (!db) {
    setCommunityStatus('Облако недоступно — показаны локальные тесты (localStorage).', 'error');
    renderCommunityFromLocal();
    return;
  }
  try {
    await migrateLocalToFirestoreOnce(loadCommunity);
    if (unsubscribeCommunity) unsubscribeCommunity();
    unsubscribeCommunity = subscribeQuizzes(
      (list) => {
        saveCommunity(list);
        setCommunityStatus('Firestore: список обновляется автоматически.', 'ok');
        renderCommunityList(list);
      },
      (err) => {
        console.error(err);
        setCommunityStatus(
          `Ошибка Firestore (${err.code || err.message || 'unknown'}). Показаны локальные данные.`,
          'error'
        );
        renderCommunityFromLocal();
      }
    );
  } catch (e) {
    console.error(e);
    setCommunityStatus('Не удалось синхронизировать — локальный режим.', 'error');
    renderCommunityFromLocal();
  }
}

function main() {
  initTelegram();
  setupTabs();
  setupCreateForm(() => {
    if (!getFirestoreDb()) renderCommunityFromLocal();
  });
  renderOfficialList();
  initCommunitySync();
}

main();
