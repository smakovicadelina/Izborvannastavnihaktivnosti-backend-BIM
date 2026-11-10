const express = require('express');
const kontroler = require('../controllers/aktivnostController');
const zahtevajPrijavu = require('../middleware/zahtevajPrijavu');

const router = express.Router();

router.get('/', kontroler.pregled);
router.get('/:aktivnostId/mesta', zahtevajPrijavu, kontroler.mesta);
router.post('/', zahtevajPrijavu, kontroler.kreiranje);
router.post('/:aktivnostId/prijava', zahtevajPrijavu, kontroler.prijava);
router.delete('/:aktivnostId/prijava', zahtevajPrijavu, kontroler.otkazivanje);

module.exports = router;
