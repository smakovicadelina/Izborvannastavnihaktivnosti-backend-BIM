const assert = require("node:assert/strict");
const test = require("node:test");

const authValidator = require("../src/validators/authValidator");
const aktivnostValidator = require("../src/validators/aktivnostValidator");
const prijavaValidator = require("../src/validators/prijavaValidator");
const terminValidator = require("../src/validators/terminValidator");
const profilValidator = require("../src/validators/profilValidator");
const prostorijaValidator = require("../src/validators/prostorijaValidator");
const obavestenjaValidator = require("../src/validators/obavestenjaValidator");

// Pomocna funkcija: lazni req objekat
const req = ({ body, params = {}, query = {}, korisnik } = {}) => ({ body, params, query, korisnik });

// Proverava da validator baca HttpGreska sa statusom 400 (ili zadatim) i porukom
function odbija(fn, poruka, status = 400) {
  assert.throws(fn, err => {
    assert.equal(err.status, status);
    if (poruka) assert.match(err.message, poruka);
    return true;
  });
}

test("registracija: obavezna polja, format emaila, duzina lozinke, dozvoljene uloge", () => {
  const ispravno = { ime_i_prezime: "  Ana Anić ", email: " ANA@Example.com ", lozinka: "12345678" };
  assert.deepEqual(authValidator.registracija(req({ body: ispravno })), {
    imeIPrezime: "Ana Anić",
    email: "ana@example.com",
    lozinka: "12345678",
    trazenaUloga: "ucenik"
  });

  odbija(() => authValidator.registracija(req({ body: { ...ispravno, ime_i_prezime: "" } })), /ime i prezime/);
  odbija(() => authValidator.registracija(req({ body: { ...ispravno, email: "nije-email" } })), /email/);
  odbija(() => authValidator.registracija(req({ body: { ...ispravno, lozinka: "123" } })), /8 znakova/);
  odbija(() => authValidator.registracija(req({ body: { ...ispravno, uloga: "admin" } })), /Uloga/);
  odbija(() => authValidator.registracija(req({ body: undefined })), /ime i prezime/);
});

test("aktivnost: kreiranje zahteva naziv i ceo broj mesta; izmena mora imati bar jedno polje", () => {
  const { unos, veze } = aktivnostValidator.kreiranje(req({
    body: { naziv: " Robotika ", maksimalno_mesta: 15, termin: "Sreda 14:00", termini_ids: [1, "2", 2] }
  }));
  assert.equal(unos.naziv, "Robotika");
  assert.equal(unos.opis, null);
  assert.deepEqual(veze.terminiIds, [1, 2]);

  odbija(() => aktivnostValidator.kreiranje(req({ body: { maksimalno_mesta: 5 } })), /Naziv/);
  odbija(() => aktivnostValidator.kreiranje(req({ body: { naziv: "X", maksimalno_mesta: "5" } })), /broj mesta/);
  odbija(() => aktivnostValidator.kreiranje(req({ body: { naziv: "X", maksimalno_mesta: 0 } })), /broj mesta/);
  odbija(() => aktivnostValidator.kreiranje(req({
    body: { naziv: "X", maksimalno_mesta: 5, profesori_ids: ["nije-uuid"] }
  })), /UUID/);

  odbija(() => aktivnostValidator.uredivanje(req({ params: { aktivnostId: "3" }, body: {} })), /Nema polja/);
  odbija(() => aktivnostValidator.uredivanje(req({ params: { aktivnostId: "abc" }, body: { naziv: "Y" } })), /ID aktivnosti/);
});

test("aktivnost: filteri pretrage", () => {
  const f = aktivnostValidator.pregled(req({
    query: { q: " sah ", dan: "3", interesovanje_id: "1,2", samo_slobodna: "true" }
  }));
  assert.equal(f.q, "sah");
  assert.equal(f.dan, 3);
  assert.deepEqual(f.interesovanjaIds, [1, 2]);
  assert.equal(f.samoSlobodna, true);

  odbija(() => aktivnostValidator.pregled(req({ query: { dan: "8" } })), /Dan/);
  odbija(() => aktivnostValidator.pregled(req({ query: { kategorija_id: "x" } })), /kategorije/);
  odbija(() => aktivnostValidator.pregled(req({ query: { moja_interesovanja: "true" } })), /prijavljeni/, 401);
});

test("prijava: dozvoljeni statusi i UUID ucenika", () => {
  assert.deepEqual(
    prijavaValidator.promenaStatusa(req({
      params: { aktivnostId: "1", prijavaId: "2" },
      body: { status_prijave: "otkazano" }
    })),
    { aktivnostId: 1, prijavaId: 2, status: "otkazano" }
  );
  odbija(() => prijavaValidator.promenaStatusa(req({
    params: { aktivnostId: "1", prijavaId: "2" },
    body: { status_prijave: "obrisano" }
  })), /Status/);
  odbija(() => prijavaValidator.upis(req({ params: { aktivnostId: "1" }, body: { ucenik_id: 5 } })), /UUID/);
});

test("termin, prostorija, profil i obavestenja", () => {
  odbija(() => terminValidator.kreiranje(req({
    body: { dan_u_nedelji: 2, vreme_od: "15:00", vreme_do: "14:00", prostorija_id: 1 }
  })), /terminu/);
  assert.deepEqual(
    terminValidator.kreiranje(req({
      body: { dan_u_nedelji: 2, vreme_od: "14:00", vreme_do: "15:00", prostorija_id: 1, visak: true }
    })).termin,
    { dan_u_nedelji: 2, vreme_od: "14:00", vreme_do: "15:00", prostorija_id: 1 }
  );

  odbija(() => prostorijaValidator.kreiranje(req({ body: { naziv: "Sala", kapacitet: -3 } })), /prostoriji/);

  // Prazan niz interesovanja je ispravna izmena (brise sva interesovanja).
  assert.deepEqual(profilValidator.izmena(req({ body: { interesovanja_ids: [] } })).interesovanjaIds, []);
  odbija(() => profilValidator.izmena(req({ body: {} })), /Nema podataka/);
  odbija(() => profilValidator.izmena(req({ body: { avatar_url: "ftp://x" } })), /avatara/);

  assert.deepEqual(obavestenjaValidator.pregled(req({ query: { limit: "500" } })), {
    samoNeprocitana: false,
    limit: 200
  });
  odbija(() => obavestenjaValidator.pregled(req({ query: { limit: "-1" } })), /limit/);
});
