/* Страж главы: телеграфированные выстрелы, бесплатные заряды света и здоровье. */
class Boss {
  constructor(chapter, arenaX, floorY) {
    Object.assign(this, {chapter, arenaX, floorY, baseX: arenaX + 690, w: 72, h: 100, maxHealth: 30 + chapter * 10});
    this.reset();
  }

  reset() {
    this.x = this.baseX; this.y = this.floorY - this.h;
    this.health = this.maxHealth; this.defeated = false; this.active = false;
    this.elapsed = 0; this.shotTimer = 3; this.hitCooldown = 0;
    this.wardWasActive = false; this.wardHitAvailable = false; this.volley = 0; this.ready = false;
    this.projectiles = []; this.beam = null;
    this.orbs = [
      {x: this.arenaX + 180, y: this.floorY - 42, cooldown: 0, damage: 3, respawn: 7, size: 'small'},
      {x: this.arenaX + 300, y: this.floorY - 130, cooldown: 10, damage: 7, respawn: 10, size: 'large'},
      {x: this.arenaX + 470, y: this.floorY - 42, cooldown: 0, damage: 3, respawn: 7, size: 'small'}
    ];
    for (const orb of this.orbs) this.placeOrb(orb);
  }

  placeOrb(orb) {
    // Все точки доступны обычным или двойным прыжком; позиции не повторяются подряд.
    const positions = [
      [160,42],[220,42],[390,42],[470,42],[550,42],[300,130],[430,105]
    ].filter(([,height]) => orb.size === 'large' || height === 42).map(([x,height]) => ({x:this.arenaX+x,y:this.floorY-height}));
    let available = positions.filter(p => Math.hypot(p.x-orb.x,p.y-orb.y)>90);
    const spaced = available.filter(p => this.orbs.every(other => other===orb || Math.hypot(p.x-other.x,p.y-other.y)>65));
    if (spaced.length) available = spaced;
    const position = available[Math.floor(Math.random()*available.length)];
    orb.x=position.x;orb.y=position.y;
  }

  onPlayerRespawn() {
    // Жизни дают шанс продолжить бой: нанесённый урон сохраняется до рестарта уровня.
    this.projectiles = []; this.shotTimer = 3; this.active = false;
    this.hitCooldown = 0; this.beam = null;
    this.wardWasActive = false; this.wardHitAvailable = false;
  }

  hit(x, y, events, damage = 1) {
    if (this.hitCooldown > 0 || this.defeated) return;
    this.health = Math.max(0, this.health - damage); this.hitCooldown = .75;
    this.beam = {x, y, life: .45, damage};
    events.push({type: 'hit', damage, x: this.x + this.w / 2, y: this.y + 45});
    if (this.health <= 0) {
      this.defeated = true; this.projectiles = [];
      events.push({type: 'defeated', x: this.x + this.w / 2, y: this.y + 40});
    }
  }

  update(dt, player, wardActive, canStart = true) {
    const events = [];
    this.ready = canStart;
    if (this.defeated) return events;
    if (!this.active) {
      if (!canStart || player.x <= this.arenaX + 120) return events;
      this.active = true; events.push({type: 'start'});
    }
    this.elapsed += dt; this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.x = this.baseX + Math.sin(this.elapsed * .8) * 14;
    if (this.beam) {this.beam.life -= dt; if (this.beam.life <= 0) this.beam = null;}
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    for (const orb of this.orbs) {
      orb.cooldown = Math.max(0, orb.cooldown - dt);
      if (!orb.cooldown && orb.pendingSpawn) { this.placeOrb(orb); orb.pendingSpawn = false; }
      if (!orb.cooldown && this.hitCooldown === 0 && Math.hypot(px - orb.x, py - orb.y) < 29) {
        orb.cooldown = orb.respawn; orb.pendingSpawn = true; this.hit(orb.x, orb.y, events, orb.damage);
      }
    }
    // Защита работает полностью, но один заряд оберега даёт только один слабый удар по стражу.
    if (wardActive && !this.wardWasActive) this.wardHitAvailable = true;
    this.wardWasActive = wardActive;
    if (wardActive && this.wardHitAvailable && !this.hitCooldown && Math.hypot(px - this.x - this.w / 2, py - this.y - 50) < 96) {
      this.wardHitAvailable = false; this.hit(px, py, events, 1);
    }
    if (this.defeated) return events;
    this.shotTimer -= dt;
    if (this.shotTimer <= 0) {
      this.shotTimer = 3.4 - this.chapter * .2;
      this.volley++;
      const x = this.x + 8, y = this.floorY - (this.volley % 2 ? 24 : 106);
      const angle = px < x ? Math.PI : 0, speed = 125 + this.chapter * 15;
      const spreads = this.chapter === 2 ? [-.06, 0] : [0];
      for (const spread of spreads) this.projectiles.push({x, y, w: 14, h: 14, vx: Math.cos(angle + spread) * speed, vy: Math.sin(angle + spread) * speed, life: 5});
    }
    for (const shot of this.projectiles) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
      if (wardActive && Math.hypot(px - shot.x, py - shot.y) < 62) shot.life = 0;
    }
    this.projectiles = this.projectiles.filter(shot => shot.life > 0 && shot.y < 550 && shot.y > 30);
    return events;
  }

  collides(player) {
    return this.active && !this.defeated && (Collision.overlaps(player, this) || this.projectiles.some(shot => Collision.overlaps(player, shot)));
  }
}
