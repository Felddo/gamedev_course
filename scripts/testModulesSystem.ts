import {
  SHIP_MODULES_CATALOG,
  DEFAULT_UNLOCKED_MODULES,
  MODULE_REWARD_MISSIONS,
  isModuleRewardMission,
  getAvailableRewardModules,
  calculateAssemblyStats,
  getModuleById,
  getModuleByPartId,
} from '../src/game/shipBuilder/modulesCatalog';
import { CATEGORY_LIMITS } from '../src/game/shipBuilder/ShipBuilderModal';

async function runTests() {
  console.log('--- 1. Testing Catalog Structure ---');
  if (SHIP_MODULES_CATALOG.length !== 20) {
    throw new Error(`Expected 20 modules, found ${SHIP_MODULES_CATALOG.length}`);
  }
  console.log('✓ SHIP_MODULES_CATALOG has 20 modules');

  const categories = ['pilot', 'body', 'wings', 'engines', 'guns'];
  categories.forEach((cat) => {
    const mods = SHIP_MODULES_CATALOG.filter((m) => m.category === cat);
    if (mods.length !== 4) {
      throw new Error(`Category ${cat} should have 4 modules, found ${mods.length}`);
    }
  });
  console.log('✓ All 5 categories have exactly 4 modules (1 starter + 3 unlockables)');

  // Check Starter Modules
  if (DEFAULT_UNLOCKED_MODULES.length !== 5) {
    throw new Error(`Expected 5 starter modules, found ${DEFAULT_UNLOCKED_MODULES.length}`);
  }
  DEFAULT_UNLOCKED_MODULES.forEach((id) => {
    const mod = getModuleById(id);
    if (!mod || mod.tier !== 0) {
      throw new Error(`Starter module ${id} not found or tier != 0`);
    }
  });
  console.log('✓ 5 Starter modules correctly defined with tier 0');

  console.log('\n--- 2. Testing Milestone Missions ---');
  const expectedMilestones = ['1-1', '1-3', '2-1', '2-3', '3-1', '3-3'];
  expectedMilestones.forEach((mId) => {
    if (!isModuleRewardMission(mId)) {
      throw new Error(`Mission ${mId} should be a module reward mission!`);
    }
  });
  const bossMissions = ['1-5', '2-5', '3-5'];
  bossMissions.forEach((mId) => {
    if (isModuleRewardMission(mId)) {
      throw new Error(`Boss mission ${mId} should NOT be a module reward mission!`);
    }
  });
  console.log('✓ Module reward missions (6 milestones) verified, boss missions (1-5, 2-5, 3-5) award 0 modules');

  console.log('\n--- 3. Testing getAvailableRewardModules ---');
  // At 1-1 with only starters unlocked
  const options1_1 = getAvailableRewardModules('1-1', [...DEFAULT_UNLOCKED_MODULES]);
  if (options1_1.length !== 3) {
    throw new Error(`Expected 3 options for 1-1, got ${options1_1.length}`);
  }
  options1_1.forEach((opt) => {
    if (DEFAULT_UNLOCKED_MODULES.includes(opt.id)) {
      throw new Error(`Already unlocked starter module ${opt.id} was offered as a reward!`);
    }
    if (opt.tier !== 1) {
      throw new Error(`Offered option ${opt.id} should be Tier 1 for mission 1-1, got tier ${opt.tier}`);
    }
  });
  console.log('✓ 1-1 offers 3 Tier-1 un-unlocked module options');

  // If player unlocks all but 2 modules
  const almostAll = SHIP_MODULES_CATALOG.slice(0, 18).map((m) => m.id);
  const remaining = getAvailableRewardModules('3-3', almostAll);
  if (remaining.length !== 2) {
    throw new Error(`Expected 2 remaining options, got ${remaining.length}`);
  }
  console.log('✓ Correctly handles case when fewer than 3 un-unlocked modules remain');

  // If player unlocks all modules
  const allIds = SHIP_MODULES_CATALOG.map((m) => m.id);
  const none = getAvailableRewardModules('3-3', allIds);
  if (none.length !== 0) {
    throw new Error(`Expected 0 options when all modules unlocked, got ${none.length}`);
  }
  console.log('✓ Returns empty array when all modules are already unlocked');

  console.log('\n--- 4. Testing calculateAssemblyStats ---');
  // Starter Assembly: 1 standard body, 1 standard pilot, 2 standard wings, 1 standard engine, 1 standard gun
  const starterAssembly = [
    { category: 'body', textureKey: 'body_black_spaceParts_047' },
    { category: 'pilot', textureKey: 'pilot_black_spaceParts_054' },
    { category: 'wings', textureKey: 'wings_blue_spaceParts_010' },
    { category: 'wings', textureKey: 'wings_blue_spaceParts_010' },
    { category: 'engines', textureKey: 'engines_0' },
    { category: 'guns', textureKey: 'guns_0' },
  ];
  const starterStats = calculateAssemblyStats(starterAssembly);
  if (starterStats.maxHp !== 100) {
    throw new Error(`Expected starter maxHp 100, got ${starterStats.maxHp}`);
  }
  if (starterStats.damageReduction !== 0) {
    throw new Error(`Expected starter armor 0%, got ${starterStats.damageReduction}`);
  }
  if (starterStats.gunCount !== 1) {
    throw new Error(`Expected gunCount 1, got ${starterStats.gunCount}`);
  }
  console.log('✓ Starter assembly stats: 100 HP, 0% Armor, 1 Gun');

  // Upgraded Assembly with Dreadnought Body (+150 HP, 25% Armor), Singularity Engine (1.4x Speed, 0.58x Dash CD), Valkyrie Wings (2.0x Turn), Armageddon Guns x2 (+12 Dmg x2, 1.35x FireRate x2), Nemesis Pilot (+4s Super, 0.6x Super CD, +8 Dmg)
  const upgradedAssembly = [
    { category: 'body', textureKey: 'body_black_spaceParts_055' }, // mod_body_dreadnought
    { category: 'pilot', textureKey: 'pilot_white_spaceParts_062' }, // mod_pilot_nemesis
    { category: 'wings', textureKey: 'wings_red_spaceParts_001' }, // mod_wings_valkyrie
    { category: 'wings', textureKey: 'wings_red_spaceParts_001' }, // mod_wings_valkyrie
    { category: 'engines', textureKey: 'engines_3' }, // mod_engine_singularity
    { category: 'guns', textureKey: 'guns_3' }, // mod_gun_twin_accelerator #1
    { category: 'guns', textureKey: 'guns_3' }, // mod_gun_twin_accelerator #2
  ];
  const upgradedStats = calculateAssemblyStats(upgradedAssembly);
  if (upgradedStats.maxHp !== 250) {
    throw new Error(`Expected upgraded maxHp 250 (100+150), got ${upgradedStats.maxHp}`);
  }
  if (upgradedStats.damageReduction !== 0.25) {
    throw new Error(`Expected upgraded armor 25%, got ${upgradedStats.damageReduction}`);
  }
  if (upgradedStats.gunCount !== 2) {
    throw new Error(`Expected gunCount 2, got ${upgradedStats.gunCount}`);
  }
  // Damage bonus: 12 + 12 (two guns) + 8 (pilot) = 32
  if (upgradedStats.bulletDamageBonus !== 32) {
    throw new Error(`Expected damage bonus 32, got ${upgradedStats.bulletDamageBonus}`);
  }
  if (upgradedStats.superDurationBonus !== 4.0) {
    throw new Error(`Expected super duration bonus 4.0, got ${upgradedStats.superDurationBonus}`);
  }
  console.log(`✓ Upgraded assembly stats verified: ${upgradedStats.maxHp} HP, ${upgradedStats.damageReduction * 100}% Armor, ${upgradedStats.gunCount} Guns, +${upgradedStats.bulletDamageBonus} Dmg, +${upgradedStats.superDurationBonus}s Super`);

  console.log('\n--- 5. Testing Category Limits ---');
  if (CATEGORY_LIMITS.guns.max !== 2) {
    throw new Error(`Expected guns max limit to be 2, got ${CATEGORY_LIMITS.guns.max}`);
  }
  if (CATEGORY_LIMITS.body.max !== 1 || CATEGORY_LIMITS.pilot.max !== 1 || CATEGORY_LIMITS.wings.max !== 2 || CATEGORY_LIMITS.engines.max !== 1) {
    throw new Error('Category limits check failed');
  }
  console.log('✓ CATEGORY_LIMITS verified: Body 1, Pilot 1, Wings 2, Engines 1, Guns 2');

  console.log('\n--- 6. Testing CampaignManager Unlocks & Persistence ---');
  // Mock localStorage for Node environment
  const mockStorage: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  };

  const { campaignManager } = await import('../src/game/campaign/CampaignManager');
  campaignManager.resetCampaign();

  // 1. Initial State
  const initialUnlocks = campaignManager.getUnlockedModuleIds();
  if (initialUnlocks.length !== 5) {
    throw new Error(`Expected 5 initial unlocked modules, got ${initialUnlocks.length}`);
  }
  if (!campaignManager.isModuleUnlocked('mod_body_standard')) {
    throw new Error('mod_body_standard should be unlocked initially');
  }
  if (campaignManager.isModuleUnlocked('mod_body_reinforced')) {
    throw new Error('mod_body_reinforced should NOT be unlocked initially');
  }
  console.log('✓ Campaign starts with only 5 starter modules unlocked');

  // 2. Unlocking a module
  const unlocked = campaignManager.unlockModule('mod_body_reinforced');
  if (!unlocked || !campaignManager.isModuleUnlocked('mod_body_reinforced')) {
    throw new Error('Failed to unlock mod_body_reinforced');
  }
  const unlockAgain = campaignManager.unlockModule('mod_body_reinforced');
  if (unlockAgain) {
    throw new Error('Second unlock should return false');
  }
  console.log('✓ unlockModule accurately unlocks new module and prevents duplicate unlock');

  // 3. Module reward recording (milestone)
  if (campaignManager.isModuleMissionRewarded('1-1')) {
    throw new Error('1-1 should not be rewarded initially');
  }
  campaignManager.recordModuleReward('1-1', 'mod_gun_rapid');
  if (!campaignManager.isModuleMissionRewarded('1-1')) {
    throw new Error('1-1 should now be rewarded');
  }
  if (!campaignManager.isModuleUnlocked('mod_gun_rapid')) {
    throw new Error('mod_gun_rapid should be unlocked after recordModuleReward');
  }
  console.log('✓ recordModuleReward marks mission rewarded and unlocks chosen module');

  // 4. Assembly saving & loading
  const testParts = [
    {
      uid: 'u1',
      partId: 'body_black_spaceParts_047',
      x: 100,
      y: 100,
      zIndex: 1,
      rotation: 0,
      flipX: false,
      width: 70,
      height: 70,
    },
    {
      uid: 'u2',
      partId: 'guns_0',
      x: 100,
      y: 50,
      zIndex: 2,
      rotation: 0,
      flipX: false,
      width: 70,
      height: 70,
    },
  ];
  campaignManager.saveShipAssembly(testParts);
  const loadedParts = campaignManager.getSavedShipAssembly();
  if (!loadedParts || loadedParts.length !== 2 || loadedParts[1].partId !== 'guns_0') {
    throw new Error('Assembly save/load round-trip mismatch');
  }
  console.log('✓ Ship assembly saved to and loaded from persistence accurately');

  // 5. Reset campaign
  campaignManager.resetCampaign();
  if (campaignManager.getUnlockedModuleIds().length !== 5) {
    throw new Error('After resetCampaign, unlocked modules should return to 5 starters');
  }
  if (campaignManager.isModuleMissionRewarded('1-1')) {
    throw new Error('After resetCampaign, rewarded missions should be empty');
  }
  if (campaignManager.getSavedShipAssembly() !== undefined) {
    throw new Error('After resetCampaign, saved assembly should be cleared');
  }
  console.log('✓ resetCampaign resets unlocked modules to 5 starters, clears rewards and assembly');

  console.log('\n=========================================');
  console.log('ALL MODULE SYSTEM UNIT TESTS PASSED! 🚀');
  console.log('=========================================');
}

runTests();
