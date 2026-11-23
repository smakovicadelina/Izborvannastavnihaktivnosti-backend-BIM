const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const errorHandler = require("../src/middleware/errorHandler");
const { greska } = require("../src/utils/http");

async function pozoviErrorHandler(error) {
  const app = express();
  app.get("/", (req, res, next) => next(error));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("centralni error handler zadržava JSON za HTTP i Supabase greške", async () => {
  assert.deepEqual(await pozoviErrorHandler(greska(422, "Neispravan unos.", { polje: "email" })), {
    status: 422,
    body: { greska: "Neispravan unos.", polje: "email" }
  });
  assert.deepEqual(await pozoviErrorHandler({ code: "23505" }), {
    status: 409,
    body: { greska: "Takav zapis već postoji." }
  });
  assert.deepEqual(await pozoviErrorHandler({ code: "42P01", message: "missing table" }), {
    status: 503,
    body: {
      greska: "Baza nije ažurirana. Pokrenite SQL migracije iz foldera supabase/migrations."
    }
  });
});
