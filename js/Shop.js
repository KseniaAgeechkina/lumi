/* Счёт уровня и кошелёк независимы. Покупка списывает очки ровно один раз. */
const SHOP_ITEMS = [
  {id:'ward',kind:'consumable',inventoryKey:'charges',name:'Световой оберег',price:80,icon:'◉',color:'#a9ddff',description:'E · 5 секунд защиты и атаки теней. До 3 зарядов.'},
  {id:'bow',slot:'chest',name:'Бантик на грудь',price:200,icon:'⋈',color:'#edb7d8',description:'Нежный розовый бантик.'},
  {id:'glow',slot:'aura',name:'Лунная подсветка',price:500,icon:'☾',color:'#c2d9ff',description:'Усиленное голубое свечение.'},
  {id:'star',slot:'pin',name:'Звёздный значок',price:300,icon:'✦',color:'#f4dc9d',description:'Маленькая звезда у ушка.'},
  {id:'spark',slot:'trail',name:'След светлячков',price:700,icon:'⁙',color:'#e4d8ff',description:'Сияющий след при движении.'},
  {id:'boost',kind:'consumable',inventoryKey:'boostCharges',name:'Попутный ветер',price:60,icon:'»',color:'#ffe0af',description:'Shift · Быстрый бег на 6 секунд. До 3 зарядов.'}
];
class Shop {
  constructor(saved, initialPoints = 0) {
    this.wallet = Number.isSafeInteger(saved?.wallet) && saved.wallet >= 0 ? saved.wallet : Math.max(0, Math.floor(initialPoints));
    this.charges = Number.isInteger(saved?.charges) ? Math.max(0, Math.min(3, saved.charges)) : 0;
    this.boostCharges = Number.isInteger(saved?.boostCharges) ? Math.max(0, Math.min(3, saved.boostCharges)) : 0;
    this.owned = new Set((Array.isArray(saved?.owned) ? saved.owned : []).filter(id=>SHOP_ITEMS.some(item=>item.id===id)));
    this.equipped = {};
    for(const [slot,id] of Object.entries(saved?.equipped || {})) {
      if(this.owned.has(id) && SHOP_ITEMS.some(item=>item.id===id && item.slot===slot)) this.equipped[slot]=id;
    }
  }

  earn(points) {
    if(!Number.isSafeInteger(points) || points <= 0 || !Number.isSafeInteger(this.wallet + points)) return;
    this.wallet += points;
  }

  purchase(id) {
    const item=SHOP_ITEMS.find(item=>item.id===id);
    if (!item) return false;
    if (item.kind === 'consumable') {
      if (this.wallet < item.price || this[item.inventoryKey] >= 3) return false;
      this.wallet -= item.price; this[item.inventoryKey]++; return true;
    }
    if(this.owned.has(id)) return false;
    if(this.wallet<item.price) return false;
    this.wallet-=item.price;this.owned.add(id);this.equipped[item.slot]=id;
    return true;
  }

  toggle(id) {
    const item=SHOP_ITEMS.find(item=>item.id===id);
    if(!item || !this.owned.has(id)) return false;
    if(this.equipped[item.slot]===id) delete this.equipped[item.slot];
    else this.equipped[item.slot]=id;
    return true;
  }

  consumeWard() {
    if (this.charges <= 0) return false;
    this.charges--; return true;
  }

  consumeBoost() {
    if (this.boostCharges <= 0) return false;
    this.boostCharges--; return true;
  }

  serialize() {return {boostCharges:this.boostCharges,charges:this.charges,wallet:this.wallet,owned:[...this.owned],equipped:{...this.equipped}};}
}
