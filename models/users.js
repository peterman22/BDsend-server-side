var mongoose = require('mongoose');
var passportLocalMongoose = require('passport-local-mongoose');
var Schema = mongoose.Schema;
var { v4: uuidv4 } = require('uuid');

const generateUniqueNumbers = length => {
	let uniqueNumber = '';
	while (uniqueNumber.length < length) {
		uniqueNumber += uuidv4().replace(/-/g, '');
	}
	return uniqueNumber.slice(0, length);
};

var User = new Schema({
	email: { type: String, default: '' },
	phonenumber: {
		type: String,
		default: '',
	},
	pin: {
		type: String,
		default: '',
	},
	fullname: { type: String },
	picture: { type: String, default: '' },
	dob: { type: String, default: '' },
	country: { type: String, default: '' },
	address: { type: String, default: '' },
	receivingId: {
		type: String,
		default: generateUniqueNumbers(9),
	},
	wallet: { type: Number, default: 0 },
});

User.plugin(passportLocalMongoose, {
	usernameField: 'email',
});

module.exports = mongoose.model('User', User);
