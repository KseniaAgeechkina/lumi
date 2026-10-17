/* Game владеет состояниями, уровнями и циклом с фиксированным шагом физики. */
class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.state = 'menu';
    this.time = 0;
    this.camera = 0;
    this.particles = [];
    this.weaponTime = 0; this.boostTime = 0;
    this.progress = {unlocked: 0, completed: {}, last: 0};
    try {
      const saved = JSON.parse(localStorage.getItem('lumi-progress-v1'));
      if (saved && Number.isInteger(saved.unlocked) && saved.unlocked >= 0) this.progress = {unlocked: Math.min(saved.unlocked, LEVEL_COUNT - 1), completed: Object.fromEntries(Object.entries(saved.completed || {}).filter(([id]) => Number(id) < LEVEL_COUNT)), last: Math.min(saved.last || 0, saved.unlocked, LEVEL_COUNT - 1), seedRewards: saved.seedRewards || {}, chapterRewards: saved.chapterRewards || {}};
    } catch {}
    this.settings = {gentle:false,particles:true,volume:.2};
    try {const saved=JSON.parse(localStorage.getItem('lumi-settings-v1'));if(saved) Object.assign(this.settings,saved);} catch {}
    this.settings.volume=Math.max(0,Math.min(1,Number(this.settings.volume)||0));
    let savedShop;
    try {savedShop=JSON.parse(localStorage.getItem('lumi-shop-v1'));}catch{}
    const previousPoints=Object.values(this.progress.completed).reduce((sum,result)=>sum+Math.max(0,Number(result.score)||0),0);
    this.shop=new Shop(savedShop,previousPoints);
    this.saveShop();
    this.input = new InputHandler(window, force => this.togglePause(force));
    this.lastFrame = null;
    this.accumulator = 0;
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  frame(timestamp) {
    const elapsed = this.lastFrame === null ? 0 : Math.min(.05, (timestamp - this.lastFrame) / 1000);
    this.lastFrame = timestamp;
    if (!['paused','map','settings','wardrobe','about','lost','won','reset-confirm'].includes(this.state)) this.time += elapsed;
    if (this.state === 'playing') {
      this.accumulator += elapsed;
      while (this.accumulator >= 1 / 120) { this.update(1 / 120); this.accumulator -= 1 / 120; if (this.state !== 'playing') {this.accumulator = 0; break;} }
    } else this.accumulator = 0;
    if (this.state === 'ending') this.endingTime += elapsed;
    this.renderer.render(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  start(index) {
    if (index < 0 || index > this.progress.unlocked || index >= LEVEL_COUNT) return;
    this.level = createLevel(index);
    this.player = new Player(this.level.spawn.x, this.level.spawn.y);
    this.spawn = {...this.level.spawn};
    this.weaponTime = 0; this.boostTime = 0;
    this.collected = 0; this.score = 0; this.maxLives=this.settings.gentle?5:3; this.lives=this.maxLives; this.time=0; this.checkpointActive = false; this.camera = 0; this.particles = [];
    this.arenaHint = undefined; this.gateHint = undefined;
    this.progress.last = index; this.save();
    this.state = 'playing'; this.input.clear();
    this.hideOverlays(); document.getElementById('hud').hidden = false;
    this.updateHud(); document.getElementById('canvas').focus();
    this.toast(index === 0 ? 'A / D — идти · Space дважды — двойной прыжок · Найди ворота' : `${this.level.name} · ${this.level.boss ? 'Перед боем нужны все огоньки' : 'Нужно огоньков'}: ${this.level.required}`);
  }

  update(dt) {
    this.weaponTime = Math.max(0, (this.weaponTime || 0) - dt);
    if (this.input.consumeWeapon?.()) this.activateWard();
    this.boostTime = Math.max(0, (this.boostTime || 0) - dt);
    if (this.input.consumeBoost?.()) this.activateBoost();
    this.updateWeaponHud();
    this.player.speedMultiplier = this.boostTime > 0 ? 1.45 : 1;
    const boss = this.level.boss;
    if (boss && !boss.active && this.collected < this.level.required && this.player.x + this.player.w > boss.arenaX + 110) {
      this.player.x = boss.arenaX + 110 - this.player.w; this.player.vx = 0;
    }
    for (const platform of this.level.platforms) platform.update(dt, this.time);
    this.player.update(dt, this.input, this.level.platforms);
    if(this.player.didDoubleJump)this.burst(this.player.x+this.player.w/2,this.player.y+this.player.h);
    for (const spike of this.level.spikes) spike.y = spike.platform.y - spike.h;
    for (const enemy of this.level.enemies) {
      if (enemy.defeated) continue;
      enemy.x += enemy.direction * (42 + this.level.chapter * 15) * dt;
      if (enemy.x <= enemy.min || enemy.x >= enemy.max) enemy.direction *= -1;
      enemy.y = enemy.platform.y - enemy.h;
    }
    // Оберег уничтожает близкие тени; шипы и падение остаются опасными.
    if (this.weaponTime > 0) {
      for (const enemy of this.level.enemies) {
        if (enemy.defeated || !enemy.platform.visible) continue;
        const distance = Math.hypot(enemy.x + enemy.w / 2 - this.player.x - this.player.w / 2,
          enemy.y + enemy.h / 2 - this.player.y - this.player.h / 2);
        if (distance < 60) { enemy.defeated = true; this.burst(enemy.x + enemy.w / 2, enemy.y); }
      }
    }
    if (boss && !boss.active && this.collected < this.level.required && this.player.x + this.player.w > boss.arenaX + 110) {
      this.player.x = boss.arenaX + 110 - this.player.w; this.player.vx = 0;
      if (this.arenaHint === undefined || this.time - this.arenaHint > 3) {
        this.toast(`До боя собери все огоньки: осталось ${this.level.required - this.collected}. Можно вернуться по тропе.`); this.arenaHint = this.time;
      }
    }
    if (boss) {
      boss.missing = Math.max(0, this.level.required - this.collected);
      for (const event of boss.update(dt, this.player, this.weaponTime > 0, this.collected >= this.level.required)) {
        if (event.type === 'start') this.toast('Собирай огоньки на арене и уклоняйся от выстрелов стража.');
        else { this.burst(event.x, event.y); if (event.type === 'defeated') this.toast('Страж рассеян. Путь к двери открыт!'); }
      }
    }
    const hazard = (this.weaponTime <= 0 && boss?.collides(this.player)) || this.level.spikes.some(spike => spike.platform.visible && Collision.overlaps(this.player, spike)) || this.level.enemies.some(enemy => !enemy.defeated && this.weaponTime <= 0 && enemy.platform.visible && Collision.overlaps(this.player, enemy));
    if (this.player.y > 570 || hazard && this.player.invincible <= 0) { this.die(this.player.y>570?'fall':hazard?'hazard':'fall'); return; }
    for (const seed of this.level.seeds) {
      if (!seed.collected && Collision.overlaps(this.player, {x: seed.x - 8, y: seed.y - 10, w: 16, h: 20})) {
        seed.collected = true; this.collected++; this.score += 5; this.claimSeedReward(seed);
        this.burst(seed.x, seed.y); this.updateHud();
        if (this.collected === this.level.required) this.toast(boss && !boss.defeated ? 'Огоньки собраны. Осталось рассеять стража.' : 'Ворота проснулись. Найди путь к ним!');
      }
    }
    const cp = this.level.checkpoint;
    if (!this.checkpointActive && this.player.grounded && this.player.support === cp) {
      this.checkpointActive = true; this.spawn = {x: cp.x + 35, y: cp.baseY - this.player.h - 3};
      this.toast('Контрольная точка · Свет сохранён'); this.burst(cp.x + 17, cp.y - 35);
    }
    if (Collision.overlaps(this.player, this.level.gate)) {
      if (this.collected >= this.level.required && (!boss || boss.defeated)) { this.win(); return; }
      if (!this.gateHint || this.time - this.gateHint > 3) { this.toast(boss && !boss.defeated ? 'Дверь охраняет страж. Собирай заряды света на арене.' : `Для ворот нужно ещё ${this.level.required - this.collected} огоньков`); this.gateHint = this.time; }
    }
    const target = boss?.active ? boss.arenaX - 10 : Math.max(0, Math.min(this.level.width - 960, this.player.x - 300));
    this.camera += (target - this.camera) * Math.min(1, dt * 7);
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.8; }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  die(cause='fall') {
    this.weaponTime = 0; this.boostTime = 0;
    if (this.level.boss && !this.level.boss.defeated) this.level.boss.onPlayerRespawn();
    this.lives--; this.updateHud();
    if (this.lives <= 0) {
      this.state = 'lost';
      this.modal('СВЕТ НЕ ИСЧЕЗ — ОН ЖДЁТ', 'Попробуем ещё раз?', 'Лесная тропа бывает непростой. Теперь ты знаешь её чуть лучше.', [['Повторить уровень', () => this.start(this.level.index)], ['Карта леса', () => this.openMap()]]);
      return;
    }
    for (const p of this.level.platforms) if (p.type === 'crumble') {p.visible = true; p.touched = false; p.crumbleTime = 0;}
    this.player = new Player(this.spawn.x, this.spawn.y); this.player.invincible = 2;
    this.input.clear(); this.toast(cause==='hazard' ? 'Луми задел препятствие. Возвращаемся к безопасной точке.' : 'Падение — не конец. Продолжим с безопасной точки.');
  }

  win() {
    this.chapterBonus = 0;
    this.state = 'won'; this.score += 150;
    if (!this.progress.completed[this.level.index]) this.earnPoints(150);
    const chapterEnd = (this.level.index + 1) % LEVELS_PER_CHAPTER === 0;
    this.progress.chapterRewards ||= {};
    if (chapterEnd && !this.progress.chapterRewards[this.level.chapter]) {
      this.progress.chapterRewards[this.level.chapter] = true;
      this.chapterBonus = 500; this.score += 500; this.earnPoints(500);
    }
    const stars = this.collected === this.level.seeds.length ? 3 : this.collected >= Math.ceil(this.level.seeds.length * .85) ? 2 : 1;
    const old = this.progress.completed[this.level.index] || {stars: 0, score: 0};
    this.progress.completed[this.level.index] = {stars: Math.max(stars, old.stars), score: Math.max(this.score, old.score)};
    this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(LEVEL_COUNT - 1, this.level.index + 1)); this.save(); this.updateHud();
    if (this.level.index === LEVEL_COUNT - 1) { this.showEnding(); return; }
    if ((this.level.index + 1) % LEVELS_PER_CHAPTER === 0) {
      this.showChapterStory(stars);
      return;
    }
    this.modal('ЕЩЁ ОДНА ТРОПА ОСВЕЩЕНА', 'Ты нашёл путь!', `${'✦'.repeat(stars)} · ${this.score} очков · ${this.collected} из ${this.level.seeds.length} огоньков`, [['Следующая тропа', () => this.start(this.level.index + 1)], ['Тропы леса', () => this.openMap()]]);
  }

  togglePause(force = false) {
    if (this.state === 'playing') {
      this.state = 'paused'; this.input.clear();
      this.modal('ПАУЗА', 'Лес подождёт', 'Путешествие продолжится с того же места.', [['Продолжить', () => this.resume()], ['Выйти в меню', () => this.exitToMenu()]]);
    } else if (this.state === 'paused' && !force) this.resume();
  }

  exitToMenu() {
    this.state='menu';this.level=null;this.camera=0;this.particles=[];this.input.clear();this.accumulator=0;
    clearTimeout(this.toastTimer);document.getElementById('toast').classList.remove('show');
    this.hideOverlays();document.getElementById('hud').hidden=true;document.getElementById('menu').hidden=false;
    document.getElementById('start').textContent='Играть';
  }

  openAbout() {
    this.panelReturn=this.state;this.state='about';this.input.clear();this.hideOverlays();document.getElementById('about').hidden=false;
  }

  resume() {
    this.state = 'playing'; this.input.clear(); this.hideOverlays(); document.getElementById('hud').hidden = false; document.getElementById('canvas').focus();
  }

  openMap() {
    this.previousState = this.state; this.state = 'map'; this.input.clear(); this.hideOverlays();
    document.getElementById('hud').hidden = true; document.getElementById('map').hidden = false;
    const container = document.getElementById('map-chapters'); container.replaceChildren();
    CHAPTERS.forEach((name, chapter) => {
      const card = document.createElement('section'); card.className = 'chapter-card';
      const image = document.createElement('img'); image.src = `assets/images/chapter-${chapter + 1}.png`;
      image.alt = name; image.className = 'chapter-art'; card.append(image);
      const heading = document.createElement('div'); heading.className = 'chapter-heading';
      const number = document.createElement('span'); number.className = 'overline'; number.textContent = `ТРОПА ${chapter + 1}`;
      const title = document.createElement('h3'); title.textContent = name;
      heading.append(number, title); card.append(heading);
      const list = document.createElement('div'); list.className = 'chapter-levels';
      let finished = 0;
      for (let local = 0; local < LEVELS_PER_CHAPTER; local++) {
        const id = chapter * LEVELS_PER_CHAPTER + local;
        const completed = this.progress.completed[id], locked = id > this.progress.unlocked;
        if (completed) finished++;
        const button = document.createElement('button');
        button.className = 'chapter-level' + (local === LEVELS_PER_CHAPTER - 1 ? ' boss-level' : '') + (completed ? ' completed' : '') + (id === this.progress.unlocked ? ' current' : '');
        button.disabled = locked;
        button.title = `${local === LEVELS_PER_CHAPTER - 1 ? 'Страж тропы · ' : ''}Уровень ${id + 1}${locked ? ' — пройди предыдущий уровень' : ''}`;
        button.setAttribute('aria-label', button.title);
        if (id === this.progress.unlocked) button.setAttribute('aria-current', 'step');
        const number = document.createElement('span'); number.className = 'level-number'; number.textContent = String(id + 1).padStart(2, '0');
        const status = document.createElement('span'); status.className = 'level-status';
        status.textContent = completed ? '✦'.repeat(completed.stars) : locked ? '·' : '○';
        button.append(number, status); button.addEventListener('click', () => this.start(id)); list.append(button);
      }
      card.append(list);
      const progress = document.createElement('p'); progress.className = 'chapter-progress';
      progress.textContent = `${finished} / ${LEVELS_PER_CHAPTER} пройдено · ◇ Страж в конце тропы`;
      card.append(progress); container.append(card);
    });
  }

  showEnding() {
    this.state = 'ending'; this.endingTime = 0; this.input.clear(); this.hideOverlays();
    document.getElementById('hud').hidden = true;
    document.getElementById('ending').hidden = false;
  }

  showChapterStory(stars) {
    const chapter = this.level.chapter, story = CHAPTER_STORIES[chapter];
    const final = this.level.index === LEVEL_COUNT - 1;
    const actions = final ? [[story.next, () => this.openMap()], ['Пройти ещё раз', () => this.start(this.level.index)]]
      : [[story.next, () => this.start(this.level.index + 1)], ['Тропы леса', () => this.openMap()]];
    this.modal(`ТРОПА ${chapter + 1} ПРОЙДЕНА · ${'✦'.repeat(stars)}${this.chapterBonus ? ' · +500 ЗА ГЛАВУ' : ''}`, story.title, story.text, actions);
    document.getElementById('modal').classList.toggle('story-screen', true);
    const scene = document.getElementById('story-scene'); scene.hidden = false;
    const landscape = document.getElementById('story-landscape');
    landscape.src = `assets/images/chapter-${chapter + 1}.png`; landscape.alt = CHAPTERS[chapter];
  }

  closeMap() {
    if (['playing','paused'].includes(this.previousState)) this.resume();
    else {this.state = 'menu'; this.level = null; this.camera = 0; this.hideOverlays(); document.getElementById('hud').hidden = true; document.getElementById('menu').hidden = false;}
  }

  hideOverlays() { for (const id of ['menu','map','modal','settings','wardrobe','about','ending']) document.getElementById(id).hidden = true; }

  modal(kicker, title, text, actions) {
    this.hideOverlays(); document.getElementById('modal').hidden = false;
    document.getElementById('modal').classList.toggle('pause-screen',this.state==='paused');
    document.getElementById('modal').classList.toggle('story-screen',false);
    document.getElementById('story-scene').hidden = true;
    document.getElementById('modal-kicker').textContent = kicker;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-text').textContent = text;
    const buttons = document.getElementById('modal-actions'); buttons.replaceChildren();
    actions.forEach(([label, action], i) => {const button = document.createElement('button'); button.className = i === 0 ? 'primary' : 'outline'; button.textContent = label; button.addEventListener('click', action); buttons.append(button);});
  }

  activateWard() {
    if (this.state !== 'playing' || this.weaponTime > 0) return;
    if (!this.shop?.consumeWard()) { this.toast('Купи световой оберег в лавке · 80 очков'); return; }
    this.weaponTime = 5; this.saveShop(); this.updateWeaponHud();
    this.toast('Оберег активен 5 секунд · Приблизься к тени, чтобы рассеять её');
  }

  activateBoost() {
    if (this.state !== 'playing' || this.boostTime > 0) return;
    if (!this.shop?.consumeBoost()) { this.toast('Купи попутный ветер в лавке · 60 очков'); return; }
    this.boostTime = 6; this.saveShop(); this.updateWeaponHud();
    this.toast('Попутный ветер · Быстрый бег на 6 секунд');
  }

  updateWeaponHud() {
    const button = document.getElementById('weapon-button');
    button.textContent = `Оберег ×${this.shop?.charges || 0}${this.weaponTime > 0 ? ' · ' + this.weaponTime.toFixed(1) + ' с' : ''}`;
    button.disabled = this.weaponTime > 0 || !this.shop?.charges;
    button.classList.toggle('active', this.weaponTime > 0);
    const boost = document.getElementById('boost-button');
    boost.textContent = `Ветер ×${this.shop?.boostCharges || 0}${this.boostTime > 0 ? ' · ' + this.boostTime.toFixed(1) + ' с' : ''}`;
    boost.disabled = this.boostTime > 0 || !this.shop?.boostCharges;
    boost.classList.toggle('active', this.boostTime > 0);
  }

  updateHud() {
    this.updateWeaponHud();
    document.getElementById('chapter-label').textContent = `ГЛАВА ${this.level.chapter + 1} · УРОВЕНЬ ${this.level.index + 1} / ${LEVEL_COUNT}`;
    document.getElementById('level-label').textContent = this.level.name;
    document.getElementById('seed-count').textContent = `✦ ${this.collected} / ${this.level.required} огоньков`;
    document.getElementById('score').textContent = `${this.score} очков`;
    document.getElementById('lives').textContent = '♥'.repeat(this.lives) + '♡'.repeat((this.maxLives||3) - this.lives);
  }

  burst(x, y) {
    this.chime();
    if(this.settings?.particles===false) return;
    for (let i = 0; i < 12; i++) {const angle = Math.random() * Math.PI * 2; this.particles.push({x, y, vx: Math.cos(angle) * 45, vy: Math.sin(angle) * 45, life: 1, size: 1 + Math.random() * 2, color: '#fff3ba'});}
  }

  toast(text) {
    const element = document.getElementById('toast'); element.textContent = text; element.classList.add('show');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => element.classList.remove('show'), 3500);
  }

  openSettings() {
    this.panelReturn=this.state; this.state='settings'; this.input.clear(); this.hideOverlays();
    document.getElementById('settings').hidden=false;
    document.getElementById('gentle-mode').checked=this.settings.gentle;
    document.getElementById('particles-mode').checked=this.settings.particles;
    document.getElementById('volume').value=this.settings.volume;
  }

  requestProgressReset() {
    this.state = 'reset-confirm'; this.input.clear();
    this.modal('НАЧАТЬ СНАЧАЛА', 'Сбросить прогресс?',
      'Открытые уровни, звёзды, очки и покупки в лавке будут сброшены. Настройки звука и сложности останутся.',
      [['Отмена', () => { this.state = this.panelReturn; this.openSettings(); }], ['Сбросить прогресс', () => this.resetProgress()]]);
  }

  resetProgress() {
    this.progress = {unlocked: 0, completed: {}, last: 0};
    this.shop = new Shop(undefined, 0);
    this.save(); this.saveShop();
    this.collected = 0; this.score = 0; this.checkpointActive = false; this.weaponTime = 0; this.boostTime = 0;
    this.exitToMenu(); this.toast('Прогресс сброшен. Новая история начинается с первой тропы.');
  }

  openWardrobe() {
    this.panelReturn=this.state; this.state='wardrobe'; this.input.clear(); this.hideOverlays();
    document.getElementById('wardrobe').hidden=false;
    this.renderWardrobe();
  }

  renderWardrobe() {
    const container=document.getElementById('cosmetics');container.replaceChildren();
    document.getElementById('shop-wallet').textContent=this.shop.wallet.toLocaleString('ru-RU')+' очков';
    for(const item of SHOP_ITEMS) {
      const owned=this.shop.owned.has(item.id),equipped=this.shop.equipped[item.slot]===item.id;
      const button=document.createElement('button');button.className='cosmetic'+(equipped?' selected':'');
      const consumable = item.kind === 'consumable';
      button.disabled = consumable ? this.shop.wallet < item.price || this.shop[item.inventoryKey] >= 3 : !owned && this.shop.wallet < item.price;
      const icon=document.createElement('span');icon.className='cosmetic-preview';icon.style.color=item.color;icon.textContent=item.icon;
      const title=document.createElement('b');title.textContent=item.name;
      const description=document.createElement('small');description.textContent=item.description;
      const action=document.createElement('span');action.className='shop-action';action.textContent=consumable ? `Купить · ${item.price} · Запас ${this.shop[item.inventoryKey]}/3` : owned?(equipped?'Надето · снять':'Надеть'):`Купить · ${item.price} очков`;
      button.append(icon,title,description,action);
      button.addEventListener('click',()=>{
        if(owned && !consumable)this.shop.toggle(item.id);else if(!this.shop.purchase(item.id))return;
        this.saveShop();this.renderWardrobe();
      });container.append(button);
    }
    document.getElementById('achievement-summary').textContent='Огонёк: +5 · Уровень: +150 · Глава: +500 · Значки навсегда · Оберег: E · Ускорение: Shift';
    this.renderer.preview(document.getElementById('shop-preview'),this.shop.equipped);
  }

  // Один и тот же огонёк не пополняет кошелёк при повторном прохождении.
  claimSeedReward(seed) {
    this.progress.seedRewards ||= {};
    const id = this.level.index, seedId = this.level.seeds.indexOf(seed);
    const claimed = this.progress.seedRewards[id] ||= [];
    if (claimed.includes(seedId)) return;
    claimed.push(seedId); this.earnPoints(5); this.save();
  }

  earnPoints(points) {
    if(!this.shop)return;
    this.shop.earn(points);this.saveShop();
  }

  saveShop() {try{localStorage.setItem('lumi-shop-v1',JSON.stringify(this.shop.serialize()));}catch{}}

  closePanel() {
    if(['playing','paused'].includes(this.panelReturn)) this.resume();
    else if(this.panelReturn==='map') this.openMap();
    else {this.state='menu';this.level=null;this.camera=0;this.hideOverlays();document.getElementById('hud').hidden=true;document.getElementById('menu').hidden=false;}
  }

  saveSettings() {try{localStorage.setItem('lumi-settings-v1',JSON.stringify(this.settings));}catch{}}

  chime() {
    if(!this.settings?.volume) return;
    try {
      this.audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if(this.audio.state==='suspended') this.audio.resume();
      const oscillator=this.audio.createOscillator(),gain=this.audio.createGain();
      oscillator.connect(gain);gain.connect(this.audio.destination);oscillator.frequency.value=660;
      gain.gain.setValueAtTime(this.settings.volume*.12,this.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,this.audio.currentTime+.22);
      oscillator.start();oscillator.stop(this.audio.currentTime+.23);
    } catch {}
  }

  save() { try {localStorage.setItem('lumi-progress-v1', JSON.stringify(this.progress));} catch {} }

  destroy() {cancelAnimationFrame(this.raf); clearTimeout(this.toastTimer); this.input.destroy();}
}
