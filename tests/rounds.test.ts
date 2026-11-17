import {
  combatOdds,
  deadlocked,
  fight,
  rerolledRoundOdds,
  rollRange,
  roundOdds,
} from '../lib/rounds';
import { expect } from 'chai';

// Numbers and rules from OpenCiv2 (github.com/richardpenman/civ2, read at 49f26ec), `unit_resolve_attack_fight`:
//  strengths are whole numbers at 8 steps to 1, each side rolls `rand % strength` (no draw at 1 or less), the attacker
//  wins a round only with the higher roll, the loser takes the winner's firepower, and it goes on to 0 hit points.
//  Hit points there are 10 to 1 (`civ.cpp`'s rules loader), so a 1-hit-point unit has 10.
const scale = 8;

// A seeded generator for the Monte Carlo runs (mulberry32).
const seeded = (seed: number) => (): number => {
  seed = (seed + 0x6d2b79f5) | 0;

  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

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

// The chance by brute force: every state of (attacker hit points, defender hit points), from the round odds alone.
const dynamicOdds = (
  a: number,
  d: number,
  hpA: number,
  hpD: number,
  fpA: number,
  fpD: number,
  defenderRerolls: boolean = false
): number => {
  // The round odds counted pair by pair, not from `rerolledRoundOdds`: the attacker's win of the first pair, times a
  //  second pair it doesn't lose.
  let first = 0,
    second = 0;

  for (let attackRoll = 0; attackRoll < Math.max(1, a); attackRoll++) {
    for (let defenceRoll = 0; defenceRoll < Math.max(1, d); defenceRoll++) {
      first += attackRoll > defenceRoll ? 1 : 0;
      second += attackRoll >= defenceRoll ? 1 : 0;
    }
  }

  const pairs = Math.max(1, a) * Math.max(1, d),
    p = defenderRerolls ? (first / pairs) * (second / pairs) : first / pairs,
    memo = new Map<string, number>(),
    odds = (attacker: number, defender: number): number => {
      if (attacker <= 0) {
        return 0;
      }

      if (defender <= 0) {
        return 1;
      }

      const key = `${attacker},${defender}`;

      if (!memo.has(key)) {
        memo.set(
          key,
          p * odds(attacker, defender - fpA) +
            (1 - p) * odds(attacker - fpD, defender)
        );
      }

      return memo.get(key)!;
    };

  return odds(hpA, hpD);
};

describe('rounds', (): void => {
  describe('rollRange', (): void => {
    it('should give whole steps of the scale, truncated (OpenCiv2 strengths are ×8 whole numbers)', (): void => {
      expect(rollRange(1, scale)).to.equal(8);
      expect(rollRange(1.5, scale)).to.equal(12);
      expect(rollRange(0.33, scale)).to.equal(2);
      expect(rollRange(0, scale)).to.equal(0);
    });
  });

  describe('roundOdds', (): void => {
    it('should give 28 in 64 to equal strengths at 8 steps: ties go to the defender (strict `>`)', (): void => {
      expect(roundOdds(8, 8)).to.equal(28 / 64);
    });

    it('should give 0 to a side that rolls below 1 or 0', (): void => {
      expect(roundOdds(1, 8)).to.equal(0);
      expect(roundOdds(0, 0)).to.equal(0);
    });

    it('should count every pair of rolls', (): void => {
      let wins = 0;

      for (let a = 0; a < 24; a++) {
        for (let d = 0; d < 8; d++) {
          wins += a > d ? 1 : 0;
        }
      }

      expect(roundOdds(24, 8)).to.equal(wins / (24 * 8));
      expect(roundOdds(2, 1)).to.equal(0.5);
    });
  });

  describe('fight', (): void => {
    it("should draw the attacker's number before the defender's, every round", (): void => {
      // 0.9 × 8 → 7 against 0.1 × 8 → 0: the attacker wins the first round; then 0 against 7: the defender wins.
      const { draws, rng } = scripted(0.9, 0.1, 0, 0.9, 0.9, 0.1),
        result = fight(
          { range: 8, hitPoints: 2, firepower: 1 },
          { range: 8, hitPoints: 2, firepower: 1 },
          rng
        );

      expect(draws).to.deep.equal([0.9, 0.1, 0, 0.9, 0.9, 0.1]);
      expect(result).to.deep.equal({
        attackerWon: true,
        attackerDamage: 1,
        defenderDamage: 2,
        rounds: 3,
      });
    });

    it('should draw nothing more than the two rolls a round without the reroll', (): void => {
      // Three rounds, the attacker winning two: six draws, and a seventh would throw.
      const { draws, rng } = scripted(0.9, 0.1, 0.9, 0.1, 0, 0.9),
        result = fight(
          { range: 8, hitPoints: 1, firepower: 1 },
          { range: 8, hitPoints: 2, firepower: 1 },
          rng
        );

      expect(draws.length).to.equal(4);
      expect(result.attackerWon).to.equal(true);
    });

    describe('with the defender rerolling', (): void => {
      it("should roll a round the attacker won again, the attacker's number first, and give it back on a lower roll", (): void => {
        // Round 1: 7 against 0, won; again 0 against 7: lower, so the defender takes it. Round 2: 7 against 0, won;
        //  again 7 against 7: not lower, so the attacker keeps it.
        const { draws, rng } = scripted(0.9, 0.1, 0, 0.9, 0.9, 0.1, 0.9, 0.9),
          result = fight(
            { range: 8, hitPoints: 2, firepower: 1 },
            { range: 8, hitPoints: 1, firepower: 1 },
            rng,
            true
          );

        expect(draws).to.deep.equal([0.9, 0.1, 0, 0.9, 0.9, 0.1, 0.9, 0.9]);
        expect(result).to.deep.equal({
          attackerWon: true,
          attackerDamage: 1,
          defenderDamage: 1,
          rounds: 2,
        });
      });

      it('should not roll again on a round the defender won', (): void => {
        const { draws, rng } = scripted(0.1, 0.9),
          result = fight(
            { range: 8, hitPoints: 1, firepower: 1 },
            { range: 8, hitPoints: 1, firepower: 1 },
            rng,
            true
          );

        expect(draws.length).to.equal(2);
        expect(result.attackerWon).to.equal(false);
      });

      it('should draw nothing for a side that rolls below 1 on the reroll either', (): void => {
        // The defender's range is 1: it rolls 0 every time and draws nothing.
        const { draws, rng } = scripted(0.9, 0.9),
          result = fight(
            { range: 8, hitPoints: 1, firepower: 1 },
            { range: 1, hitPoints: 1, firepower: 1 },
            rng,
            true
          );

        expect(draws.length).to.equal(2);
        expect(result.attackerWon).to.equal(true);
      });
    });

    it('should give a tied round to the defender', (): void => {
      const { rng } = scripted(0.5, 0.5),
        result = fight(
          { range: 8, hitPoints: 1, firepower: 1 },
          { range: 8, hitPoints: 1, firepower: 1 },
          rng
        );

      expect(result.attackerWon).to.equal(false);
    });

    it('should draw nothing for a side that rolls below 1', (): void => {
      const { draws, rng } = scripted(0.5),
        result = fight(
          { range: 8, hitPoints: 1, firepower: 1 },
          { range: 1, hitPoints: 1, firepower: 1 },
          rng
        );

      expect(draws.length).to.equal(1);
      expect(result.attackerWon).to.equal(true);
    });

    it('should report damage as what each side lost, never more than it had left', (): void => {
      // Firepower 3 against 2 hit points left: the defender loses 2.
      const { rng } = scripted(0.9, 0.1),
        result = fight(
          { range: 8, hitPoints: 5, firepower: 3 },
          { range: 8, hitPoints: 2, firepower: 1 },
          rng
        );

      expect(result.defenderDamage).to.equal(2);
      expect(result.attackerDamage).to.equal(0);
    });

    it('should lose the attacker the battle when both firepowers are 0, with no draws', (): void => {
      const { draws, rng } = scripted(),
        result = fight(
          { range: 8, hitPoints: 10, firepower: 0 },
          { range: 8, hitPoints: 10, firepower: 0 },
          rng
        );

      expect(draws.length).to.equal(0);
      expect(result).to.deep.equal({
        attackerWon: false,
        attackerDamage: 0,
        defenderDamage: 0,
        rounds: 0,
      });
    });

    it("should lose the attacker a battle neither side's hits can end", (): void => {
      const attacker = { range: 1, hitPoints: 10, firepower: 1 },
        defender = { range: 8, hitPoints: 10, firepower: 0 };

      expect(deadlocked(attacker, defender)).to.equal(true);
      expect(fight(attacker, defender, scripted().rng).attackerWon).to.equal(
        false
      );
    });

    it('should lose an attacker with no hit points, and win against a defender with none, with no draws', (): void => {
      expect(
        fight(
          { range: 8, hitPoints: 0, firepower: 1 },
          { range: 8, hitPoints: 0, firepower: 1 },
          scripted().rng
        ).attackerWon
      ).to.equal(false);
      expect(
        fight(
          { range: 8, hitPoints: 10, firepower: 1 },
          { range: 8, hitPoints: 0, firepower: 1 },
          scripted().rng
        ).attackerWon
      ).to.equal(true);
    });
  });

  describe('rerolledRoundOdds', (): void => {
    it('should be roundOdds without the reroll', (): void => {
      expect(rerolledRoundOdds(8, 8)).to.equal(roundOdds(8, 8));
      expect(rerolledRoundOdds(32, 24, false)).to.equal(roundOdds(32, 24));
    });

    it("should take the attacker's first win times a second pair it doesn't lose", (): void => {
      // 8 v 8: 28/64 to win the first pair, 36/64 not to lose the second.
      expect(rerolledRoundOdds(8, 8, true)).to.equal((28 / 64) * (36 / 64));
      // 2 v 1: the defender always rolls 0; the attacker wins on a 1 and keeps it whatever it rolls.
      expect(rerolledRoundOdds(2, 1, true)).to.equal(0.5);
      expect(rerolledRoundOdds(1, 8, true)).to.equal(0);
    });
  });

  describe('combatOdds', (): void => {
    const cases: [string, number, number, number, number, number, number][] = [
      // 1 attack against 1 defence, both at 1 hit point (10) and firepower 1.
      ['1 v 1, 10 HP, firepower 1', 8, 8, 10, 10, 1, 1],
      // 4 attack (×8) against 2 defence fortified (×1.5): 32 against 24.
      ['32 v 24, 10 HP each', 32, 24, 10, 10, 1, 1],
      // 3 hit points, firepower 2 against 2 hit points, firepower 1.
      ['firepower 2 v 1, 30 v 20 HP', 48, 64, 30, 20, 2, 1],
      // Damaged: 7 of 20 hit points left, against an undamaged 10.
      ['damaged attacker, 7 v 10 HP', 80, 24, 7, 10, 1, 1],
      // A partial attack: a third of a move.
      ['a third of a move, 2 v 8', 2, 8, 10, 10, 1, 1],
      // Heavy firepower against many hit points: 40 HP, firepower 2 against 30 HP, firepower 3.
      ['40 HP fp 2 v 30 HP fp 3', 96, 64, 40, 30, 2, 3],
    ];

    cases.forEach(([name, a, d, hpA, hpD, fpA, fpD]): void => {
      it(`should match the exhaustive count: ${name}`, (): void => {
        expect(combatOdds(a, d, hpA, hpD, fpA, fpD)).to.be.closeTo(
          dynamicOdds(a, d, hpA, hpD, fpA, fpD),
          1e-12
        );
      });

      it(`should match a Monte Carlo of fight itself: ${name}`, (): void => {
        const rng = seeded(a * 1000 + d),
          battles = 20000;

        let wins = 0;

        for (let index = 0; index < battles; index++) {
          wins += fight(
            { range: a, hitPoints: hpA, firepower: fpA },
            { range: d, hitPoints: hpD, firepower: fpD },
            rng
          ).attackerWon
            ? 1
            : 0;
        }

        const odds = combatOdds(a, d, hpA, hpD, fpA, fpD),
          // Four standard errors, and at least a few battles' worth.
          margin = Math.max(
            4 * Math.sqrt((odds * (1 - odds)) / battles),
            5 / battles
          );

        expect(wins / battles).to.be.closeTo(odds, margin);
      });
    });

    cases.forEach(([name, a, d, hpA, hpD, fpA, fpD]): void => {
      it(`should match the exhaustive count with the defender rerolling: ${name}`, (): void => {
        expect(combatOdds(a, d, hpA, hpD, fpA, fpD, true)).to.be.closeTo(
          dynamicOdds(a, d, hpA, hpD, fpA, fpD, true),
          1e-12
        );
      });

      it(`should match a Monte Carlo of fight itself with the defender rerolling: ${name}`, (): void => {
        const rng = seeded(a * 1000 + d + 7),
          battles = 20000;

        let wins = 0;

        for (let index = 0; index < battles; index++) {
          wins += fight(
            { range: a, hitPoints: hpA, firepower: fpA },
            { range: d, hitPoints: hpD, firepower: fpD },
            rng,
            true
          ).attackerWon
            ? 1
            : 0;
        }

        const odds = combatOdds(a, d, hpA, hpD, fpA, fpD, true),
          margin = Math.max(
            4 * Math.sqrt((odds * (1 - odds)) / battles),
            5 / battles
          );

        expect(wins / battles).to.be.closeTo(odds, margin);
      });
    });

    it('should lower the odds with the defender rerolling', (): void => {
      expect(combatOdds(32, 24, 10, 10, 1, 1, true)).to.be.below(
        combatOdds(32, 24, 10, 10, 1, 1)
      );
    });

    it('should be about 29% for 1 v 1 at 10 HP and firepower 1 (28/64 a round)', (): void => {
      // The attacker needs 10 round wins before 10 losses at p = 0.4375.
      expect(combatOdds(8, 8, 10, 10, 1, 1)).to.be.closeTo(0.2897, 0.0001);
    });

    it('should give the edge cases', (): void => {
      expect(combatOdds(8, 8, 0, 10, 1, 1)).to.equal(0);
      expect(combatOdds(8, 8, 10, 0, 1, 1)).to.equal(1);
      expect(combatOdds(8, 8, 10, 10, 0, 0)).to.equal(0);
      expect(combatOdds(8, 8, 10, 10, 0, 1)).to.equal(0);
      expect(combatOdds(8, 8, 10, 10, 1, 0)).to.equal(1);
      expect(combatOdds(1, 8, 10, 10, 1, 0)).to.equal(0);
    });
  });
});
