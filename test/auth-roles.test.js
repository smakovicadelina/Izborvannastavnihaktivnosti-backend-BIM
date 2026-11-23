const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const express = require("express");

const configPath = require.resolve("../src/config/supabase");
const authRoutesPath = require.resolve("../src/routes/authRoutes");
const aktivnostRoutesPath = require.resolve("../src/routes/aktivnostRoutes");
const aktivnostControllerPath = require.resolve("../src/controllers/aktivnostController");
const loginMiddlewarePath = require.resolve("../src/middleware/zahtevajPrijavu");
const roleMiddlewarePath = require.resolve("../src/middleware/zahtevajUlogu");

test("registracija profesora pravi zahtjev, ali ne dodjeljuje profesorsku ulogu", async t => {
  const korisnici = new Map();
  const zahtjevi = new Map();
  const authKorisnici = new Map();
  const signupPozivi = [];
  const kreiraneAktivnosti = [];
  let requestsTableAvailable = true;
  let nextId = 1;

  const authSupabase = {
    auth: {
      async signUp(options) {
        signupPozivi.push(options);
        const existingUser = authKorisnici.get(options.email);
        if (existingUser) {
          return {
            data: { user: { ...existingUser, identities: [] } },
            error: {
              status: 422,
              code: "user_already_exists",
              message: "User already registered"
            }
          };
        }

        const id = `korisnik-${nextId++}`;
        const user = { id, email: options.email, identities: [{}] };
        authKorisnici.set(options.email, user);
        return {
          data: {
            user,
            session: {
              access_token: `token-${id}`,
              refresh_token: `refresh-${id}`,
              expires_at: 123
            }
          },
          error: null
        };
      },
      async signInWithPassword({ email }) {
        const user = authKorisnici.get(email);
        if (!user) {
          return { data: {}, error: { status: 400 } };
        }

        return {
          data: {
            user,
            session: {
              access_token: `token-${user.id}`,
              refresh_token: `refresh-${user.id}`,
              expires_at: 123
            }
          },
          error: null
        };
      },
      async getUser(token) {
        const id = token.replace(/^token-/, "");
        const user = [...authKorisnici.values()].find(item => item.id === id);
        return user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: new Error("Invalid token") };
      },
      admin: {
        async signOut(token, scope) {
          return token && scope === "global"
            ? { data: null, error: null }
            : { data: null, error: new Error("Invalid token") };
        }
      }
    }
  };

  const dbSupabase = {
    from(table) {
      return {
        row: null,
        filter: null,
        upsert(row) {
          if (table === "zahtevi_za_profesora" && !requestsTableAvailable) {
            this.error = { code: "42P01" };
            return this;
          }

          this.row = row;
          if (table === "korisnici") {
            const existing = korisnici.get(row.id);
            this.row = { ...existing, ...row };
            korisnici.set(row.id, this.row);
          } else {
            this.row = zahtjevi.get(row.korisnik_id) || {
              id: zahtjevi.size + 1,
              ...row,
              status: "na_cekanju",
              kreiran_at: "2026-11-20T12:00:00Z",
              obradjen_at: null
            };
            zahtjevi.set(row.korisnik_id, this.row);
          }
          return this;
        },
        select() {
          return this;
        },
        eq(column, value) {
          this.filter = { column, value };
          return this;
        },
        async single() {
          return {
            data: this.error ? null : this.row,
            error: this.error || null
          };
        },
        insert(row) {
          this.row = {
            id: kreiraneAktivnosti.length + 1,
            ...row,
            kreirano_at: "2026-11-20T12:00:00Z"
          };
          if (table === "aktivnosti") {
            kreiraneAktivnosti.push(this.row);
          }
          return this;
        },
        async maybeSingle() {
          const record = table === "korisnici"
            ? korisnici.get(this.filter.value)
            : zahtjevi.get(this.filter.value);
          return { data: record || null, error: null };
        }
      };
    }
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: { authSupabase, dbSupabase }
  };
  for (const modulePath of [
    authRoutesPath,
    aktivnostRoutesPath,
    aktivnostControllerPath,
    loginMiddlewarePath,
    roleMiddlewarePath
  ]) {
    delete require.cache[modulePath];
  }

  const zahtijevajPrijavu = require("../src/middleware/zahtevajPrijavu");
  const zahtijevajProfesora =
    require("../src/middleware/zahtevajUlogu")("profesor");
  const app = express();
  app.use(express.json());
  app.use("/api/auth", require("../src/routes/authRoutes"));
  app.use("/api/aktivnosti", require("../src/routes/aktivnostRoutes"));
  app.get(
    "/api/profesorska-ruta",
    zahtijevajPrijavu,
    zahtijevajProfesora,
    (req, res) => res.json({ uloga: req.profil.uloga })
  );

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headers = { "Content-Type": "application/json" };

  const registruj = async (email, uloga) => fetch(
    `${baseUrl}/api/auth/registracija`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        ime_i_prezime: "Test Korisnik",
        email,
        lozinka: "SigurnaLozinka123",
        uloga
      })
    }
  );

  const ucenikResponse = await registruj("ucenik@example.com", "ucenik");
  const ucenik = await ucenikResponse.json();
  assert.equal(ucenikResponse.status, 201);
  assert.equal(ucenik.korisnik.uloga, "ucenik");
  assert.equal(ucenik.zahtev_za_profesora, null);

  requestsTableAvailable = false;
  const profesorResponse = await registruj("profesor@example.com", "profesor");
  const profesor = await profesorResponse.json();
  assert.equal(profesorResponse.status, 503);
  assert.match(profesor.greska, /Ne registrujte se ponovo/);
  assert.equal(
    korisnici.get(authKorisnici.get("profesor@example.com").id).uloga,
    "ucenik"
  );
  assert.equal(
    signupPozivi[1].options.data.uloga,
    undefined,
    "the requested role must not be sent as an Auth role"
  );
  assert.equal(signupPozivi[1].options.data.requested_role, "profesor");

  const invalidResponse = await registruj("invalid@example.com", "administrator");
  assert.equal(invalidResponse.status, 400);
  assert.equal(signupPozivi.length, 2, "invalid roles must not reach Supabase Auth");

  const duplicateResponse = await registruj("ucenik@example.com", "profesor");
  assert.equal(duplicateResponse.status, 409);

  requestsTableAvailable = true;
  const prijavaResponse = await fetch(`${baseUrl}/api/auth/prijava`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: "PROFESOR@example.com",
      lozinka: "SigurnaLozinka123"
    })
  });
  const prijava = await prijavaResponse.json();
  assert.equal(prijavaResponse.status, 200);
  assert.equal(prijava.korisnik.uloga, "ucenik");
  assert.equal(prijava.zahtev_za_profesora, undefined);

  const odjavaResponse = await fetch(`${baseUrl}/api/auth/odjava`, {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `Bearer ${prijava.token}`
    }
  });
  assert.equal(odjavaResponse.status, 200);
  assert.deepEqual(await odjavaResponse.json(), {
    poruka: "Uspešno ste odjavljeni."
  });

  const authHeader = {
    Authorization: `Bearer ${prijava.token}`
  };
  const unauthenticatedCreate = await fetch(
    `${baseUrl}/api/aktivnosti`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        naziv: "Test aktivnost",
        maksimalno_mesta: 10,
        termin: "Srijeda 14:00",
        prostorija: "Učionica 1"
      })
    }
  );
  assert.equal(unauthenticatedCreate.status, 401);

  const pendingActivityCreate = await fetch(
    `${baseUrl}/api/aktivnosti`,
    {
      method: "POST",
      headers: {
        ...headers,
        ...authHeader
      },
      body: JSON.stringify({
        naziv: "Test aktivnost",
        maksimalno_mesta: 10,
        termin: "Srijeda 14:00",
        prostorija: "Učionica 1"
      })
    }
  );
  assert.equal(pendingActivityCreate.status, 403);

  const pendingAccess = await fetch(
    `${baseUrl}/api/profesorska-ruta`,
    { headers: authHeader }
  );
  assert.equal(pendingAccess.status, 403);

  const recoveredRequest = await fetch(
    `${baseUrl}/api/auth/zahtev-za-profesora`,
    {
      method: "POST",
      headers: {
        ...headers,
        Authorization: `Bearer ${prijava.token}`
      },
      body: JSON.stringify({ uloga: "profesor", korisnik_id: "neko-drugi" })
    }
  );
  assert.equal(recoveredRequest.status, 200);
  const recoveredData = await recoveredRequest.json();
  assert.equal(
    recoveredData.zahtev_za_profesora.korisnik_id,
    prijava.korisnik.id,
    "the request must use the authenticated user id, not a JSON-supplied id"
  );
  assert.equal(korisnici.get(prijava.korisnik.id).uloga, "ucenik");

  const repeatedRequest = await fetch(
    `${baseUrl}/api/auth/zahtev-za-profesora`,
    {
      method: "POST",
      headers: {
        ...headers,
        Authorization: `Bearer ${prijava.token}`
      },
      body: JSON.stringify({ uloga: "ucenik" })
    }
  );
  assert.equal(repeatedRequest.status, 200);
  assert.equal(
    (await repeatedRequest.json()).zahtev_za_profesora.id,
    recoveredData.zahtev_za_profesora.id
  );

  const studentAccess = await fetch(
    `${baseUrl}/api/profesorska-ruta`,
    { headers: { Authorization: `Bearer ${ucenik.token}` } }
  );
  assert.equal(studentAccess.status, 403);

  korisnici.get(prijava.korisnik.id).uloga = "profesor";
  zahtjevi.get(prijava.korisnik.id).status = "odobren";
  const approvedAccess = await fetch(
    `${baseUrl}/api/profesorska-ruta`,
    { headers: authHeader }
  );
  assert.equal(approvedAccess.status, 200);
  assert.equal((await approvedAccess.json()).uloga, "profesor");

  const activityCreate = await fetch(`${baseUrl}/api/aktivnosti`, {
    method: "POST",
    headers: {
      ...headers,
      ...authHeader
    },
    body: JSON.stringify({
      naziv: "Test aktivnost",
      opis: "Kreirana nakon odobrenja",
      maksimalno_mesta: 10,
      termin: "Srijeda 14:00",
      prostorija: "Učionica 1",
      profesor_id: "neko-drugi"
    })
  });
  assert.equal(activityCreate.status, 201);
  assert.equal(kreiraneAktivnosti.length, 1);
  assert.equal(
    kreiraneAktivnosti[0].profesor_id,
    prijava.korisnik.id,
    "activity ownership must use the authenticated user id"
  );
});
