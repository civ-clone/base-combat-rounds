"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCombatModifiers = exports.CombatModifiers = void 0;
const Rule_1 = require("@civ-clone/core-rule/Rule");
/**
 * Changes the terms a battle between `attacker` and `defender` is fought at, for what `Strength` rules can't say:
 *  firepower that depends on where and whom a unit fights (a ship firing at a land unit, a ship caught in port), or a
 *  strength that changes only in this kind of battle. A rule's answer replaces the terms; `undefined` leaves them.
 *
 * Unlike most rules, these run one after another (in the registry's order): each matching rule sees the terms the one
 *  before it returned, and its criteria are checked against them too.
 */
class CombatModifiers extends Rule_1.default {
}
exports.CombatModifiers = CombatModifiers;
/** `terms` after each `CombatModifiers` rule in `ruleRegistry` that matches, in order. */
const applyCombatModifiers = (ruleRegistry, attacker, defender, terms) => ruleRegistry
    .get(CombatModifiers)
    .reduce((current, rule) => {
    var _a;
    return rule.validate(attacker, defender, current)
        ? (_a = rule.process(attacker, defender, current)) !== null && _a !== void 0 ? _a : current
        : current;
}, terms);
exports.applyCombatModifiers = applyCombatModifiers;
exports.default = CombatModifiers;
//# sourceMappingURL=CombatModifiers.js.map