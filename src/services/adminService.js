// Administratorski panel (samo profesor): CRUD nad ucenicima, zahtevi za
// profesorski nalog, pregled svih prijava i statistika.

const { dbSupabase } = require("../config/supabase");
const { greska, tabelaNedostaje } = require("../utils/http");
const { upit, sviRedovi } = require("../utils/upit");
const { normalizuj } = require("../utils/tekst");
const { AKTIVNI_STATUSI } = require("../utils/konstante");
const { interesovanjaKorisnika, postaviInteresovanja } = require("./profilService");
const { obavesti } = require("./obavestenjaService");

const KOLONE_UCENIKA =
  "id, ime_i_prezime, uloga, razred_odeljenje, korisnicko_ime, biografija, avatar_url, kreirano_at";

// Red iz "korisnici" koji ima ulogu ucenik, ili 404.
async function zahtevajUcenika(id) {
  const { data, error } = await dbSupabase
    .from("korisnici")
    .select(KOLONE_UCENIKA)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.uloga !== "ucenik") throw greska(404, "Učenik nije pronađen.");
  return data;
}

// ---------------------------------------------------------------------------
// UCENICI - CRUD
// ---------------------------------------------------------------------------

async function listaUcenika({ q, razred }) {
  let upitUcenika = dbSupabase
    .from("korisnici")
    .select(KOLONE_UCENIKA)
    .eq("uloga", "ucenik")
    .order("ime_i_prezime");
  if (razred) upitUcenika = upitUcenika.eq("razred_odeljenje", razred);

  let ucenici = await upit(upitUcenika);
  if (q) {
    const trazeno = normalizuj(q);
    ucenici = ucenici.filter(u =>
      normalizuj(`${u.ime_i_prezime} ${u.korisnicko_ime || ""} ${u.razred_odeljenje || ""}`)
        .includes(trazeno)
    );
  }

  const prijave = ucenici.length
    ? await sviRedovi(() =>
        dbSupabase
          .from("prijave")
          .select("ucenik_id, status_prijave")
          .in("ucenik_id", ucenici.map(u => u.id))
      )
    : [];

  return ucenici.map(u => ({
    ...u,
    broj_aktivnih_prijava: prijave.filter(
      p => p.ucenik_id === u.id && p.status_prijave === "prijavljen"
    ).length
  }));
}

// Ucenik sa emailom, interesovanjima i svim prijavama (+ broj dolazaka/izostanaka).
async function detaljiUcenika(id) {
  const ucenik = await zahtevajUcenika(id);

  const [{ data: auth }, interesovanja, prijave] = await Promise.all([
    dbSupabase.auth.admin.getUserById(id),
    interesovanjaKorisnika(id),
    upit(
      dbSupabase
        .from("prijave")
        .select("id, aktivnost_id, status_prijave, prijavljen_at")
        .eq("ucenik_id", id)
        .order("prijavljen_at", { ascending: false })
    )
  ]);

  const aktivnostIds = [...new Set(prijave.map(p => p.aktivnost_id))];
  const [nazivi, prisustva] = await Promise.all([
    aktivnostIds.length
      ? upit(dbSupabase.from("aktivnosti").select("id, naziv, aktivna").in("id", aktivnostIds))
      : [],
    prijave.length
      ? upit(
          dbSupabase
            .from("prisustva")
            .select("prijava_id, prisutan")
            .in("prijava_id", prijave.map(p => p.id))
        )
      : []
  ]);
  const naziviPoId = new Map(nazivi.map(a => [a.id, a]));

  return {
    ...ucenik,
    email: auth?.user?.email || null,
    interesovanja,
    prijave: prijave.map(p => {
      const moja = prisustva.filter(x => x.prijava_id === p.id);
      return {
        ...p,
        aktivnost: naziviPoId.get(p.aktivnost_id) || null,
        broj_prisustva: moja.filter(x => x.prisutan).length,
        broj_odsustva: moja.filter(x => !x.prisutan).length
      };
    })
  };
}

// CREATE - profesor kreira ucenicki nalog (email je odmah potvrdjen).
async function kreirajUcenika({ email, lozinka, imeIPrezime, razred, interesovanjaIds }) {
  const { data, error } = await dbSupabase.auth.admin.createUser({
    email,
    password: lozinka,
    email_confirm: true,
    user_metadata: { ime_i_prezime: imeIPrezime }
  });
  if (error) {
    if (error.code === "email_exists" || /already/i.test(error.message || "")) {
      throw greska(409, "Nalog sa ovom email adresom već postoji.");
    }
    throw error;
  }

  const { data: profil, error: profilGreska } = await dbSupabase
    .from("korisnici")
    .upsert(
      { id: data.user.id, ime_i_prezime: imeIPrezime, uloga: "ucenik", razred_odeljenje: razred },
      { onConflict: "id" }
    )
    .select(KOLONE_UCENIKA)
    .single();
  if (profilGreska) {
    // Ne ostavljamo Auth nalog bez profila.
    await dbSupabase.auth.admin.deleteUser(data.user.id);
    throw profilGreska;
  }

  if (interesovanjaIds.length) await postaviInteresovanja(profil.id, interesovanjaIds);
  return { ...profil, email };
}

// UPDATE
async function izmeniUcenika(id, { unos, interesovanjaIds }) {
  await zahtevajUcenika(id);
  if (Object.keys(unos).length) {
    const { error } = await dbSupabase.from("korisnici").update(unos).eq("id", id);
    if (error) throw error;
  }
  if (interesovanjaIds !== undefined) await postaviInteresovanja(id, interesovanjaIds);

  const ucenik = await zahtevajUcenika(id);
  return { ...ucenik, interesovanja: await interesovanjaKorisnika(id) };
}

// DELETE - samo ucenik bez aktivnih prijava. Brisu se i svi povezani podaci
// (redosled je bitan zbog stranih kljuceva: prvo "deca", pa "roditelj").
async function obrisiUcenika(id) {
  await zahtevajUcenika(id);

  const { count, error } = await dbSupabase
    .from("prijave")
    .select("id", { count: "exact", head: true })
    .eq("ucenik_id", id)
    .in("status_prijave", AKTIVNI_STATUSI);
  if (error) throw error;
  if (count) {
    throw greska(409, "Učenik ima aktivne prijave. Najpre otkažite prijave, pa zatim obrišite nalog.");
  }

  const prijave = await upit(dbSupabase.from("prijave").select("id").eq("ucenik_id", id));
  const preporuke = await upit(dbSupabase.from("ai_preporuke").select("id").eq("korisnik_id", id));

  const koraci = [
    prijave.length &&
      (() => dbSupabase.from("prisustva").delete().in("prijava_id", prijave.map(p => p.id))),
    () => dbSupabase.from("prijave").delete().eq("ucenik_id", id),
    preporuke.length &&
      (() =>
        dbSupabase.from("ai_preporuka_aktivnosti").delete().in("preporuka_id", preporuke.map(p => p.id))),
    () => dbSupabase.from("ai_preporuke").delete().eq("korisnik_id", id),
    () => dbSupabase.from("korisnik_interesovanja").delete().eq("korisnik_id", id),
    () => dbSupabase.from("obavestenja").delete().eq("korisnik_id", id),
    () => dbSupabase.from("zahtevi_za_profesora").delete().eq("korisnik_id", id),
    () => dbSupabase.from("korisnici").delete().eq("id", id)
  ].filter(Boolean);

  for (const korak of koraci) {
    const { error: e } = await korak();
    if (e && !tabelaNedostaje(e)) throw e;
  }

  const { error: authGreska } = await dbSupabase.auth.admin.deleteUser(id);
  if (authGreska) console.error("Brisanje Auth naloga:", authGreska);
}

// ---------------------------------------------------------------------------
// ZAHTEVI ZA PROFESORSKI NALOG
// ---------------------------------------------------------------------------

async function listaZahteva(status) {
  let q = dbSupabase
    .from("zahtevi_za_profesora")
    .select("id, korisnik_id, status, kreiran_at, obradjen_at")
    .order("kreiran_at", { ascending: false });
  if (status) q = q.eq("status", status);

  const zahtevi = await upit(q);
  const korisnici = zahtevi.length
    ? await upit(
        dbSupabase
          .from("korisnici")
          .select("id, ime_i_prezime, uloga")
          .in("id", zahtevi.map(z => z.korisnik_id))
      )
    : [];
  const poId = new Map(korisnici.map(k => [k.id, k]));
  return zahtevi.map(z => ({ ...z, korisnik: poId.get(z.korisnik_id) || null }));
}

// Odobravanje menja ulogu korisnika u "profesor"; korisnik dobija obavestenje.
async function obradiZahtev(id, status) {
  const { data: zahtev, error } = await dbSupabase
    .from("zahtevi_za_profesora")
    .select("id, korisnik_id, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!zahtev) throw greska(404, "Zahtev nije pronađen.");
  if (zahtev.status !== "na_cekanju") throw greska(409, "Zahtev je već obrađen.");

  if (status === "odobren") {
    const { data: promenjen, error: ulogaGreska } = await dbSupabase
      .from("korisnici")
      .update({ uloga: "profesor" })
      .eq("id", zahtev.korisnik_id)
      .eq("uloga", "ucenik")
      .select("id")
      .maybeSingle();
    if (ulogaGreska) throw ulogaGreska;
    if (!promenjen) throw greska(409, "Profil ne postoji ili više nema ulogu ucenik.");
  }

  const { data, error: obradaGreska } = await dbSupabase
    .from("zahtevi_za_profesora")
    .update({ status, obradjen_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "na_cekanju")
    .select("id, korisnik_id, status, kreiran_at, obradjen_at")
    .maybeSingle();
  if (obradaGreska) throw obradaGreska;

  await obavesti([zahtev.korisnik_id], {
    tip: "zahtev_za_profesora",
    naslov: status === "odobren"
      ? "Profesorski nalog je odobren"
      : "Zahtev za profesorski nalog je odbijen",
    poruka: status === "odobren"
      ? "Vaš nalog sada ima profesorska ovlašćenja. Prijavite se ponovo."
      : "Vaš zahtev za profesorski nalog nije odobren."
  });
  return data;
}

// ---------------------------------------------------------------------------
// PRIJAVE I STATISTIKA
// ---------------------------------------------------------------------------

async function listaPrijava({ status, aktivnostId }) {
  const prijave = await sviRedovi(() => {
    let q = dbSupabase
      .from("prijave")
      .select("id, ucenik_id, aktivnost_id, status_prijave, prijavljen_at")
      .order("prijavljen_at", { ascending: false });
    if (status) q = q.eq("status_prijave", status);
    if (aktivnostId !== undefined) q = q.eq("aktivnost_id", aktivnostId);
    return q;
  });

  const [ucenici, akt] = await Promise.all([
    prijave.length
      ? upit(
          dbSupabase
            .from("korisnici")
            .select("id, ime_i_prezime, razred_odeljenje")
            .in("id", [...new Set(prijave.map(p => p.ucenik_id))])
        )
      : [],
    prijave.length
      ? upit(
          dbSupabase
            .from("aktivnosti")
            .select("id, naziv")
            .in("id", [...new Set(prijave.map(p => p.aktivnost_id))])
        )
      : []
  ]);
  const uceniciPoId = new Map(ucenici.map(u => [u.id, u]));
  const aktPoId = new Map(akt.map(a => [a.id, a]));
  return prijave.map(p => ({
    ...p,
    ucenik: uceniciPoId.get(p.ucenik_id) || null,
    aktivnost: aktPoId.get(p.aktivnost_id) || null
  }));
}

const procenat = (deo, celina) => (celina ? Math.round((deo / celina) * 1000) / 10 : 0);

async function statistika() {
  const [korisnici, svaAkt, prijave, prisustva, kategorije] = await Promise.all([
    sviRedovi(() => dbSupabase.from("korisnici").select("id, uloga")),
    sviRedovi(() =>
      dbSupabase.from("aktivnosti").select("id, naziv, aktivna, maksimalno_mesta, kategorija_id")
    ),
    sviRedovi(() => dbSupabase.from("prijave").select("id, ucenik_id, aktivnost_id, status_prijave")),
    sviRedovi(() => dbSupabase.from("prisustva").select("prijava_id, prisutan")),
    sviRedovi(() => dbSupabase.from("kategorije").select("id, naziv"))
  ]);

  const prijavaAktivnost = new Map(prijave.map(p => [p.id, p.aktivnost_id]));
  const kategorijePoId = new Map(kategorije.map(k => [k.id, k.naziv]));

  const poAktivnostima = svaAkt.map(a => {
    const moje = prijave.filter(p => p.aktivnost_id === a.id);
    const prijavljeno = moje.filter(p => p.status_prijave === "prijavljen").length;
    const evidencija = prisustva.filter(x => prijavaAktivnost.get(x.prijava_id) === a.id);
    const prisutno = evidencija.filter(x => x.prisutan).length;
    return {
      id: a.id,
      naziv: a.naziv,
      aktivna: a.aktivna,
      kategorija: kategorijePoId.get(a.kategorija_id) || null,
      maksimalno_mesta: a.maksimalno_mesta,
      broj_prijavljenih: prijavljeno,
      na_cekanju: moje.filter(p => p.status_prijave === "na_cekanju").length,
      otkazano: moje.filter(p => p.status_prijave === "otkazano").length,
      ukupno_prijava: moje.length,
      iskoriscenost_kapaciteta: procenat(prijavljeno, a.maksimalno_mesta),
      evidentirano_dolazaka: evidencija.length,
      prisutno,
      redovnost_prisustva: procenat(prisutno, evidencija.length)
    };
  });

  const aktivne = poAktivnostima.filter(a => a.aktivna);
  const ukupnoMesta = aktivne.reduce((s, a) => s + a.maksimalno_mesta, 0);
  const ukupnoPrijavljenih = aktivne.reduce((s, a) => s + a.broj_prijavljenih, 0);
  const ukupnoPrisutno = prisustva.filter(x => x.prisutan).length;

  const poKategorijama = [...new Set(poAktivnostima.map(a => a.kategorija))]
    .map(k => {
      const grupa = poAktivnostima.filter(a => a.kategorija === k);
      return {
        kategorija: k || "Bez kategorije",
        broj_aktivnosti: grupa.length,
        broj_prijavljenih: grupa.reduce((s, a) => s + a.broj_prijavljenih, 0),
        ukupno_prijava: grupa.reduce((s, a) => s + a.ukupno_prijava, 0)
      };
    })
    .sort((a, b) => b.ukupno_prijava - a.ukupno_prijava);

  return {
    ukupno: {
      broj_ucenika: korisnici.filter(k => k.uloga === "ucenik").length,
      broj_profesora: korisnici.filter(k => k.uloga === "profesor").length,
      broj_aktivnosti: svaAkt.length,
      broj_aktivnih_aktivnosti: aktivne.length,
      ukupno_prijava: prijave.length,
      prijavljenih: prijave.filter(p => p.status_prijave === "prijavljen").length,
      na_cekanju: prijave.filter(p => p.status_prijave === "na_cekanju").length,
      otkazanih: prijave.filter(p => p.status_prijave === "otkazano").length,
      ucenika_sa_prijavom: new Set(
        prijave.filter(p => p.status_prijave === "prijavljen").map(p => p.ucenik_id)
      ).size,
      iskoriscenost_kapaciteta: procenat(ukupnoPrijavljenih, ukupnoMesta),
      redovnost_prisustva: procenat(ukupnoPrisutno, prisustva.length)
    },
    najpopularnije_aktivnosti: [...poAktivnostima]
      .sort((a, b) => b.broj_prijavljenih - a.broj_prijavljenih || b.ukupno_prijava - a.ukupno_prijava)
      .slice(0, 10),
    po_aktivnostima: poAktivnostima,
    po_kategorijama: poKategorijama
  };
}

module.exports = {
  listaUcenika,
  detaljiUcenika,
  kreirajUcenika,
  izmeniUcenika,
  obrisiUcenika,
  listaZahteva,
  obradiZahtev,
  listaPrijava,
  statistika
};
