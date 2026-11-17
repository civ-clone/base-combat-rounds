import Rule from '@civ-clone/core-rule/Rule';
import { RuleRegistry } from '@civ-clone/core-rule/RuleRegistry';
import Unit from '@civ-clone/core-unit/Unit';

/**
 * What a battle is fought at: each side's strength (the attacker's already scaled by the share of a full attack it has
 *  the moves for) and the damage each round it wins deals.
 */
export interface CombatTerms {
  attack: number;
  defence: number;
  attackerFirepower: number;
  defenderFirepower: number;
  /**
   * Whether the defender rolls again on each round the attacker wins: both sides roll a second time, and the round goes
   *  to the defender after all if the attacker's second roll is lower (OpenCiv2 `unit_resolve_attack_fight`, the
   *  barbarians' attack on a city). Off when not given.
   */
  defenderRerolls?: boolean;
}

/**
 * Changes the terms a battle between `attacker` and `defender` is fought at, for what `Strength` rules can't say:
 *  firepower that depends on where and whom a unit fights (a ship firing at a land unit, a ship caught in port), or a
 *  strength that changes only in this kind of battle. A rule's answer replaces the terms; `undefined` leaves them.
 *
 * Unlike most rules, these run one after another (in the registry's order): each matching rule sees the terms the one
 *  before it returned, and its criteria are checked against them too.
 */
export class CombatModifiers extends Rule<
  [attacker: Unit, defender: Unit, terms: CombatTerms],
  CombatTerms | undefined
> {}

/** `terms` after each `CombatModifiers` rule in `ruleRegistry` that matches, in order. */
export const applyCombatModifiers = (
  ruleRegistry: RuleRegistry,
  attacker: Unit,
  defender: Unit,
  terms: CombatTerms
): CombatTerms =>
  ruleRegistry
    .get(CombatModifiers)
    .reduce(
      (current: CombatTerms, rule: CombatModifiers): CombatTerms =>
        rule.validate(attacker, defender, current)
          ? rule.process(attacker, defender, current) ?? current
          : current,
      terms
    );

export default CombatModifiers;
