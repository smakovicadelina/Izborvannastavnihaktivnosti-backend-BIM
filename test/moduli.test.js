const assert = require("node:assert/strict");
const test = require("node:test");

process.env.QR_SECRET = "test-tajna";

const { napraviQrKod, proveriQrKod } = require("../src/services/qrService");
const { terminiSePreklapaju, opisTermina, sortirajTermine } = require("../src/utils/vreme");
const { parsirajId, nizId, jeDatum, opcioniTekst } = require("../src/utils/http");
const { lokalnePreporuke } = require("../src/services/aiService");

test("QR kod: ispravan kod se prihvata, izmenjen ili istekao odbija", () => {
  const sada = Date.UTC(2026, 10, 21, 12, 0, 0);
  const { kod } = napraviQrKod({ aktivnostId: 7, datum: "2026-11-21", trajanjeMinuta: 30, sada });

  assert.deepEqual(proveriQrKod(kod, sada + 60_000), { aktivnostId: 7, datum: "2026-11-21" });

  // Promena aktivnosti u telu koda ponistava potpis.
  const [prefiks, telo, potpis] = kod.split(".");
  const lazno = Buffer.from(
    JSON.stringify({ ...JSON.parse(Buffer.from(telo, "base64url")), a: 8 })
  ).toString("base64url");
  assert.throws(() => proveriQrKod(`${prefiks}.${lazno}.${potpis}`, sada), /nije ispravan/);

  assert.throws(() => proveriQrKod(kod, sada + 31 * 60_000), /istekao/);
  assert.throws(() => proveriQrKod("besmislica", sada), /nije ispravan/);
  assert.throws(() => proveriQrKod(undefined, sada), /nije ispravan/);
});

test("preklapanje termina", () => {
  const a = { dan_u_nedelji: 3, vreme_od: "14:00:00", vreme_do: "15:30:00" };
  assert.equal(terminiSePreklapaju(a, { dan_u_nedelji: 3, vreme_od: "15:00", vreme_do: "16:00" }), true);
  assert.equal(terminiSePreklapaju(a, { dan_u_nedelji: 3, vreme_od: "15:30", vreme_do: "16:00" }), false, "susedni termini se ne preklapaju");
  assert.equal(terminiSePreklapaju(a, { dan_u_nedelji: 4, vreme_od: "14:00", vreme_do: "15:00" }), false);
  assert.equal(opisTermina(a), "Sreda 14:00–15:30");
  assert.deepEqual(
    sortirajTermine([
      { dan_u_nedelji: 4, vreme_od: "08:00" },
      { dan_u_nedelji: 1, vreme_od: "12:00" },
      { dan_u_nedelji: 1, vreme_od: "09:00" }
    ]).map(t => `${t.dan_u_nedelji}-${t.vreme_od}`),
    ["1-09:00", "1-12:00", "4-08:00"]
  );
});

test("validacija ID-jeva, datuma i teksta", () => {
  assert.equal(parsirajId("12"), 12);
  assert.equal(parsirajId("1e3"), null);
  assert.equal(parsirajId("-1"), null);
  assert.equal(parsirajId("0"), null);
  assert.equal(parsirajId("99999999999999999999"), null);
  assert.deepEqual(nizId([1, "2", 2]), [1, 2]);
  assert.equal(nizId([1, "x"]), null);
  assert.equal(nizId("1"), null);
  assert.equal(jeDatum("2026-02-29"), false);
  assert.equal(jeDatum("2028-02-29"), true);
  assert.deepEqual(opcioniTekst("  "), { ok: true, vrednost: null });
  assert.deepEqual(opcioniTekst(5), { ok: false });
});

test("lokalni AI preporucuje samo postojece aktivnosti i daje obrazlozenje", () => {
  const aktivnosti = [
    { id: 1, naziv: "Robotika", opis: "Programiranje robota", kategorija: { naziv: "Nauka" }, interesovanja: [], slobodna_mesta: 4 },
    { id: 2, naziv: "Školski hor", opis: "Pevanje i muzika", kategorija: { naziv: "Muzika" }, interesovanja: [], slobodna_mesta: 2 },
    { id: 3, naziv: "Šah", opis: "Strategija", kategorija: { naziv: "Sport" }, interesovanja: [], slobodna_mesta: 1 }
  ];

  const r = lokalnePreporuke(
    "Volim programiranje i robote",
    aktivnosti,
    [{ naziv: "Muzika" }]
  );

  assert.equal(r.preporuke[0].aktivnost_id, 1);
  assert.ok(r.preporuke.some(p => p.aktivnost_id === 2), "interesovanje iz profila (Muzika) se uzima u obzir");
  assert.ok(!r.preporuke.some(p => p.aktivnost_id === 3));
  assert.match(r.preporuke[0].obrazlozenje, /Robotika/);

  const prazno = lokalnePreporuke("xyz", aktivnosti, []);
  assert.equal(prazno.preporuke.length, 0);
  assert.ok(prazno.uvod.length > 0);
});
