// Middleware za validaciju podataka iz zahteva.
//
// Primer upotrebe u ruti:
//   router.post("/", validiraj(prostorijaValidator.kreiranje), kontroler.kreiranje);
//
// Validator je funkcija (req) => podaci koja proverava req.params, req.query i
// req.body. Ako su podaci ispravni, ocisceni podaci se upisuju u req.podaci i
// zahtev ide dalje ka kontroleru. Ako nisu, validator baca HttpGreska(400), a
// next(greska) prosledjuje gresku centralnom errorHandler-u - kontroler se
// tada uopste ne poziva.

function validiraj(validator) {
  return function validacijaMiddleware(req, res, next) {
    try {
      req.podaci = validator(req);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = validiraj;
