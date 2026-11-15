# base-combat-rounds

A `CombatResolver` (core-unit) for battles fought in rounds, a hook for firepower changes, and the odds of such a
battle for computer players. A library: nothing registers on import. A game that registers no resolver keeps
base-unit-action-attack's single roll.

## How a battle goes

Each round the attacker rolls a whole number below its range, then the defender rolls one below its own. The attacker
wins the round only if its roll is strictly higher, so ties go to the defender. The loser of the round takes the
winner's firepower as damage. Rounds go on until one side has no hit points left; the winner keeps its damage.

- A side's range is its strength times `strengthScale`, truncated (`rollRange`). The attacker's strength is first
  multiplied by `power`, the share of a full attack it has the moves for.
- A range of 1 or less always rolls 0 and draws nothing from the generator.
- Each side starts from the hit points it has left (`unit.hitPoints()`), so earlier damage counts.
- If neither side's hits can end the battle (the defender's firepower is 0, and the attacker's is 0 or it can never win
  a round), the attacker loses it outright, with no rounds. That includes both firepowers being 0.
- An attacker with no hit points loses before any round; one facing a defender with none wins.

The rules follow OpenCiv2 (github.com/richardpenman/civ2, MIT), `unit_resolve_attack_fight`. There, strengths are
whole numbers at 8 steps to 1, so a game reproducing it passes `strengthScale: 8`: two equal strengths then win a round
28 times in 64 for the attacker.

## API

Deep-import the modules; there is no index.

- `lib/combatRoundsRules`:
  - `combatRoundsRules({ ruleRegistry }, { strengthScale, id?, criteria? }): CombatResolver[]`, the resolver rule.
    Only one resolver should match a battle (see core-unit's `CombatResolver`), so `criteria` narrows it if a game has
    another.
  - `resolveInRounds(ruleRegistry, strengthScale)`, its effect, and `combatTerms(...)`, the terms before modifiers.
  - The result's `attackerDamage` and `defenderDamage` are what each side lost in this battle, never more than it had
    left: `Attack` adds the winner's to its `damage()`.
- `lib/CombatModifiers`:
  - `CombatModifiers`, a rule `(attacker, defender, terms) → terms | undefined` that changes `CombatTerms`
    (`attack`, `defence`, `attackerFirepower`, `defenderFirepower`) for what `Strength` rules can't say: a ship
    firing at a land unit, a ship caught in port, a defender whose firepower drops to 1 against a certain attacker.
  - Unlike most rules these run one after another, in the registry's order: each matching rule sees, and is checked
    against, the terms the one before returned. `undefined` leaves them as they were.
  - `applyCombatModifiers(ruleRegistry, attacker, defender, terms)`.
- `lib/rounds`, the arithmetic with no units or rules:
  - `fight(attacker, defender, randomNumberGenerator)`, each side a `{ range, hitPoints, firepower }`.
  - `combatOdds(a, d, hpA, hpD, fpA, fpD)`, the chance the attacker wins: ranges (as `rollRange` gives them), hit
    points left and firepowers. A closed form (the attacker must win `ceil(hpD / fpA)` rounds before the defender wins
    `ceil(hpA / fpD)`); the tests check it against an exhaustive count and a Monte Carlo of `fight`.
  - `roundOdds(a, d)`, `rollRange(strength, scale)`, `roll(range, randomNumberGenerator)` and `deadlocked(...)`.

## Not here

The barbarian defender's second roll and a single-round mode are left out: neither is needed yet.
