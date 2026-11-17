import {
  Attack as AttackYield,
  Defence,
  Firepower,
  HitPoints,
} from '@civ-clone/core-unit/Yields';
import CombatModifiers, { CombatTerms } from '../lib/CombatModifiers';
import Attack from '@civ-clone/base-unit-action-attack/Attack';
import Criterion from '@civ-clone/core-rule/Criterion';
import Damaged from '@civ-clone/core-unit/Rules/Damaged';
import Defeated from '@civ-clone/core-unit/Rules/Defeated';
import Effect from '@civ-clone/core-rule/Effect';
import Generator from '@civ-clone/core-world-generator/Generator';
import Player from '@civ-clone/core-player/Player';
import RuleRegistry from '@civ-clone/core-rule/RuleRegistry';
import Terrain from '@civ-clone/core-terrain/Terrain';
import Tile from '@civ-clone/core-world/Tile';
import Unit from '@civ-clone/core-unit/Unit';
import UnitRegistry from '@civ-clone/core-unit/UnitRegistry';
import World from '@civ-clone/core-world/World';
import { Yield as YieldRule } from '@civ-clone/core-unit/Rules/Yield';
import YieldValue from '@civ-clone/core-yield/Yield';
import combatRoundsRules, { roundsStrengths } from '../lib/combatRoundsRules';
import { expect } from 'chai';

type Stats = [
  attack: number,
  defence: number,
  hitPoints: number,
  firepower: number
];

const scripted = (...values: number[]) => {
  const draws: number[] = [];

  return {
    draws,
    rng: (): number => {
      if (draws.length >= values.length) {
        throw new Error('Drew more numbers than were scripted.');
      }

      draws.push(values[draws.length]);

      return values[draws.length - 1];
    },
  };
};

const setUp = (strengthScale: number = 8) => {
  const ruleRegistry = new RuleRegistry(),
    unitRegistry = new UnitRegistry(),
    world = new World(new Generator(2, 1)),
    from = new Tile(0, 0, new Terrain(), world),
    to = new Tile(1, 0, new Terrain(), world),
    stats = new Map<Unit, Stats>(),
    events: [string, Unit, Unit][] = [],
    unit = (tile: Tile, unitStats: Stats, moves: number = 1): Unit => {
      const created = new Unit(null, new Player(), tile, ruleRegistry);

      stats.set(created, unitStats);
      created.moves().set(moves);
      unitRegistry.register(created);

      return created;
    };

  ruleRegistry.register(
    new YieldRule(
      new Criterion((unit: Unit): boolean => stats.has(unit)),
      new Effect((unit: Unit, unitYield: YieldValue): void => {
        const [attack, defence, hitPoints, firepower] = stats.get(unit)!;

        [
          [AttackYield, attack],
          [Defence, defence],
          [HitPoints, hitPoints],
          [Firepower, firepower],
        ].forEach(([Type, value]: any): void => {
          if (unitYield instanceof Type) {
            unitYield.set(value);
          }
        });
      })
    ),
    new Defeated(
      new Effect((loser: Unit, winner: Unit): void => {
        events.push(['defeated', loser, winner]);
      })
    ),
    new Damaged(
      new Effect((damaged: Unit, by: Unit): void => {
        events.push(['damaged', damaged, by]);
      })
    ),
    ...combatRoundsRules({ ruleRegistry }, { strengthScale })
  );

  return { events, from, ruleRegistry, to, unit, unitRegistry };
};

describe('combatRoundsRules', (): void => {
  it('should fight in rounds through `Attack`, keeping the winner damaged', (): void => {
    const { events, from, ruleRegistry, to, unit, unitRegistry } = setUp(),
      attacker = unit(from, [1, 0, 2, 1]),
      defender = unit(to, [0, 1, 2, 1]),
      // Attacker 7 v 0, then 0 v 7 (the defender hits back), then 7 v 0.
      { draws, rng } = scripted(0.9, 0.1, 0, 0.9, 0.9, 0.1);

    new Attack(from, to, attacker, ruleRegistry, unitRegistry, rng).perform();

    expect(draws.length).to.equal(6);
    expect(attacker.damage()).to.equal(1);
    expect(attacker.hitPoints()).to.deep.equal([1, 2]);
    expect(events).to.deep.equal([
      ['defeated', defender, attacker],
      ['damaged', attacker, defender],
    ]);
  });

  it('should start from the hit points a unit has left', (): void => {
    const { events, from, ruleRegistry, to, unit, unitRegistry } = setUp(),
      attacker = unit(from, [1, 0, 10, 1]),
      defender = unit(to, [0, 1, 10, 1]);

    // 9 damage already: one lost round ends it.
    attacker.setDamage(9);

    new Attack(
      from,
      to,
      attacker,
      ruleRegistry,
      unitRegistry,
      scripted(0, 0.9).rng
    ).perform();

    expect(events).to.deep.equal([['defeated', attacker, defender]]);
    expect(defender.damage()).to.equal(0);
  });

  it('should scale the attack by the share of a move left, before the strength scale', (): void => {
    const { events, from, ruleRegistry, to, unit, unitRegistry } = setUp(),
      // Attack 3 with a third of a move rolls below 8, not 24: 0.3 × 8 → 2 loses to the defender's 0.8 × 8 → 6 (at 24
      //  steps it would be 7 and win).
      attacker = unit(from, [3, 0, 1, 1], 1 / 3),
      defender = unit(to, [0, 1, 1, 1]);

    new Attack(
      from,
      to,
      attacker,
      ruleRegistry,
      unitRegistry,
      scripted(0.3, 0.8).rng
    ).perform();

    expect(events).to.deep.equal([['defeated', attacker, defender]]);
  });

  it('should apply `CombatModifiers` in order, each seeing the terms the one before left', (): void => {
    const { events, from, ruleRegistry, to, unit, unitRegistry } = setUp(),
      attacker = unit(from, [1, 0, 3, 3]),
      defender = unit(to, [0, 1, 3, 3]),
      seen: CombatTerms[] = [];

    ruleRegistry.register(
      // Both sides fire at 1, as a ship firing at a land unit does.
      new CombatModifiers(
        new Effect(
          (
            attacking: Unit,
            defending: Unit,
            terms: CombatTerms
          ): CombatTerms => {
            seen.push(terms);

            return { ...terms, attackerFirepower: 1, defenderFirepower: 1 };
          }
        )
      ),
      // Then doubles the attacker's, as for a ship caught in port.
      new CombatModifiers(
        new Criterion(
          (attacking: Unit, defending: Unit, terms: CombatTerms): boolean =>
            terms.attackerFirepower === 1
        ),
        new Effect(
          (
            attacking: Unit,
            defending: Unit,
            terms: CombatTerms
          ): CombatTerms => {
            seen.push(terms);

            return { ...terms, attackerFirepower: terms.attackerFirepower * 2 };
          }
        )
      ),
      // Declines.
      new CombatModifiers(new Effect((): undefined => undefined))
    );

    // Attacker wins two rounds at firepower 2: 3 hit points need 2.
    new Attack(
      from,
      to,
      attacker,
      ruleRegistry,
      unitRegistry,
      scripted(0.9, 0.1, 0.9, 0.1).rng
    ).perform();

    expect(seen).to.deep.equal([
      { attack: 1, defence: 1, attackerFirepower: 3, defenderFirepower: 3 },
      { attack: 1, defence: 1, attackerFirepower: 1, defenderFirepower: 1 },
    ]);
    expect(events).to.deep.equal([['defeated', defender, attacker]]);
  });

  it('should let the defender roll again when a `CombatModifiers` rule says so', (): void => {
    const { events, from, ruleRegistry, to, unit, unitRegistry } = setUp(),
      attacker = unit(from, [1, 0, 1, 1]),
      defender = unit(to, [0, 1, 1, 1]),
      // 7 v 0, then again 0 v 7: the defender takes the round back and wins.
      { draws, rng } = scripted(0.9, 0.1, 0, 0.9);

    ruleRegistry.register(
      new CombatModifiers(
        new Effect(
          (
            attacking: Unit,
            defending: Unit,
            terms: CombatTerms
          ): CombatTerms => ({ ...terms, defenderRerolls: true })
        )
      )
    );

    new Attack(from, to, attacker, ruleRegistry, unitRegistry, rng).perform();

    expect(draws.length).to.equal(4);
    expect(events).to.deep.equal([['defeated', attacker, defender]]);
  });

  it('should lose the attacker the battle when both firepowers are 0', (): void => {
    const { events, from, ruleRegistry, to, unit, unitRegistry } = setUp(),
      attacker = unit(from, [9, 0, 10, 0]),
      defender = unit(to, [0, 1, 10, 0]),
      { draws, rng } = scripted();

    new Attack(from, to, attacker, ruleRegistry, unitRegistry, rng).perform();

    expect(draws.length).to.equal(0);
    expect(events).to.deep.equal([['defeated', attacker, defender]]);
  });

  it('should only fight the battles its criteria allow', (): void => {
    const ruleRegistry = new RuleRegistry(),
      [resolver] = combatRoundsRules(
        { ruleRegistry },
        {
          id: 'test:rounds',
          criteria: [new Criterion((): boolean => false)],
          strengthScale: 8,
        }
      );

    expect(resolver.id()).to.equal('test:rounds');
    expect(
      resolver.validate(...([] as unknown as [any, any, any, any, any, any]))
    ).to.equal(false);
  });
});

describe('roundsStrengths', (): void => {
  it('should give the strengths the resolver fights at, after `CombatModifiers` and the share of a move', (): void => {
    const { from, ruleRegistry, to, unit } = setUp(),
      attacker = unit(from, [3, 0, 10, 1], 0.5),
      defender = unit(to, [0, 2, 10, 1]);

    ruleRegistry.register(
      new CombatModifiers(
        new Effect(
          (
            attacking: Unit,
            defending: Unit,
            terms: CombatTerms
          ): CombatTerms => ({
            ...terms,
            defence: terms.defence / 2,
          })
        )
      )
    );

    expect(roundsStrengths(ruleRegistry)(attacker, defender)).to.deep.equal([
      1.5, 1,
    ]);
  });
});
