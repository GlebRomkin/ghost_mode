/* GM — Ghost Mode · обучение: автоматический показ «что где»
   Разработано Veraxis */
const TOUR = [
  { t:'Добро пожаловать в Ghost Mode', d:'За полминуты покажу, что где находится. Ничего нажимать не нужно — просто смотри.' },
  { s:'#addForm',  t:'Дела на день', d:'Пиши сюда дело и жми «Добавить». Флажок — важное дело, значок файла — импорт списка из .txt.' },
  { s:'.hero .ring', t:'Прогресс дня', d:'Кольцо показывает, какая часть дел на сегодня уже сделана.' },
  { s:'#week', t:'Неделя', d:'Нажми на день, чтобы посмотреть его дела. Прошедшие дни закрыты для правки — всё честно.' },
  { s:'.streak-card', t:'Серия', d:'Сколько дней подряд ты сделал хотя бы одно дело. Пропустил день — серия сгорит.' },
  { s:'#questCard', t:'Квесты дня', d:'Три задания на каждый день, +30 XP за каждое. Обновляются в полночь.' },
  { s:'.side.right .sc', t:'Фокус-таймер', d:'Фокус, перерыв и отдых. Время настраивается шестерёнкой, а уведомление придёт даже при закрытом сайте.' },
  { s:'#note', box:'.sc', t:'Итог дня', d:'Мысли и итоги дня. Все записи собираются в «Альбоме».' },
  { s:'.tab[data-view="stats"]', t:'Статистика', d:'Графики, процент выполнения, активность по дням и по дням недели.' },
  { s:'.tab[data-view="album"]', t:'Альбом', d:'Твои записи и общий альбом с другом по Тандему.' },
  { s:'.tab[data-view="friends"]', t:'Друзья', d:'Найди друга по нику, заведи с ним Тандем — серию на двоих — и смотри рейтинг.' },
  { s:'.tab[data-view="profile"]', t:'Профиль', d:'Уровень, достижения, аватары, друзья и «Настройки»: темы, уведомления и повтор этого обучения.' },
  { t:'Готово!', d:'Тихо делай своё. Если что-то потеряешь — обучение можно пройти снова: Профиль → Настройки.' },
];
const TOUR_MS = 5200;
let tourI = -1, tourTimer = null, tourEl = null;

function startTour(force){
  if(!force && data.settings.tourDone) return;
  document.querySelector('.tab[data-view="today"]').click();
  if(typeof cur !== 'undefined' && cur !== today()){ cur = today(); render(); }
  tourEl = document.createElement('div');
  tourEl.className = 'tour';
  tourEl.innerHTML = `<div class="tour-spot" id="tourSpot"></div>
    <div class="tour-card glass" id="tourCard">
      <div class="tour-step" id="tourStep"></div>
      <b id="tourT"></b><p id="tourD"></p>
      <div class="tour-bar"><i id="tourBar"></i></div>
      <div class="tour-btns"><button class="tour-skip" id="tourSkip">Пропустить обучение</button><button class="tour-next" id="tourNext">Далее</button></div>
    </div>`;
  document.body.appendChild(tourEl);
  $('tourSkip').onclick = () => endTour();
  $('tourNext').onclick = () => tourGo(tourI + 1);
  addEventListener('resize', tourPlace);
  tourGo(0);
}
function tourGo(i){
  clearTimeout(tourTimer);
  if(i >= TOUR.length) return endTour();
  tourI = i; const st = TOUR[i];
  $('tourStep').textContent = `${i + 1} / ${TOUR.length}`;
  $('tourT').textContent = st.t; $('tourD').textContent = st.d;
  $('tourNext').textContent = i === TOUR.length - 1 ? 'Начать' : 'Далее';
  const bar = $('tourBar'); bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth;
  bar.style.transition = `width ${TOUR_MS}ms linear`; bar.style.width = '100%';
  const el = tourTarget(st);
  if(el){
    const r = el.getBoundingClientRect();
    if(getComputedStyle(el).position !== 'fixed' && (r.top < 70 || r.bottom > innerHeight - 90)) el.scrollIntoView({ behavior:'smooth', block:'center' });
  }
  tourEl.classList.toggle('center', !el);
  setTimeout(tourPlace, el ? 380 : 0);
  tourTimer = setTimeout(() => tourGo(i + 1), TOUR_MS + (el ? 380 : 0));
}
function tourTarget(st){
  if(!st.s) return null;
  let el = document.querySelector(st.s); if(!el) return null;
  if(st.box) el = el.closest(st.box) || el;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? el : null;
}
function tourPlace(){
  if(!tourEl) return;
  const st = TOUR[tourI], el = tourTarget(st), spot = $('tourSpot'), card = $('tourCard');
  if(!el){ spot.style.cssText = 'left:50%;top:50%;width:0;height:0'; card.style.cssText = ''; return; }
  const r = el.getBoundingClientRect(), pad = 8;
  spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
  const cw = Math.min(340, innerWidth - 24), ch = card.offsetHeight || 170;
  let top = r.bottom + 16;
  if(top + ch > innerHeight - 12) top = r.top - ch - 16;
  if(top < 12) top = Math.max(12, innerHeight - ch - (innerWidth <= 640 ? 96 : 16));   // цель слишком большая — карточку вниз экрана
  const left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), innerWidth - cw - 12);
  card.style.cssText = `left:${left}px;top:${top}px;width:${cw}px`;
}
function endTour(){
  clearTimeout(tourTimer); removeEventListener('resize', tourPlace);
  if(tourEl){ tourEl.remove(); tourEl = null; }
  if(!data.settings.tourDone){ data.settings.tourDone = 1; Store.save(data); }
  window.scrollTo({ top:0, behavior:'smooth' });
}
addEventListener('scroll', () => { if(tourEl) tourPlace(); }, { passive:true });
setTimeout(() => startTour(false), 700);
