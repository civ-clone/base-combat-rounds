/**
 * The arithmetic of a battle fought in rounds, with no units or rules: a ruleset's `CombatResolver` (see
 *  `combatRoundsRules`) and a computer player's odds both use it, so the two always agree.
 *
 * Each round, the attacker rolls a whole number below its range and then the defender rolls one below its own; the
 *  attacker wins the round only if its roll is strictly higher, so ties go to the defender. The loser of the round
 *  takes the winner's firepower as damage. Rounds go on until one side has no hit points left. (OpenCiv2,
 *  `unit_resolve_attack_fight`.)
 */

/** One side of a battle: what it rolls below, the hit points it has left, and the damage each round it wins deals. */
export interface Combatant {
  range: number;
  hitPoints: number;
  firepower: number;
}

export interface FightResult {
  attackerWon: boolean;
  // The damage each side took in this battle, never more than the hit points it had left.
  attackerDamage: number;
  defenderDamage: number;
  rounds: number;
}

/**
 * The whole-number range a side rolls below for a `strength`: the strength times `scale`, truncated. A larger scale
 *  gives finer steps between strengths; strengths are compared at this precision, as whole numbers.
 */
export const rollRange = (strength: number, scale: number): number =>
  Math.max(0, Math.trunc(strength * scale));

/**
 * A roll below `range`. A range of 1 or less always rolls 0 and draws no number, so a side with nothing to roll costs
 *  the generator nothing (OpenCiv2, `unit_resolve_attack_fight`).
 */
export const roll = (range: number, randomNumberGenerator: () => number) =>
  range <= 1 ? 0 : Math.floor(randomNumberGenerator() * range);

/**
 * The chance that the attacker wins one round: that its roll below `attackRange` is strictly above the defender's
 *  below `defenceRange`, with every roll equally likely.
 */
export const roundOdds = (
  attackRange: number,
  defenceRange: number
): number => {
  const attackValues = Math.max(1, Math.trunc(attackRange)),
    defenceValues = Math.max(1, Math.trunc(defenceRange));

  // For each attacker roll `a`, the defender rolls below it `min(a, defenceValues)` ways.
  let wins = 0;

  for (let attackRoll = 0; attackRoll < attackValues; attackRoll++) {
    wins += Math.min(attackRoll, defenceValues);
  }

  return wins / (attackValues * defenceValues);
};

/**
 * The chance that the attacker wins one round when the defender rolls again on each round the attacker wins
 *  (`defenderRerolls`): it must win the first pair of rolls, and then not roll lower than the defender in the second
 *  (`a2 < d2` gives the round back), so `roundOdds(a, d) × (1 − roundOdds(d, a))`. Without the reroll, `roundOdds`.
 */
export const rerolledRoundOdds = (
  attackRange: number,
  defenceRange: number,
  defenderRerolls: boolean = false
): number =>
  defenderRerolls
    ? roundOdds(attackRange, defenceRange) *
      (1 - roundOdds(defenceRange, attackRange))
    : roundOdds(attackRange, defenceRange);

/**
 * Whether the battle can't be won by either side's hits: the defender deals no damage, and the attacker either deals
 *  none or can never win a round. It would go on for ever, so the attacker loses it outright. That includes both
 *  firepowers being 0.
 */
export const deadlocked = (attacker: Combatant, defender: Combatant): boolean =>
  defender.firepower <= 0 &&
  (attacker.firepower <= 0 || roundOdds(attacker.range, defender.range) === 0);

/**
 * Fights one battle, drawing on `randomNumberGenerator` (a number in [0, 1)): each round the attacker's roll and then
 *  the defender's. An attacker with no hit points loses before any round, and one facing a defender with none wins; a
 *  deadlocked battle (see `deadlocked`) is lost by the attacker with no rounds and no draws.
 *
 * With `defenderRerolls`, a round the attacker wins is rolled again, the attacker's number and then the defender's,
 *  and goes to the defender if the attacker's second roll is lower (OpenCiv2 `unit_resolve_attack_fight`). Without it,
 *  nothing more is drawn.
 */
export const fight = (
  attacker: Combatant,
  defender: Combatant,
  randomNumberGenerator: () => number,
  defenderRerolls: boolean = false
): FightResult => {
  let attackerHitPoints = attacker.hitPoints,
    defenderHitPoints = defender.hitPoints,
    rounds = 0;

  if (
    attackerHitPoints > 0 &&
    defenderHitPoints > 0 &&
    deadlocked(attacker, defender)
  ) {
    return {
      attackerWon: false,
      attackerDamage: 0,
      defenderDamage: 0,
      rounds,
    };
  }

  while (attackerHitPoints > 0 && defenderHitPoints > 0) {
    const attackRoll = roll(attacker.range, randomNumberGenerator),
      defenceRoll = roll(defender.range, randomNumberGenerator);

    rounds++;

    let attackerWins = attackRoll > defenceRoll;

    if (defenderRerolls && attackerWins) {
      const secondAttackRoll = roll(attacker.range, randomNumberGenerator),
        secondDefenceRoll = roll(defender.range, randomNumberGenerator);

      attackerWins = secondAttackRoll >= secondDefenceRoll;
    }

    if (attackerWins) {
      defenderHitPoints -= attacker.firepower;

      continue;
    }

    attackerHitPoints -= defender.firepower;
  }

  return {
    attackerWon: attackerHitPoints > 0,
    attackerDamage: attacker.hitPoints - Math.max(0, attackerHitPoints),
    defenderDamage: defender.hitPoints - Math.max(0, defenderHitPoints),
    rounds,
  };
};

/**
 * The chance that the attacker wins the battle `fight` would fight, for a computer player weighing an attack: `a` and
 *  `d` are the ranges each side rolls below (see `rollRange`), `hpA` and `hpD` the hit points each has left, and `fpA`
 *  and `fpD` their firepowers; `defenderRerolls` as `fight`'s.
 *
 * The attacker has to win `ceil(hpD / fpA)` rounds before the defender wins `ceil(hpA / fpD)`, at `roundOdds(a, d)` a
 *  round (`rerolledRoundOdds` with the reroll): the sum of the negative binomial terms for the defender winning 0 up to
 *  one fewer than it needs.
 */
export const combatOdds = (
  a: number,
  d: number,
  hpA: number,
  hpD: number,
  fpA: number,
  fpD: number,
  defenderRerolls: boolean = false
): number => {
  if (hpA <= 0) {
    return 0;
  }

  if (hpD <= 0) {
    return 1;
  }

  const attacker: Combatant = { range: a, hitPoints: hpA, firepower: fpA },
    defender: Combatant = { range: d, hitPoints: hpD, firepower: fpD };

  if (deadlocked(attacker, defender) || fpA <= 0) {
    return 0;
  }

  const p = rerolledRoundOdds(a, d, defenderRerolls);

  if (fpD <= 0) {
    return p > 0 ? 1 : 0;
  }

  const q = 1 - p,
    attackerNeeds = Math.ceil(hpD / fpA),
    defenderNeeds = Math.ceil(hpA / fpD);

  // C(attackerNeeds - 1 + j, j) p^attackerNeeds q^j, built term by term.
  let term = Math.pow(p, attackerNeeds),
    odds = term;

  for (let j = 1; j < defenderNeeds; j++) {
    term *= (q * (attackerNeeds - 1 + j)) / j;
    odds += term;
  }

  return Math.min(1, odds);
};
