async function pregledAktivnosti(supabase) {
  const { data, error } = await supabase
    .from('pogled_aktivnosti')
    .select('*')
    .order('termin', { ascending: true });

  if (error) throw error;
  return data;
}

async function aktivnostPoId(supabase, aktivnostId) {
  const { data, error } = await supabase
    .from('pogled_aktivnosti')
    .select('*')
    .eq('id', aktivnostId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function kreirajAktivnost(supabase, profesorId, unos) {
  const { data, error } = await supabase
    .from('aktivnosti')
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

async function prijaviUcenika(supabase, ucenikId, aktivnostId) {
  const { data, error } = await supabase
    .from('prijave')
    .insert({
      ucenik_id: ucenikId,
      aktivnost_id: aktivnostId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function otkaziPrijavu(supabase, ucenikId, aktivnostId) {
  const { data, error } = await supabase
    .from('prijave')
    .update({ status_prijave: 'otkazana' })
    .eq('ucenik_id', ucenikId)
    .eq('aktivnost_id', aktivnostId)
    .neq('status_prijave', 'otkazana')
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return data;
}

module.exports = {
  pregledAktivnosti,
  aktivnostPoId,
  kreirajAktivnost,
  prijaviUcenika,
  otkaziPrijavu
};
