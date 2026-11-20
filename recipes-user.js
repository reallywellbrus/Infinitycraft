/*
 * Записанные вручную рецепты (пришли из all.html → «Мои рецепты»).
 * Перезаписывается командой: node tools/import-proposals.mjs <файл.json>
 * Имена элементов сохраняются ровно в том виде, в каком их ввели (регистр, знаки, эмодзи).
 */
(function (global) {
  'use strict';

  const EXTRA = {
    elements: {
      "custom:c2c0lj": { name: "Flamewall", emoji: "🌋", hue: 10 },
      "custom:2xaz5v": { name: "DVA FIRESTAR", emoji: "😼", hue: 350 },
      "custom:x7yyzn": { name: "Flamestar", emoji: "💫", hue: 280 },
      "custom:firestar-n5gjbld": { name: "firestar", emoji: "🐈", hue: 20 },
      "custom:mzo9k8": { name: "7 лет", emoji: "🎂", hue: 40 },
      "custom:zoink-4qtya2": { name: "Zoink", emoji: "👾", hue: 290 },
      "custom:фурри-k2521e": { name: "Фурри", emoji: "🦊", hue: 30 },
      "custom:o2tkni": { name: "2.2", emoji: "2️⃣", hue: 50 },
      "custom:7mew5l": { name: "Geometry dash", emoji: "🎮", hue: 260 },
      "custom:tidal-wave-rpr8p2": { name: "Tidal wave", emoji: "🌊", hue: 200 },
      "custom:brambleclaw-firestar-dies-this-is-your-chance-nb6lgr1": { name: "BRAMBLECLAW, FIRESTAR DIES!!!!!!!!!!!!! THIS IS YOUR CHANCE!!!!!!!!!!!!!!!!!!!", emoji: "😹", hue: 280 },
      "custom:demon-slayer-np0le4m": { name: "Demon slayer", emoji: "👹", hue: 0 },
      "custom:коготь-nm938ps": { name: "Коготь", emoji: "🐾", hue: 30 },
      "custom:element-7s": { name: "?", emoji: "❓", hue: 260 },
      "custom:артур-jr3ars": { name: "Артур", emoji: "👑", hue: 45 },
      "custom:паранойя-b8uitb": { name: "Паранойя", emoji: "😨", hue: 270 },
      "custom:brambleclaw-nfedah5": { name: "Brambleclaw", emoji: "🐆", hue: 35 },
      "custom:кусты-jwn4wq": { name: "Кусты", emoji: "🌿", hue: 120 },
      "custom:взаимовычитание-ns6uln8": { name: "Взаимовычитание", emoji: "➖", hue: 280 },
      "custom:анти-пчеловуд-8ds66u": { name: "Анти-пчеловуд", emoji: "🚫", hue: 0 },
      "custom:пчеловуд-nbd0xfq": { name: "Пчеловуд", emoji: "🐝", hue: 48 },
      "custom:лаборатория-ng1v9zy": { name: "Лаборатория", emoji: "🧪", hue: 180 },
      "custom:лес-а-за-ним-лес-5sxlsh": { name: "лес а за ним лес", emoji: "🌲", hue: 145 },
      "custom:большой-любитель-грибов-gmpipz": { name: "БОЛЬШОЙ ЛЮБИТЕЛЬ ГРИБОВ!!!", emoji: "🤤", hue: 350 },
      "custom:два-больших-любителя-грибов-nrbjal8": { name: "ДВА БОЛЬШИХ ЛЮБИТЕЛЯ ГРИБОВ???????????", emoji: "👬", hue: 30 },
      "custom:четыре-гриба-nke3wbn": { name: "ЧЕТЫРЕ ГРИБА!!!!!!!!!!!!!!!!!!!!", emoji: "🍀", hue: 120 },
      "custom:три-гриба": { name: "ТРИ ГРИБА!!!!!!!!!!!!!!!!", emoji: "3️⃣", hue: 100 },
      "custom:два-гриба": { name: "Два гриба!!!", emoji: "🍄", hue: 30 },
      "custom:парк": { name: "парк", emoji: "🎡", hue: 190 },
    },
    recipes: [
      ["custom:c2c0lj", "custom:2xaz5v", "custom:x7yyzn"],
      ["custom:firestar-n5gjbld", "custom:firestar-n5gjbld", "custom:2xaz5v"],
      ["custom:mzo9k8", "custom:zoink-4qtya2", "custom:фурри-k2521e"],
      ["time", "custom:o2tkni", "custom:mzo9k8"],
      ["time", "custom:7mew5l", "custom:o2tkni"],
      ["custom:tidal-wave-rpr8p2", "custom:c2c0lj", "custom:7mew5l"],
      ["fire", "custom:tidal-wave-rpr8p2", "custom:c2c0lj"],
      ["custom:brambleclaw-firestar-dies-this-is-your-chance-nb6lgr1", "storm", "sandstorm"],
      ["custom:zoink-4qtya2", "custom:фурри-k2521e", "love"],
      ["custom:фурри-k2521e", "custom:demon-slayer-np0le4m", "custom:zoink-4qtya2"],
      ["human", "custom:tidal-wave-rpr8p2", "custom:demon-slayer-np0le4m"],
      ["wave", "tsunami", "custom:tidal-wave-rpr8p2"],
      ["custom:коготь-nm938ps", "man", "custom:фурри-k2521e"],
      ["custom:коготь-nm938ps", "woman", "custom:фурри-k2521e"],
      ["custom:element-7s", "custom:артур-jr3ars", "custom:паранойя-b8uitb"],
      ["custom:brambleclaw-firestar-dies-this-is-your-chance-nb6lgr1", "rainbow", "custom:element-7s"],
      ["custom:firestar-n5gjbld", "custom:brambleclaw-nfedah5", "custom:brambleclaw-firestar-dies-this-is-your-chance-nb6lgr1"],
      ["custom:кусты-jwn4wq", "custom:коготь-nm938ps", "custom:brambleclaw-nfedah5"],
      ["custom:взаимовычитание-ns6uln8", "custom:firestar-n5gjbld", "custom:коготь-nm938ps"],
      ["custom:анти-пчеловуд-8ds66u", "custom:пчеловуд-nbd0xfq", "custom:взаимовычитание-ns6uln8"],
      ["custom:паранойя-b8uitb", "custom:анти-пчеловуд-8ds66u", "custom:артур-jr3ars"],
      ["custom:паранойя-b8uitb", "custom:лаборатория-ng1v9zy", "custom:анти-пчеловуд-8ds66u"],
      ["seed", "custom:артур-jr3ars", "custom:лаборатория-ng1v9zy"],
      ["human", "custom:паранойя-b8uitb", "custom:артур-jr3ars"],
      ["custom:пчеловуд-nbd0xfq", "custom:пчеловуд-nbd0xfq", "custom:паранойя-b8uitb"],
      ["bee", "bee", "custom:пчеловуд-nbd0xfq"],
      ["knowledge", "animal", "human"],
      ["tree", "plant", "custom:кусты-jwn4wq"],
      ["forest", "forest", "custom:лес-а-за-ним-лес-5sxlsh"],
      ["fire", "sun", "custom:firestar-n5gjbld"],
      ["custom:большой-любитель-грибов-gmpipz", "custom:большой-любитель-грибов-gmpipz", "custom:два-больших-любителя-грибов-nrbjal8"],
      ["custom:четыре-гриба-nke3wbn", "custom:четыре-гриба-nke3wbn", "custom:большой-любитель-грибов-gmpipz"],
      ["mushroom", "custom:три-гриба", "custom:четыре-гриба-nke3wbn"],
      ["custom:два-гриба", "custom:два-гриба", "custom:четыре-гриба-nke3wbn"],
      ["steam", "custom:три-гриба", "custom:парк"],
      ["mushroom", "custom:два-гриба", "custom:три-гриба"],
      ["mushroom", "mushroom", "custom:два-гриба"],
    ],
  };

  global.CRAFT_EXTRA = EXTRA;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EXTRA;
  }
})(typeof window !== 'undefined' ? window : globalThis);
