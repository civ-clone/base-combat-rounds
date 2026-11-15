import { Attack, Defence } from '@civ-clone/core-unit/Yields';
import CombatResolver, {
  CombatResult,
} from '@civ-clone/core-unit/Rules/CombatResolver';
import { CombatTerms } from './CombatModifiers';
import { RuleRegistry } from '@civ-clone/core-rule/RuleRegistry';
import Criterion from '@civ-clone/core-rule/Criterion';
import Unit from '@civ-clone/core-unit/Unit';
export interface CombatRoundsDependencies {
  ruleRegistry?: RuleRegistry;
}
export interface CombatRoundsOptions {
  /** The resolver rule's id. */
  id?: string;
  /** The battles this resolver fights; every one, without. Only one resolver should match a battle. */
  criteria?: Criterion<[Unit, Unit, Attack, Defence, number, () => number]>[];
  /**
   * How many whole steps a strength of 1 is rolled in (see `rollRange`): strengths are multiplied by this and truncated
   *  before each side rolls, so it sets how finely strengths are told apart.
   */
  strengthScale: number;
}
/**
 * The terms a battle starts at, before `CombatModifiers`: the attacker's strength times `power`, the defender's, and
 *  each side's `Firepower`.
 */
export declare const combatTerms: (
  attacker: Unit,
  defender: Unit,
  attack: Attack,
  defence: Defence,
  power: number
) => CombatTerms;
/**
 * Fights a battle in rounds (see `fight`) at the terms the `CombatModifiers` rules leave (see `combatTerms`), from the
 *  hit points each unit has left. The winner is the side left with hit points; each side's damage is what it lost in
 *  this battle, so `Attack` adds it to the unit's damage.
 */
export declare const resolveInRounds: (
  ruleRegistry: RuleRegistry,
  strengthScale: number
) => (
  attacker: Unit,
  defender: Unit,
  attack: Attack,
  defence: Defence,
  power: number,
  randomNumberGenerator: () => number
) => CombatResult;
/**
 * The strengths a battle between `attacker` and `defender` is fought at in rounds, as `[attack, defence]`: `strength`'s,
 *  the attack times the share of a full attack the attacker has the moves for (`min(1, moves)`), after the
 *  `CombatModifiers` rules. What base-unit-veteran-promotion's `strengths` option takes, so a promotion's chance is
 *  worked out from the strengths the battle was fought at. Asked while `Defeated` is processed, before the attacker
 *  spends its moves.
 */
export declare const roundsStrengths: (
  ruleRegistry?: RuleRegistry
) => (attacker: Unit, defender: Unit) => [attack: number, defence: number];
/**
 * A ruleset's `CombatResolver` for battles fought in rounds. Register it only in a game that fights this way: with no
 *  resolver, `Attack` keeps its single roll.
 */
export declare const combatRoundsRules: (
  { ruleRegistry }: CombatRoundsDependencies,
  { id, criteria, strengthScale }: CombatRoundsOptions
) => CombatResolver[];
export default combatRoundsRules;
