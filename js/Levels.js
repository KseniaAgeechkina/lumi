/* Двадцать четыре маршрута: восемь разных профилей высоты и три главы. */
const CHAPTERS = ['Лес утреннего света', 'Руины тихой воды', 'Сердце ночного леса'];
const LEVELS_PER_CHAPTER = 8;
const LEVEL_NAMES = [
  'Лесной порог', 'Тропа росы', 'Тихий ручей', 'Корни великана', 'Шепчущая поляна', 'Лепестки рассвета', 'Старый дуб', 'Страж утреннего леса',
  'Отражения', 'Древний мост', 'Затонувший двор', 'Зал светлячков', 'Осколки колонн', 'Туманная заводь', 'Хрустальный ключ', 'Страж тихой воды',
  'Сумеречные сосны', 'Ночные ветви', 'Тропа звёзд', 'Храм луны', 'Безмолвная крона', 'Последний огонёк', 'Корни сновидений', 'Страж забытых снов'
];
const LEVEL_COUNT = LEVEL_NAMES.length;
const ROUTE_PROFILES = [
  [410,365,320,355,300,245,290,345],
  [410,355,300,245,205,250,305,360,305],
  [425,380,335,380,335,290,335,380,335],
  [405,350,295,240,185,230,275,320,365,310],
  [415,365,310,355,300,345,290,335,280,325],
  [410,370,330,290,250,210,250,290,330,370],
  [410,355,310,260,300,245,195,240,285,330,275],
  [410,365,320,275,320,365]
];
function createLevel(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LEVEL_COUNT) throw new RangeError('Неизвестный уровень');
  const chapter = Math.floor(index / LEVELS_PER_CHAPTER), stage = index % LEVELS_PER_CHAPTER;
  const isBoss = stage === LEVELS_PER_CHAPTER - 1;
  const platforms = [new Platform(0, 455, 310)], seeds = [], enemies = [], spikes = [];
  const profile = ROUTE_PROFILES[stage];
  const count = profile.length + (isBoss ? 0 : chapter * 2);
  let x = 350, y = 420;
  for (let i = 0; i < count; i++) {
    const widths = [112,220,145,98,190,128];
    let width = widths[(i * (stage % 2 + 1) + stage + chapter) % widths.length] - chapter * 5;
    const previousY = y, desired = profile[i % profile.length] + (chapter ? Math.sin(i * 1.7 + chapter) * 9 : 0);
    y = Math.round(Math.max(previousY - 55, Math.min(previousY + 55, desired)));
    if (y > previousY) width = Math.max(width, 195);
    const type = i > 1 && i % 4 === 2 && (chapter >= 1 || stage >= 4) ? 'crumble' : i > 1 && i % 4 === 1 && index >= 2 ? 'moving' : 'stone';
    const platform = new Platform(x, y, width, type); platforms.push(platform);
    seeds.push({x: x + width / 2, y: y - 45, collected: false});
    if (i % 5 === 3) enemies.push({x: x + 25, y: y - 38, w: 28, h: 38, min: x + 12, max: x + width - 40, direction: 1, platform});
    if (i % 6 === 4 && index >= 2) spikes.push({x: x + width - 45, y: y - 30, w: 32, h: 30, platform});
    x += width + [44,56,48,61][(i + stage) % 4] + chapter * 6;
  }
  const finishY = isBoss ? 420 : Math.min(420, y + 50);
  const last = new Platform(x, finishY, isBoss ? 940 : 290); platforms.push(last);
  const checkpoint = isBoss ? last : platforms[Math.floor(platforms.length / 2)]; checkpoint.type = 'stone';
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].platform === checkpoint) enemies.splice(i, 1);
  for (let i = spikes.length - 1; i >= 0; i--) if (spikes[i].platform === checkpoint) spikes.splice(i, 1);
  const lowerRoutes = platforms.slice(1, -1).filter((p,i) => i % 4 === 0 && p.baseY >= 300 && p !== checkpoint);
  for (let i = 0; i < lowerRoutes.length; i++) {
    const lower = lowerRoutes[i], width = Math.min(i % 2 ? 105 : 74, lower.w - 50);
    const upper = new Platform(lower.baseX + 6, lower.baseY - 160, width);
    upper.upperRoute = true; platforms.push(upper);
    seeds.push({x: upper.x + width / 2, y: upper.y - 40, collected: false});
  }
  const boss = isBoss ? new Boss(chapter, x, finishY) : null;
  if (isBoss) platforms.push(new Platform(x + 250, finishY - 90, 100));
  return {index, chapter, isBoss, boss, name: LEVEL_NAMES[index], platforms, seeds, enemies, spikes,
    required: isBoss ? seeds.length : seeds.length - 1, width: x + (isBoss ? 980 : 330),
    gate: {x: x + (isBoss ? 840 : 190), y: finishY - 118, w: 64, h: 118}, checkpoint, spawn: {x:90,y:410}};
}

/* Небольшие развязки глав: последствия пути и следующая цель. */
const CHAPTER_STORIES = [
  {title: 'Первый свет вернулся', text: 'У старого дуба Луми выпустил собранные огоньки. Засохшие ветви покрылись листьями, а в его прозрачной груди зажглось маленькое тёплое сердце. Но ручей всё ещё молчал: его свет заперт среди затонувших руин. Впереди — тропа тихой воды.', next: 'К руинам тихой воды'},
  {title: 'Руины запели', text: 'Луми коснулся хрустального ключа — и вода снова побежала по древним каналам. В отражении он увидел огромный спящий силуэт: это дерево, из сна которого родился сам Луми. Чтобы разбудить его, хранителю предстоит пройти ночной лес и встретиться с тенями.', next: 'В ночной лес'},
  {title: 'Дом, который ждал', text: 'Последний огонёк растворился в корнях, и древнее дерево открыло глаза. Луми понял: он не потерянный путник, а маленький хранитель его снов. Теперь в лесу снова наступает утро. Впереди — тихая жизнь среди проснувшихся троп; к любой из них можно вернуться.', next: 'К тропам леса'}
];
