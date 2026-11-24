// Zajednicka pravila validacije koja koriste svi validatori.
//
// Svaki validator je funkcija (req) => podaci. Ako je ulaz neispravan, baca
// HttpGreska sa statusom 400; ako je ispravan, vraca ociscene podatke
// (trim-ovane stringove, brojeve umesto stringova...) koje middleware
// "validiraj" upisuje u req.podaci.

const {
  greska,
  imaPolje,
  zahtevajId,
  parsirajId,
  jeUuid,
  jeNeprazanTekst,
  opcioniTekst,
  nizId,
  jeDatum
} = require("../utils/http");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSI_PRIJAVE = ["prijavljen", "na_cekanju", "otkazano"];

// "true", "1", "da" -> true (za query parametre)
const daLi = vrednost =>
  ["true", "1", "da"].includes(String(vrednost).toLowerCase());

function telo(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

// ID iz URL parametra, npr. idParam(req, "aktivnostId", "Neispravan ID aktivnosti.")
function idParam(req, ime, poruka) {
  return zahtevajId(req.params[ime], poruka);
}

function uuidParam(req, ime, poruka) {
  const vrednost = req.params[ime];
  if (!jeUuid(vrednost)) throw greska(400, poruka);
  return vrednost;
}

function email(vrednost) {
  const e = typeof vrednost === "string" ? vrednost.trim().toLowerCase() : "";
  if (!EMAIL_REGEX.test(e)) throw greska(400, "Unesite ispravnu email adresu.");
  return e;
}

function lozinka(vrednost) {
  if (typeof vrednost !== "string" || vrednost.length < 8) {
    throw greska(400, "Lozinka mora imati najmanje 8 znakova.");
  }
  return vrednost;
}

function imeIPrezime(vrednost, poruka = "Unesite ime i prezime.") {
  if (!jeNeprazanTekst(vrednost, 120) || vrednost.trim().length < 2) {
    throw greska(400, poruka);
  }
  return vrednost.trim();
}

// Opcioni status prijave iz query parametra (?status=...)
function opcioniStatusPrijave(vrednost, poruka) {
  if (vrednost === undefined) return undefined;
  if (!STATUSI_PRIJAVE.includes(vrednost)) {
    throw greska(400, poruka || "Status mora biti prijavljen, na_cekanju ili otkazano.");
  }
  return vrednost;
}

function datum(vrednost) {
  if (!jeDatum(vrednost)) throw greska(400, "Datum mora biti u formatu YYYY-MM-DD.");
  return vrednost;
}

function nizIdIliGreska(vrednost, poruka) {
  const ids = nizId(vrednost);
  if (!ids) throw greska(400, poruka);
  return ids;
}

// Opciona tekstualna polja: [["polje", maksDuzina], ...] -> { polje: vrednost }
function opcionaTekstPolja(b, polja) {
  const unos = {};
  for (const [polje, maks] of polja) {
    if (imaPolje(b, polje)) {
      const v = opcioniTekst(b[polje], maks);
      if (!v.ok) throw greska(400, `Polje ${polje} nije ispravno.`);
      unos[polje] = v.vrednost;
    }
  }
  return unos;
}

// Baca 400 ako nijedan deo ne sadrzi izmenu. Prazan objekat = nema izmena,
// a niz (i prazan, npr. interesovanja_ids: []) se racuna kao izmena.
function zahtevajIzmene(...delovi) {
  const prazno = d =>
    d === undefined || (!Array.isArray(d) && typeof d === "object" && !Object.keys(d).length);
  if (delovi.every(prazno)) {
    throw greska(400, "Nema podataka za izmenu.");
  }
}

module.exports = {
  EMAIL_REGEX,
  STATUSI_PRIJAVE,
  daLi,
  telo,
  idParam,
  uuidParam,
  email,
  lozinka,
  imeIPrezime,
  opcioniStatusPrijave,
  datum,
  nizIdIliGreska,
  opcionaTekstPolja,
  zahtevajIzmene,
  // ponovo izvozimo osnovne alate da validatori imaju jedan izvor
  greska,
  imaPolje,
  parsirajId,
  jeUuid,
  jeNeprazanTekst,
  opcioniTekst,
  nizId
};
