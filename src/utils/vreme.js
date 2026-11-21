
// Pomocne funkcije za termine (dan u nedelji + vreme od/do).

const NAZIVI_DANA = [
  null,
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
  "Nedelja"
];

const VREME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function ispravnoVreme(vrednost) {
  return typeof vrednost === "string" && VREME_REGEX.test(vrednost);
}

function sekundeOdPonoci(vreme) {
  const [sati, minuti, sekunde = "0"] = String(vreme).split(":");
  return Number(sati) * 3600 + Number(minuti) * 60 + Number(sekunde);
}

function kratkoVreme(vreme) {
  return String(vreme || "").slice(0, 5);
}

function nazivDana(dan) {
  return NAZIVI_DANA[dan] || null;
}

// Da li se dva termina preklapaju (isti dan i presek intervala [od, do)).
function terminiSePreklapaju(a, b) {
  return (
    Number(a.dan_u_nedelji) === Number(b.dan_u_nedelji) &&
    sekundeOdPonoci(a.vreme_od) < sekundeOdPonoci(b.vreme_do) &&
    sekundeOdPonoci(b.vreme_od) < sekundeOdPonoci(a.vreme_do)
  );
}

function opisTermina(termin) {
  return `${nazivDana(termin.dan_u_nedelji)} ${kratkoVreme(termin.vreme_od)}–${kratkoVreme(termin.vreme_do)}`;
}

function sortirajTermine(termini) {
  return [...termini].sort(
    (a, b) =>
      a.dan_u_nedelji - b.dan_u_nedelji ||
      sekundeOdPonoci(a.vreme_od) - sekundeOdPonoci(b.vreme_od)
  );
}

module.exports = {
  NAZIVI_DANA,
  ispravnoVreme,
  sekundeOdPonoci,
  kratkoVreme,
  nazivDana,
  terminiSePreklapaju,
  opisTermina,
  sortirajTermine
};
