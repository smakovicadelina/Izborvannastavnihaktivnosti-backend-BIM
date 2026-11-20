
async function pregledAktivnosti(supabase) {
  const { data, error } = await supabase
    .from("aktivnosti")
    .select("*")
    .order("kreirano_at", { ascending: false });

  if (error) throw error;

  if (!data.length) return data;

  const { data: prijave, error: prijaveError } = await supabase
    .from("prijave")
    .select("aktivnost_id")
    .eq("status_prijave", "prijavljen")
    .in("aktivnost_id", data.map(aktivnost => aktivnost.id));

  if (prijaveError) throw prijaveError;

  const brojPoAktivnosti = new Map();
  for (const prijava of prijave) {
    brojPoAktivnosti.set(
      prijava.aktivnost_id,
      (brojPoAktivnosti.get(prijava.aktivnost_id) || 0) + 1
    );
  }

  return data.map(aktivnost => {
    const brojPrijavljenih = brojPoAktivnosti.get(aktivnost.id) || 0;
    return {
      ...aktivnost,
      broj_prijavljenih: brojPrijavljenih,
      slobodna_mesta: Math.max(
        0,
        aktivnost.maksimalno_mesta - brojPrijavljenih
      )
    };
  });
}

async function aktivnostPoId(supabase, aktivnostId) {
  const { data, error } = await supabase
    .from("aktivnosti")
    .select("*")
    .eq("id", aktivnostId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { count, error: countError } = await supabase
    .from("prijave")
    .select("id", { count: "exact", head: true })
    .eq("aktivnost_id", aktivnostId)
    .eq("status_prijave", "prijavljen");

  if (countError) throw countError;

  return {
    ...data,
    broj_prijavljenih: count || 0,
    slobodna_mesta: Math.max(
      0,
      data.maksimalno_mesta - (count || 0)
    )
  };
}

async function kreirajAktivnost(supabase, profesorId, unos) {
  const { data, error } = await supabase
    .from("aktivnosti")
    .insert({
      naziv: unos.naziv.trim(),
      opis: unos.opis ?? null,
      profesor_id: profesorId,
      maksimalno_mesta: unos.maksimalno_mesta,
      termin: unos.termin,
      prostorija: unos.prostorija.trim(),
      aktivna: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function urediAktivnost(
  supabase,
  profesorId,
  aktivnostId,
  unos
) {
  const { data: postojeca, error: proveraGreska } =
    await supabase
      .from("aktivnosti")
      .select("id")
      .eq("id", aktivnostId)
      .eq("profesor_id", profesorId)
      .maybeSingle();

  if (proveraGreska) throw proveraGreska;

  if (!postojeca) {
    const greska = new Error(
      "Aktivnost nije pronađena ili nemate dozvolu."
    );
    greska.status = 404;
    throw greska;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      unos,
      "maksimalno_mesta"
    )
  ) {
    const { count, error: countError } = await supabase
      .from("prijave")
      .select("id", { count: "exact", head: true })
      .eq("aktivnost_id", aktivnostId)
      .eq("status_prijave", "prijavljen");

    if (countError) throw countError;

    if (unos.maksimalno_mesta < (count || 0)) {
      const greska = new Error(
        "Broj mesta ne može biti manji od broja prijavljenih."
      );
      greska.status = 409;
      throw greska;
    }
  }

  const { data, error } = await supabase
    .from("aktivnosti")
    .update(unos)
    .eq("id", aktivnostId)
    .eq("profesor_id", profesorId)
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const greska = new Error("Aktivnost nije pronađena.");
    greska.status = 404;
    throw greska;
  }

  return data;
}

async function deaktivirajAktivnost(
  supabase,
  profesorId,
  aktivnostId
) {
  const { data, error } = await supabase
    .from("aktivnosti")
    .update({ aktivna: false })
    .eq("id", aktivnostId)
    .eq("profesor_id", profesorId)
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const greska = new Error(
      "Aktivnost nije pronađena ili nemate dozvolu."
    );
    greska.status = 404;
    throw greska;
  }

  return data;
}

async function prijaveAktivnosti(
  supabase,
  profesorId,
  aktivnostId
) {
  const aktivnost = await aktivnostPoId(
    supabase,
    aktivnostId
  );

  if (!aktivnost) {
    const greska = new Error("Aktivnost nije pronađena.");
    greska.status = 404;
    throw greska;
  }

  if (aktivnost.profesor_id !== profesorId) {
    const greska = new Error(
      "Nemate dozvolu za pregled prijava."
    );
    greska.status = 403;
    throw greska;
  }

  const { data, error } = await supabase
    .from("prijave")
    .select(
      "id, ucenik_id, status_prijave, prijavljen_at"
    )
    .eq("aktivnost_id", aktivnostId)
    .order("prijavljen_at", { ascending: false });

  if (error) throw error;
  return data;
}

async function azurirajPrijavu(
  supabase,
  profesorId,
  aktivnostId,
  prijavaId,
  statusPrijave
) {
  const aktivnost = await aktivnostPoId(
    supabase,
    aktivnostId
  );

  if (!aktivnost) {
    const greska = new Error("Aktivnost nije pronađena.");
    greska.status = 404;
    throw greska;
  }

  if (aktivnost.profesor_id !== profesorId) {
    const greska = new Error(
      "Nemate dozvolu da upravljate prijavama."
    );
    greska.status = 403;
    throw greska;
  }

  const { data: postojeca, error: proveraGreska } =
    await supabase
      .from("prijave")
      .select("id, status_prijave")
      .eq("id", prijavaId)
      .eq("aktivnost_id", aktivnostId)
      .maybeSingle();

  if (proveraGreska) throw proveraGreska;

  if (!postojeca) {
    const greska = new Error("Prijava nije pronađena.");
    greska.status = 404;
    throw greska;
  }

  if (
    statusPrijave === "prijavljen" &&
    postojeca.status_prijave !== "prijavljen"
  ) {
    const { count, error: countError } = await supabase
      .from("prijave")
      .select("id", { count: "exact", head: true })
      .eq("aktivnost_id", aktivnostId)
      .eq("status_prijave", "prijavljen")
      .neq("id", prijavaId);

    if (countError) throw countError;

    if ((count || 0) >= aktivnost.maksimalno_mesta) {
      const greska = new Error(
        "Nema slobodnih mesta za ovu prijavu."
      );
      greska.status = 409;
      throw greska;
    }
  }

  const { data, error } = await supabase
    .from("prijave")
    .update({ status_prijave: statusPrijave })
    .eq("id", prijavaId)
    .eq("aktivnost_id", aktivnostId)
    .select("id, ucenik_id, status_prijave")
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const greska = new Error("Prijava nije pronađena.");
    greska.status = 404;
    throw greska;
  }

  return data;
}

async function prijaviUcenika(
  supabase,
  ucenikId,
  aktivnostId
) {
  const { data, error } = await supabase.rpc(
    "bezbedna_prijava",
    {
      p_ucenik_id: ucenikId,
      p_aktivnost_id: Number(aktivnostId)
    }
  );

  if (error) {
    const poruka = error.message || "";

    if (
      poruka.includes("Nema slobodnih mesta") ||
      poruka.includes("Već ste prijavljeni")
    ) {
      const greska = new Error(poruka);
      greska.status = 409;
      throw greska;
    }

    if (poruka.includes("Aktivnost nije dostupna")) {
      const greska = new Error(poruka);
      greska.status = 404;
      throw greska;
    }

    if (poruka.includes("samo učenicima")) {
      const greska = new Error(poruka);
      greska.status = 403;
      throw greska;
    }

    throw error;
  }

  return data;
}

async function otkaziPrijavu(
  supabase,
  ucenikId,
  aktivnostId
) {
  const { data, error } = await supabase
    .from("prijave")
    .update({ status_prijave: "otkazano" })
    .eq("ucenik_id", ucenikId)
    .eq("aktivnost_id", aktivnostId)
    .in("status_prijave", [
      "prijavljen",
      "na_cekanju"
    ])
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = {
  pregledAktivnosti,
  aktivnostPoId,
  kreirajAktivnost,
  urediAktivnost,
  deaktivirajAktivnost,
  prijaveAktivnosti,
  azurirajPrijavu,
  prijaviUcenika,
  otkaziPrijavu
};
