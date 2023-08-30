var express = require('express');
var router = express.Router();
var passport = require('passport');
var authenticate = require('../middleware/authAdmin');
var adminController = require('../controllers/adminController');

router.get('/info', authenticate.verifyAdmin, adminController.getUser);
router.get('/main', authenticate.verifyAdmin, adminController.mainDashboard);
router.get('/users/list', authenticate.verifyAdmin, adminController.getUsers);
router.get('/rate/get', authenticate.verifyAdmin, adminController.getRate);
router.post('/register', adminController.register);
router.post(
	'/signin',
	passport.authenticate('local-admin'),
	adminController.signIn
);
router.patch(
	'/profile/edit/user/:id',
	authenticate.verifyAdmin,
	adminController.editUser
);
router.patch(
	'/profile/change',
	authenticate.verifyAdmin,
	adminController.editAdmin
);
router.patch(
	'/profile/active/:id',
	authenticate.verifyAdmin,
	adminController.editActiveUser
);
router.delete(
	'/profile/user/delete/:id',
	authenticate.verifyAdmin,
	adminController.deleteUser
);
router.patch(
	'/rate/update',
	authenticate.verifyAdmin,
	adminController.updateRate
);

module.exports = router;
