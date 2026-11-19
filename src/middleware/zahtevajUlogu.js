
function zahtevajUlogu(...dozvoljeneUloge) {
  return (req, res, next) => {
    if (!req.korisnik || !req.profil) {
      return res.status(401).json({
        greska: "Morate biti prijavljeni."
      });
    }

    if (!dozvoljeneUloge.includes(req.profil.uloga)) {
      return res.status(403).json({
        greska: "Nemate dozvolu za ovu radnju."
      });
    }

    next();
  };
}

module.exports = zahtevajUlogu;
