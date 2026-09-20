const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { isGuest, isLoggedIn } = require('../middleware/auth');

router.route('/register').get(isGuest, auth.getRegister).post(isGuest, auth.postRegister);
router.route('/login').get(isGuest, auth.getLogin).post(isGuest, auth.postLogin);
router.post('/logout', isLoggedIn, auth.logout);

module.exports = router;
