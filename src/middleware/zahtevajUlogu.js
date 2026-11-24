// AUTORIZACIJA - provera sta korisnik sme da radi.
//
// Ide UVEK posle zahtevajPrijavu (koji popunjava req.profil). Primer:
//   router.post("/", zahtevajPrijavu, zahtevajUlogu("profesor"), ...)
// Ako uloga korisnika nije medju dozvoljenima, vraca se 403 Forbidden.

const { greska } = require("../utils/http");

function zahtevajUlogu(...dozvoljeneUloge) {
  return function proveraUloge(req, res, next) {
    if (!req.korisnik || !req.profil) {
      return next(greska(401, "Morate biti prijavljeni."));
    }
    if (!dozvoljeneUloge.includes(req.profil.uloga)) {
      return next(greska(403, "Nemate dozvolu za ovu radnju."));
    }
    return next();
  };
}

module.exports = zahtevajUlogu;
