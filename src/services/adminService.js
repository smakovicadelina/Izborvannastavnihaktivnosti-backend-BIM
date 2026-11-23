const { dbSupabase } = require("../config/supabase");
const aktivnosti = require("./aktivnostService");
const { interesovanjaKorisnika, postaviInteresovanja } = require("./profilService");
const { obavesti } = require("./obavestenjaService");
const { tabelaNedostaje } = require("../utils/http");

const KOLONE_UCENIKA =
  "id, ime_i_prezime, uloga, razred_odeljenje, korisnicko_ime, biografija, avatar_url, kreirano_at";

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
  const { data, error } = await dbSupabase
    .from("korisnici")
    .select(KOLONE_UCENIKA)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function listaUcenika({ q, razred }) {
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
      aktivnosti.normalizuj(
        `${u.ime_i_prezime} ${u.korisnicko_ime || ""} ${u.razred_odeljenje || ""}`
      ).includes(trazeno)
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

async function detaljiUcenika(id) {
  const [{ data: auth }, interesovanja, prijave] = await Promise.all([
    dbSupabase.auth.admin.getUserById(id),
    interesovanjaKorisnika(id),
    aktivnosti.upit(
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

  return { auth, interesovanja, prijave, naziviPoId, prisustva };
}

async function kreirajUcenika({ email, lozinka, imeIPrezime, razred, interesovanjaIds }) {
  const { data, error } = await dbSupabase.auth.admin.createUser({
    email,
    password: lozinka,
    email_confirm: true,
    user_metadata: { ime_i_prezime: imeIPrezime }
  });
  if (error) throw { authError: error };

  const { data: profil, error: profilGreska } = await dbSupabase
    .from("korisnici")
    .upsert(
      {
        id: data.user.id,
        ime_i_prezime: imeIPrezime,
        uloga: "ucenik",
        razred_odeljenje: razred
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
  return { profil, email };
}

async function izmeniUcenika(id, unos, interesovanjaIds) {
  if (Object.keys(unos).length) {
    const { error } = await dbSupabase.from("korisnici").update(unos).eq("id", id);
    if (error) throw error;
  }
  if (interesovanjaIds !== undefined) {
    await postaviInteresovanja(id, interesovanjaIds);
  }
  const ucenik = await zahtevajUcenika(id);
  const interesovanja = await interesovanjaKorisnika(id);
  return { ucenik, interesovanja };
}

async function obrisiUcenika(id) {
  const { count, error } = await dbSupabase
    .from("prijave")
    .select("id", { count: "exact", head: true })
    .eq("ucenik_id", id)
    .in("status_prijave", aktivnosti.AKTIVNI_STATUSI);
  if (error) throw error;
  if (count) return { imaAktivnePrijave: true };

  const prijave = await aktivnosti.upit(
    dbSupabase.from("prijave").select("id").eq("ucenik_id", id)
  );
  const preporuke = await aktivnosti.upit(
    dbSupabase.from("ai_preporuke").select("id").eq("korisnik_id", id)
  );

  const koraci = [
    prijave.length && (() => dbSupabase.from("prisustva").delete().in("prijava_id", prijave.map(p => p.id))),
    () => dbSupabase.from("prijave").delete().eq("ucenik_id", id),
    preporuke.length && (() => dbSupabase.from("ai_preporuka_aktivnosti").delete().in("preporuka_id", preporuke.map(p => p.id))),
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
  return { imaAktivnePrijave: false };
}

async function listaZahteva(status) {
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
  return zahtevi.map(z => ({ ...z, korisnik: poId.get(z.korisnik_id) || null }));
}

async function obradiZahtev(id, status) {
  const { data: zahtev, error } = await dbSupabase
    .from("zahtevi_za_profesora")
    .select("id, korisnik_id, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!zahtev) return { notFound: true };
  if (zahtev.status !== "na_cekanju") return { alreadyProcessed: true };

  if (status === "odobren") {
    const { data: promenjen, error: ulogaGreska } = await dbSupabase
      .from("korisnici")
      .update({ uloga: "profesor" })
      .eq("id", zahtev.korisnik_id)
      .eq("uloga", "ucenik")
      .select("id")
      .maybeSingle();
    if (ulogaGreska) throw ulogaGreska;
    if (!promenjen) return { invalidProfile: true };
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
  return { zahtev: data };
}

async function listaPrijava({ status, aktivnost_id }) {
  const prijave = await sviRedovi(() => {
    let q = dbSupabase
      .from("prijave")
      .select("id, ucenik_id, aktivnost_id, status_prijave, prijavljen_at")
      .order("prijavljen_at", { ascending: false });
    if (status) q = q.eq("status_prijave", status);
    if (aktivnost_id !== undefined) q = q.eq("aktivnost_id", aktivnost_id);
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
  KOLONE_UCENIKA,
  zahtevajUcenika,
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
