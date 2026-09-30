/* GM — Ghost Mode · импорт дел из .txt
   Безопасность: файл читается ТОЛЬКО как текст. Ничего не выполняется и не вставляется как HTML,
   служебные и невидимые символы вырезаются, размер и количество строк ограничены.
   Разработано Veraxis */
const IMP_MAX_BYTES = 100 * 1024, IMP_MAX_TASKS = 50;
const WEEKDAYS = { 'понедельник':1, 'вторник':2, 'среда':3, 'среду':3, 'четверг':4, 'пятница':5, 'пятницу':5, 'суббота':6, 'субботу':6, 'воскресенье':0,
                   'пн':1, 'вт':2, 'ср':3, 'чт':4, 'пт':5, 'сб':6, 'вс':0 };
let impTasks = [];

function impDecode(buf){
  const bytes = new Uint8Array(buf);
  // нулевые байты = бинарный файл (картинка, программа, архив) — не текст
  let zeros = 0; for(let i = 0; i < Math.min(bytes.length, 4096); i++) if(bytes[i] === 0) zeros++;
  if(zeros) return null;
  try{ return new TextDecoder('utf-8', { fatal:true }).decode(bytes); }
  catch(e){ try{ return new TextDecoder('windows-1251').decode(bytes); }catch(_){ return null; } }   // «Блокнот» в Windows часто сохраняет так
}
// коды невидимых и служебных символов, которые вырезаются (управляющие, «невидимые пробелы», смена направления текста)
const IMP_BAD = [[0,8],[11,12],[14,31],[127,159],[173,173],[8203,8207],[8232,8238],[8288,8303],[65279,65279],[65520,65535]];
function impClean(raw){
  let out = '';
  for(const ch of raw.replace(/\r\n?/g, '\n')){
    const c = ch.codePointAt(0);
    if(c === 10 || c === 9 ? false : IMP_BAD.some(([a, b]) => c >= a && c <= b)) continue;
    out += c === 9 ? ' ' : ch;
  }
  return out;
}
function impDateLine(line){
  const l = line.trim().toLowerCase().replace(/[:：]\s*$/, '').trim(), t = today();
  if(l === 'сегодня') return t;
  if(l === 'завтра') return addDays(t, 1);
  if(l === 'послезавтра') return addDays(t, 2);
  if(l in WEEKDAYS){ const wd = WEEKDAYS[l], cur = parse(t).getDay(); return addDays(t, (wd - cur + 7) % 7); }
  let m = l.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m) return impValid(+m[1], +m[2], +m[3]);
  m = l.match(/^(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2}|\d{4}))?$/);
  if(m){ let y = m[3] ? +m[3] : parse(t).getFullYear(); if(y < 100) y += 2000; return impValid(y, +m[2], +m[1]); }
  return null;
}
function impValid(y, mo, d){
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? ymd(dt) : 'bad';
}
function impParse(text){
  const t = today(), base = cur >= t ? cur : t, lines = text.split('\n');
  let date = base, past = 0, bad = 0, over = 0; const out = [];
  if(lines.length > 2000) lines.length = 2000;
  for(let line of lines){
    line = line.replace(/\s+/g, ' ').trim();
    if(!line || /^[-=_*#~.]{3,}$/.test(line)) continue;           // пустые строки и разделители
    const d = impDateLine(line);
    if(d){ if(d === 'bad'){ bad++; date = null; } else date = d; continue; }
    if(!date) continue;
    let title = line.replace(/^(?:[-*•·–—+>]|\d{1,3}[.)]|\[\s?[xх✓ ]?\])\s*/i, '').trim();
    let prio = false;
    if(/^!+/.test(title) || /!{2,}$/.test(title)){ prio = true; title = title.replace(/^!+\s*/, '').replace(/\s*!{2,}$/, '').trim(); }
    if(!title) continue;
    if(date < t){ past++; continue; }
    if(out.length >= IMP_MAX_TASKS){ over++; continue; }
    out.push({ title: title.slice(0, 200), date, prio });
  }
  return { out, past, bad, over };
}

async function impOpen(file){
  if(!file) return;
  if(!/\.txt$/i.test(file.name)) return toast('Нужен текстовый файл .txt');
  if(file.type && file.type !== 'text/plain') return toast('Это не текстовый файл');
  if(file.size > IMP_MAX_BYTES) return toast('Файл слишком большой — максимум 100 КБ');
  if(!file.size) return toast('Файл пустой');
  const raw = impDecode(await file.arrayBuffer());
  if(raw === null) return toast('Файл не похож на обычный текст — импорт отменён');
  const { out, past, bad, over } = impParse(impClean(raw));
  if(!out.length) return toast(past ? 'Все дела в файле — на прошедшие дни. Их добавить нельзя.' : 'В файле не нашлось дел');
  impTasks = out;
  const byDate = {}; out.forEach(x => (byDate[x.date] ||= []).push(x));
  const notes = [past && `${past} на прошедшие дни пропущено`, bad && `${bad} неверных дат`, over && `${over} сверх лимита ${IMP_MAX_TASKS}`].filter(Boolean);
  $('impInfo').textContent = `Найдено ${out.length} ${plural(out.length, 'дело', 'дела', 'дел')}.` + (notes.length ? ' ' + notes.join(', ') + '.' : '');
  $('impList').innerHTML = Object.keys(byDate).sort().map(d => `<div class="imp-day">${d === today() ? 'Сегодня' : d === addDays(today(), 1) ? 'Завтра' : `${WD[parse(d).getDay()]}, ${human(d)}`}</div>`
    + byDate[d].map(x => `<div class="imp-row${x.prio ? ' prio' : ''}">${x.prio ? '<em>важное</em>' : ''}${esc(x.title)}</div>`).join('')).join('');
  $('impYes').textContent = `Добавить ${out.length}`;
  $('impModal').hidden = false;
}
$('importBtn').onclick = () => { $('importFile').value = ''; $('importFile').click(); };
$('importFile').onchange = e => impOpen(e.target.files[0]);
$('impNo').onclick = () => { $('impModal').hidden = true; impTasks = []; };
$('impModal').addEventListener('click', e => { if(e.target === $('impModal')) $('impNo').click(); });
$('impYes').onclick = () => {
  const now = Date.now();
  impTasks.forEach((x, i) => data.tasks.push({ id: uid(), title: x.title, date: x.date, done:false, doneAt:null, prio:x.prio, created: now + i, from:'import' }));
  data.counters.imported = (data.counters.imported || 0) + 1;
  const n = impTasks.length; impTasks = [];
  $('impModal').hidden = true; commit(); checkAch();
  toast(`Добавлено ${n} ${plural(n, 'дело', 'дела', 'дел')} из файла`);
};
