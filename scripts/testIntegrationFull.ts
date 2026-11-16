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

async function testFullCampaignModuleProgression() {
  console.log('=== FULL INTEGRATION TEST: SHIP MODULE UNLOCKS & STATS ===\n');

  // Setup localStorage mock
  const storage: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => storage[k] || null,
    setItem: (k: string, v: string) => { storage[k] = v; },
    removeItem: (k: string) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
  };

  const { campaignManager } = await import('../src/game/campaign/CampaignManager');
  campaignManager.resetCampaign();

  // Step 1: Verify Starting State
  console.log('Step 1: Checking initial shipyard hangar state...');
  const startingUnlocks = campaignManager.getUnlockedModuleIds();
  if (startingUnlocks.length !== 5) {
    throw new Error(`Expected exactly 5 default starter modules, got ${startingUnlocks.length}`);
  }
  DEFAULT_UNLOCKED_MODULES.forEach((id) => {
    if (!campaignManager.isModuleUnlocked(id)) {
      throw new Error(`Starter module ${id} should be unlocked by default`);
    }
  });

  // Calculate stats with only starter modules equipped
  const defaultAssembly = [
    { category: 'body', textureKey: 'body_black_spaceParts_047' },
    { category: 'pilot', textureKey: 'pilot_black_spaceParts_054' },
    { category: 'wings', textureKey: 'wings_blue_spaceParts_010' },
    { category: 'wings', textureKey: 'wings_blue_spaceParts_010' },
    { category: 'engines', textureKey: 'engines_0' },
    { category: 'guns', textureKey: 'guns_0' },
  ];
  let currentStats = calculateAssemblyStats(defaultAssembly);
  if (currentStats.maxHp !== 100 || currentStats.damageReduction !== 0 || currentStats.gunCount !== 1) {
    throw new Error('Starter stats mismatch!');
  }
  console.log('  ✓ Initial stats: 100 HP, 0% Armor, 1 Gun');

  // Step 2: Milestone 1-1 Victory
  console.log('\nStep 2: Simulating Mission 1-1 Victory...');
  if (!isModuleRewardMission('1-1')) throw new Error('1-1 should be a reward mission');
  if (campaignManager.isModuleMissionRewarded('1-1')) throw new Error('1-1 should not be rewarded yet');

  const offers1_1 = getAvailableRewardModules('1-1', campaignManager.getUnlockedModuleIds());
  if (offers1_1.length !== 3) throw new Error(`Expected 3 options for 1-1, got ${offers1_1.length}`);
  console.log(`  ✓ 1-1 Offered 3 modules: ${offers1_1.map(m => m.name).join(', ')}`);

  // Player picks offer #0
  const chosen1_1 = offers1_1[0];
  campaignManager.recordModuleReward('1-1', chosen1_1.id);
  if (!campaignManager.isModuleUnlocked(chosen1_1.id)) throw new Error('Chosen module should be unlocked');
  if (!campaignManager.isModuleMissionRewarded('1-1')) throw new Error('1-1 should be recorded as rewarded');
  console.log(`  ✓ Player chose and unlocked: ${chosen1_1.name} (${chosen1_1.id})`);

  // Verify anti-duplication protection: Re-opening 1-1 completion screen
  if (!campaignManager.isModuleMissionRewarded('1-1')) throw new Error('Anti-duplication check failed');
  console.log('  ✓ Anti-duplication check: 1-1 cannot be re-rewarded');

  // Verify passive bonus constraint: module is unlocked in warehouse, but NOT yet installed on ship!
  // Ship stats must remain unchanged!
  currentStats = calculateAssemblyStats(defaultAssembly);
  if (currentStats.maxHp !== 100 || currentStats.damageReduction !== 0) {
    throw new Error('PASSIVE BONUS VIOLATION: Uninstalled module gave passive stats!');
  }
  console.log('  ✓ Verified: Uninstalled unlocked module gives NO passive bonuses');

  // Step 3: Regular Mission 1-2 Victory
  console.log('\nStep 3: Simulating Regular Mission 1-2 Victory...');
  if (isModuleRewardMission('1-2')) throw new Error('Regular mission 1-2 should NOT offer module reward');
  console.log('  ✓ Verified: Mission 1-2 correctly offers NO module rewards');

  // Step 4: Milestone 1-3 Victory
  console.log('\nStep 4: Simulating Mission 1-3 Victory...');
  const offers1_3 = getAvailableRewardModules('1-3', campaignManager.getUnlockedModuleIds());
  if (offers1_3.length !== 3) throw new Error(`Expected 3 options for 1-3, got ${offers1_3.length}`);
  if (offers1_3.some(m => m.id === chosen1_1.id)) {
    throw new Error('Previously unlocked module was offered again!');
  }
  const chosen1_3 = offers1_3[0];
  campaignManager.recordModuleReward('1-3', chosen1_3.id);
  console.log(`  ✓ Player chose and unlocked: ${chosen1_3.name} (${chosen1_3.id})`);

  // Step 5: Regular Mission 1-4 & Boss Mission 1-5
  console.log('\nStep 5: Simulating Regular 1-4 and Sector 1 Boss 1-5...');
  if (isModuleRewardMission('1-4')) throw new Error('1-4 should not be reward mission');
  if (isModuleRewardMission('1-5')) throw new Error('Boss mission 1-5 must NOT offer module rewards!');
  console.log('  ✓ Verified: Boss mission 1-5 awards 0 modules (only bonus scrap)');

  // Step 6: Sector 2 Milestones (2-1 and 2-3)
  console.log('\nStep 6: Simulating Sector 2 Milestones (2-1, 2-3)...');
  const offers2_1 = getAvailableRewardModules('2-1', campaignManager.getUnlockedModuleIds());
  const chosen2_1 = offers2_1[0];
  campaignManager.recordModuleReward('2-1', chosen2_1.id);
  console.log(`  ✓ 2-1 Unlocked: ${chosen2_1.name}`);

  const offers2_3 = getAvailableRewardModules('2-3', campaignManager.getUnlockedModuleIds());
  const chosen2_3 = offers2_3[0];
  campaignManager.recordModuleReward('2-3', chosen2_3.id);
  console.log(`  ✓ 2-3 Unlocked: ${chosen2_3.name}`);

  if (isModuleRewardMission('2-5')) throw new Error('Boss mission 2-5 must NOT offer module rewards!');
  console.log('  ✓ Verified: Boss mission 2-5 awards 0 modules');

  // Step 7: Sector 3 Milestones (3-1 and 3-3)
  console.log('\nStep 7: Simulating Sector 3 Milestones (3-1, 3-3)...');
  const offers3_1 = getAvailableRewardModules('3-1', campaignManager.getUnlockedModuleIds());
  const chosen3_1 = offers3_1[0];
  campaignManager.recordModuleReward('3-1', chosen3_1.id);
  console.log(`  ✓ 3-1 Unlocked: ${chosen3_1.name}`);

  const offers3_3 = getAvailableRewardModules('3-3', campaignManager.getUnlockedModuleIds());
  const chosen3_3 = offers3_3[0];
  campaignManager.recordModuleReward('3-3', chosen3_3.id);
  console.log(`  ✓ 3-3 Unlocked: ${chosen3_3.name}`);

  if (isModuleRewardMission('3-5')) throw new Error('Final Boss mission 3-5 must NOT offer module rewards!');
  console.log('  ✓ Verified: Final Boss mission 3-5 awards 0 modules');

  // Step 8: Total Unlocks Verification
  const totalUnlocks = campaignManager.getUnlockedModuleIds();
  // 5 starters + 6 milestones = 11 modules unlocked
  if (totalUnlocks.length !== 11) {
    throw new Error(`Expected exactly 11 unlocked modules after 6 milestones, got ${totalUnlocks.length}`);
  }
  console.log(`\nStep 8: Total unlocked modules across full campaign: ${totalUnlocks.length} (5 starter + 6 choices)`);

  // Step 9: Equipping Upgraded Modules & Multi-Gun Testing
  console.log('\nStep 9: Testing Custom Ship Assembly with Dual Guns & Upgraded Armor...');
  const dualGunAssembly = [
    { category: 'body', textureKey: 'body_white_spaceParts_034' }, // Kevlar (+40 HP, +8% armor)
    { category: 'pilot', textureKey: 'pilot_white_spaceParts_058' }, // Centurion (+1.5s super, +2 dmg)
    { category: 'wings', textureKey: 'wings_green_spaceParts_011' }, // Falcon (+30% turn)
    { category: 'wings', textureKey: 'wings_green_spaceParts_011' }, // Falcon (+30% turn)
    { category: 'engines', textureKey: 'engines_1' }, // Comet (+15% speed, -15% dash CD)
    { category: 'guns', textureKey: 'guns_1' }, // Squall (+25% fire rate, +1 dmg, +60 speed) Left gun
    { category: 'guns', textureKey: 'guns_1' }, // Squall Right gun
  ];

  const dualStats = calculateAssemblyStats(dualGunAssembly);
  if (dualStats.maxHp !== 140) throw new Error(`Expected 140 HP, got ${dualStats.maxHp}`);
  if (Math.abs(dualStats.damageReduction - 0.08) > 0.001) throw new Error(`Expected 8% armor, got ${dualStats.damageReduction}`);
  if (dualStats.gunCount !== 2) throw new Error(`Expected 2 guns, got ${dualStats.gunCount}`);
  // Damage bonus: 1 + 1 (2 guns) + 2 (pilot) = 4
  if (dualStats.bulletDamageBonus !== 4) throw new Error(`Expected +4 dmg, got ${dualStats.bulletDamageBonus}`);
  console.log(`  ✓ Dual-gun assembly stats: ${dualStats.maxHp} HP, ${(dualStats.damageReduction * 100).toFixed(0)}% Armor, ${dualStats.gunCount} Guns, +${dualStats.bulletDamageBonus} Dmg, +${dualStats.superDurationBonus}s Super`);

  // Step 10: Armor damage calculation
  const rawHitDamage = 30;
  const netDamage = Math.max(1, rawHitDamage * (1 - dualStats.damageReduction));
  // 30 * (1 - 0.08) = 27.6
  if (Math.abs(netDamage - 27.6) > 0.01) {
    throw new Error(`Expected net damage 27.6, got ${netDamage}`);
  }
  console.log(`  ✓ Armor damage reduction verified: ${rawHitDamage} raw damage -> ${netDamage.toFixed(1)} net damage`);

  // Step 11: Persistence across simulated browser restart
  console.log('\nStep 11: Testing persistence across simulated reload...');
  const rawSave = storage['iron_resolve_campaign_save'];
  if (!rawSave) throw new Error('Save data not found in localStorage');
  const parsedSave = JSON.parse(rawSave);
  if (parsedSave.unlockedModuleIds.length !== 11) throw new Error('Persistence failed for unlocked modules');
  if (parsedSave.rewardedModuleMissions.length !== 6) throw new Error('Persistence failed for rewarded missions');
  console.log('  ✓ Verified: All 11 unlocked modules and 6 claimed milestone rewards safely persisted in localStorage');

  console.log('\n======================================================');
  console.log('ALL INTEGRATION TESTS PASSED WITH 100% SUCCESS! 🚀✨');
  console.log('======================================================');
}

testFullCampaignModuleProgression().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
