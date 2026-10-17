/* Связь кнопок страницы с единственным экземпляром игры. */
const game = new Game(document.getElementById('canvas'));
document.getElementById('start').textContent = 'Играть';
document.getElementById('start').addEventListener('click', () => game.start(game.progress.last));
document.getElementById('open-map').addEventListener('click', () => game.openMap());
document.getElementById('map-button').addEventListener('click', () => game.openMap());
document.getElementById('close-map').addEventListener('click', () => game.closeMap());
document.getElementById('pause-button').addEventListener('click', () => game.togglePause());
document.getElementById('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.getElementById('player').requestFullscreen();
  } catch {game.toast('Полный экран недоступен в этом браузере.');}
});
// Переключение вкладки автоматически ставит игру на паузу.
document.addEventListener('visibilitychange', () => {if (document.hidden) game.togglePause(true);});

for(const [id,method] of [['open-settings','openSettings'],['open-wardrobe','openWardrobe'],['close-settings','closePanel'],['close-wardrobe','closePanel']]) document.getElementById(id).addEventListener('click',()=>game[method]());
document.getElementById('volume').addEventListener('input',event=>{game.settings.volume=Number(event.target.value);game.saveSettings();});
document.getElementById('gentle-mode').addEventListener('change',event=>{game.settings.gentle=event.target.checked;game.saveSettings();});
document.getElementById('particles-mode').addEventListener('change',event=>{game.settings.particles=event.target.checked;game.saveSettings();});

document.getElementById('open-about').addEventListener('click',()=>game.openAbout());
document.getElementById('close-about').addEventListener('click',()=>game.exitToMenu());

document.getElementById('reset-progress').addEventListener('click', () => game.requestProgressReset());

document.getElementById('weapon-button').addEventListener('click', () => game.activateWard());

document.getElementById('boost-button').addEventListener('click', () => game.activateBoost());

document.getElementById('ending-map').addEventListener('click', () => game.openMap());
document.getElementById('ending-menu').addEventListener('click', () => game.exitToMenu());
