
// Zajednicki alati za greske i validaciju ulaza.

class HttpGreska extends Error {
  constructor(status, poruka, dodatno = undefined) {
    super(poruka);
    this.status = status;
    this.dodatno = dodatno;
  }
}

const greska = (status, poruka, dodatno) =>
  new HttpGreska(status, poruka, dodatno);

function imaPolje(objekat, polje) {
  return Object.prototype.hasOwnProperty.call(objekat || {}, polje);
}

// Vraca pozitivan ceo broj ili null (odbija "1e3", "-1", prevelike brojeve).
function parsirajId(vrednost) {
  if (typeof vrednost === "number") {
    return Number.isSafeInteger(vrednost) && vrednost > 0 ? vrednost : null;
  }

  if (typeof vrednost !== "string" || !/^\d{1,15}$/.test(vrednost)) {
    return null;
  }

  const broj = Number(vrednost);
  return broj > 0 ? broj : null;
}

function zahtevajId(vrednost, poruka = "Neispravan ID.") {
  const id = parsirajId(vrednost);
  if (!id) throw greska(400, poruka);
  return id;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jeUuid(vrednost) {
  return typeof vrednost === "string" && UUID_REGEX.test(vrednost);
}

function jeNeprazanTekst(vrednost, maks = 10000) {
  return (
    typeof vrednost === "string" &&
    vrednost.trim().length > 0 &&
    vrednost.trim().length <= maks
  );
}

// null ili string (prazan string se cuva kao null)
function opcioniTekst(vrednost, maks = 10000) {
  if (vrednost === null || vrednost === undefined) return { ok: true, vrednost: null };
  if (typeof vrednost !== "string" || vrednost.length > maks) return { ok: false };
  const t = vrednost.trim();
  return { ok: true, vrednost: t.length ? t : null };
}

// Niz pozitivnih ID-jeva bez duplikata; null ako niz nije ispravan.
function nizId(vrednost) {
  if (!Array.isArray(vrednost)) return null;
  const rezultat = [];
  for (const v of vrednost) {
    const id = parsirajId(v);
    if (!id) return null;
    if (!rezultat.includes(id)) rezultat.push(id);
  }
  return rezultat;
}

function tabelaNedostaje(error) {
  return Boolean(
    error && (error.code === "42P01" || error.code === "PGRST205")
  );
}

const DATUM_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function jeDatum(vrednost) {
  if (typeof vrednost !== "string" || !DATUM_REGEX.test(vrednost)) return false;
  const d = new Date(`${vrednost}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === vrednost;
}

// Danasnji datum u lokalnoj vremenskoj zoni servera (YYYY-MM-DD).
function danasnjiDatum(sada = new Date()) {
  const pomeraj = sada.getTimezoneOffset() * 60000;
  return new Date(sada.getTime() - pomeraj).toISOString().slice(0, 10);
}

module.exports = {
  HttpGreska,
  greska,
  imaPolje,
  parsirajId,
  zahtevajId,
  jeUuid,
  jeNeprazanTekst,
  opcioniTekst,
  nizId,
  tabelaNedostaje,
  jeDatum,
  danasnjiDatum
};
