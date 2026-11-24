// CORS podesavanja: koji web domeni smeju da zovu API iz pretrazivaca.
//
// Napomena: React Native aplikacija na telefonu (Expo Go) NE podleze CORS-u -
// to je pravilo pretrazivaca. CORS je bitan za Swagger UI, Expo web i web frontend.
// Zahtevi bez Origin zaglavlja (Postman, mobilna aplikacija) su uvek dozvoljeni.

const port = Number(process.env.PORT) || 3000;
const produkcija = process.env.NODE_ENV === "production";

function normalizujOrigin(origin) {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

// CORS_ORIGIN / FRONTEND_ORIGIN iz .env (moze vise, odvojeno zarezom; "*" = svi).
const konfigurisaniOrigini = [process.env.CORS_ORIGIN, process.env.FRONTEND_ORIGIN]
  .filter(Boolean)
  .flatMap(vrednost => vrednost.split(","))
  .map(o => o.trim());

const sviOrigini = konfigurisaniOrigini.includes("*");

const dozvoljeniOrigini = new Set(
  [
    ...konfigurisaniOrigini,
    "http://localhost:5173",
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`
  ]
    .map(normalizujOrigin)
    .filter(Boolean)
);

// U razvoju dozvoljavamo localhost i lokalnu mrezu na bilo kom portu
// (Expo web, emulator, telefon u istoj WiFi mrezi...).
function lokalniOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    if (!["http:", "https:"].includes(protocol)) return false;
    return (
      hostname === "localhost" ||
      hostname === "[::1]" ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

const corsOpcije = {
  origin(origin, callback) {
    if (
      !origin ||
      sviOrigini ||
      dozvoljeniOrigini.has(normalizujOrigin(origin)) ||
      (!produkcija && lokalniOrigin(origin))
    ) {
      return callback(null, true);
    }
    // errorHandler ovu gresku pretvara u 403.
    return callback(new Error("CORS_ORIGIN_NOT_ALLOWED"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

module.exports = corsOpcije;
