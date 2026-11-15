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
  attackerDamage: number;
  defenderDamage: number;
  rounds: number;
}
/**
 * The whole-number range a side rolls below for a `strength`: the strength times `scale`, truncated. A larger scale
 *  gives finer steps between strengths; strengths are compared at this precision, as whole numbers.
 */
export declare const rollRange: (strength: number, scale: number) => number;
/**
 * A roll below `range`. A range of 1 or less always rolls 0 and draws no number, so a side with nothing to roll costs
 *  the generator nothing (OpenCiv2, `unit_resolve_attack_fight`).
 */
export declare const roll: (
  range: number,
  randomNumberGenerator: () => number
) => number;
/**
 * The chance that the attacker wins one round: that its roll below `attackRange` is strictly above the defender's
 *  below `defenceRange`, with every roll equally likely.
 */
export declare const roundOdds: (
  attackRange: number,
  defenceRange: number
) => number;
/**
 * Whether the battle can't be won by either side's hits: the defender deals no damage, and the attacker either deals
 *  none or can never win a round. It would go on for ever, so the attacker loses it outright. That includes both
 *  firepowers being 0.
 */
export declare const deadlocked: (
  attacker: Combatant,
  defender: Combatant
) => boolean;
/**
 * Fights one battle, drawing on `randomNumberGenerator` (a number in [0, 1)): each round the attacker's roll and then
 *  the defender's. An attacker with no hit points loses before any round, and one facing a defender with none wins; a
 *  deadlocked battle (see `deadlocked`) is lost by the attacker with no rounds and no draws.
 */
export declare const fight: (
  attacker: Combatant,
  defender: Combatant,
  randomNumberGenerator: () => number
) => FightResult;
/**
 * The chance that the attacker wins the battle `fight` would fight, for a computer player weighing an attack: `a` and
 *  `d` are the ranges each side rolls below (see `rollRange`), `hpA` and `hpD` the hit points each has left, and `fpA`
 *  and `fpD` their firepowers.
 *
 * The attacker has to win `ceil(hpD / fpA)` rounds before the defender wins `ceil(hpA / fpD)`, at `roundOdds(a, d)` a
 *  round: the sum of the negative binomial terms for the defender winning 0 up to one fewer than it needs.
 */
export declare const combatOdds: (
  a: number,
  d: number,
  hpA: number,
  hpD: number,
  fpA: number,
  fpD: number
) => number;
