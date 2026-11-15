"use strict";
/**
 * The arithmetic of a battle fought in rounds, with no units or rules: a ruleset's `CombatResolver` (see
 *  `combatRoundsRules`) and a computer player's odds both use it, so the two always agree.
 *
 * Each round, the attacker rolls a whole number below its range and then the defender rolls one below its own; the
 *  attacker wins the round only if its roll is strictly higher, so ties go to the defender. The loser of the round
 *  takes the winner's firepower as damage. Rounds go on until one side has no hit points left. (OpenCiv2,
 *  `unit_resolve_attack_fight`.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.combatOdds = exports.fight = exports.deadlocked = exports.roundOdds = exports.roll = exports.rollRange = void 0;
/**
 * The whole-number range a side rolls below for a `strength`: the strength times `scale`, truncated. A larger scale
 *  gives finer steps between strengths; strengths are compared at this precision, as whole numbers.
 */
const rollRange = (strength, scale) => Math.max(0, Math.trunc(strength * scale));
exports.rollRange = rollRange;
/**
 * A roll below `range`. A range of 1 or less always rolls 0 and draws no number, so a side with nothing to roll costs
 *  the generator nothing (OpenCiv2, `unit_resolve_attack_fight`).
 */
const roll = (range, randomNumberGenerator) => range <= 1 ? 0 : Math.floor(randomNumberGenerator() * range);
exports.roll = roll;
/**
 * The chance that the attacker wins one round: that its roll below `attackRange` is strictly above the defender's
 *  below `defenceRange`, with every roll equally likely.
 */
const roundOdds = (attackRange, defenceRange) => {
    const attackValues = Math.max(1, Math.trunc(attackRange)), defenceValues = Math.max(1, Math.trunc(defenceRange));
    // For each attacker roll `a`, the defender rolls below it `min(a, defenceValues)` ways.
    let wins = 0;
    for (let attackRoll = 0; attackRoll < attackValues; attackRoll++) {
        wins += Math.min(attackRoll, defenceValues);
    }
    return wins / (attackValues * defenceValues);
};
exports.roundOdds = roundOdds;
/**
 * Whether the battle can't be won by either side's hits: the defender deals no damage, and the attacker either deals
 *  none or can never win a round. It would go on for ever, so the attacker loses it outright. That includes both
 *  firepowers being 0.
 */
const deadlocked = (attacker, defender) => defender.firepower <= 0 &&
    (attacker.firepower <= 0 || (0, exports.roundOdds)(attacker.range, defender.range) === 0);
exports.deadlocked = deadlocked;
/**
 * Fights one battle, drawing on `randomNumberGenerator` (a number in [0, 1)): each round the attacker's roll and then
 *  the defender's. An attacker with no hit points loses before any round, and one facing a defender with none wins; a
 *  deadlocked battle (see `deadlocked`) is lost by the attacker with no rounds and no draws.
 */
const fight = (attacker, defender, randomNumberGenerator) => {
    let attackerHitPoints = attacker.hitPoints, defenderHitPoints = defender.hitPoints, rounds = 0;
    if (attackerHitPoints > 0 &&
        defenderHitPoints > 0 &&
        (0, exports.deadlocked)(attacker, defender)) {
        return {
            attackerWon: false,
            attackerDamage: 0,
            defenderDamage: 0,
            rounds,
        };
    }
    while (attackerHitPoints > 0 && defenderHitPoints > 0) {
        const attackRoll = (0, exports.roll)(attacker.range, randomNumberGenerator), defenceRoll = (0, exports.roll)(defender.range, randomNumberGenerator);
        rounds++;
        if (attackRoll > defenceRoll) {
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
exports.fight = fight;
/**
 * The chance that the attacker wins the battle `fight` would fight, for a computer player weighing an attack: `a` and
 *  `d` are the ranges each side rolls below (see `rollRange`), `hpA` and `hpD` the hit points each has left, and `fpA`
 *  and `fpD` their firepowers.
 *
 * The attacker has to win `ceil(hpD / fpA)` rounds before the defender wins `ceil(hpA / fpD)`, at `roundOdds(a, d)` a
 *  round: the sum of the negative binomial terms for the defender winning 0 up to one fewer than it needs.
 */
const combatOdds = (a, d, hpA, hpD, fpA, fpD) => {
    if (hpA <= 0) {
        return 0;
    }
    if (hpD <= 0) {
        return 1;
    }
    const attacker = { range: a, hitPoints: hpA, firepower: fpA }, defender = { range: d, hitPoints: hpD, firepower: fpD };
    if ((0, exports.deadlocked)(attacker, defender) || fpA <= 0) {
        return 0;
    }
    const p = (0, exports.roundOdds)(a, d);
    if (fpD <= 0) {
        return p > 0 ? 1 : 0;
    }
    const q = 1 - p, attackerNeeds = Math.ceil(hpD / fpA), defenderNeeds = Math.ceil(hpA / fpD);
    // C(attackerNeeds - 1 + j, j) p^attackerNeeds q^j, built term by term.
    let term = Math.pow(p, attackerNeeds), odds = term;
    for (let j = 1; j < defenderNeeds; j++) {
        term *= (q * (attackerNeeds - 1 + j)) / j;
        odds += term;
    }
    return Math.min(1, odds);
};
exports.combatOdds = combatOdds;
//# sourceMappingURL=rounds.js.map