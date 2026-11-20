/*
 * Настройки версии «все элементы» (all.html).
 * Подключается после recipes.js и до game.js.
 *
 *   startAllUnlocked  — все элементы сразу в панели
 *   knownRecipes      — все рецепты сразу в книге рецептов
 *   seedBoard         — начальные фишки на столе
 *   saveKey           — отдельное сохранение, чтобы не мешать обычной версии
 */
window.CRAFT_OPTIONS = {
  startAllUnlocked: true,
  knownRecipes: true,
  seedBoard: ['water', 'fire', 'wind', 'earth'],
  saveKey: 'infinity-craft.all.save.v1',
  // Если пары нет в рецептах — предложить выбрать, что получится.
  proposeUnknown: true,
  proposalsKey: 'infinity-craft.proposals.v1',
};
