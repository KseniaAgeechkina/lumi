/* Лесной дух: два прыжка между приземлениями и плавный разворот в профиль. */
class Player {
  constructor(x, y) {
    Object.assign(this, {x,y,w:34,h:46,vx:0,vy:0,grounded:false,support:null,facing:1,coyote:0,jumpBuffer:0,invincible:0,jumpsUsed:0,walkPhase:0,profile:0,didDoubleJump:false});
  }

  update(dt, input, platforms) {
    this.didDoubleJump=false;
    this.invincible=Math.max(0,this.invincible-dt);
    // В первый кадр после появления опора уже должна восстанавливать два прыжка.
    if(!this.grounded && this.vy>=0) {
      const floor=platforms.find(p=>p.visible && this.x+this.w>p.x && this.x<p.x+p.w && Math.abs(this.y+this.h-p.y)<2);
      if(floor){this.grounded=true;this.support=floor;this.y=floor.y-this.h;}
    }
    this.coyote=this.grounded?.1:Math.max(0,this.coyote-dt);
    if(this.grounded) this.jumpsUsed=0;
    // После схода с края доступен один воздушный прыжок, не два дополнительных.
    if(!this.grounded && this.coyote===0) this.jumpsUsed=Math.max(1,this.jumpsUsed);
    this.jumpBuffer=input.consumeJump()?.12:Math.max(0,this.jumpBuffer-dt);
    const target=input.direction*235*(this.speedMultiplier || 1);
    const acceleration=this.grounded?1800:1150;
    this.vx+=Math.max(-acceleration*dt,Math.min(acceleration*dt,target-this.vx));
    if(input.direction) this.facing=input.direction;
    this.profile+=(Number(Math.abs(this.vx)>15)-this.profile)*Math.min(1,dt*10);
    if(this.grounded) this.walkPhase+=Math.abs(this.vx)*dt*.065;
    if(this.jumpBuffer>0 && this.jumpsUsed<2) {
      this.jumpsUsed++;
      this.didDoubleJump=this.jumpsUsed===2;
      this.vy=this.didDoubleJump?-510:-550;
      this.coyote=0;this.jumpBuffer=0;this.grounded=false;this.support=null;
    }
    this.vy=Math.min(720,this.vy+1350*dt);
    Collision.move(this,platforms,dt);
    if(this.grounded) this.jumpsUsed=0;
    this.x=Math.max(0,this.x);
  }
}
