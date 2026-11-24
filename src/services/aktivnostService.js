// POSLOVNA LOGIKA ZA AKTIVNOSTI.
//
// Glavne tabele: aktivnosti (+ kategorije), i povezne tabele (veza vise-prema-vise):
//   aktivnost_termini       aktivnost <-> termin (termin pripada prostoriji)
//   aktivnost_profesori     aktivnost <-> korisnik sa ulogom profesor
//   aktivnost_interesovanja aktivnost <-> interesovanje
// Servis ne zna nista o HTTP-u (req/res): prima obicne podatke, radi sa bazom
// i vraca rezultat ili baca HttpGreska koju errorHandler pretvara u odgovor.

const { dbSupabase } = require("../config/supabase");
const { greska, imaPolje, tabelaNedostaje } = require("../utils/http");
const { upit, upitOpcione } = require("../utils/upit");
const { normalizuj } = require("../utils/tekst");
const { AKTIVNI_STATUSI } = require("../utils/konstante");
const { nazivDana, opisTermina, sortirajTermine } = require("../utils/vreme");
const { napraviQrKod } = require("./qrService");
const obavestenja = require("./obavestenjaService");

// ---------------------------------------------------------------------------
// Ucitavanje i "obogacivanje" aktivnosti povezanim podacima
// ---------------------------------------------------------------------------

// Termini po ID-ju, zajedno sa prostorijom: Map<terminId, termin>.
async function ucitajTermine(terminIds) {
  if (!terminIds.length) return new Map();

  const termini = await upit(
    dbSupabase
      .from("termini")
      .select("id, dan_u_nedelji, vreme_od, vreme_do, prostorija_id")
      .in("id", terminIds)
  );

  const prostorijaIds = [...new Set(termini.map(t => t.prostorija_id))];
  const prostorije = prostorijaIds.length
    ? await upit(
        dbSupabase.from("prostorije").select("id, naziv, kapacitet").in("id", prostorijaIds)
      )
    : [];
  const prostorijePoId = new Map(prostorije.map(p => [p.id, p]));

  return new Map(
    termini.map(t => [
      t.id,
      {
        id: t.id,
        dan_u_nedelji: t.dan_u_nedelji,
        dan: nazivDana(t.dan_u_nedelji),
        vreme_od: t.vreme_od,
        vreme_do: t.vreme_do,
        prostorija_id: t.prostorija_id,
        prostorija: prostorijePoId.get(t.prostorija_id) || null
      }
    ])
  );
}

// Dodaje svakoj aktivnosti: kategoriju, termine, profesore, interesovanja,
// broj prijavljenih i slobodna mesta (i "moja_prijava" ako je zadat ucenikId).
// Podaci se ucitavaju sa nekoliko upita za SVE aktivnosti odjednom (ne po jednoj).
async function obogatiAktivnosti(aktivnosti, { ucenikId = null } = {}) {
  if (!aktivnosti.length) return [];

  const ids = aktivnosti.map(a => a.id);

  const [prijave, veze, profesoriVeze, interesovanjaVeze, kategorije] = await Promise.all([
    upit(
      dbSupabase
        .from("prijave")
        .select("id, aktivnost_id, ucenik_id, status_prijave")
        .in("aktivnost_id", ids)
        .in("status_prijave", AKTIVNI_STATUSI)
    ),
    upitOpcione(
      dbSupabase.from("aktivnost_termini").select("aktivnost_id, termin_id").in("aktivnost_id", ids)
    ),
    upitOpcione(
      dbSupabase.from("aktivnost_profesori").select("aktivnost_id, profesor_id").in("aktivnost_id", ids)
    ),
    upitOpcione(
      dbSupabase
        .from("aktivnost_interesovanja")
        .select("aktivnost_id, interesovanje_id")
        .in("aktivnost_id", ids)
    ),
    upitOpcione(dbSupabase.from("kategorije").select("id, naziv"))
  ]);

  // aktivnosti.termin_id i aktivnosti.profesor_id su "glavni" termin/profesor;
  // dodatni dolaze iz poveznih tabela.
  const terminIds = new Set(veze.map(v => v.termin_id));
  for (const a of aktivnosti) if (a.termin_id) terminIds.add(a.termin_id);
  const terminiPoId = await ucitajTermine([...terminIds]);

  const profesorIds = new Set(profesoriVeze.map(v => v.profesor_id));
  for (const a of aktivnosti) if (a.profesor_id) profesorIds.add(a.profesor_id);
  const profesori = profesorIds.size
    ? await upit(dbSupabase.from("korisnici").select("id, ime_i_prezime").in("id", [...profesorIds]))
    : [];
  const profesoriPoId = new Map(profesori.map(p => [p.id, p]));

  const interesovanjeIds = [...new Set(interesovanjaVeze.map(v => v.interesovanje_id))];
  const interesovanja = interesovanjeIds.length
    ? await upit(dbSupabase.from("interesovanja").select("id, naziv").in("id", interesovanjeIds))
    : [];
  const interesovanjaPoId = new Map(interesovanja.map(i => [i.id, i]));
  const kategorijePoId = new Map(kategorije.map(k => [k.id, k]));

  return aktivnosti.map(a => {
    const prijavljeni = prijave.filter(
      p => p.aktivnost_id === a.id && p.status_prijave === "prijavljen"
    ).length;

    const terminIdsAktivnosti = new Set(
      veze.filter(v => v.aktivnost_id === a.id).map(v => v.termin_id)
    );
    if (a.termin_id) terminIdsAktivnosti.add(a.termin_id);

    const profesoriAktivnosti = new Set(
      profesoriVeze.filter(v => v.aktivnost_id === a.id).map(v => v.profesor_id)
    );
    if (a.profesor_id) profesoriAktivnosti.add(a.profesor_id);

    const rezultat = {
      ...a,
      kategorija: kategorijePoId.get(a.kategorija_id) || null,
      termini: sortirajTermine(
        [...terminIdsAktivnosti].map(id => terminiPoId.get(id)).filter(Boolean)
      ),
      profesori: [...profesoriAktivnosti].map(id => profesoriPoId.get(id)).filter(Boolean),
      interesovanja: interesovanjaVeze
        .filter(v => v.aktivnost_id === a.id)
        .map(v => interesovanjaPoId.get(v.interesovanje_id))
        .filter(Boolean),
      broj_prijavljenih: prijavljeni,
      slobodna_mesta: Math.max(0, a.maksimalno_mesta - prijavljeni)
    };

    if (ucenikId) {
      const moja = prijave.find(p => p.aktivnost_id === a.id && p.ucenik_id === ucenikId);
      rezultat.moja_prijava = moja ? { id: moja.id, status_prijave: moja.status_prijave } : null;
    }
    return rezultat;
  });
}

// Red iz tabele aktivnosti ili 404.
async function zahtevajAktivnost(aktivnostId) {
  const { data, error } = await dbSupabase
    .from("aktivnosti")
    .select("*")
    .eq("id", aktivnostId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Aktivnost nije pronađena.");
  return data;
}

// Obogacena aktivnost ili null.
async function aktivnostPoId(aktivnostId, opcije = {}) {
  const { data, error } = await dbSupabase
    .from("aktivnosti")
    .select("*")
    .eq("id", aktivnostId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [obogacena] = await obogatiAktivnosti([data], opcije);
  return obogacena;
}

async function aktivnostiPoIds(ids) {
  const redovi = ids.length
    ? await upit(dbSupabase.from("aktivnosti").select("*").in("id", ids))
    : [];
  return obogatiAktivnosti(redovi);
}

// Svi termini (sa prostorijom) koji pripadaju aktivnosti.
async function terminiAktivnosti(aktivnost) {
  const veze = await upitOpcione(
    dbSupabase.from("aktivnost_termini").select("termin_id").eq("aktivnost_id", aktivnost.id)
  );
  const ids = new Set(veze.map(v => v.termin_id));
  if (aktivnost.termin_id) ids.add(aktivnost.termin_id);
  const mapa = await ucitajTermine([...ids]);
  return [...mapa.values()];
}

async function brojPrijavljenih(aktivnostId) {
  const { count, error } = await dbSupabase
    .from("prijave")
    .select("id", { count: "exact", head: true })
    .eq("aktivnost_id", aktivnostId)
    .eq("status_prijave", "prijavljen");
  if (error) throw error;
  return count || 0;
}

// ---------------------------------------------------------------------------
// PREGLED, PRETRAGA I FILTRIRANJE
// ---------------------------------------------------------------------------

// korisnik = { id, uloga } ili null (anonimni zahtev)
async function pregled(filteri, korisnik) {
  const jeProfesor = korisnik?.uloga === "profesor";
  const ucenikId = korisnik?.uloga === "ucenik" ? korisnik.id : null;
  let interesovanjaIds = filteri.interesovanjaIds || [];

  if (filteri.mojaInteresovanja) {
    const { data, error } = await dbSupabase
      .from("korisnik_interesovanja")
      .select("interesovanje_id")
      .eq("korisnik_id", korisnik.id);
    if (error) throw error;
    interesovanjaIds = [...new Set([...interesovanjaIds, ...data.map(r => r.interesovanje_id)])];
    if (!interesovanjaIds.length) return [];
  }

  let q = dbSupabase.from("aktivnosti").select("*").order("kreirano_at", { ascending: false });
  if (!(jeProfesor && filteri.ukljuciNeaktivne)) q = q.eq("aktivna", true);
  if (filteri.kategorijaId) q = q.eq("kategorija_id", filteri.kategorijaId);

  let lista = await obogatiAktivnosti(await upit(q), { ucenikId });

  // Pretraga po vise reci, bez obzira na velika slova i dijakritike.
  if (filteri.q) {
    const reci = normalizuj(filteri.q).split(/\s+/).filter(Boolean);
    lista = lista.filter(a => {
      const tekst = normalizuj(
        [
          a.naziv,
          a.opis,
          a.kategorija?.naziv,
          a.termin,
          a.prostorija,
          ...a.interesovanja.map(i => i.naziv),
          ...a.profesori.map(p => p.ime_i_prezime)
        ].join(" ")
      );
      return reci.every(r => tekst.includes(r));
    });
  }

  if (interesovanjaIds.length) {
    const trazena = new Set(interesovanjaIds);
    const nazivi = await upit(
      dbSupabase.from("interesovanja").select("naziv").in("id", interesovanjaIds)
    );
    const trazeniNazivi = new Set(nazivi.map(i => normalizuj(i.naziv)));
    lista = lista.filter(
      a =>
        a.interesovanja.some(i => trazena.has(i.id)) ||
        // Ako aktivnost nema povezana interesovanja, poredimo naziv sa kategorijom.
        (a.kategorija && trazeniNazivi.has(normalizuj(a.kategorija.naziv)))
    );
  }

  if (filteri.dan) {
    lista = lista.filter(a => a.termini.some(t => t.dan_u_nedelji === filteri.dan));
  }
  if (filteri.samoSlobodna) {
    lista = lista.filter(a => a.slobodna_mesta > 0);
  }
  return lista;
}

// Detalji aktivnosti; neaktivnu aktivnost vidi samo profesor.
async function detalji(aktivnostId, korisnik) {
  const aktivnost = await aktivnostPoId(aktivnostId, {
    ucenikId: korisnik?.uloga === "ucenik" ? korisnik.id : null
  });
  if (!aktivnost || (aktivnost.aktivna === false && korisnik?.uloga !== "profesor")) {
    throw greska(404, "Aktivnost nije pronađena.");
  }
  return aktivnost;
}

// ---------------------------------------------------------------------------
// Provere poslovnih pravila
// ---------------------------------------------------------------------------

async function proveriKategoriju(kategorijaId) {
  const { data, error } = await dbSupabase
    .from("kategorije")
    .select("id")
    .eq("id", kategorijaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(400, "Izabrana kategorija ne postoji.");
}

async function proveriProfesore(profesoriIds) {
  if (!profesoriIds.length) return;
  const profesori = await upit(
    dbSupabase.from("korisnici").select("id, uloga").in("id", profesoriIds)
  );
  const validni = new Set(profesori.filter(p => p.uloga === "profesor").map(p => p.id));
  if (profesoriIds.some(id => !validni.has(id))) {
    throw greska(400, "Svi navedeni profesori moraju postojati i imati ulogu profesor.");
  }
}

async function proveriInteresovanja(interesovanjaIds) {
  if (!interesovanjaIds.length) return;
  const postojeca = await upit(
    dbSupabase.from("interesovanja").select("id").in("id", interesovanjaIds)
  );
  if (postojeca.length !== interesovanjaIds.length) {
    throw greska(400, "Neka od navedenih interesovanja ne postoje.");
  }
}

// Termin (prostorija u odredjeno vreme) ne sme biti dodeljen drugoj aktivnoj aktivnosti.
async function proveriDostupnostTermina(terminIds, aktivnostId = null) {
  if (!terminIds.length) return;

  const [veze, direktne] = await Promise.all([
    upitOpcione(
      dbSupabase.from("aktivnost_termini").select("aktivnost_id, termin_id").in("termin_id", terminIds)
    ),
    upit(dbSupabase.from("aktivnosti").select("id, termin_id").in("termin_id", terminIds))
  ]);

  const zauzimaju = new Set([...veze.map(v => v.aktivnost_id), ...direktne.map(a => a.id)]);
  zauzimaju.delete(aktivnostId);
  if (!zauzimaju.size) return;

  const aktivne = await upit(
    dbSupabase.from("aktivnosti").select("id, naziv").in("id", [...zauzimaju]).eq("aktivna", true)
  );
  if (aktivne.length) {
    throw greska(409, `Prostorija je u izabranom terminu zauzeta (aktivnost: ${aktivne[0].naziv}).`);
  }
}

// Broj mesta aktivnosti ne sme biti veci od kapaciteta prostorije.
function proveriKapacitet(maksimalnoMesta, termini) {
  const premali = termini.find(t => t.prostorija && maksimalnoMesta > t.prostorija.kapacitet);
  if (premali) {
    throw greska(
      409,
      `Broj mesta (${maksimalnoMesta}) premašuje kapacitet prostorije ${premali.prostorija.naziv} (${premali.prostorija.kapacitet}).`
    );
  }
}

async function ucitajIzabraneTermine(terminiIds) {
  const mapa = await ucitajTermine(terminiIds);
  if (mapa.size !== terminiIds.length) {
    throw greska(400, "Neki od izabranih termina ne postoje.");
  }
  return terminiIds.map(id => mapa.get(id));
}

// ---------------------------------------------------------------------------
// Povezne tabele
// ---------------------------------------------------------------------------

// Zamenjuje sve veze aktivnosti u poveznoj tabeli novim skupom vrednosti.
async function zameniVeze(tabela, aktivnostId, kolona, vrednosti) {
  const { error: brisanjeGreska } = await dbSupabase
    .from(tabela)
    .delete()
    .eq("aktivnost_id", aktivnostId);
  if (brisanjeGreska) throw brisanjeGreska;

  if (!vrednosti.length) return;
  const { error } = await dbSupabase
    .from(tabela)
    .insert(vrednosti.map(v => ({ aktivnost_id: aktivnostId, [kolona]: v })));
  if (error) throw error;
}

async function sacuvajVeze(aktivnostId, veze) {
  if (veze.terminiIds) {
    await zameniVeze("aktivnost_termini", aktivnostId, "termin_id", veze.terminiIds);
  }
  if (veze.profesoriIds) {
    await zameniVeze("aktivnost_profesori", aktivnostId, "profesor_id", veze.profesoriIds);
  }
  if (veze.interesovanjaIds) {
    try {
      await zameniVeze("aktivnost_interesovanja", aktivnostId, "interesovanje_id", veze.interesovanjaIds);
    } catch (error) {
      if (tabelaNedostaje(error)) {
        throw greska(503, "Tabela aktivnost_interesovanja ne postoji. Pokrenite SQL migraciju 004.");
      }
      throw error;
    }
  }
}

// Tekstualna polja termin/prostorija izvedena iz strukturisanih termina.
function tekstIzTermina(termini) {
  return {
    termin: termini.map(opisTermina).join("; "),
    prostorija: [...new Set(termini.map(t => t.prostorija?.naziv).filter(Boolean))].join(", ") || null
  };
}

async function osveziTekstTermina(aktivnostId, termini) {
  const { error } = await dbSupabase
    .from("aktivnosti")
    .update(tekstIzTermina(termini))
    .eq("id", aktivnostId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

// CREATE - unos i veze dolaze iz aktivnostValidator.kreiranje
async function kreiraj(profesorId, { unos, veze }) {
  if (unos.kategorija_id) await proveriKategoriju(unos.kategorija_id);
  if (veze.profesoriIds) await proveriProfesore(veze.profesoriIds);
  if (veze.interesovanjaIds) await proveriInteresovanja(veze.interesovanjaIds);

  let termini = [];
  if (veze.terminiIds?.length) {
    termini = await ucitajIzabraneTermine(veze.terminiIds);
    proveriKapacitet(unos.maksimalno_mesta, termini);
    await proveriDostupnostTermina(veze.terminiIds);

    const tekst = tekstIzTermina(termini);
    unos.termin = unos.termin || tekst.termin;
    if (!unos.prostorija) unos.prostorija = tekst.prostorija;
    unos.termin_id = veze.terminiIds[0];
  }

  if (!unos.termin) {
    throw greska(400, "Unesite termin (tekst) ili izaberite termine (termini_ids).");
  }

  // Vlasnik aktivnosti je UVEK ulogovani profesor (ne ID iz tela zahteva).
  const { data, error } = await dbSupabase
    .from("aktivnosti")
    .insert({ ...unos, profesor_id: profesorId, aktivna: true })
    .select()
    .single();
  if (error) throw error;

  try {
    await sacuvajVeze(data.id, veze);
  } catch (vezeGreska) {
    // Ne ostavljamo polovicno kreiranu aktivnost.
    for (const tabela of ["aktivnost_termini", "aktivnost_profesori", "aktivnost_interesovanja"]) {
      await dbSupabase.from(tabela).delete().eq("aktivnost_id", data.id);
    }
    await dbSupabase.from("aktivnosti").delete().eq("id", data.id);
    throw vezeGreska;
  }

  return { ...data, termini, broj_prijavljenih: 0, slobodna_mesta: data.maksimalno_mesta };
}

// UPDATE - delimicna izmena (PATCH). Ako se promeni raspored, ucenici dobijaju obavestenje.
async function uredi(aktivnostId, { unos, veze }) {
  const postojeca = await zahtevajAktivnost(aktivnostId);

  if (unos.kategorija_id) await proveriKategoriju(unos.kategorija_id);
  if (veze.profesoriIds) await proveriProfesore(veze.profesoriIds);
  if (veze.interesovanjaIds) await proveriInteresovanja(veze.interesovanjaIds);

  const maksimalnoMesta = unos.maksimalno_mesta ?? postojeca.maksimalno_mesta;
  if (imaPolje(unos, "maksimalno_mesta")) {
    if (unos.maksimalno_mesta < (await brojPrijavljenih(aktivnostId))) {
      throw greska(409, "Broj mesta ne može biti manji od broja prijavljenih.");
    }
  }

  let termini;
  if (veze.terminiIds) {
    termini = await ucitajIzabraneTermine(veze.terminiIds);
    await proveriDostupnostTermina(veze.terminiIds, aktivnostId);
    if (termini.length) {
      const tekst = tekstIzTermina(termini);
      if (!imaPolje(unos, "termin")) unos.termin = tekst.termin;
      if (!imaPolje(unos, "prostorija")) unos.prostorija = tekst.prostorija;
    }
    unos.termin_id = veze.terminiIds[0] || null;
  } else {
    termini = await terminiAktivnosti(postojeca);
  }

  proveriKapacitet(maksimalnoMesta, termini);
  if (imaPolje(unos, "termin") && !unos.termin) {
    throw greska(400, "Termin ne može biti prazan.");
  }

  let aktivnost = postojeca;
  if (Object.keys(unos).length) {
    const { data, error } = await dbSupabase
      .from("aktivnosti")
      .update(unos)
      .eq("id", aktivnostId)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw greska(404, "Aktivnost nije pronađena.");
    aktivnost = data;
  }

  await sacuvajVeze(aktivnostId, veze);

  const promenjenRaspored =
    Boolean(veze.terminiIds) ||
    (imaPolje(unos, "termin") && unos.termin !== postojeca.termin) ||
    (imaPolje(unos, "prostorija") && unos.prostorija !== postojeca.prostorija);

  if (promenjenRaspored) {
    await obavestenja.obavestiUcenikeAktivnosti(aktivnostId, {
      tip: "promena_termina",
      naslov: "Promena termina",
      poruka: `Aktivnost "${aktivnost.naziv}" ima novi termin: ${aktivnost.termin}${aktivnost.prostorija ? `, prostorija: ${aktivnost.prostorija}` : ""}.`
    });
  }

  return aktivnostPoId(aktivnostId);
}

// UPDATE - aktivacija / deaktivacija (umesto brisanja aktivnosti koja ima prijave).
async function postaviAktivnost(aktivnostId, aktivna) {
  const postojeca = await zahtevajAktivnost(aktivnostId);

  if (aktivna) {
    const termini = await terminiAktivnosti(postojeca);
    await proveriDostupnostTermina(termini.map(t => t.id), aktivnostId);
  }

  const { data, error } = await dbSupabase
    .from("aktivnosti")
    .update({ aktivna })
    .eq("id", aktivnostId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Aktivnost nije pronađena.");

  await obavestenja.obavestiUcenikeAktivnosti(aktivnostId, aktivna
    ? {
        tip: "aktivnost_aktivirana",
        naslov: "Aktivnost je ponovo aktivna",
        poruka: `Aktivnost "${data.naziv}" je ponovo aktivna.`
      }
    : {
        tip: "aktivnost_deaktivirana",
        naslov: "Aktivnost je obustavljena",
        poruka: `Aktivnost "${data.naziv}" je trenutno obustavljena.`
      });

  return data;
}

// DELETE - dozvoljeno samo za aktivnost bez ijedne prijave.
async function obrisi(aktivnostId) {
  await zahtevajAktivnost(aktivnostId);

  const { count, error: countError } = await dbSupabase
    .from("prijave")
    .select("id", { count: "exact", head: true })
    .eq("aktivnost_id", aktivnostId);
  if (countError) throw countError;
  if (count) {
    throw greska(
      409,
      "Aktivnost ima evidentirane prijave i ne može se obrisati. Deaktivirajte je umesto brisanja."
    );
  }

  for (const tabela of [
    "aktivnost_termini",
    "aktivnost_profesori",
    "aktivnost_interesovanja",
    "ai_preporuka_aktivnosti"
  ]) {
    const { error } = await dbSupabase.from(tabela).delete().eq("aktivnost_id", aktivnostId);
    if (error && !tabelaNedostaje(error)) throw error;
  }

  const { error } = await dbSupabase.from("aktivnosti").delete().eq("id", aktivnostId);
  if (error) throw error;
}

// QR kod koji profesor prikazuje, a ucenici skeniraju za evidenciju prisustva.
async function qrKod({ aktivnostId, datum, trajanjeMin }) {
  const aktivnost = await zahtevajAktivnost(aktivnostId);
  if (!aktivnost.aktivna) throw greska(409, "Aktivnost nije aktivna.");

  const { kod, vazi_do } = napraviQrKod({ aktivnostId, datum, trajanjeMinuta: trajanjeMin });
  return { aktivnost_id: aktivnostId, naziv: aktivnost.naziv, datum, vazi_do, kod };
}

module.exports = {
  // citanje
  ucitajTermine,
  obogatiAktivnosti,
  zahtevajAktivnost,
  aktivnostPoId,
  aktivnostiPoIds,
  terminiAktivnosti,
  brojPrijavljenih,
  pregled,
  detalji,
  // izmene
  kreiraj,
  uredi,
  postaviAktivnost,
  obrisi,
  osveziTekstTermina,
  qrKod
};
