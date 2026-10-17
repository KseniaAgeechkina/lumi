/* Нажатия хранятся отдельно от физики; удержание прыжка не повторяет его. */
class InputHandler {
  constructor(target, onPause) {
    this.keys = new Set();
    this.jumpPressed = false;
    this.weaponPressed = false;
    this.boostPressed = false;
    this.target = target;
    this.down = event => {
      if (['Space','ArrowUp','ArrowLeft','ArrowRight','KeyW','KeyA','KeyD','KeyE','ShiftLeft','ShiftRight','Escape'].includes(event.code)) event.preventDefault();
      if (event.code === 'Escape' && !event.repeat) onPause();
      if (['Space','KeyW','ArrowUp'].includes(event.code) && !event.repeat) this.jumpPressed = true;
      if (event.code === 'KeyE' && !event.repeat) this.weaponPressed = true;
      if (['ShiftLeft','ShiftRight'].includes(event.code) && !event.repeat) this.boostPressed = true;
      this.keys.add(event.code);
    };
    this.up = event => this.keys.delete(event.code);
    this.blur = () => { this.clear(); onPause(true); };
    target.addEventListener('keydown', this.down);
    target.addEventListener('keyup', this.up);
    target.addEventListener('blur', this.blur);
  }

  get direction() {
    return Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
  }

  consumeJump() {
    const value = this.jumpPressed;
    this.jumpPressed = false;
    return value;
  }

  consumeWeapon() { const value = this.weaponPressed; this.weaponPressed = false; return value; }

  consumeBoost() { const value = this.boostPressed; this.boostPressed = false; return value; }

  clear() { this.keys.clear(); this.jumpPressed = false; this.weaponPressed = false; this.boostPressed = false; }

  destroy() {
    this.target.removeEventListener('keydown', this.down);
    this.target.removeEventListener('keyup', this.up);
    this.target.removeEventListener('blur', this.blur);
  }
}
