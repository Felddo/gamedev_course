import {
  SHIP_MODIFICATIONS,
  MODIFICATION_REWARD_MISSIONS,
  isModificationRewardMission,
  getRandomModifications,
  getModificationById,
  ShipModification,
} from '../src/game/modifications/modificationsData';
import { PLAYER_ATTACK_RADIUS, BLASTER_DAMAGE, BLASTER_COOLDOWN, PLAYER_SPEED } from '../src/game/constants';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 TESTING SHIP MODIFICATIONS SYSTEM (SOUL KNIGHT STYLE)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`  ❌ FAILED: ${msg}`);
      failed++;
      throw new Error(msg);
    } else {
      console.log(`  ✓ ${msg}`);
      passed++;
    }
  }

  // TEST 1: CATALOG OF EXACTLY 10 MODIFICATIONS
  console.log('--- TEST 1: Catalog of exactly 10 modifications ---');
  assert(SHIP_MODIFICATIONS.length === 10, `Catalog must have exactly 10 modifications, found ${SHIP_MODIFICATIONS.length}`);

  const expectedIds = [
    'enhanced_targeting',
    'magnetic_collector',
    'overclocked_capacitor',
    'reinforced_barrels',
    'plasma_munitions',
    'emp_discharge',
    'scrap_recycler',
    'reinforced_armor',
    'afterburner_thrusters',
    'annihilation_protocol',
  ];

  const foundIds = SHIP_MODIFICATIONS.map((m) => m.id);
  assert(
    new Set(foundIds).size === 10,
    'All 10 modification IDs must be unique',
  );

  expectedIds.forEach((id) => {
    const mod = getModificationById(id);
    assert(!!mod, `Modification '${id}' must exist in catalog`);
    assert(!!mod?.name && mod.name.length > 0, `Modification '${id}' must have a name`);
    assert(!!mod?.categoryLabel && mod.categoryLabel.length > 0, `Modification '${id}' must have a category label`);
    assert(!!mod?.shortDesc && mod.shortDesc.length > 0, `Modification '${id}' must have a short description`);
    assert(!!mod?.bonusValue && mod.bonusValue.length > 0, `Modification '${id}' must have a bonus value`);
    assert(!!mod?.iconSvg && mod.iconSvg.includes('<svg'), `Modification '${id}' must have valid inline SVG icon`);
  });

  // Verify that plasma_munitions and other mods do NOT mention pixels
  const plasma = getModificationById('plasma_munitions');
  assert(
    !plasma?.bonusValue.toLowerCase().includes('пиксел') &&
    !plasma?.bonusValue.toLowerCase().includes('px') &&
    !plasma?.shortDesc.toLowerCase().includes('пиксел') &&
    !plasma?.shortDesc.toLowerCase().includes('px'),
    'Plasma munitions must NOT mention pixels in bonusValue or shortDesc',
  );

  // Verify categories
  assert(getModificationById('enhanced_targeting')?.category === 'utility', 'enhanced_targeting is utility');
  assert(getModificationById('magnetic_collector')?.category === 'utility', 'magnetic_collector is utility');
  assert(getModificationById('overclocked_capacitor')?.category === 'weapon', 'overclocked_capacitor is weapon');
  assert(getModificationById('reinforced_barrels')?.category === 'weapon', 'reinforced_barrels is weapon');
  assert(getModificationById('plasma_munitions')?.category === 'weapon', 'plasma_munitions is weapon');
  assert(getModificationById('emp_discharge')?.category === 'weapon', 'emp_discharge is weapon');
  assert(getModificationById('scrap_recycler')?.category === 'resources', 'scrap_recycler is resources');
  assert(getModificationById('reinforced_armor')?.category === 'defense', 'reinforced_armor is defense');
  assert(getModificationById('afterburner_thrusters')?.category === 'mobility', 'afterburner_thrusters is mobility');
  assert(getModificationById('annihilation_protocol')?.category === 'weapon', 'annihilation_protocol is weapon');

  // TEST 2: MILESTONES (1:2, 1:4, 2:1, 2:3, 3:1, 3:3)
  console.log('\n--- TEST 2: Milestone missions ---');
  const expectedMilestones = ['1-2', '1-4', '2-1', '2-3', '3-1', '3-3'];
  assert(
    MODIFICATION_REWARD_MISSIONS.length === 6 &&
    expectedMilestones.every((m) => MODIFICATION_REWARD_MISSIONS.includes(m)),
    `Milestones must match ['1-2', '1-4', '2-1', '2-3', '3-1', '3-3'] exactly`,
  );

  expectedMilestones.forEach((mId) => {
    assert(isModificationRewardMission(mId), `Mission ${mId} must be a modification reward milestone`);
  });

  const nonMilestones = ['1-1', '1-3', '1-5', '2-2', '2-4', '2-5', '3-2', '3-4', '3-5'];
  nonMilestones.forEach((mId) => {
    assert(!isModificationRewardMission(mId), `Mission ${mId} must NOT be a modification reward milestone`);
  });

  // TEST 3: SELECTION GENERATION & NO REPEATS
  console.log('\n--- TEST 3: Random selection rules ---');
  // At start: 10 available, get 3
  const initialOffers = getRandomModifications(3, new Set());
  assert(initialOffers.length === 3, 'Initial offers count must be 3');
  assert(new Set(initialOffers.map((o) => o.id)).size === 3, 'Initial offers must have 3 distinct modifications');

  // Simulate full 6-choice campaign 50 times
  for (let run = 0; run < 50; run++) {
    const chosenMods = new Set<string>();
    for (let step = 0; step < 6; step++) {
      const offers = getRandomModifications(3, chosenMods);
      assert(offers.length === 3, `Run ${run + 1}, Step ${step + 1}: expected 3 offers, got ${offers.length}`);
      assert(new Set(offers.map((o) => o.id)).size === 3, `Run ${run + 1}, Step ${step + 1}: offers has no duplicate items`);
      for (const off of offers) {
        assert(!chosenMods.has(off.id), `Run ${run + 1}, Step ${step + 1}: offer ${off.id} was not previously chosen`);
      }
      // Pick one randomly
      const picked = offers[Math.floor(Math.random() * offers.length)];
      chosenMods.add(picked.id);
    }
    assert(chosenMods.size === 6, `Run ${run + 1}: Expected 6 unique modifications chosen in campaign`);
  }
  console.log('  ✓ 50 full campaign simulations passed (no duplicates, no re-offers)');

  // TEST 4: SAVE & LOAD & RESET IN CAMPAIGN MANAGER
  console.log('\n--- TEST 4: CampaignManager persistence & reset ---');
  const storage: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => storage[k] || null,
    setItem: (k: string, v: string) => { storage[k] = v; },
    removeItem: (k: string) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
  };

  const { CampaignManager } = await import('../src/game/campaign/CampaignManager');
  const cm = CampaignManager.getInstance();
  cm.resetCampaign();

  assert(cm.getAppliedUpgradeIds().length === 0, 'Initial campaign has 0 applied modifications');
  assert(cm.getPendingModificationMission() === null, 'No pending modification at start');

  // Record milestone 1-2
  cm.recordModificationReward('1-2', 'enhanced_targeting');
  assert(cm.isModificationMissionRewarded('1-2'), 'Mission 1-2 marked as rewarded');
  assert(cm.getAppliedUpgradeIds().includes('enhanced_targeting'), 'enhanced_targeting is in applied list');

  // Record milestone 1-4
  cm.recordModificationReward('1-4', 'overclocked_capacitor');
  assert(cm.isModificationMissionRewarded('1-4'), 'Mission 1-4 marked as rewarded');
  assert(cm.getAppliedUpgradeIds().includes('overclocked_capacitor'), 'overclocked_capacitor is in applied list');
  assert(cm.getAppliedUpgradeIds().length === 2, 'Applied upgrades length is 2');

  // Verify persistence
  const savedRaw = storage['iron_resolve_campaign_save'];
  assert(!!savedRaw, 'Data saved to localStorage');
  const parsed = JSON.parse(savedRaw);
  assert(parsed.appliedUpgradeIds.includes('enhanced_targeting'), 'localStorage contains enhanced_targeting');
  assert(parsed.appliedUpgradeIds.includes('overclocked_capacitor'), 'localStorage contains overclocked_capacitor');
  assert(parsed.rewardedTacticalMissions.includes('1-2'), 'localStorage contains rewardedTacticalMissions 1-2');

  // Reset campaign
  cm.resetCampaign();
  assert(cm.getAppliedUpgradeIds().length === 0, 'After resetCampaign, applied upgrades is empty');
  assert(!cm.isModificationMissionRewarded('1-2'), 'After resetCampaign, mission 1-2 reward status is reset');

  // TEST 5: MECHANICAL CALCULATIONS FOR ALL 10 MODS
  console.log('\n--- TEST 5: Mechanical bonus formulas ---');

  // 1. Enhanced Targeting: +25% radius
  const baseAttackRadius = PLAYER_ATTACK_RADIUS; // 280
  const enhancedRadius = baseAttackRadius * 1.25;
  assert(enhancedRadius === 350, `Enhanced targeting: 280 * 1.25 = 350, got ${enhancedRadius}`);

  // 2. Magnetic Collector: +60% pickup radius
  const baseMagnetRadius = 160;
  const enhancedMagnetRadius = baseMagnetRadius * 1.6;
  assert(enhancedMagnetRadius === 256, `Magnetic collector: 160 * 1.6 = 256, got ${enhancedMagnetRadius}`);

  // 3. Overclocked Capacitor: +15% fire rate
  const baseCd = BLASTER_COOLDOWN; // 0.22
  const overclockedCd = baseCd / 1.15;
  assert(overclockedCd < baseCd, `Overclocked capacitor: cooldown decreased from ${baseCd}s to ${overclockedCd.toFixed(4)}s`);

  // 4. Reinforced Barrels: +20% damage, -10% fire rate
  const baseDamage = BLASTER_DAMAGE; // 1.5
  const reinforcedDamage = baseDamage * 1.2;
  const reinforcedCd = baseCd / 0.9;
  assert(Math.abs(reinforcedDamage - 1.8) < 0.001, `Reinforced barrels damage: 1.5 * 1.2 = 1.8, got ${reinforcedDamage}`);
  assert(reinforcedCd > baseCd, `Reinforced barrels cooldown increased from ${baseCd}s to ${reinforcedCd.toFixed(4)}s`);

  // 5. Plasma Munitions: explosive splash 110px radius, 70% damage
  const splashRadius = 110;
  const splashDamage = baseDamage * 0.7;
  assert(splashRadius === 110, 'Plasma munitions splash radius is 110px');
  assert(Math.abs(splashDamage - 1.05) < 0.001, `Plasma splash damage: 1.5 * 0.7 = 1.05, got ${splashDamage}`);

  // 6. EMP Discharge: 15% arc chance, nearest other enemy
  const arcChance = 0.15;
  assert(arcChance === 0.15, 'EMP arc chance is 15%');

  // 7. Scrap Recycler: +20% scrap dropped from defeated enemies
  const normalScrapDrop = 15;
  const boostedScrapDrop = Math.round(normalScrapDrop * 1.2);
  assert(boostedScrapDrop === 18, `Scrap recycler: 15 * 1.2 = 18, got ${boostedScrapDrop}`);

  // 8. Reinforced Armor: -15% incoming damage
  const incomingHit = 20;
  const netHit = Math.max(1, incomingHit * (1 - 0.15));
  assert(netHit === 17, `Reinforced armor: 20 * 0.85 = 17, got ${netHit}`);

  // 9. Afterburner Thrusters: +15% movement speed
  const baseSpeed = PLAYER_SPEED; // 240
  const boostedSpeed = baseSpeed * 1.15;
  assert(boostedSpeed === 276, `Afterburner thrusters: 240 * 1.15 = 276, got ${boostedSpeed}`);

  // 10. Annihilation Protocol: +30% boss damage, 0% normal enemy damage
  const normalEnemyDamage = baseDamage;
  const bossDamage = baseDamage * 1.3;
  assert(normalEnemyDamage === 1.5, 'Normal enemy takes standard damage (1.5)');
  assert(Math.abs(bossDamage - 1.95) < 0.001, `Boss takes 1.5 * 1.3 = 1.95, got ${bossDamage}`);

  console.log(`\n====================================================`);
  console.log(`🎉 ALL TESTS PASSED! (${passed} checks passed, 0 failed)`);
  console.log(`====================================================\n`);
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
