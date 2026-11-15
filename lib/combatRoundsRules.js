"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.combatRoundsRules = exports.roundsStrengths = exports.resolveInRounds = exports.combatTerms = void 0;
const CombatResolver_1 = require("@civ-clone/core-unit/Rules/CombatResolver");
const CombatModifiers_1 = require("./CombatModifiers");
const RuleRegistry_1 = require("@civ-clone/core-rule/RuleRegistry");
const rounds_1 = require("./rounds");
const Effect_1 = require("@civ-clone/core-rule/Effect");
const strength_1 = require("@civ-clone/core-unit/strength");
/**
 * The terms a battle starts at, before `CombatModifiers`: the attacker's strength times `power`, the defender's, and
 *  each side's `Firepower`.
 */
const combatTerms = (attacker, defender, attack, defence, power) => ({
    attack: attack.value() * power,
    defence: defence.value(),
    attackerFirepower: attacker.firepower().value(),
    defenderFirepower: defender.firepower().value(),
});
exports.combatTerms = combatTerms;
/**
 * Fights a battle in rounds (see `fight`) at the terms the `CombatModifiers` rules leave (see `combatTerms`), from the
 *  hit points each unit has left. The winner is the side left with hit points; each side's damage is what it lost in
 *  this battle, so `Attack` adds it to the unit's damage.
 */
const resolveInRounds = (ruleRegistry, strengthScale) => (attacker, defender, attack, defence, power, randomNumberGenerator) => {
    const terms = (0, CombatModifiers_1.applyCombatModifiers)(ruleRegistry, attacker, defender, (0, exports.combatTerms)(attacker, defender, attack, defence, power)), [attackerHitPoints] = attacker.hitPoints(), [defenderHitPoints] = defender.hitPoints(), { attackerWon, attackerDamage, defenderDamage } = (0, rounds_1.fight)({
        range: (0, rounds_1.rollRange)(terms.attack, strengthScale),
        hitPoints: attackerHitPoints,
        firepower: Math.max(0, terms.attackerFirepower),
    }, {
        range: (0, rounds_1.rollRange)(terms.defence, strengthScale),
        hitPoints: defenderHitPoints,
        firepower: Math.max(0, terms.defenderFirepower),
    }, randomNumberGenerator);
    return {
        winner: attackerWon ? attacker : defender,
        loser: attackerWon ? defender : attacker,
        attackerDamage,
        defenderDamage,
    };
};
exports.resolveInRounds = resolveInRounds;
/**
 * The strengths a battle between `attacker` and `defender` is fought at in rounds, as `[attack, defence]`: `strength`'s,
 *  the attack times the share of a full attack the attacker has the moves for (`min(1, moves)`), after the
 *  `CombatModifiers` rules. What base-unit-veteran-promotion's `strengths` option takes, so a promotion's chance is
 *  worked out from the strengths the battle was fought at. Asked while `Defeated` is processed, before the attacker
 *  spends its moves.
 */
const roundsStrengths = (ruleRegistry = RuleRegistry_1.instance) => (attacker, defender) => {
    const [attack, defence] = (0, strength_1.default)(attacker, defender, ruleRegistry), { attack: modifiedAttack, defence: modifiedDefence } = (0, CombatModifiers_1.applyCombatModifiers)(ruleRegistry, attacker, defender, (0, exports.combatTerms)(attacker, defender, attack, defence, Math.min(1, attacker.moves().value())));
    return [modifiedAttack, modifiedDefence];
};
exports.roundsStrengths = roundsStrengths;
/**
 * A ruleset's `CombatResolver` for battles fought in rounds. Register it only in a game that fights this way: with no
 *  resolver, `Attack` keeps its single roll.
 */
const combatRoundsRules = ({ ruleRegistry = RuleRegistry_1.instance }, { id, criteria = [], strengthScale }) => [
    new CombatResolver_1.default(...(id === undefined ? [] : [id]), ...criteria, new Effect_1.default((0, exports.resolveInRounds)(ruleRegistry, strengthScale))),
];
exports.combatRoundsRules = combatRoundsRules;
exports.default = exports.combatRoundsRules;
//# sourceMappingURL=combatRoundsRules.js.map