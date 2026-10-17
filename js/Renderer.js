/* Отрисовка не изменяет физику. Весь мир использует координаты 960 × 540. */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.backgrounds = [1, 2, 3].map(chapter => {
      const image = new Image();
      image.src = `assets/images/chapter-${chapter}.png`;
      return image;
    });
  }

  render(game) {
    const c = this.ctx, t = game.time, chapter = game.level?.chapter || 0;
    c.clearRect(0, 0, 960, 540);
    c.fillStyle = '#2e243d'; c.fillRect(0, 0, 960, 540);
    const background = this.backgrounds[chapter];
    if (background.complete && background.naturalWidth) {
      // Один самостоятельный акварельный фон на каждую главу.
      c.drawImage(background, 0, 0, 960, 540);
    }
    if (game.state === 'ending') { this.ending(game); return; }
    c.fillStyle = ['#27352c09','#16364612','#18243b12'][chapter];
    c.fillRect(0, 0, 960, 540);
    const fog = c.createLinearGradient(0, 330, 0, 540);
    fog.addColorStop(0, '#11132300'); fog.addColorStop(.55, '#11132344'); fog.addColorStop(1, '#030613f2');
    c.fillStyle = fog; c.fillRect(0, 0, 960, 540);
    for (let i = 0; i < 34; i++) {
      const x = (i * 137 + Math.sin(t * .25 + i) * 30 - game.camera * .15 + 4000) % 960;
      const y = 90 + (i * 73) % 380 + Math.sin(t * .6 + i) * 15;
      c.globalAlpha = .45 + (Math.sin(t * 1.2 + i) + 1) * .22;
      c.fillStyle = '#fff3cf'; c.shadowColor='#ffe5a0';c.shadowBlur=12;c.beginPath();c.arc(x,y,i%3===0?2.2:1.3,0,Math.PI*2);c.fill();c.shadowBlur=0;
    }
    c.globalAlpha = 1;
    if (!game.level) {
      this.platform({x: 630, y: 452, w: 220, h: 30, visible: true, type: 'stone', crumbleTime: 0}, t, 0);
      this.player({x:708,y:406,w:34,h:46,vx:0,vy:0,facing:1,grounded:true,invincible:0,profile:0},t,2.3,game.shop?.equipped);
      return;
    }
    c.save(); c.translate(-game.camera, 0);
    for (const platform of game.level.platforms) this.platform(platform, t, chapter);
    for (const spike of game.level.spikes) {
      if (!spike.platform.visible) continue;
      c.fillStyle = '#141325'; c.strokeStyle = '#b7a0bd'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(spike.x, spike.y + spike.h);
      c.lineTo(spike.x + 7, spike.y + 9); c.lineTo(spike.x + 12, spike.y + 17);
      c.lineTo(spike.x + 21, spike.y); c.lineTo(spike.x + spike.w, spike.y + spike.h);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#51425e'; c.beginPath(); c.moveTo(spike.x + 21, spike.y + 3);
      c.lineTo(spike.x + 20, spike.y + 26); c.lineTo(spike.x + 27, spike.y + 26); c.fill();
    }
    for (const seed of game.level.seeds) {
      if (seed.collected) continue;
      const y = seed.y + Math.sin(t * 2 + seed.x) * 4;
      this.spark(seed.x, y, t, seed.x);

    }
    const cp = game.level.checkpoint;
    this.checkpoint(cp.x + 17, cp.y, game.checkpointActive, t);
    this.gate(game.level.gate, game.collected >= game.level.required && (!game.level.boss || game.level.boss.defeated), t, game.level.index === LEVEL_COUNT - 1, game.level.chapter);
    for (const enemy of game.level.enemies) if (enemy.platform.visible && !enemy.defeated) this.enemy(enemy, t);
    if (game.level.boss) {
      const boss = game.level.boss;
      if (!boss.ready && !boss.active && !boss.defeated) this.arenaBarrier(boss, t);
      this.boss(boss, t);
    }
    if(game.shop?.equipped?.trail==='spark' && Math.abs(game.player.vx)>20 && game.settings?.particles!==false) {
      for(let i=1;i<9;i++) {
        const x=game.player.x+17-game.player.facing*i*7,y=game.player.y+27+Math.sin(t*5+i)*5;
        c.globalAlpha=(1-i/9)*.8;c.fillStyle='#e9dcff';c.shadowColor='#c7a8ff';c.shadowBlur=13;
        c.beginPath();c.arc(x,y,2.5-i*.2,0,Math.PI*2);c.fill();
      }
      c.shadowBlur=0;c.globalAlpha=1;
    }
    if (game.weaponTime > 0) {
      const x = game.player.x + game.player.w / 2, y = game.player.y + game.player.h / 2;
      c.save(); c.strokeStyle = '#c9edff'; c.lineWidth = 2.2; c.shadowColor = '#8ad3ff'; c.shadowBlur = 22;
      c.fillStyle = '#a6ddff20'; c.beginPath(); c.arc(x, y, 52 + Math.sin(t * 7) * 2, 0, Math.PI * 2); c.fill(); c.stroke();
      for (let i = 0; i < 6; i++) { const angle = t * 2 + i * Math.PI / 3; c.beginPath(); c.arc(x + Math.cos(angle) * 56, y + Math.sin(angle) * 56, 3, 0, Math.PI * 2); c.fillStyle = '#eefbff'; c.fill(); }
      c.restore();
    }
    if (game.boostTime > 0 && Math.abs(game.player.vx) > 30) {
      c.save(); c.strokeStyle = '#fae2b9'; c.lineWidth = 1.5; c.globalAlpha = .65;
      for (let i = 0; i < 3; i++) {
        const x = game.player.x + 17 - game.player.facing * (28 + i * 9), y = game.player.y + 15 + i * 8;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - game.player.facing * 17, y); c.stroke();
      }
      c.restore();
    }
    this.player(game.player,t,1,game.shop?.equipped);
    if (game.state === 'won' && game.level.index === LEVEL_COUNT - 1) {
      for (let i = 0; i < 30; i++) {c.fillStyle = i % 2 ? '#e4c2e3' : '#d0bee9'; c.shadowColor = '#d2bfec'; c.shadowBlur = 12; c.beginPath(); c.arc(game.level.gate.x - 170 + i * 13, 390 - Math.sin(i) * 50, 4, 0, Math.PI * 2); c.fill();} c.shadowBlur = 0;
    }
    for (const particle of game.particles) {
      c.globalAlpha = particle.life; c.fillStyle = particle.color;c.shadowColor=particle.color;c.shadowBlur=14;
      c.beginPath(); c.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); c.fill();
    }
    c.shadowBlur=0;c.globalAlpha = 1; c.restore();
    const abyss=c.createLinearGradient(0,465,0,540);
    abyss.addColorStop(0,'#02041100');abyss.addColorStop(.55,'#020411b8');abyss.addColorStop(1,'#020411');
    c.fillStyle=abyss;c.fillRect(0,465,960,75);
  }

  arenaBarrier(boss, time) {
    const c = this.ctx, x = boss.arenaX + 110;
    c.save(); c.shadowColor = '#ffe5ae'; c.shadowBlur = 16;
    c.strokeStyle = '#ffe6bdcc'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x,boss.floorY); c.bezierCurveTo(x-8,boss.floorY-90,x+8,boss.floorY-160,x,boss.floorY-215); c.stroke();
    c.shadowBlur=0; c.fillStyle='#0a1328da'; c.beginPath();c.roundRect(x-115,boss.floorY-260,230,38,3);c.fill();
    c.fillStyle='#ffe9bd';c.textAlign='center';c.font='11px Arial';c.fillText('До арены нужны все огоньки',x,boss.floorY-245);
    c.fillStyle='#ccd7e8';c.fillText(`Осталось: ${boss.missing ?? '…'} · можно вернуться`,x,boss.floorY-231);c.restore();
  }

  // Большой страж главы: накидка, острые глаза и дымный хохолок по референсу.
  boss(boss, time) {
    if (boss.defeated) return;
    const c = this.ctx, x = boss.x + boss.w / 2, y = boss.y + boss.h;
    if (boss.active) {
      for (const orb of boss.orbs) if (orb.cooldown <= 0) {
        c.save(); c.translate(orb.x, orb.y); c.scale(orb.size === 'large' ? 1.65 : .8, orb.size === 'large' ? 1.65 : .8); this.spark(0, 0, time, orb.x); c.restore();
      }
      for (const shot of boss.projectiles) {
        c.save(); c.translate(shot.x + 7, shot.y + 7);
        c.shadowColor = '#b38ae3'; c.shadowBlur = 11; c.fillStyle = '#14142b';
        c.beginPath(); c.ellipse(0, 0, 10, 8, Math.atan2(shot.vy, shot.vx), 0, Math.PI * 2); c.fill();
        c.fillStyle = '#dac9ff'; for (const side of [-1,1]) { c.beginPath(); c.arc(side * 3, -1, 1.5, 0, Math.PI * 2); c.fill(); }
        c.restore();
      }
      if (boss.beam) {
        c.save(); c.globalAlpha = Math.max(0, boss.beam.life / .45); c.shadowColor = '#fff1af'; c.shadowBlur = 18;
        c.strokeStyle = '#fff1c0'; c.lineWidth = 3; c.beginPath(); c.moveTo(boss.beam.x, boss.beam.y); c.lineTo(x, y - 60); c.stroke(); c.restore();
      }
      c.save(); c.fillStyle = '#0b1325c9'; c.beginPath(); c.roundRect(boss.arenaX + 195, 64, 550, 48, 3); c.fill();
      c.textAlign = 'center'; c.fillStyle = '#e8daef'; c.font = '14px Georgia';
      c.fillText(['СТРАЖ УТРЕННЕГО ЛЕСА','СТРАЖ ТИХОЙ ВОДЫ','СТРАЖ ЗАБЫТЫХ СНОВ'][boss.chapter], boss.arenaX + 470, 84);
      c.fillStyle = '#c2ccdc'; c.font = '11px Arial'; c.fillText('Собирай огоньки и уклоняйся от тёмных сгустков', boss.arenaX + 470, 102); c.restore();
    }
    c.save(); c.translate(x, y);
    const sway = Math.sin(time * 2) * 3;
    c.shadowColor = '#9291c688'; c.shadowBlur = boss.hitCooldown > 0 ? 20 : 7;
    c.fillStyle = '#090e18';
    c.beginPath(); c.ellipse(-20, -5, 9, 6, -.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(21, -5, 9, 6, .2, 0, Math.PI * 2); c.fill();
    c.fillStyle = ['#244a60','#204760','#3e3c63'][boss.chapter];
    c.beginPath(); c.moveTo(-22, -85); c.bezierCurveTo(-47, -79, -49, -43, -43, -18);
    c.quadraticCurveTo(-50, -8, -30 + sway, -10); c.quadraticCurveTo(-10, -20, 0, -6);
    c.quadraticCurveTo(24, -20, 44 + sway, -11); c.bezierCurveTo(57, -35, 48, -79, 23, -84);
    c.closePath(); c.fill();
    c.strokeStyle = '#80a2b333'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-22,-72); c.quadraticCurveTo(-34,-36,-25,-17); c.moveTo(22,-72); c.quadraticCurveTo(38,-38,29,-17); c.stroke();
    c.fillStyle = '#080b13'; c.beginPath(); c.moveTo(-16,-78);
    c.bezierCurveTo(-33,-115,9,-96,6,-115); c.bezierCurveTo(1,-135,36,-119,22,-103);
    c.bezierCurveTo(10,-96,12,-84,21,-77); c.closePath(); c.fill();
    c.beginPath(); c.arc(3,-127+Math.sin(time*2),3.5,0,Math.PI*2); c.fill();
    c.beginPath(); c.ellipse(0,-65,29,27,0,0,Math.PI*2); c.fill();
    c.fillStyle = '#111724'; c.beginPath(); c.ellipse(0,-61,25,21,0,0,Math.PI*2); c.fill();
    c.shadowColor = boss.shotTimer < .5 && boss.active ? '#d9a4ff' : '#e6ecff'; c.shadowBlur = boss.shotTimer < .5 ? 15 : 5;
    c.fillStyle = '#fffef4';
    for (const side of [-1,1]) {
      c.save(); c.scale(side,1); c.beginPath(); c.moveTo(5,-54); c.bezierCurveTo(9,-67,19,-72,23,-69);
      c.bezierCurveTo(25,-61,16,-52,5,-54); c.fill(); c.restore();
    }
    c.shadowBlur = 0;
    c.fillStyle = '#101626'; c.fillRect(-36,-144,72,5);
    c.fillStyle = '#e1c5ec'; c.fillRect(-36,-144,72*boss.health/boss.maxHealth,5);
    c.strokeStyle='#e8d8f577';c.lineWidth=1;c.strokeRect(-36,-144,72,5);
    c.fillStyle='#f3deef';c.textAlign='center';c.font='10px Arial';c.fillText(`${boss.health} / ${boss.maxHealth}`,0,-150);
    c.restore();
  }

  // После финальной победы свет постепенно возвращается в крону дерева.
  ending(game) {
    const c = this.ctx, time = game.time, awakening = Math.min(1, (game.endingTime || 0) / 6);
    c.fillStyle = '#0a152d66'; c.fillRect(0,0,960,540);
    const halo = c.createRadialGradient(640,220,20,640,220,290);
    halo.addColorStop(0, `rgba(255,222,151,${awakening*.25})`); halo.addColorStop(1,'#ffe6af00');
    c.fillStyle=halo;c.fillRect(330,0,630,540);
    // Корни и цельный изогнутый ствол.
    c.save(); c.fillStyle='#343047';c.shadowColor='#17162b';c.shadowBlur=18;
    c.beginPath();c.moveTo(609,439);c.bezierCurveTo(583,460,547,463,512,482);c.quadraticCurveTo(579,477,631,466);
    c.quadraticCurveTo(698,469,766,485);c.quadraticCurveTo(708,454,675,438);c.closePath();c.fill();
    const bark=c.createLinearGradient(590,0,690,0);bark.addColorStop(0,'#423749');bark.addColorStop(.55,'#8d7380');bark.addColorStop(1,'#45364d');
    c.fillStyle=bark;c.beginPath();c.moveTo(598,463);c.bezierCurveTo(634,382,599,332,621,267);
    c.quadraticCurveTo(627,239,651,200);c.quadraticCurveTo(638,287,657,332);
    c.bezierCurveTo(676,380,654,419,692,465);c.closePath();c.fill();
    const branches=[[-170,-145],[-107,-222],[-35,-250],[85,-232],[157,-171],[192,-102]];
    branches.forEach(([dx,dy],i)=>{c.strokeStyle=i%2?'#695566':'#514155';c.lineCap='round';c.lineWidth=22-i%3*3;c.beginPath();c.moveTo(643,346-i%2*22);c.bezierCurveTo(638+dx*.28,296,640+dx*.7,330+dy,640+dx,345+dy);c.stroke();});
    c.shadowBlur=0;
    // Крупные перекрывающиеся пятна листвы сохраняют рисованный силуэт.
    const colors=['#45415e','#51475f','#66536e','#746078','#5b5273'];
    for(let i=0;i<65;i++){
      const angle=i*2.399963, radius=Math.sqrt((i+.5)/65);
      const x=642+Math.cos(angle)*205*radius,y=190+Math.sin(angle)*112*radius;
      const shade=c.createRadialGradient(x-12,y-14,3,x,y,48);
      shade.addColorStop(0,colors[(i+2)%colors.length]);shade.addColorStop(1,colors[i%colors.length]);
      c.fillStyle=shade;c.beginPath();c.ellipse(x,y,40+Math.sin(i*2)*9,29+Math.cos(i)*7,i*.4,0,Math.PI*2);c.fill();
      c.strokeStyle='#bca0b622';c.lineWidth=.7;
      for(let leaf=0;leaf<4;leaf++){
        const lx=x-24+leaf*14,ly=y+Math.sin(i+leaf)*12;
        c.beginPath();c.moveTo(lx-5,ly+3);c.quadraticCurveTo(lx-1,ly-6,lx+7,ly-5);c.quadraticCurveTo(lx+5,ly+1,lx-5,ly+3);c.stroke();
      }
    }
    c.strokeStyle='#d4adac55';c.lineWidth=2;c.beginPath();c.moveTo(630,432);c.bezierCurveTo(650,385,626,338,639,280);c.stroke();
    // Много маленьких огоньков загораются последовательно, а затем мерцают.
    const count=Math.min(96,Math.max(0,Math.floor(((game.endingTime||0)-.4)*17)));
    for(let i=0;i<count;i++){
      const angle=i*2.399963,radius=Math.sqrt((i+.5)/96);
      const x=642+Math.cos(angle)*193*radius,y=190+Math.sin(angle)*103*radius;
      c.save();c.translate(x,y);c.scale(.28+((i*7)%5)*.035,.28+((i*7)%5)*.035);this.spark(0,0,time,i);c.restore();
    }
    c.fillStyle='#071128aa';c.beginPath();c.ellipse(645,485,200,20,0,0,Math.PI*2);c.fill();
    this.player({x:605,y:435,w:34,h:46,vx:0,facing:1,grounded:true,profile:0,invincible:0},time,1.1,game.shop?.equipped);
    c.restore();
  }

  // Контрольный кристалл светится до активации и теплеет после сохранения.
  checkpoint(x, y, active, time) {
    const c = this.ctx, light = active ? '#ffe7a1' : '#8ff8ed';
    const pulse = 1 + Math.sin(time * 2.4) * .1;
    c.save(); c.translate(x, y);
    const halo = c.createRadialGradient(0, -34, 2, 0, -34, 35 * pulse);
    halo.addColorStop(0, active ? '#ffe7a188' : '#8ff8ed77'); halo.addColorStop(1, '#8ff8ed00');
    c.fillStyle = halo; c.fillRect(-40, -74, 80, 80);
    c.shadowColor = light; c.shadowBlur = active ? 22 : 16;
    c.fillStyle = light; c.fillRect(-1.5, -28, 3, 27);
    c.beginPath(); c.ellipse(0, -1, 10, 2.5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(0, -48); c.bezierCurveTo(15, -36, 7, -26, 0, -24);
    c.bezierCurveTo(-8, -29, -12, -39, 0, -48); c.fill();
    c.shadowBlur = 6; c.fillStyle = '#fffef0';
    c.beginPath(); c.ellipse(-1, -37, 2.2, 7, .2, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 4; i++) {
      c.globalAlpha = .5 + Math.sin(time * 2 + i) * .25;
      c.beginPath(); c.arc(Math.sin(time + i * 2) * 14, -22 - i * 7, 1.2, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // Золотая восьмилучевая искра со светлой сердцевиной.
  spark(x, y, time, phase = 0) {
    const c = this.ctx, pulse = 1 + Math.sin(time * 3 + phase) * .08;
    c.save(); c.translate(x, y); c.rotate(Math.sin(time * .7 + phase) * .12); c.scale(pulse * .82, pulse * .82);
    c.shadowColor = '#ffdb7c'; c.shadowBlur = 17;
    const glow = c.createRadialGradient(0, 0, 1, 0, 0, 23);
    glow.addColorStop(0, '#ffefac66'); glow.addColorStop(1, '#ffd37600'); c.fillStyle = glow; c.fillRect(-24, -24, 48, 48);
    c.fillStyle = '#fff3a4'; c.beginPath();
    for (let i = 0; i < 16; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 8;
      const radius = i % 2 ? 4.2 : i % 4 ? 12 : 17;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath(); c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#fffbe0'; c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  platform(p, time, chapter = 0) {
    if (!p.visible) {
      if (p.type === 'crumble') this.fragments(p, chapter);
      return;
    }
    const c=this.ctx;
    const palettes=[
      {body:'#39334e',deep:'#24243a',patch:'#64536b',edge:'#b09c65',leaf:'#b26383',light:'#e1ad84'},
      {body:'#293c58',deep:'#1b2944',patch:'#4c6581',edge:'#7aabb0',leaf:'#7275ad',light:'#b0d9d3'},
      {body:'#302d50',deep:'#1c203a',patch:'#575071',edge:'#9293bb',leaf:'#a17eae',light:'#d3bcda'}
    ];
    const t=palettes[chapter];c.save();
    if(p.type==='crumble'&&p.touched)c.translate(Math.sin(time*55)*Math.min(1,p.crumbleTime/.85)*3,0);
    // Крупный цельный силуэт с рисованной корневой нижней кромкой.
    c.fillStyle=t.deep;c.beginPath();c.moveTo(p.x,p.y+4);c.lineTo(p.x+p.w,p.y+4);c.lineTo(p.x+p.w-4,p.y+24);
    for(let i=p.w-8;i>0;i-=24)c.lineTo(p.x+i,p.y+31+Math.sin(i*.23)*7);
    c.lineTo(p.x,p.y+24);c.closePath();c.fill();
    c.fillStyle=t.body;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+p.w,p.y);c.lineTo(p.x+p.w-6,p.y+24);c.quadraticCurveTo(p.x+p.w*.6,p.y+19,p.x+3,p.y+27);c.closePath();c.fill();
    // Широкие мазки и ломаные пятна, без повторяющихся круглых камней.
    c.save();c.clip();c.fillStyle=t.patch;c.globalAlpha=.2;
    for(let i=0;i<p.w;i+=41+(i%7)){c.beginPath();c.moveTo(p.x+i-8,p.y+7);c.lineTo(p.x+i+16,p.y+4+(i%5));c.lineTo(p.x+i+29,p.y+17);c.lineTo(p.x+i+6,p.y+21);c.closePath();c.fill();}
    c.restore();
    c.strokeStyle=t.edge;c.lineWidth=3;c.beginPath();c.moveTo(p.x+2,p.y+1);
    for(let i=7;i<p.w;i+=12)c.lineTo(p.x+i,p.y+Math.sin(i*.7)*1.5);
    c.lineTo(p.x+p.w-2,p.y+1);c.stroke();
    // Небольшие группы листьев повторяют силуэты растений в пейзаже.
    for(let i=17;i<p.w-12;i+=53){
      c.strokeStyle=t.deep;c.lineWidth=1.8;c.beginPath();c.moveTo(p.x+i,p.y+1);c.lineTo(p.x+i-2,p.y-13);c.stroke();
      c.fillStyle=t.leaf;c.beginPath();c.moveTo(p.x+i-1,p.y-6);c.quadraticCurveTo(p.x+i-15,p.y-16,p.x+i-8,p.y-18);c.quadraticCurveTo(p.x+i-1,p.y-17,p.x+i-1,p.y-6);c.fill();
      c.beginPath();c.moveTo(p.x+i-1,p.y-8);c.quadraticCurveTo(p.x+i+5,p.y-22,p.x+i+10,p.y-17);c.quadraticCurveTo(p.x+i+9,p.y-11,p.x+i-1,p.y-8);c.fill();
      c.fillStyle=t.light;c.globalAlpha=.65;c.fillRect(p.x+i+8,p.y-4,2,2);c.globalAlpha=1;
    }
    c.strokeStyle=t.deep;c.lineWidth=2;
    for(let i=28;i<p.w-10;i+=62){c.beginPath();c.moveTo(p.x+i,p.y+28);c.bezierCurveTo(p.x+i-6,p.y+42,p.x+i+5,p.y+45,p.x+i-4,p.y+50);c.stroke();}
    if(p.type==='moving'){c.strokeStyle=t.light;c.lineWidth=1;c.globalAlpha=.7;c.beginPath();c.moveTo(p.x+8,p.y+5);c.lineTo(p.x+p.w-8,p.y+5);c.stroke();}
    if (p.type === 'crumble') {
      // Неровные тонкие разломы с короткими ответвлениями, без повторяющегося зигзага.
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (let i = 22, n = 0; i < p.w - 10; i += 39 + n % 3 * 7, n++) {
        const x = p.x + i, bend = Math.sin(p.baseX * .07 + n * 2.4) * 7;
        const depth = 16 + (n * 7 + Math.floor(p.baseX)) % 13;
        c.strokeStyle = '#151527a6'; c.lineWidth = p.touched ? 1.4 : 1;
        c.beginPath(); c.moveTo(x, p.y + 2);
        c.lineTo(x + bend * .4, p.y + 6); c.lineTo(x + bend, p.y + 11);
        c.lineTo(x + bend - 2, p.y + depth * .75); c.lineTo(x + bend + 1, p.y + depth); c.stroke();
        c.lineWidth = .65; c.strokeStyle = '#17152680';
        c.beginPath(); c.moveTo(x + bend, p.y + 11);
        c.lineTo(x + bend + (n % 2 ? -4 : 5), p.y + 14);
        c.lineTo(x + bend + (n % 2 ? -7 : 8), p.y + 15); c.stroke();
        c.strokeStyle = '#d3c2c42e'; c.lineWidth = .6;
        c.beginPath(); c.moveTo(x + 1.5, p.y + 3); c.lineTo(x + bend + 1.5, p.y + 10); c.stroke();
      }
    }
    c.restore();
  }

  // Обломки живут по таймеру платформы: не влияют на коллизии.
  fragments(p, chapter) {
    const age = p.crumbleTime - .85;
    if (age < 0 || age > 1.3) return;
    const c = this.ctx, count = 9;
    c.save(); c.globalAlpha = Math.max(0, 1 - age / 1.3);
    for (let i = 0; i < count; i++) {
      const offset = i - (count - 1) / 2, width = p.w / count;
      c.save();
      c.translate(p.x + (i + .5) * width + offset * age * 24,
        p.y + 10 - (45 + i % 3 * 22) * age + 310 * age * age);
      c.rotate(offset * age * 1.3);
      c.fillStyle = ['#4c3c59', '#3a4f6b', '#484163'][chapter];
      c.strokeStyle = '#aca0b1'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-width / 2, -11); c.lineTo(width / 2, -8);
      c.lineTo(width / 2 + 4, 7); c.lineTo(-3, 15); c.lineTo(-width / 2 - 2, 5);
      c.closePath(); c.fill(); c.stroke(); c.restore();
    }
    c.restore();
  }

  // Тень с круглой головой, белыми глазами и живым дымным хохолком, без накидки.
  enemy(enemy, time) {
    const c = this.ctx, step = Math.sin(time * 8 + enemy.x * .03);
    c.save(); c.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h);
    c.scale(enemy.direction || 1, 1);
    c.fillStyle = '#070a10'; c.shadowColor = '#a49bc366'; c.shadowBlur = 5;
    // Маленькое тело и две шагающие лапки.
    c.beginPath(); c.ellipse(0, -8, 7, 9, 0, 0, Math.PI * 2); c.fill();
    for (const side of [-1, 1]) {
      c.beginPath(); c.ellipse(side * 4 + side * step, -2 - Math.max(0, side * step) * 2, 3.3, 5, side * .15, 0, Math.PI * 2); c.fill();
    }
    c.save(); c.translate(0, Math.sin(time * 2 + enemy.x) * .7);
    c.beginPath(); c.moveTo(-10, -28);
    c.bezierCurveTo(-20, -49, 5, -36, 2, -47);
    c.bezierCurveTo(-2, -60, 24, -53, 13, -42);
    c.bezierCurveTo(1, -38, 1, -32, 9, -28); c.closePath(); c.fill();
    c.beginPath(); c.arc(-2, -54 + Math.sin(time * 3) * 1.2, 2.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0, -22, 14, 15, -.12, 0, Math.PI * 2); c.fill();
    // Лицо отделено от силуэта едва заметным холодным оттенком.
    c.shadowBlur = 0; c.fillStyle = '#10151e';
    c.beginPath(); c.ellipse(2, -21, 11.5, 13.3, -.12, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fffef4'; c.shadowColor = '#e4eeff'; c.shadowBlur = 5;
    c.beginPath(); c.ellipse(-4, -21, 5.3, 7.4, .17, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(8, -23, 3.2, 5.4, -.1, 0, Math.PI * 2); c.fill();
    c.restore(); c.restore();
  }

  player(p, time, scale = 1, equipped = {}) {
    const c=this.ctx;
    if(p.invincible>0&&Math.floor(time*12)%2)return;
    const moving=Math.abs(p.vx)>12, phase=p.walkPhase??time*13;
    const profile=p.profile??Number(moving),sway=moving?Math.sin(phase)*.06:Math.sin(time*1.4)*.025;
    const bob=p.grounded&&moving?Math.abs(Math.sin(phase))*1.3:Math.sin(time*1.6)*.5;
    c.save();c.translate(p.x+p.w/2,p.y+p.h-23*scale+bob*scale);c.scale(scale*p.facing,scale);
    const aura=equipped?.aura==='glow';
    const halo=c.createRadialGradient(0,-2,6,0,-2,aura?48:31);
    halo.addColorStop(0,aura?'#c9e2ff55':'#fff8d82b');halo.addColorStop(1,'#fffde000');
    c.fillStyle=halo;c.fillRect(-52,-58,104,105);
    c.scale(1-profile*.2,1);
    c.shadowColor=aura?'#c6dfff':'#fff7db';c.shadowBlur=aura?20:9;
    // Мягкие широкие ушки с округлыми отростками.
    for (const side of [-1, 1]) {
      c.save(); c.translate(side * 11, -20); c.scale(side, 1); c.rotate(sway);
      c.fillStyle = '#fffdeb'; c.beginPath();
      c.moveTo(-4, 4); c.bezierCurveTo(-8, -2, -14, -9, -13, -14);
      c.bezierCurveTo(-12, -18, -8, -16, -5, -10);
      c.bezierCurveTo(-8, -20, -5, -25, -2, -22);
      c.quadraticCurveTo(0, -20, 2, -12);
      c.bezierCurveTo(2, -23, 7, -26, 9, -22);
      c.quadraticCurveTo(11, -18, 7, -10);
      c.bezierCurveTo(14, -17, 19, -14, 16, -10);
      c.quadraticCurveTo(11, -4, 7, 4); c.closePath(); c.fill(); c.restore();
    }
    // Светлая голова постепенно растворяется в прозрачном теле.
    c.shadowBlur = 0;
    const body = c.createLinearGradient(0, -24, 0, 22);
    body.addColorStop(0, '#fffdec'); body.addColorStop(.35, '#fffdece8');
    body.addColorStop(.65, '#fffdec60'); body.addColorStop(1, '#fffdec25');
    c.fillStyle = body; c.strokeStyle = '#fffdebc9'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-17, -14);
    c.bezierCurveTo(-18, -28, 17, -28, 18, -14);
    c.bezierCurveTo(19, -4, 23, 12, 19, 18);
    c.quadraticCurveTo(0, 25, -19, 18);
    c.bezierCurveTo(-23, 12, -19, -4, -17, -14);
    c.closePath(); c.fill(); c.stroke();
    // Тонкие ручки и светящиеся колечки на животике.
    c.strokeStyle = '#fffdebba'; c.lineWidth = 1.1;
    for (const side of [-1, 1]) {
      c.beginPath(); c.moveTo(side * 17, -1);
      c.bezierCurveTo(side * 23, 4, side * 24, 14, side * 20, 13); c.stroke();
    }
    for (let i = 0; i < 7; i++) {
      c.beginPath(); c.arc(-11 + (i * 7) % 23, 2 + (i * 5) % 13, i % 3 === 0 ? 2 : .8, 0, Math.PI * 2);
      if (i % 3 === 0) c.stroke(); else { c.fillStyle = '#fffdebc9'; c.fill(); }
    }
    // Лапки рисуются поверх прозрачного тела и шагают попеременно.
    for (const leg of [-1, 1]) {
      const step = p.grounded && moving ? Math.sin(phase + (leg === 1 ? Math.PI : 0)) : 0;
      const x = leg * 9 + step * (2 + profile * 4), y = 19 - Math.max(0, -step) * 4;
      c.fillStyle = '#fffdebdd'; c.beginPath();
      c.ellipse(x, y, 6, 3.5, -.15 * leg, 0, Math.PI * 2); c.fill();
    }
    const blink = Math.sin(time * .8) > .996;
    // Приглушённые серо-голубые глазки и рот с едва заметным свечением.
    c.shadowColor = '#b6d4df'; c.shadowBlur = 1.5;
    const eye = (x, opacity = 1) => {
      c.globalAlpha = opacity; c.fillStyle = '#536b77';
      c.beginPath(); c.ellipse(x, -12, 2.7, blink ? .65 : 3.1, 0, 0, Math.PI * 2); c.fill();
      if (!blink) {
        c.fillStyle = '#f9ffff'; c.beginPath(); c.ellipse(x - .5, -12.8, .65, .85, 0, 0, Math.PI * 2); c.fill();
      }
    };
    eye(-6 + profile * 6, 1 - profile); eye(7 + profile * 2);
    c.globalAlpha = 1; c.shadowBlur = 1; c.fillStyle = '#536b77';
    c.beginPath(); c.ellipse(profile * 8, -5.5, 1.3, .85, 0, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    if(equipped?.chest==='bow') {
      c.fillStyle='#e9a6cf';c.beginPath();c.moveTo(0,3);c.lineTo(-7,-1);c.lineTo(-7,8);c.closePath();c.fill();c.beginPath();c.moveTo(0,3);c.lineTo(7,-1);c.lineTo(7,8);c.closePath();c.fill();c.fillStyle='#f7d4e7';c.beginPath();c.arc(0,3,2,0,Math.PI*2);c.fill();
    }
    if(equipped?.pin==='star') {c.fillStyle='#f6d889';c.font='12px Georgia';c.fillText('✦',8,-22);}
    c.restore();
  }

  preview(canvas, equipped) {
    const previous=this.ctx;
    try {this.ctx=canvas.getContext('2d');this.ctx.clearRect(0,0,canvas.width,canvas.height);this.player({x:73,y:120,w:34,h:46,vx:0,vy:0,grounded:true,facing:1,profile:0},0,2,equipped);}
    finally {this.ctx=previous;}
  }

  gate(g, active, time, final, chapter = 0) {
    const c = this.ctx;
    const palette = [
      {frame:'#d99ba3', edge:'#f0c0b8', wood:'#b76c7c', dark:'#794b62', iron:'#52344b', glow:'#ffd2bd'},
      {frame:'#90adc9', edge:'#c2e1ed', wood:'#5b86b1', dark:'#3d6089', iron:'#263b61', glow:'#b8eaff'},
      {frame:'#a593c4', edge:'#d7c2eb', wood:'#8169a4', dark:'#584a7b', iron:'#322d54', glow:'#e4c6ff'}
    ][chapter];
    const w = g.w, h = g.h;
    c.save(); c.translate(g.x, g.y);
    // Каменная арка, деревянные доски и кованые ветви повторяют лесные мотивы.
    c.shadowColor = palette.glow; c.shadowBlur = active ? 24 : 0;
    c.fillStyle = palette.frame; c.strokeStyle = palette.edge; c.lineWidth = 1.7;
    c.beginPath(); c.roundRect(-9, -11, w + 18, h + 12, [w / 2 + 9, w / 2 + 9, 2, 2]); c.fill(); c.stroke(); c.shadowBlur = 0;
    c.save();
    c.beginPath(); c.roundRect(3, 2, w - 6, h - 2, [w / 2 - 3, w / 2 - 3, 1, 1]); c.clip();
    const wood = c.createLinearGradient(0, 0, w, 0); wood.addColorStop(0, palette.dark); wood.addColorStop(.5, palette.wood); wood.addColorStop(1, palette.dark);
    c.fillStyle = wood; c.fillRect(0, 0, w, h);
    for (let i = 8; i < w; i += 8) {
      c.strokeStyle = palette.iron + '77'; c.lineWidth = .8;
      c.beginPath(); c.moveTo(i, 0); c.bezierCurveTo(i - 2, h * .3, i + 2, h * .6, i - 1, h); c.stroke();
      c.strokeStyle = palette.edge + '33'; c.beginPath(); c.moveTo(i + 2, 4); c.lineTo(i + 2, h); c.stroke();
    }
    c.strokeStyle = palette.iron; c.fillStyle = palette.iron; c.lineWidth = 1.7; c.lineCap = 'round';
    for (const y of [32, 79]) {
      c.beginPath(); c.moveTo(w - 4, y + 4);
      c.bezierCurveTo(w * .58, y - 7, w * .17, y + 18, w * .22, y - 5);
      c.bezierCurveTo(w * .23, y - 17, w * .43, y - 17, w * .45, y - 8); c.stroke();
      for (let i = 0; i < 3; i++) {
        const x = w * .3 + i * 10, sy = y + 2 - Math.sin(i) * 4;
        c.beginPath(); c.moveTo(x, sy); c.quadraticCurveTo(x - 6, sy - 12, x - 9, sy - 9);
        c.quadraticCurveTo(x - 9, sy - 3, x, sy); c.fill();
        c.beginPath(); c.moveTo(x, sy); c.quadraticCurveTo(x + 3, sy + 10, x + 7, sy + 8);
        c.quadraticCurveTo(x + 8, sy + 4, x, sy); c.fill();
      }
    }
    // Розетка-цветок и круглая ручка; никаких прямоугольных символов.
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      c.beginPath(); c.ellipse(17 + Math.cos(angle) * 4, 59 + Math.sin(angle) * 4, 2.8, 1.3, angle, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = palette.edge; c.lineWidth = 1; c.beginPath(); c.arc(17, 59, 2.2, 0, Math.PI * 2); c.stroke();
    if (active) {
      c.globalAlpha = .55 + Math.sin(time * 2) * .12; c.strokeStyle = palette.glow; c.lineWidth = 2;
      c.beginPath(); c.moveTo(w - 5, 30); c.lineTo(w - 5, h); c.stroke();
      c.globalAlpha = 1;
    }
    c.restore();
    c.strokeStyle = palette.dark + '99'; c.lineWidth = .8;
    for (let i = 0; i < 5; i++) {
      const angle = Math.PI + i * Math.PI / 4;
      c.beginPath(); c.moveTo(w / 2 + Math.cos(angle) * (w / 2 + 8), 29 + Math.sin(angle) * (w / 2 + 8));
      c.lineTo(w / 2 + Math.cos(angle) * (w / 2 - 1), 29 + Math.sin(angle) * (w / 2 - 1)); c.stroke();
    }
    for (const side of [-5, w + 5]) for (let y = 44; y < h; y += 22) { c.beginPath(); c.moveTo(side - 4, y); c.lineTo(side + 4, y - 1); c.stroke(); }
    c.restore();
  }
}
