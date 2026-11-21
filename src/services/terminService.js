
const { greska } = require("../utils/http");
const { terminiSePreklapaju, opisTermina } = require("../utils/vreme");
const { upit, upitOpcione } = require("./aktivnostService");

// Termini koji se u istoj prostoriji preklapaju sa zadatim intervalom.
async function preklapanjaUProstoriji(db, { prostorija_id, dan_u_nedelji, vreme_od, vreme_do }, izuzmiId = null) {
  const termini = await upit(
    db
      .from("termini")
      .select("id, dan_u_nedelji, vreme_od, vreme_do, prostorija_id")
      .eq("prostorija_id", prostorija_id)
      .eq("dan_u_nedelji", dan_u_nedelji)
  );

  return termini.filter(
    t => t.id !== izuzmiId && terminiSePreklapaju(t, { dan_u_nedelji, vreme_od, vreme_do })
  );
}

async function zahtevajProstoriju(db, prostorijaId) {
  const { data, error } = await db
    .from("prostorije")
    .select("id, naziv, kapacitet")
    .eq("id", prostorijaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(400, "Izabrana prostorija ne postoji.");
  return data;
}

async function proveriDostupnostProstorije(db, termin, izuzmiId = null) {
  const preklapanja = await preklapanjaUProstoriji(db, termin, izuzmiId);
  if (preklapanja.length) {
    throw greska(
      409,
      `Prostorija je zauzeta: postoji termin koji se preklapa (${opisTermina(preklapanja[0])}).`
    );
  }
}

// Aktivnosti koje koriste termin.
async function aktivnostiTermina(db, terminIds) {
  if (!terminIds.length) return [];
  const [veze, direktne] = await Promise.all([
    upitOpcione(db.from("aktivnost_termini").select("aktivnost_id").in("termin_id", terminIds)),
    upit(db.from("aktivnosti").select("id").in("termin_id", terminIds))
  ]);
  const ids = [...new Set([...veze.map(v => v.aktivnost_id), ...direktne.map(a => a.id)])];
  if (!ids.length) return [];
  return upit(
    db.from("aktivnosti").select("id, naziv, maksimalno_mesta, aktivna").in("id", ids)
  );
}

module.exports = {
  preklapanjaUProstoriji,
  zahtevajProstoriju,
  proveriDostupnostProstorije,
  aktivnostiTermina
};
