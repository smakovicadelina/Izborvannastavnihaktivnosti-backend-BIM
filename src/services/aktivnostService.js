
const {
  greska,
  imaPolje,
  jeUuid,
  jeNeprazanTekst,
  opcioniTekst,
  nizId,
  parsirajId,
  tabelaNedostaje
} = require("../utils/http");
const {
  nazivDana,
  opisTermina,
  sortirajTermine,
  terminiSePreklapaju
} = require("../utils/vreme");

const AKTIVNI_STATUSI = ["prijavljen", "na_cekanju"];

// ---------------------------------------------------------------------------
// Pomocne funkcije za upite
// ---------------------------------------------------------------------------

async function upit(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data || [];
}

// Za tabele koje dolaze iz novijih migracija: ako tabela ne postoji, vraca [].
async function upitOpcione(promise) {
  const { data, error } = await promise;
  if (error) {
    if (tabelaNedostaje(error)) return [];
    throw error;
  }
  return data || [];
}

function normalizuj(tekst) {
  return String(tekst || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "dj");
}

// ---------------------------------------------------------------------------
// Ucitavanje i obogacivanje aktivnosti
// ---------------------------------------------------------------------------

async function ucitajTermine(db, terminIds) {
  if (!terminIds.length) return new Map();

  const termini = await upit(
    db
      .from("termini")
      .select("id, dan_u_nedelji, vreme_od, vreme_do, prostorija_id")
      .in("id", terminIds)
  );

  const prostorijaIds = [...new Set(termini.map(t => t.prostorija_id))];
  const prostorije = prostorijaIds.length
    ? await upit(
        db
          .from("prostorije")
          .select("id, naziv, kapacitet")
          .in("id", prostorijaIds)
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

async function obogatiAktivnosti(db, aktivnosti, { ucenikId = null } = {}) {
  if (!aktivnosti.length) return [];

  const ids = aktivnosti.map(a => a.id);

  const [prijave, veze, profesoriVeze, interesovanjaVeze, kategorije] =
    await Promise.all([
      upit(
        db
          .from("prijave")
          .select("id, aktivnost_id, ucenik_id, status_prijave")
          .in("aktivnost_id", ids)
          .in("status_prijave", AKTIVNI_STATUSI)
      ),
      upitOpcione(
        db
          .from("aktivnost_termini")
          .select("aktivnost_id, termin_id")
          .in("aktivnost_id", ids)
      ),
      upitOpcione(
        db
          .from("aktivnost_profesori")
          .select("aktivnost_id, profesor_id")
          .in("aktivnost_id", ids)
      ),
      upitOpcione(
        db
          .from("aktivnost_interesovanja")
          .select("aktivnost_id, interesovanje_id")
          .in("aktivnost_id", ids)
      ),
      upitOpcione(db.from("kategorije").select("id, naziv"))
    ]);

  const terminIds = new Set(veze.map(v => v.termin_id));
  for (const a of aktivnosti) if (a.termin_id) terminIds.add(a.termin_id);
  const terminiPoId = await ucitajTermine(db, [...terminIds]);

  const profesorIds = new Set(profesoriVeze.map(v => v.profesor_id));
  for (const a of aktivnosti) if (a.profesor_id) profesorIds.add(a.profesor_id);
  const profesori = profesorIds.size
    ? await upit(
        db
          .from("korisnici")
          .select("id, ime_i_prezime")
          .in("id", [...profesorIds])
      )
    : [];
  const profesoriPoId = new Map(profesori.map(p => [p.id, p]));

  const interesovanjeIds = [
    ...new Set(interesovanjaVeze.map(v => v.interesovanje_id))
  ];
  const interesovanja = interesovanjeIds.length
    ? await upit(
        db
          .from("interesovanja")
          .select("id, naziv")
          .in("id", interesovanjeIds)
      )
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
      profesoriVeze
        .filter(v => v.aktivnost_id === a.id)
        .map(v => v.profesor_id)
    );
    if (a.profesor_id) profesoriAktivnosti.add(a.profesor_id);

    const rezultat = {
      ...a,
      kategorija: kategorijePoId.get(a.kategorija_id) || null,
      termini: sortirajTermine(
        [...terminIdsAktivnosti]
          .map(id => terminiPoId.get(id))
          .filter(Boolean)
      ),
      profesori: [...profesoriAktivnosti]
        .map(id => profesoriPoId.get(id))
        .filter(Boolean),
      interesovanja: interesovanjaVeze
        .filter(v => v.aktivnost_id === a.id)
        .map(v => interesovanjaPoId.get(v.interesovanje_id))
        .filter(Boolean),
      broj_prijavljenih: prijavljeni,
      slobodna_mesta: Math.max(0, a.maksimalno_mesta - prijavljeni)
    };

    if (ucenikId) {
      const moja = prijave.find(
        p => p.aktivnost_id === a.id && p.ucenik_id === ucenikId
      );
      rezultat.moja_prijava = moja
        ? { id: moja.id, status_prijave: moja.status_prijave }
        : null;
    }

    return rezultat;
  });
}

async function pregledAktivnosti(db, filteri = {}) {
  let upitAktivnosti = db
    .from("aktivnosti")
    .select("*")
    .order("kreirano_at", { ascending: false });

  if (!filteri.ukljuciNeaktivne) {
    upitAktivnosti = upitAktivnosti.eq("aktivna", true);
  }

  if (filteri.kategorijaId) {
    upitAktivnosti = upitAktivnosti.eq("kategorija_id", filteri.kategorijaId);
  }

  const aktivnosti = await upit(upitAktivnosti);
  let lista = await obogatiAktivnosti(db, aktivnosti, {
    ucenikId: filteri.ucenikId
  });

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

  if (filteri.interesovanjaIds?.length) {
    const trazena = new Set(filteri.interesovanjaIds);
    const trazeniNazivi = new Set(
      (filteri.interesovanjaNazivi || []).map(normalizuj)
    );
    lista = lista.filter(
      a =>
        a.interesovanja.some(i => trazena.has(i.id)) ||
        // Ako aktivnost nema povezana interesovanja, poredimo naziv sa kategorijom.
        (a.kategorija && trazeniNazivi.has(normalizuj(a.kategorija.naziv)))
    );
  }

  if (filteri.dan) {
    lista = lista.filter(a =>
      a.termini.some(t => t.dan_u_nedelji === filteri.dan)
    );
  }

  if (filteri.samoSlobodna) {
    lista = lista.filter(a => a.slobodna_mesta > 0);
  }

  return lista;
}

async function aktivnostPoId(db, aktivnostId, opcije = {}) {
  const { data, error } = await db
    .from("aktivnosti")
    .select("*")
    .eq("id", aktivnostId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [obogacena] = await obogatiAktivnosti(db, [data], opcije);
  return obogacena;
}

async function zahtevajAktivnost(db, aktivnostId) {
  const { data, error } = await db
    .from("aktivnosti")
    .select("*")
    .eq("id", aktivnostId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw greska(404, "Aktivnost nije pronađena.");
  return data;
}

async function brojPrijavljenih(db, aktivnostId) {
  const { count, error } = await db
    .from("prijave")
    .select("id", { count: "exact", head: true })
    .eq("aktivnost_id", aktivnostId)
    .eq("status_prijave", "prijavljen");

  if (error) throw error;
  return count || 0;
}

// Svi termini (sa prostorijom) koji pripadaju aktivnosti.
async function terminiAktivnosti(db, aktivnost) {
  const veze = await upitOpcione(
    db
      .from("aktivnost_termini")
      .select("termin_id")
      .eq("aktivnost_id", aktivnost.id)
  );
  const ids = new Set(veze.map(v => v.termin_id));
  if (aktivnost.termin_id) ids.add(aktivnost.termin_id);
  const mapa = await ucitajTermine(db, [...ids]);
  return [...mapa.values()];
}

// ---------------------------------------------------------------------------
// Validacija i provere pravila (kapacitet, zauzetost prostorije)
// ---------------------------------------------------------------------------

async function proveriKategoriju(db, kategorijaId) {
  const { data, error } = await db
    .from("kategorije")
    .select("id")
    .eq("id", kategorijaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(400, "Izabrana kategorija ne postoji.");
}

async function proveriProfesore(db, profesoriIds) {
  if (!profesoriIds.length) return;
  const profesori = await upit(
    db
      .from("korisnici")
      .select("id, uloga")
      .in("id", profesoriIds)
  );
  const validni = new Set(
    profesori.filter(p => p.uloga === "profesor").map(p => p.id)
  );
  if (profesoriIds.some(id => !validni.has(id))) {
    throw greska(400, "Svi navedeni profesori moraju postojati i imati ulogu profesor.");
  }
}

async function proveriInteresovanja(db, interesovanjaIds) {
  if (!interesovanjaIds.length) return;
  const postojeca = await upit(
    db.from("interesovanja").select("id").in("id", interesovanjaIds)
  );
  if (postojeca.length !== interesovanjaIds.length) {
    throw greska(400, "Neka od navedenih interesovanja ne postoje.");
  }
}

// Termin (prostorija u odredjeno vreme) ne sme biti dodeljen drugoj aktivnoj aktivnosti.
async function proveriDostupnostTermina(db, terminIds, aktivnostId = null) {
  if (!terminIds.length) return;

  const [veze, direktne] = await Promise.all([
    upitOpcione(
      db
        .from("aktivnost_termini")
        .select("aktivnost_id, termin_id")
        .in("termin_id", terminIds)
    ),
    upit(
      db
        .from("aktivnosti")
        .select("id, termin_id")
        .in("termin_id", terminIds)
    )
  ]);

  const zauzimaju = new Set([
    ...veze.map(v => v.aktivnost_id),
    ...direktne.map(a => a.id)
  ]);
  zauzimaju.delete(aktivnostId);

  if (!zauzimaju.size) return;

  const aktivne = await upit(
    db
      .from("aktivnosti")
      .select("id, naziv")
      .in("id", [...zauzimaju])
      .eq("aktivna", true)
  );

  if (aktivne.length) {
    throw greska(
      409,
      `Prostorija je u izabranom terminu zauzeta (aktivnost: ${aktivne[0].naziv}).`
    );
  }
}

function proveriKapacitet(maksimalnoMesta, termini) {
  const premali = termini.find(
    t => t.prostorija && maksimalnoMesta > t.prostorija.kapacitet
  );
  if (premali) {
    throw greska(
      409,
      `Broj mesta (${maksimalnoMesta}) premašuje kapacitet prostorije ${premali.prostorija.naziv} (${premali.prostorija.kapacitet}).`
    );
  }
}

// Validira telo zahteva. delimicno=true za PATCH.
function validirajUnos(body, delimicno) {
  const b = body || {};
  const unos = {};
  const veze = {};
  const neispravno = poruka => greska(400, poruka || "Podaci o aktivnosti nisu ispravni.");

  if (!delimicno || imaPolje(b, "naziv")) {
    if (!jeNeprazanTekst(b.naziv, 200)) throw neispravno("Naziv aktivnosti je obavezan (do 200 znakova).");
    unos.naziv = b.naziv.trim();
  }

  if (imaPolje(b, "opis")) {
    const opis = opcioniTekst(b.opis, 5000);
    if (!opis.ok) throw neispravno("Opis nije ispravan.");
    unos.opis = opis.vrednost;
  } else if (!delimicno) {
    unos.opis = null;
  }

  if (!delimicno || imaPolje(b, "maksimalno_mesta")) {
    if (
      !Number.isInteger(b.maksimalno_mesta) ||
      b.maksimalno_mesta < 1 ||
      b.maksimalno_mesta > 10000
    ) {
      throw neispravno("Maksimalan broj mesta mora biti ceo broj veći od 0.");
    }
    unos.maksimalno_mesta = b.maksimalno_mesta;
  }

  if (imaPolje(b, "termin")) {
    if (b.termin !== null && !jeNeprazanTekst(b.termin, 200)) {
      throw neispravno("Termin nije ispravan.");
    }
    if (b.termin !== null) unos.termin = b.termin.trim();
  }

  if (imaPolje(b, "prostorija")) {
    const prostorija = opcioniTekst(b.prostorija, 200);
    if (!prostorija.ok) throw neispravno("Prostorija nije ispravna.");
    unos.prostorija = prostorija.vrednost;
  }

  if (imaPolje(b, "kategorija_id")) {
    if (b.kategorija_id === null) {
      unos.kategorija_id = null;
    } else {
      const id = parsirajId(b.kategorija_id);
      if (!id) throw neispravno("ID kategorije nije ispravan.");
      unos.kategorija_id = id;
    }
  }

  if (imaPolje(b, "slika_url")) {
    const slika = opcioniTekst(b.slika_url, 2000);
    if (!slika.ok || (slika.vrednost && !/^https?:\/\//i.test(slika.vrednost))) {
      throw neispravno("URL slike mora počinjati sa http:// ili https://.");
    }
    unos.slika_url = slika.vrednost;
  }

  if (imaPolje(b, "termini_ids")) {
    const ids = nizId(b.termini_ids);
    if (!ids) throw neispravno("termini_ids mora biti niz ID-jeva termina.");
    veze.terminiIds = ids;
  }

  if (imaPolje(b, "profesori_ids")) {
    if (
      !Array.isArray(b.profesori_ids) ||
      !b.profesori_ids.every(jeUuid)
    ) {
      throw neispravno("profesori_ids mora biti niz UUID vrednosti.");
    }
    veze.profesoriIds = [...new Set(b.profesori_ids)];
  }

  if (imaPolje(b, "interesovanja_ids")) {
    const ids = nizId(b.interesovanja_ids);
    if (!ids) throw neispravno("interesovanja_ids mora biti niz ID-jeva interesovanja.");
    veze.interesovanjaIds = ids;
  }

  return { unos, veze };
}

async function zameniVeze(db, tabela, aktivnostId, kolona, vrednosti) {
  const { error: brisanjeGreska } = await db
    .from(tabela)
    .delete()
    .eq("aktivnost_id", aktivnostId);
  if (brisanjeGreska) throw brisanjeGreska;

  if (!vrednosti.length) return;

  const { error } = await db
    .from(tabela)
    .insert(vrednosti.map(v => ({ aktivnost_id: aktivnostId, [kolona]: v })));
  if (error) throw error;
}

async function sacuvajVeze(db, aktivnostId, veze) {
  if (veze.terminiIds) {
    await zameniVeze(db, "aktivnost_termini", aktivnostId, "termin_id", veze.terminiIds);
  }
  if (veze.profesoriIds) {
    await zameniVeze(db, "aktivnost_profesori", aktivnostId, "profesor_id", veze.profesoriIds);
  }
  if (veze.interesovanjaIds) {
    try {
      await zameniVeze(
        db,
        "aktivnost_interesovanja",
        aktivnostId,
        "interesovanje_id",
        veze.interesovanjaIds
      );
    } catch (error) {
      if (tabelaNedostaje(error)) {
        throw greska(
          503,
          "Tabela aktivnost_interesovanja ne postoji. Pokrenite SQL migraciju 004."
        );
      }
      throw error;
    }
  }
}

// Priprema tekstualna polja termin/prostorija iz strukturisanih termina.
function tekstIzTermina(termini) {
  return {
    termin: termini.map(opisTermina).join("; "),
    prostorija: [
      ...new Set(termini.map(t => t.prostorija?.naziv).filter(Boolean))
    ].join(", ") || null
  };
}

// ---------------------------------------------------------------------------
// CRUD nad aktivnostima
// ---------------------------------------------------------------------------

async function kreirajAktivnost(db, profesorId, body) {
  const { unos, veze } = validirajUnos(body, false);

  if (unos.kategorija_id) await proveriKategoriju(db, unos.kategorija_id);
  if (veze.profesoriIds) await proveriProfesore(db, veze.profesoriIds);
  if (veze.interesovanjaIds) await proveriInteresovanja(db, veze.interesovanjaIds);

  let termini = [];
  if (veze.terminiIds?.length) {
    const mapa = await ucitajTermine(db, veze.terminiIds);
    if (mapa.size !== veze.terminiIds.length) {
      throw greska(400, "Neki od izabranih termina ne postoje.");
    }
    termini = veze.terminiIds.map(id => mapa.get(id));
    proveriKapacitet(unos.maksimalno_mesta, termini);
    await proveriDostupnostTermina(db, veze.terminiIds);

    const tekst = tekstIzTermina(termini);
    unos.termin = unos.termin || tekst.termin;
    if (!imaPolje(unos, "prostorija") || !unos.prostorija) {
      unos.prostorija = tekst.prostorija;
    }
    unos.termin_id = veze.terminiIds[0];
  }

  if (!unos.termin) {
    throw greska(400, "Unesite termin (tekst) ili izaberite termine (termini_ids).");
  }

  const { data, error } = await db
    .from("aktivnosti")
    .insert({
      ...unos,
      profesor_id: profesorId,
      aktivna: true
    })
    .select()
    .single();

  if (error) throw error;

  try {
    await sacuvajVeze(db, data.id, veze);
  } catch (vezeGreska) {
    // Ne ostavljamo polovicno kreiranu aktivnost.
    await db.from("aktivnost_termini").delete().eq("aktivnost_id", data.id);
    await db.from("aktivnost_profesori").delete().eq("aktivnost_id", data.id);
    await db.from("aktivnost_interesovanja").delete().eq("aktivnost_id", data.id);
    await db.from("aktivnosti").delete().eq("id", data.id);
    throw vezeGreska;
  }

  return {
    ...data,
    termini,
    broj_prijavljenih: 0,
    slobodna_mesta: data.maksimalno_mesta
  };
}

// Vraca { aktivnost, promenjenRaspored }
async function urediAktivnost(db, aktivnostId, body) {
  const postojeca = await zahtevajAktivnost(db, aktivnostId);
  const { unos, veze } = validirajUnos(body, true);

  if (!Object.keys(unos).length && !Object.keys(veze).length) {
    throw greska(400, "Nema polja za ažuriranje.");
  }

  if (unos.kategorija_id) await proveriKategoriju(db, unos.kategorija_id);
  if (veze.profesoriIds) await proveriProfesore(db, veze.profesoriIds);
  if (veze.interesovanjaIds) await proveriInteresovanja(db, veze.interesovanjaIds);

  const maksimalnoMesta = unos.maksimalno_mesta ?? postojeca.maksimalno_mesta;

  if (imaPolje(unos, "maksimalno_mesta")) {
    const prijavljeno = await brojPrijavljenih(db, aktivnostId);
    if (unos.maksimalno_mesta < prijavljeno) {
      throw greska(409, "Broj mesta ne može biti manji od broja prijavljenih.");
    }
  }

  let termini;
  if (veze.terminiIds) {
    const mapa = await ucitajTermine(db, veze.terminiIds);
    if (mapa.size !== veze.terminiIds.length) {
      throw greska(400, "Neki od izabranih termina ne postoje.");
    }
    termini = veze.terminiIds.map(id => mapa.get(id));
    await proveriDostupnostTermina(db, veze.terminiIds, aktivnostId);

    if (termini.length) {
      const tekst = tekstIzTermina(termini);
      if (!imaPolje(unos, "termin")) unos.termin = tekst.termin;
      if (!imaPolje(unos, "prostorija")) unos.prostorija = tekst.prostorija;
    }
    unos.termin_id = veze.terminiIds[0] || null;
  } else {
    termini = await terminiAktivnosti(db, postojeca);
  }

  proveriKapacitet(maksimalnoMesta, termini);

  if (imaPolje(unos, "termin") && !unos.termin) {
    throw greska(400, "Termin ne može biti prazan.");
  }

  let aktivnost = postojeca;
  if (Object.keys(unos).length) {
    const { data, error } = await db
      .from("aktivnosti")
      .update(unos)
      .eq("id", aktivnostId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw greska(404, "Aktivnost nije pronađena.");
    aktivnost = data;
  }

  await sacuvajVeze(db, aktivnostId, veze);

  const promenjenRaspored =
    Boolean(veze.terminiIds) ||
    (imaPolje(unos, "termin") && unos.termin !== postojeca.termin) ||
    (imaPolje(unos, "prostorija") && unos.prostorija !== postojeca.prostorija);

  return { aktivnost, promenjenRaspored };
}

async function postaviAktivnost(db, aktivnostId, aktivna) {
  const postojeca = await zahtevajAktivnost(db, aktivnostId);

  if (aktivna) {
    const termini = await terminiAktivnosti(db, postojeca);
    await proveriDostupnostTermina(db, termini.map(t => t.id), aktivnostId);
  }

  const { data, error } = await db
    .from("aktivnosti")
    .update({ aktivna })
    .eq("id", aktivnostId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw greska(404, "Aktivnost nije pronađena.");
  return data;
}

async function obrisiAktivnost(db, aktivnostId) {
  await zahtevajAktivnost(db, aktivnostId);

  const { count, error: countError } = await db
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
    const { error } = await db.from(tabela).delete().eq("aktivnost_id", aktivnostId);
    if (error && !tabelaNedostaje(error)) throw error;
  }

  const { error } = await db.from("aktivnosti").delete().eq("id", aktivnostId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Prijave
// ---------------------------------------------------------------------------

async function prijaveAktivnosti(db, aktivnostId, { status } = {}) {
  await zahtevajAktivnost(db, aktivnostId);

  let q = db
    .from("prijave")
    .select("id, ucenik_id, status_prijave, prijavljen_at")
    .eq("aktivnost_id", aktivnostId)
    .order("prijavljen_at", { ascending: false });

  if (status) q = q.eq("status_prijave", status);

  const prijave = await upit(q);
  const ucenikIds = [...new Set(prijave.map(p => p.ucenik_id))];
  const ucenici = ucenikIds.length
    ? await upit(
        db
          .from("korisnici")
          .select("id, ime_i_prezime, razred_odeljenje")
          .in("id", ucenikIds)
      )
    : [];
  const uceniciPoId = new Map(ucenici.map(u => [u.id, u]));

  return prijave.map(p => ({
    ...p,
    ucenik: uceniciPoId.get(p.ucenik_id) || null
  }));
}

async function azurirajPrijavu(db, aktivnostId, prijavaId, statusPrijave) {
  const aktivnost = await zahtevajAktivnost(db, aktivnostId);

  const { data: postojeca, error: proveraGreska } = await db
    .from("prijave")
    .select("id, ucenik_id, status_prijave")
    .eq("id", prijavaId)
    .eq("aktivnost_id", aktivnostId)
    .maybeSingle();

  if (proveraGreska) throw proveraGreska;
  if (!postojeca) throw greska(404, "Prijava nije pronađena.");

  if (
    statusPrijave === "prijavljen" &&
    postojeca.status_prijave !== "prijavljen"
  ) {
    const prijavljeno = await brojPrijavljenih(db, aktivnostId);
    if (prijavljeno >= aktivnost.maksimalno_mesta) {
      throw greska(409, "Nema slobodnih mesta za ovu prijavu.");
    }
  }

  const { data, error } = await db
    .from("prijave")
    .update({ status_prijave: statusPrijave })
    .eq("id", prijavaId)
    .eq("aktivnost_id", aktivnostId)
    .select("id, ucenik_id, status_prijave")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw greska(404, "Prijava nije pronađena.");

  return { prijava: data, prethodniStatus: postojeca.status_prijave, aktivnost };
}

async function obrisiPrijavu(db, aktivnostId, prijavaId) {
  const { data: prijava, error } = await db
    .from("prijave")
    .select("id, ucenik_id")
    .eq("id", prijavaId)
    .eq("aktivnost_id", aktivnostId)
    .maybeSingle();

  if (error) throw error;
  if (!prijava) throw greska(404, "Prijava nije pronađena.");

  const { count, error: countError } = await db
    .from("prisustva")
    .select("id", { count: "exact", head: true })
    .eq("prijava_id", prijavaId);
  if (countError) throw countError;

  if (count) {
    throw greska(
      409,
      "Prijava ima evidentirano prisustvo i ne može se obrisati. Promenite status na otkazano."
    );
  }

  const { error: brisanjeGreska } = await db
    .from("prijave")
    .delete()
    .eq("id", prijavaId);
  if (brisanjeGreska) throw brisanjeGreska;

  return prijava;
}

// Ucenik ne moze da se prijavi na aktivnost ciji se termin preklapa sa
// terminom aktivnosti na koju je vec prijavljen.
async function proveriPreklapanjeZaUcenika(db, ucenikId, aktivnost) {
  const novi = aktivnost.termini || (await terminiAktivnosti(db, aktivnost));
  if (!novi.length) return;

  const moje = await upit(
    db
      .from("prijave")
      .select("aktivnost_id")
      .eq("ucenik_id", ucenikId)
      .in("status_prijave", AKTIVNI_STATUSI)
      .neq("aktivnost_id", aktivnost.id)
  );
  if (!moje.length) return;

  const aktivnosti = await upit(
    db
      .from("aktivnosti")
      .select("*")
      .in("id", moje.map(p => p.aktivnost_id))
      .eq("aktivna", true)
  );
  const obogacene = await obogatiAktivnosti(db, aktivnosti);

  for (const druga of obogacene) {
    for (const t1 of druga.termini) {
      for (const t2 of novi) {
        if (terminiSePreklapaju(t1, t2)) {
          throw greska(
            409,
            `Termin se preklapa sa aktivnošću "${druga.naziv}" (${opisTermina(t1)}).`
          );
        }
      }
    }
  }
}

function prevediGreskuPrijave(error) {
  const poruka = error.message || "";

  if (
    poruka.includes("Nema slobodnih mesta") ||
    poruka.includes("Već ste prijavljeni") ||
    poruka.includes("već prijavljen")
  ) {
    return greska(409, poruka);
  }

  if (poruka.includes("Aktivnost nije dostupna")) {
    return greska(404, poruka);
  }

  if (poruka.includes("samo učenicima")) {
    return greska(403, poruka);
  }

  return error;
}

async function prijaviUcenika(db, ucenikId, aktivnostId) {
  const { data, error } = await db.rpc("bezbedna_prijava", {
    p_ucenik_id: ucenikId,
    p_aktivnost_id: Number(aktivnostId)
  });

  if (error) throw prevediGreskuPrijave(error);
  return data;
}

async function otkaziPrijavu(db, ucenikId, aktivnostId) {
  const { data, error } = await db
    .from("prijave")
    .update({ status_prijave: "otkazano" })
    .eq("ucenik_id", ucenikId)
    .eq("aktivnost_id", aktivnostId)
    .in("status_prijave", AKTIVNI_STATUSI)
    .select("id, status_prijave")
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = {
  AKTIVNI_STATUSI,
  upit,
  upitOpcione,
  normalizuj,
  ucitajTermine,
  obogatiAktivnosti,
  pregledAktivnosti,
  aktivnostPoId,
  zahtevajAktivnost,
  terminiAktivnosti,
  kreirajAktivnost,
  urediAktivnost,
  postaviAktivnost,
  obrisiAktivnost,
  prijaveAktivnosti,
  azurirajPrijavu,
  obrisiPrijavu,
  proveriPreklapanjeZaUcenika,
  prijaviUcenika,
  otkaziPrijavu
};
