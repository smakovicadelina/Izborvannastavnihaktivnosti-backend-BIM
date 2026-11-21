
// Upravljacki panel profesora sa administratorskim ovlascenjima.

const express = require("express");
const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const { interesovanjaKorisnika, postaviInteresovanja } = require("./profilRoutes");
const { obavesti } = require("../services/obavestenjaService");
const aktivnosti = require("../services/aktivnostService");
const {
  greska,
  imaPolje,
  jeUuid,
  jeNeprazanTekst,
  opcioniTekst,
  nizId,
  zahtevajId,
  tabelaNedostaje
} = require("../utils/http");

const router = express.Router();
router.use(zahtevajPrijavu);
router.use(zahtevajUlogu("profesor"));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KOLONE_UCENIKA =
  "id, ime_i_prezime, uloga, razred_odeljenje, korisnicko_ime, biografija, avatar_url, kreirano_at";

// Ucitava sve redove (zaobilazi PostgREST limit od 1000 redova po upitu).
async function sviRedovi(napraviUpit) {
  const rezultat = [];
  const korak = 1000;
  for (let od = 0; ; od += korak) {
    const { data, error } = await napraviUpit().range(od, od + korak - 1);
    if (error) throw error;
    rezultat.push(...data);
    if (data.length < korak) return rezultat;
  }
}

async function zahtevajUcenika(id) {
  if (!jeUuid(id)) throw greska(400, "Neispravan ID učenika.");
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
// UCENICI
// ---------------------------------------------------------------------------

router.get("/ucenici", async (req, res) => {
  const { q, razred } = req.query;

  let upit = dbSupabase
    .from("korisnici")
    .select(KOLONE_UCENIKA)
    .eq("uloga", "ucenik")
    .order("ime_i_prezime");
  if (typeof razred === "string" && razred.trim()) {
    upit = upit.eq("razred_odeljenje", razred.trim());
  }

  let ucenici = await aktivnosti.upit(upit);

  if (typeof q === "string" && q.trim()) {
    const trazeno = aktivnosti.normalizuj(q.trim());
    ucenici = ucenici.filter(u =>
      aktivnosti
        .normalizuj(`${u.ime_i_prezime} ${u.korisnicko_ime || ""} ${u.razred_odeljenje || ""}`)
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

  return res.json({
    ucenici: ucenici.map(u => ({
      ...u,
      broj_aktivnih_prijava: prijave.filter(
        p => p.ucenik_id === u.id && p.status_prijave === "prijavljen"
      ).length
    }))
  });
});

router.get("/ucenici/:id", async (req, res) => {
  const ucenik = await zahtevajUcenika(req.params.id);

  const [{ data: auth }, interesovanja, prijave] = await Promise.all([
    dbSupabase.auth.admin.getUserById(ucenik.id),
    interesovanjaKorisnika(ucenik.id),
    aktivnosti.upit(
      dbSupabase
        .from("prijave")
        .select("id, aktivnost_id, status_prijave, prijavljen_at")
        .eq("ucenik_id", ucenik.id)
        .order("prijavljen_at", { ascending: false })
    )
  ]);

  const aktivnostIds = [...new Set(prijave.map(p => p.aktivnost_id))];
  const [nazivi, prisustva] = await Promise.all([
    aktivnostIds.length
      ? aktivnosti.upit(dbSupabase.from("aktivnosti").select("id, naziv, aktivna").in("id", aktivnostIds))
      : [],
    prijave.length
      ? aktivnosti.upit(
          dbSupabase
            .from("prisustva")
            .select("prijava_id, prisutan")
            .in("prijava_id", prijave.map(p => p.id))
        )
      : []
  ]);
  const naziviPoId = new Map(nazivi.map(a => [a.id, a]));

  return res.json({
    ucenik: {
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
    }
  });
});

router.post("/ucenici", async (req, res) => {
  const b = req.body || {};
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";

  if (!jeNeprazanTekst(b.ime_i_prezime, 120) || b.ime_i_prezime.trim().length < 2) {
    throw greska(400, "Unesite ime i prezime.");
  }
  if (!EMAIL_REGEX.test(email)) throw greska(400, "Unesite ispravnu email adresu.");
  if (typeof b.lozinka !== "string" || b.lozinka.length < 8) {
    throw greska(400, "Lozinka mora imati najmanje 8 znakova.");
  }
  const razred = opcioniTekst(b.razred_odeljenje, 20);
  if (!razred.ok) throw greska(400, "Razred/odeljenje nije ispravno.");
  const interesovanjaIds = imaPolje(b, "interesovanja_ids") ? nizId(b.interesovanja_ids) : [];
  if (!interesovanjaIds) throw greska(400, "interesovanja_ids mora biti niz ID-jeva.");

  const imeIPrezime = b.ime_i_prezime.trim();
  const { data, error } = await dbSupabase.auth.admin.createUser({
    email,
    password: b.lozinka,
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
      {
        id: data.user.id,
        ime_i_prezime: imeIPrezime,
        uloga: "ucenik",
        razred_odeljenje: razred.vrednost
      },
      { onConflict: "id" }
    )
    .select(KOLONE_UCENIKA)
    .single();

  if (profilGreska) {
    await dbSupabase.auth.admin.deleteUser(data.user.id);
    throw profilGreska;
  }

  if (interesovanjaIds.length) {
    await postaviInteresovanja(profil.id, interesovanjaIds);
  }

  return res.status(201).json({
    poruka: "Učenik je kreiran.",
    ucenik: { ...profil, email }
  });
});

router.patch("/ucenici/:id", async (req, res) => {
  const ucenik = await zahtevajUcenika(req.params.id);
  const b = req.body || {};
  const unos = {};

  if (imaPolje(b, "ime_i_prezime")) {
    if (!jeNeprazanTekst(b.ime_i_prezime, 120) || b.ime_i_prezime.trim().length < 2) {
      throw greska(400, "Ime i prezime mora imati od 2 do 120 znakova.");
    }
    unos.ime_i_prezime = b.ime_i_prezime.trim();
  }
  for (const [polje, maks] of [
    ["razred_odeljenje", 20],
    ["korisnicko_ime", 50],
    ["biografija", 2000]
  ]) {
    if (imaPolje(b, polje)) {
      const v = opcioniTekst(b[polje], maks);
      if (!v.ok) throw greska(400, `Polje ${polje} nije ispravno.`);
      unos[polje] = v.vrednost;
    }
  }

  const interesovanjaIds = imaPolje(b, "interesovanja_ids") ? nizId(b.interesovanja_ids) : undefined;
  if (interesovanjaIds === null) throw greska(400, "interesovanja_ids mora biti niz ID-jeva.");

  if (!Object.keys(unos).length && interesovanjaIds === undefined) {
    throw greska(400, "Nema podataka za izmenu.");
  }

  if (Object.keys(unos).length) {
    const { error } = await dbSupabase.from("korisnici").update(unos).eq("id", ucenik.id);
    if (error) throw error;
  }
  if (interesovanjaIds !== undefined) {
    await postaviInteresovanja(ucenik.id, interesovanjaIds);
  }

  return res.json({
    poruka: "Podaci učenika su ažurirani.",
    ucenik: {
      ...(await zahtevajUcenika(ucenik.id)),
      interesovanja: await interesovanjaKorisnika(ucenik.id)
    }
  });
});

// Brisanje ucenika: nije dozvoljeno dok ima aktivne prijave (integritet).
router.delete("/ucenici/:id", async (req, res) => {
  const ucenik = await zahtevajUcenika(req.params.id);

  const { count, error } = await dbSupabase
    .from("prijave")
    .select("id", { count: "exact", head: true })
    .eq("ucenik_id", ucenik.id)
    .in("status_prijave", aktivnosti.AKTIVNI_STATUSI);
  if (error) throw error;
  if (count) {
    throw greska(
      409,
      "Učenik ima aktivne prijave. Najpre otkažite prijave, pa zatim obrišite nalog."
    );
  }

  const prijave = await aktivnosti.upit(
    dbSupabase.from("prijave").select("id").eq("ucenik_id", ucenik.id)
  );
  const preporuke = await aktivnosti.upit(
    dbSupabase.from("ai_preporuke").select("id").eq("korisnik_id", ucenik.id)
  );

  const koraci = [
    prijave.length && (() => dbSupabase.from("prisustva").delete().in("prijava_id", prijave.map(p => p.id))),
    () => dbSupabase.from("prijave").delete().eq("ucenik_id", ucenik.id),
    preporuke.length && (() => dbSupabase.from("ai_preporuka_aktivnosti").delete().in("preporuka_id", preporuke.map(p => p.id))),
    () => dbSupabase.from("ai_preporuke").delete().eq("korisnik_id", ucenik.id),
    () => dbSupabase.from("korisnik_interesovanja").delete().eq("korisnik_id", ucenik.id),
    () => dbSupabase.from("obavestenja").delete().eq("korisnik_id", ucenik.id),
    () => dbSupabase.from("zahtevi_za_profesora").delete().eq("korisnik_id", ucenik.id),
    () => dbSupabase.from("korisnici").delete().eq("id", ucenik.id)
  ].filter(Boolean);

  for (const korak of koraci) {
    const { error: e } = await korak();
    if (e && !tabelaNedostaje(e)) throw e;
  }

  const { error: authGreska } = await dbSupabase.auth.admin.deleteUser(ucenik.id);
  if (authGreska) {
    console.error("Brisanje Auth naloga:", authGreska);
  }

  return res.json({ poruka: "Učenik je obrisan." });
});

// ---------------------------------------------------------------------------
// ZAHTEVI ZA PROFESORSKI NALOG
// ---------------------------------------------------------------------------

router.get("/zahtevi-za-profesora", async (req, res) => {
  const { status } = req.query;
  if (status !== undefined && !["na_cekanju", "odobren", "odbijen"].includes(status)) {
    throw greska(400, "Status mora biti na_cekanju, odobren ili odbijen.");
  }

  let upit = dbSupabase
    .from("zahtevi_za_profesora")
    .select("id, korisnik_id, status, kreiran_at, obradjen_at")
    .order("kreiran_at", { ascending: false });
  if (status) upit = upit.eq("status", status);

  const zahtevi = await aktivnosti.upit(upit);
  const korisnici = zahtevi.length
    ? await aktivnosti.upit(
        dbSupabase
          .from("korisnici")
          .select("id, ime_i_prezime, uloga")
          .in("id", zahtevi.map(z => z.korisnik_id))
      )
    : [];
  const poId = new Map(korisnici.map(k => [k.id, k]));

  return res.json({
    zahtevi: zahtevi.map(z => ({ ...z, korisnik: poId.get(z.korisnik_id) || null }))
  });
});

router.patch("/zahtevi-za-profesora/:id", async (req, res) => {
  const id = zahtevajId(req.params.id, "Neispravan ID zahteva.");
  const status = req.body?.status;
  if (!["odobren", "odbijen"].includes(status)) {
    throw greska(400, "Status mora biti odobren ili odbijen.");
  }

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

  await obavesti(dbSupabase, [zahtev.korisnik_id], {
    tip: "zahtev_za_profesora",
    naslov: status === "odobren" ? "Profesorski nalog je odobren" : "Zahtev za profesorski nalog je odbijen",
    poruka:
      status === "odobren"
        ? "Vaš nalog sada ima profesorska ovlašćenja. Prijavite se ponovo."
        : "Vaš zahtev za profesorski nalog nije odobren."
  });

  return res.json({ zahtev: data });
});

// ---------------------------------------------------------------------------
// PREGLED SVIH PRIJAVA
// ---------------------------------------------------------------------------

router.get("/prijave", async (req, res) => {
  const { status, aktivnost_id } = req.query;
  if (status !== undefined && !["prijavljen", "na_cekanju", "otkazano"].includes(status)) {
    throw greska(400, "Status mora biti prijavljen, na_cekanju ili otkazano.");
  }

  const prijave = await sviRedovi(() => {
    let q = dbSupabase
      .from("prijave")
      .select("id, ucenik_id, aktivnost_id, status_prijave, prijavljen_at")
      .order("prijavljen_at", { ascending: false });
    if (status) q = q.eq("status_prijave", status);
    if (aktivnost_id !== undefined) {
      q = q.eq("aktivnost_id", zahtevajId(aktivnost_id, "Neispravan ID aktivnosti."));
    }
    return q;
  });

  const [ucenici, akt] = await Promise.all([
    prijave.length
      ? aktivnosti.upit(dbSupabase.from("korisnici").select("id, ime_i_prezime, razred_odeljenje").in("id", [...new Set(prijave.map(p => p.ucenik_id))]))
      : [],
    prijave.length
      ? aktivnosti.upit(dbSupabase.from("aktivnosti").select("id, naziv").in("id", [...new Set(prijave.map(p => p.aktivnost_id))]))
      : []
  ]);
  const uceniciPoId = new Map(ucenici.map(u => [u.id, u]));
  const aktPoId = new Map(akt.map(a => [a.id, a]));

  return res.json({
    prijave: prijave.map(p => ({
      ...p,
      ucenik: uceniciPoId.get(p.ucenik_id) || null,
      aktivnost: aktPoId.get(p.aktivnost_id) || null
    }))
  });
});

// ---------------------------------------------------------------------------
// STATISTIKA
// ---------------------------------------------------------------------------

const procenat = (deo, celina) => (celina ? Math.round((deo / celina) * 1000) / 10 : 0);

router.get("/statistika", async (req, res) => {
  const [korisnici, svaAkt, prijave, prisustva, kategorije] = await Promise.all([
    sviRedovi(() => dbSupabase.from("korisnici").select("id, uloga")),
    sviRedovi(() => dbSupabase.from("aktivnosti").select("id, naziv, aktivna, maksimalno_mesta, kategorija_id")),
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

  const poKategorijama = [...new Set(poAktivnostima.map(a => a.kategorija))].map(k => {
    const grupa = poAktivnostima.filter(a => a.kategorija === k);
    return {
      kategorija: k || "Bez kategorije",
      broj_aktivnosti: grupa.length,
      broj_prijavljenih: grupa.reduce((s, a) => s + a.broj_prijavljenih, 0),
      ukupno_prijava: grupa.reduce((s, a) => s + a.ukupno_prijava, 0)
    };
  }).sort((a, b) => b.ukupno_prijava - a.ukupno_prijava);

  return res.json({
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
  });
});

module.exports = router;
