const { dbSupabase } = require("../config/supabase");
const { greska, tabelaNedostaje } = require("../utils/http");

async function jedinstvenNaziv(tabela, naziv, nazivEntiteta, izuzmiId = null) {
  const { data, error } = await dbSupabase
    .from(tabela)
    .select("id, naziv")
    .ilike("naziv", naziv.replace(/[\\%_]/g, c => `\\${c}`));
  if (error) throw error;
  if (data.some(r => r.id !== izuzmiId)) {
    throw greska(409, `${nazivEntiteta} sa tim nazivom već postoji.`);
  }
}

async function lista(tabela) {
  const { data, error } = await dbSupabase.from(tabela).select("*").order("naziv");
  if (error) throw error;
  return data;
}

async function jedan(tabela, id) {
  const { data, error } = await dbSupabase
    .from(tabela)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function kreiraj(tabela, nazivEntiteta, naziv, unos) {
  await jedinstvenNaziv(tabela, naziv, nazivEntiteta);
  const { data, error } = await dbSupabase
    .from(tabela)
    .insert(unos)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function izmeni(tabela, nazivEntiteta, id, unos) {
  if (unos.naziv) await jedinstvenNaziv(tabela, unos.naziv, nazivEntiteta, id);
  const { data, error } = await dbSupabase
    .from(tabela)
    .update(unos)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function obrisi(tabela, id, koriscenje) {
  for (const { tabela: t, kolona, poruka } of koriscenje) {
    const { count, error } = await dbSupabase
      .from(t)
      .select(kolona, { count: "exact", head: true })
      .eq(kolona, id);
    if (error && !tabelaNedostaje(error)) throw error;
    if (count) throw greska(409, poruka);
  }

  const { data, error } = await dbSupabase
    .from(tabela)
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { lista, jedan, kreiraj, izmeni, obrisi };
