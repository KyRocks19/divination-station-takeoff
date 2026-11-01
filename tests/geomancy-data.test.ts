import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIGURES,
  HOUSES,
  PLACES,
  addFigures,
  buildChart,
  castMothers,
  chartRows,
  chartSummary,
  dotRows,
  dotsOf,
  figureOfLines,
  getFigure,
  mothersFromIds,
  mothersFromText,
  mothersToText,
} from "../lib/geomancy-data";

const via = getFigure("geomancy-via")!;
const populus = getFigure("geomancy-populus")!;

test("there are sixteen figures, each a different pattern of single and double dots", () => {
  assert.equal(FIGURES.length, 16);
  assert.equal(new Set(FIGURES.map((x) => x.lines.join(""))).size, 16);
  assert.equal(new Set(FIGURES.map((x) => x.id)).size, 16);
  assert.equal(new Set(FIGURES.map((x) => x.latin)).size, 16);
  for (const x of FIGURES) {
    assert.equal(x.lines.length, 4);
    assert.ok(x.lines.every((v) => v === 1 || v === 2));
    assert.ok(x.english.length > 2);
    assert.equal(figureOfLines(x.lines), x);
  }
});

test("the three figures the sources give in text have their patterns", () => {
  assert.deepEqual(getFigure("geomancy-via")!.lines, [1, 1, 1, 1]);
  assert.deepEqual(getFigure("geomancy-puer")!.lines, [1, 1, 2, 1]);
  assert.deepEqual(getFigure("geomancy-populus")!.lines, [2, 2, 2, 2]);
});

test("a figure with one active element has a single dot on that element's line only", () => {
  // Fire, Air, Water, Earth are the top to bottom lines; a single dot marks the element a figure is active in.
  assert.deepEqual(getFigure("geomancy-laetitia")!.lines, [1, 2, 2, 2], "Fire only");
  assert.deepEqual(getFigure("geomancy-rubeus")!.lines, [2, 1, 2, 2], "Air only");
  assert.deepEqual(getFigure("geomancy-albus")!.lines, [2, 2, 1, 2], "Water only");
  assert.deepEqual(getFigure("geomancy-tristitia")!.lines, [2, 2, 2, 1], "Earth only");
  assert.deepEqual(getFigure("geomancy-carcer")!.lines, [1, 2, 2, 1], "Fire and Earth");
  assert.deepEqual(getFigure("geomancy-conjunctio")!.lines, [2, 1, 1, 2], "Air and Water");
});

test("the figures pair as reversals of one another, the way the sources pair them", () => {
  const reversed = (id: string) => figureOfLines([...getFigure(id)!.lines].reverse()).id;
  const pairs = [
    ["puer", "puella"],
    ["fortuna-major", "fortuna-minor"],
    ["acquisitio", "amissio"],
    ["laetitia", "tristitia"],
    ["rubeus", "albus"],
    ["caput-draconis", "cauda-draconis"],
  ];
  for (const [a, b] of pairs) {
    assert.equal(reversed(`geomancy-${a}`), `geomancy-${b}`, `${a} reversed`);
    assert.equal(reversed(`geomancy-${b}`), `geomancy-${a}`, `${b} reversed`);
  }
  for (const id of ["via", "populus", "conjunctio", "carcer"]) assert.equal(reversed(`geomancy-${id}`), `geomancy-${id}`, `${id} reads the same upside down`);
});

test("adding figures: two dots where the lines hold an even number between them, one where odd", () => {
  assert.equal(addFigures(via, via), populus);
  assert.equal(addFigures(populus, populus), populus);
  assert.equal(addFigures(via, populus), via);
  const [puer, puella] = [getFigure("geomancy-puer")!, getFigure("geomancy-puella")!];
  assert.equal(addFigures(puer, puella), addFigures(puella, puer), "adding is the same either way round");
});

test("a chart is made as the sources say, shown on four Via", () => {
  const chart = buildChart([via, via, via, via]);
  for (const p of ["daughter1", "daughter2", "daughter3", "daughter4"] as const) assert.equal(chart[p], via, p);
  for (const p of ["niece1", "niece2", "niece3", "niece4", "rightWitness", "leftWitness", "judge"] as const) assert.equal(chart[p], populus, p);
  assert.equal(chart.reconciler, via, "the Judge (Populus) added to the First Mother (Via)");
});

test("the Daughters are the Mothers' lines taken across", () => {
  const [m1, m2, m3, m4] = [getFigure("geomancy-puer")!, getFigure("geomancy-albus")!, getFigure("geomancy-carcer")!, getFigure("geomancy-laetitia")!];
  const chart = buildChart([m1, m2, m3, m4]);
  assert.deepEqual(chart.daughter1.lines, [m1.lines[0], m2.lines[0], m3.lines[0], m4.lines[0]]);
  assert.deepEqual(chart.daughter4.lines, [m1.lines[3], m2.lines[3], m3.lines[3], m4.lines[3]]);
  assert.equal(chart.niece1, addFigures(m1, m2));
  assert.equal(chart.niece2, addFigures(m3, m4));
  assert.equal(chart.niece3, addFigures(chart.daughter1, chart.daughter2));
  assert.equal(chart.niece4, addFigures(chart.daughter3, chart.daughter4));
  assert.equal(chart.rightWitness, addFigures(chart.niece1, chart.niece2));
  assert.equal(chart.leftWitness, addFigures(chart.niece3, chart.niece4));
  assert.equal(chart.judge, addFigures(chart.rightWitness, chart.leftWitness));
});

test("the Judge always has an even number of dots, whatever the Mothers", () => {
  for (let a = 0; a < 16; a += 3) {
    for (let b = 0; b < 16; b++) {
      for (let c = 0; c < 16; c += 2) {
        for (let d = 0; d < 16; d++) {
          const chart = buildChart([FIGURES[a], FIGURES[b], FIGURES[c], FIGURES[d]]);
          assert.equal(dotsOf(chart.judge) % 2, 0);
        }
      }
    }
  }
});

test("casting follows the random function and gives sixteen lines of single or double dots", () => {
  assert.deepEqual(castMothers(() => 0.1).map((m) => m.id), ["geomancy-via", "geomancy-via", "geomancy-via", "geomancy-via"]);
  assert.deepEqual(castMothers(() => 0.9).map((m) => m.id), ["geomancy-populus", "geomancy-populus", "geomancy-populus", "geomancy-populus"]);
  let x = 0.37;
  const mothers = castMothers(() => (x = (x * 7.31 + 0.137) % 1));
  assert.equal(mothers.length, 4);
});

test("the Mothers are kept as sixteen digits and read back, and chosen by figure id", () => {
  const mothers = [via, populus, getFigure("geomancy-puer")!, getFigure("geomancy-carcer")!] as const;
  const text = mothersToText(mothers);
  assert.equal(text, "1111222211211221");
  assert.deepEqual(mothersFromText(text)!.map((m) => m.id), mothers.map((m) => m.id));
  assert.equal(mothersFromText("111122221121122"), null);
  assert.equal(mothersFromText("1111222211211223"), null);
  assert.equal(mothersFromText(7), null);
  assert.deepEqual(mothersFromIds(["geomancy-via", "geomancy-via", "geomancy-via", "geomancy-via"])!.length, 4);
  assert.equal(mothersFromIds(["geomancy-via", "geomancy-via", "geomancy-via"]), null);
  assert.equal(mothersFromIds(["geomancy-via", "geomancy-via", "geomancy-via", "rune-fehu"]), null);
});

test("a chart is kept as sixteen rows in a fixed order, with a one-line summary", () => {
  const chart = buildChart([via, populus, via, populus]);
  const rows = chartRows(chart);
  assert.deepEqual(rows.map((r) => r.place), [...PLACES]);
  assert.equal(rows.length, 16);
  assert.match(chartSummary(chart), /^Judge: \w+( \w+)?; Mothers: Via, Populus, Via, Populus$/);
  assert.deepEqual(dotRows(via), ["●", "●", "●", "●"]);
  assert.deepEqual(dotRows(populus), ["● ●", "● ●", "● ●", "● ●"]);
});

test("there are twelve houses with their Latin names, numbered from 1", () => {
  assert.deepEqual(HOUSES.map((h) => h.n), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.equal(HOUSES[0].latin, "Vita");
  assert.equal(HOUSES[11].latin, "Carcer");
});
