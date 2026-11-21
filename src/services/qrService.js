
// Potpisani QR kodovi za evidenciju prisustva.
// Profesor generise kod za aktivnost i datum; ucenik ga skenira kamerom
// i salje backendu. Kod je HMAC-potpisan, pa ga ucenik ne moze falsifikovati.

const crypto = require("crypto");

const PREFIKS = "VA1";

function tajna() {
  const izvor =
    process.env.QR_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!izvor) {
    throw new Error("QR_SECRET nije podešen.");
  }

  // Izvodimo poseban kljuc kako se service role kljuc ne bi direktno koristio.
  return crypto.createHash("sha256").update(`qr-prisustvo:${izvor}`).digest();
}

function potpis(sadrzaj) {
  return crypto.createHmac("sha256", tajna()).update(sadrzaj).digest("base64url");
}

function napraviQrKod({ aktivnostId, datum, trajanjeMinuta = 120, sada = Date.now() }) {
  const vaziDo = Math.floor(sada / 1000) + Math.round(trajanjeMinuta * 60);
  const telo = Buffer.from(
    JSON.stringify({
      a: aktivnostId,
      d: datum,
      e: vaziDo,
      n: crypto.randomBytes(6).toString("base64url")
    })
  ).toString("base64url");

  const sadrzaj = `${PREFIKS}.${telo}`;

  return {
    kod: `${sadrzaj}.${potpis(sadrzaj)}`,
    vazi_do: new Date(vaziDo * 1000).toISOString()
  };
}

// Vraca { aktivnostId, datum } ili baca Error sa .razlog
function proveriQrKod(kod, sada = Date.now()) {
  const neispravan = razlog => {
    const e = new Error(razlog);
    e.razlog = razlog;
    return e;
  };

  if (typeof kod !== "string" || kod.length > 1000) {
    throw neispravan("QR kod nije ispravan.");
  }

  const delovi = kod.trim().split(".");
  if (delovi.length !== 3 || delovi[0] !== PREFIKS) {
    throw neispravan("QR kod nije ispravan.");
  }

  const sadrzaj = `${delovi[0]}.${delovi[1]}`;
  const ocekivan = Buffer.from(potpis(sadrzaj));
  const primljen = Buffer.from(delovi[2]);

  if (
    ocekivan.length !== primljen.length ||
    !crypto.timingSafeEqual(ocekivan, primljen)
  ) {
    throw neispravan("QR kod nije ispravan.");
  }

  let telo;
  try {
    telo = JSON.parse(Buffer.from(delovi[1], "base64url").toString("utf8"));
  } catch {
    throw neispravan("QR kod nije ispravan.");
  }

  if (Math.floor(sada / 1000) > telo.e) {
    throw neispravan("QR kod je istekao.");
  }

  return { aktivnostId: telo.a, datum: telo.d };
}

module.exports = {
  napraviQrKod,
  proveriQrKod
};
