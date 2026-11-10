require('dotenv').config();

const express = require('express');
const authRoutes = require('./routes/authRoutes');
const aktivnostRoutes = require('./routes/aktivnostRoutes');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => res.json({ poruka: 'API je pokrenut.' }));
app.use('/api/auth', authRoutes);
app.use('/api/aktivnosti', aktivnostRoutes);

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ greska: 'Telo zahteva nije ispravan JSON.' });
  }
  console.error('Neočekivana greška:', err);

  if (err.code === '42501') {
    return res.status(403).json({ greska: 'Nemate dozvolu za ovu radnju.' });
  }
  if (err.code === '23505' || err.code === 'P0001' || err.code === '23514') {
    return res.status(409).json({
      greska: 'Radnja nije moguća zbog duplikata ili ograničenja kapaciteta.'
    });
  }

  return res.status(500).json({ greska: 'Došlo je do greške na serveru.' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Server je pokrenut na portu ${port}.`);
});
