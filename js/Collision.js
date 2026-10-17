/* Коллизии AABB. Раздельное разрешение осей не позволяет проходить сквозь стены. */
class Collision {
  static overlaps(a, b) {
    return a.x < b.x + b.w - .001 && a.x + a.w > b.x + .001 && a.y < b.y + b.h - .001 && a.y + a.h > b.y + .001;
  }

  static move(player, platforms, dt) {
    const solid = platforms.filter(platform => platform.visible);
    if (player.support?.visible) {
      player.x += player.support.dx;
      player.y += player.support.dy;
    }
    const previousX = player.x;
    player.x += player.vx * dt;
    for (const platform of solid) {
      if (!Collision.overlaps(player, platform)) continue;
      if (player.vx > 0 && previousX + player.w <= platform.x + .01) {player.x = platform.x - player.w; player.vx = 0;}
      if (player.vx < 0 && previousX >= platform.x + platform.w - .01) {player.x = platform.x + platform.w; player.vx = 0;}
    }
    player.y += player.vy * dt;
    player.grounded = false;
    player.support = null;
    for (const platform of solid) {
      if (!Collision.overlaps(player, platform)) continue;
      if (player.vy >= 0) {
        player.y = platform.y - player.h;
        player.grounded = true;
        player.support = platform;
        platform.touched = true;
      } else {
        player.y = platform.y + platform.h;
      }
      player.vy = 0;
    }
  }
}
