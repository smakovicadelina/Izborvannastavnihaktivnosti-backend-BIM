const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const express = require("express");

const validiraj = require("../src/middleware/validiraj");
const zahtevajUlogu = require("../src/middleware/zahtevajUlogu");
const nepostojecaRuta = require("../src/middleware/nepostojecaRuta");
const errorHandler = require("../src/middleware/errorHandler");
const { greska } = require("../src/utils/http");

// Mini aplikacija sa istim redosledom middleware-a kao src/app.js
async function pokreni(podesi) {
  const app = express();
  app.use(express.json());
  podesi(app);
  app.use(nepostojecaRuta);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    zatvori: () => new Promise(resolve => server.close(resolve))
  };
}

test("validiraj: ispravni podaci stizu u req.podaci, neispravni ne stizu do kontrolera", async t => {
  let kontrolerPozvan = 0;
  const validator = req => {
    if (typeof req.body.naziv !== "string") throw greska(400, "Naziv je obavezan.");
    return { naziv: req.body.naziv.trim() };
  };
  const { url, zatvori } = await pokreni(app => {
    app.post("/x", validiraj(validator), (req, res) => {
      kontrolerPozvan++;
      res.status(201).json(req.podaci);
    });
  });
  t.after(zatvori);

  const ok = await fetch(`${url}/x`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ naziv: "  Šah  " })
  });
  assert.equal(ok.status, 201);
  assert.deepEqual(await ok.json(), { naziv: "Šah" });

  const lose = await fetch(`${url}/x`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  assert.equal(lose.status, 400);
  assert.deepEqual(await lose.json(), { greska: "Naziv je obavezan." });
  assert.equal(kontrolerPozvan, 1);
});

test("zahtevajUlogu: 401 bez prijave, 403 za pogresnu ulogu, prolaz za ispravnu", async t => {
  const { url, zatvori } = await pokreni(app => {
    app.get(
      "/profesor",
      (req, res, next) => {
        const uloga = req.headers["x-uloga"];
        if (uloga) {
          req.korisnik = { id: "1" };
          req.profil = { uloga };
        }
        next();
      },
      zahtevajUlogu("profesor"),
      (req, res) => res.json({ ok: true })
    );
  });
  t.after(zatvori);

  assert.equal((await fetch(`${url}/profesor`)).status, 401);
  assert.equal((await fetch(`${url}/profesor`, { headers: { "x-uloga": "ucenik" } })).status, 403);
  assert.equal((await fetch(`${url}/profesor`, { headers: { "x-uloga": "profesor" } })).status, 200);
});

test("nepostojeca ruta vraca 404 JSON, neispravan JSON vraca 400", async t => {
  const { url, zatvori } = await pokreni(app => {
    app.post("/x", (req, res) => res.json({}));
  });
  t.after(zatvori);

  const r404 = await fetch(`${url}/nema`);
  assert.equal(r404.status, 404);
  assert.equal((await r404.json()).greska, "Ruta nije pronađena.");

  const r400 = await fetch(`${url}/x`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ los json"
  });
  assert.equal(r400.status, 400);
  assert.deepEqual(await r400.json(), { greska: "Telo zahteva nije ispravan JSON." });
});
