/* Движущиеся и рассыпающиеся платформы пользуются той же системой коллизий. */
class Platform {
  constructor(x, y, w, type = 'stone') {
    Object.assign(this, {x, y, w, h: 30, type, baseX: x, baseY: y, dx: 0, dy: 0, visible: true, touched: false, crumbleTime: 0});
  }

  update(dt, time) {
    const oldX = this.x, oldY = this.y;
    if (this.type === 'moving') this.y = this.baseY + Math.sin(time * 1.5 + this.baseX) * 18;
    if (this.type === 'crumble' && this.touched) {
      this.crumbleTime += dt;
      if (this.crumbleTime > .85) this.visible = false;
      if (this.crumbleTime > 4) { this.visible = true; this.touched = false; this.crumbleTime = 0; }
    }
    this.dx = this.x - oldX;
    this.dy = this.y - oldY;
  }
}
