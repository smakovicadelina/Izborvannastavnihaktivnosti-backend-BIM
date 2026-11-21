
const napraviSifarnikRouter = require("./sifarnikRouter");

module.exports = napraviSifarnikRouter({
  tabela: "interesovanja",
  kljucListe: "interesovanja",
  kljucJednog: "interesovanje",
  naziv: "Interesovanje",
  koriscenje: [
    {
      tabela: "korisnik_interesovanja",
      kolona: "interesovanje_id",
      poruka: "Interesovanje je izabrano kod učenika i ne može se obrisati."
    },
    {
      tabela: "aktivnost_interesovanja",
      kolona: "interesovanje_id",
      poruka: "Interesovanje je povezano sa aktivnostima i ne može se obrisati."
    }
  ]
});
