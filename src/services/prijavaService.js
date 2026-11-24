// POSLOVNA LOGIKA ZA PRIJAVE UCENIKA NA AKTIVNOSTI.
//
// Tabela prijave je veza izmedju korisnika (ucenika) i aktivnosti:
//   prijave(id, ucenik_id -> korisnici.id, aktivnost_id -> aktivnosti.id,
//           status_prijave: prijavljen | na_cekanju | otkazano, prijavljen_at)
//
// Sama prijava se radi kroz PostgreSQL funkciju bezbedna_prijava (RPC), koja
// u JEDNOJ transakciji proverava slobodna mesta i duplikat - tako dva ucenika
// koji se istovremeno prijave ne mogu oba dobiti poslednje mesto.

const { dbSupabase } = require("../config/supabase");
const { greska } = require("../utils/http");
const { upit } = require("../utils/upit");
const { AKTIVNI_STATUSI } = require("../utils/konstante");
const { terminiSePreklapaju, opisTermina } = require("../utils/vreme");
const aktivnosti = require("./aktivnostService");
const obavestenja = require("./obavestenjaService");

const OPISI_STATUSA = {
  prijavljen: "potvrđena",
  na_cekanju: "stavljena na čekanje",
  otkazano: "otkazana"
};

// Poruke koje baca SQL funkcija bezbedna_prijava -> odgovarajuci HTTP status.
function prevediGreskuPrijave(error) {
  const poruka = error.message || "";
  if (
    poruka.includes("Nema slobodnih mesta") ||
    poruka.includes("Već ste prijavljeni") ||
    poruka.includes("već prijavljen")
  ) {
    return greska(409, poruka);
  }
  if (poruka.includes("Aktivnost nije dostupna")) return greska(404, poruka);
  if (poruka.includes("samo učenicima")) return greska(403, poruka);
  return error;
}

// Ucenik ne moze da se prijavi na aktivnost ciji se termin preklapa sa
// terminom aktivnosti na koju je vec prijavljen.
async function proveriPreklapanje(ucenikId, aktivnost) {
  const novi = aktivnost.termini || (await aktivnosti.terminiAktivnosti(aktivnost));
  if (!novi.length) return;

  const moje = await upit(
    dbSupabase
      .from("prijave")
      .select("aktivnost_id")
      .eq("ucenik_id", ucenikId)
      .in("status_prijave", AKTIVNI_STATUSI)
      .neq("aktivnost_id", aktivnost.id)
  );
  if (!moje.length) return;

  const redovi = await upit(
    dbSupabase
      .from("aktivnosti")
      .select("*")
      .in("id", moje.map(p => p.aktivnost_id))
      .eq("aktivna", true)
  );
  const druge = await aktivnosti.obogatiAktivnosti(redovi);

  for (const druga of druge) {
    for (const t1 of druga.termini) {
      for (const t2 of novi) {
        if (terminiSePreklapaju(t1, t2)) {
          throw greska(409, `Termin se preklapa sa aktivnošću "${druga.naziv}" (${opisTermina(t1)}).`);
        }
      }
    }
  }
}

async function upisiUBazu(ucenikId, aktivnostId) {
  const { data, error } = await dbSupabase.rpc("bezbedna_prijava", {
    p_ucenik_id: ucenikId,
    p_aktivnost_id: Number(aktivnostId)
  });
  if (error) throw prevediGreskuPrijave(error);
  return data;
}

async function zahtevajAktivnuAktivnost(aktivnostId) {
  const aktivnost = await aktivnosti.aktivnostPoId(aktivnostId);
  if (!aktivnost || aktivnost.aktivna === false) {
    throw greska(404, "Aktivnost nije dostupna.");
  }
  return aktivnost;
}

// ---------------------------------------------------------------------------
// UCENIK
// ---------------------------------------------------------------------------

// CREATE - ucenik se sam prijavljuje na aktivnost.
async function prijaviSe(ucenikId, aktivnostId) {
  const aktivnost = await zahtevajAktivnuAktivnost(aktivnostId);
  await proveriPreklapanje(ucenikId, aktivnost);
  const prijava = await upisiUBazu(ucenikId, aktivnostId);

  await obavestenja.obavesti([ucenikId], {
    tip: "prijava",
    naslov: "Prijava je uspešna",
    poruka: `Prijavili ste se na aktivnost "${aktivnost.naziv}".`,
    aktivnost_id: aktivnostId
  });
  return prijava;
}

// UPDATE - ucenik otkazuje svoju aktivnu prijavu (status -> otkazano).
async function otkazi(ucenikId, aktivnostId) {
  const { data, error } = await dbSupabase
    .from("prijave")
    .update({ status_prijave: "otkazano" })
    .eq("ucenik_id", ucenikId)
    .eq("aktivnost_id", aktivnostId)
    .in("status_prijave", AKTIVNI_STATUSI)
    .select("id, status_prijave")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Aktivna prijava nije pronađena.");

  const { data: aktivnost } = await dbSupabase
    .from("aktivnosti")
    .select("naziv")
    .eq("id", aktivnostId)
    .maybeSingle();

  await obavestenja.obavesti([ucenikId], {
    tip: "otkazivanje",
    naslov: "Prijava je otkazana",
    poruka: `Otkazali ste prijavu na aktivnost "${aktivnost?.naziv || aktivnostId}".`,
    aktivnost_id: aktivnostId
  });
  return data;
}

// ---------------------------------------------------------------------------
// PROFESOR
// ---------------------------------------------------------------------------

// READ - sve prijave na aktivnost (sa podacima o uceniku).
async function listaZaAktivnost(aktivnostId, status) {
  await aktivnosti.zahtevajAktivnost(aktivnostId);

  let q = dbSupabase
    .from("prijave")
    .select("id, ucenik_id, status_prijave, prijavljen_at")
    .eq("aktivnost_id", aktivnostId)
    .order("prijavljen_at", { ascending: false });
  if (status) q = q.eq("status_prijave", status);

  const prijave = await upit(q);
  const ucenikIds = [...new Set(prijave.map(p => p.ucenik_id))];
  const ucenici = ucenikIds.length
    ? await upit(
        dbSupabase.from("korisnici").select("id, ime_i_prezime, razred_odeljenje").in("id", ucenikIds)
      )
    : [];
  const uceniciPoId = new Map(ucenici.map(u => [u.id, u]));

  return prijave.map(p => ({ ...p, ucenik: uceniciPoId.get(p.ucenik_id) || null }));
}

// CREATE - profesor upisuje ucenika na aktivnost.
async function upisiUcenika(aktivnostId, ucenikId) {
  const aktivnost = await zahtevajAktivnuAktivnost(aktivnostId);

  const { data: ucenik, error } = await dbSupabase
    .from("korisnici")
    .select("id, uloga")
    .eq("id", ucenikId)
    .maybeSingle();
  if (error) throw error;
  if (!ucenik || ucenik.uloga !== "ucenik") throw greska(404, "Učenik nije pronađen.");

  await proveriPreklapanje(ucenikId, aktivnost);
  const prijava = await upisiUBazu(ucenikId, aktivnostId);

  await obavestenja.obavesti([ucenikId], {
    tip: "prijava",
    naslov: "Upisani ste na aktivnost",
    poruka: `Profesor vas je upisao na aktivnost "${aktivnost.naziv}".`,
    aktivnost_id: aktivnostId
  });
  return prijava;
}

// UPDATE - profesor menja status prijave (potvrda, cekanje, otkazivanje).
async function promeniStatus(aktivnostId, prijavaId, status) {
  const aktivnost = await aktivnosti.zahtevajAktivnost(aktivnostId);

  const { data: postojeca, error: proveraGreska } = await dbSupabase
    .from("prijave")
    .select("id, ucenik_id, status_prijave")
    .eq("id", prijavaId)
    .eq("aktivnost_id", aktivnostId)
    .maybeSingle();
  if (proveraGreska) throw proveraGreska;
  if (!postojeca) throw greska(404, "Prijava nije pronađena.");

  // Potvrda prijave zauzima mesto - proveravamo kapacitet.
  if (status === "prijavljen" && postojeca.status_prijave !== "prijavljen") {
    if ((await aktivnosti.brojPrijavljenih(aktivnostId)) >= aktivnost.maksimalno_mesta) {
      throw greska(409, "Nema slobodnih mesta za ovu prijavu.");
    }
  }

  const { data, error } = await dbSupabase
    .from("prijave")
    .update({ status_prijave: status })
    .eq("id", prijavaId)
    .eq("aktivnost_id", aktivnostId)
    .select("id, ucenik_id, status_prijave")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw greska(404, "Prijava nije pronađena.");

  if (postojeca.status_prijave !== status) {
    await obavestenja.obavesti([data.ucenik_id], {
      tip: "status_prijave",
      naslov: "Promena statusa prijave",
      poruka: `Vaša prijava na aktivnost "${aktivnost.naziv}" je ${OPISI_STATUSA[status]}.`,
      aktivnost_id: aktivnostId
    });
  }
  return data;
}

// DELETE - samo prijava bez evidentiranog prisustva (inace se menja status).
async function obrisi(aktivnostId, prijavaId) {
  const { data: prijava, error } = await dbSupabase
    .from("prijave")
    .select("id, ucenik_id")
    .eq("id", prijavaId)
    .eq("aktivnost_id", aktivnostId)
    .maybeSingle();
  if (error) throw error;
  if (!prijava) throw greska(404, "Prijava nije pronađena.");

  const { count, error: countError } = await dbSupabase
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

  const { error: brisanjeGreska } = await dbSupabase.from("prijave").delete().eq("id", prijavaId);
  if (brisanjeGreska) throw brisanjeGreska;
}

module.exports = {
  prijaviSe,
  otkazi,
  listaZaAktivnost,
  upisiUcenika,
  promeniStatus,
  obrisi
};
