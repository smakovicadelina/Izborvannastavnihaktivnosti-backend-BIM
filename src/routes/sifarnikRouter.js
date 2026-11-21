
// Zajednicki CRUD ruter za jednostavne sifarnike (kategorije, interesovanja):
// citanje je javno, izmene su dozvoljene samo profesoru.

const express = require("express");
const { dbSupabase } = require("../config/supabase");
const zahtevajPrijavu = require("../middleware/zahtevajPrijavu");
const zahtevajUlogu = require("../middleware/zahtevajUlogu");
const {
  greska,
  imaPolje,
  zahtevajId,
  jeNeprazanTekst,
  opcioniTekst,
  tabelaNedostaje
} = require("../utils/http");

function napraviSifarnikRouter({ tabela, kljucListe, kljucJednog, naziv, koriscenje }) {
  const router = express.Router();
  const profesor = [zahtevajPrijavu, zahtevajUlogu("profesor")];

  async function proveriJedinstvenNaziv(vrednost, izuzmiId = null) {
    const { data, error } = await dbSupabase
      .from(tabela)
      .select("id, naziv")
      .ilike("naziv", vrednost.replace(/[\\%_]/g, c => `\\${c}`));
    if (error) throw error;
    if (data.some(r => r.id !== izuzmiId)) {
      throw greska(409, `${naziv} sa tim nazivom već postoji.`);
    }
  }

  function procitajTelo(body, delimicno) {
    const b = body || {};
    const unos = {};

    if (!delimicno || imaPolje(b, "naziv")) {
      if (!jeNeprazanTekst(b.naziv, 100)) {
        throw greska(400, "Naziv je obavezan (do 100 znakova).");
      }
      unos.naziv = b.naziv.trim();
    }

    if (imaPolje(b, "opis")) {
      const opis = opcioniTekst(b.opis, 2000);
      if (!opis.ok) throw greska(400, "Opis nije ispravan.");
      unos.opis = opis.vrednost;
    }

    if (!Object.keys(unos).length) {
      throw greska(400, "Nema podataka za izmenu.");
    }

    return unos;
  }

  router.get("/", async (req, res) => {
    const { data, error } = await dbSupabase
      .from(tabela)
      .select("*")
      .order("naziv");
    if (error) throw error;
    return res.json({ [kljucListe]: data });
  });

  router.get("/:id", async (req, res) => {
    const id = zahtevajId(req.params.id);
    const { data, error } = await dbSupabase
      .from(tabela)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw greska(404, `${naziv} nije pronađen(a).`);
    return res.json({ [kljucJednog]: data });
  });

  router.post("/", ...profesor, async (req, res) => {
    const unos = procitajTelo(req.body, false);
    await proveriJedinstvenNaziv(unos.naziv);

    const { data, error } = await dbSupabase
      .from(tabela)
      .insert(unos)
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ [kljucJednog]: data });
  });

  router.patch("/:id", ...profesor, async (req, res) => {
    const id = zahtevajId(req.params.id);
    const unos = procitajTelo(req.body, true);
    if (unos.naziv) await proveriJedinstvenNaziv(unos.naziv, id);

    const { data, error } = await dbSupabase
      .from(tabela)
      .update(unos)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw greska(404, `${naziv} nije pronađen(a).`);
    return res.json({ [kljucJednog]: data });
  });

  router.delete("/:id", ...profesor, async (req, res) => {
    const id = zahtevajId(req.params.id);

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
    if (!data) throw greska(404, `${naziv} nije pronađen(a).`);
    return res.json({ poruka: `${naziv} je obrisan(a).` });
  });

  return router;
}

module.exports = napraviSifarnikRouter;
