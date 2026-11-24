// Generican CRUD za jednostavne sifarnike (kategorije, interesovanja).
// Isti kod radi za obe tabele; razlikuju se samo konfiguracijom
// (naziv tabele i tabele koje ih koriste - vidi routes/kategorijaRoutes.js).

const { dbSupabase } = require("../config/supabase");
const { greska, tabelaNedostaje } = require("../utils/http");
const { upit } = require("../utils/upit");

function napraviSifarnikServis({ tabela, naziv, koriscenje }) {
  const nijePronadjen = () => greska(404, `${naziv} nije pronađen(a).`);

  // Naziv mora biti jedinstven bez obzira na velika/mala slova.
  async function proveriJedinstvenNaziv(trazeniNaziv, izuzmiId = null) {
    const postojeci = await upit(
      dbSupabase
        .from(tabela)
        .select("id, naziv")
        .ilike("naziv", trazeniNaziv.replace(/[\\%_]/g, c => `\\${c}`))
    );
    if (postojeci.some(r => r.id !== izuzmiId)) {
      throw greska(409, `${naziv} sa tim nazivom već postoji.`);
    }
  }

  async function lista() {
    return upit(dbSupabase.from(tabela).select("*").order("naziv"));
  }

  async function jedan(id) {
    const { data, error } = await dbSupabase.from(tabela).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) throw nijePronadjen();
    return data;
  }

  async function kreiraj(unos) {
    await proveriJedinstvenNaziv(unos.naziv);
    const { data, error } = await dbSupabase.from(tabela).insert(unos).select().single();
    if (error) throw error;
    return data;
  }

  async function izmeni(id, unos) {
    if (unos.naziv) await proveriJedinstvenNaziv(unos.naziv, id);
    const { data, error } = await dbSupabase
      .from(tabela)
      .update(unos)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw nijePronadjen();
    return data;
  }

  // Brisanje nije dozvoljeno dok zapis koristi neka druga tabela (strani kljuc).
  async function obrisi(id) {
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
    if (!data) throw nijePronadjen();
  }

  return { lista, jedan, kreiraj, izmeni, obrisi };
}

module.exports = napraviSifarnikServis;
