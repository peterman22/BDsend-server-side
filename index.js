var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var passport = require('passport');
var session = require('express-session');
require('dotenv').config();

var errorMiddleware = require('./middleware/errorMiddleware');
var ErrorHandler = require('./utils/error');
var connection = require('./utils/connection');

var User = require('./routes/userRoutes');
var Payment = require('./routes/paymentRoutes');
var Admin = require('./routes/adminRoutes');
// var Bitcoin = require('./routes/bitcoinRoutes');

app.listen(process.env.PORT, () => {
	console.log(`Running on port ${process.env.PORT} 👍.`);
});
connection.connectDB();

app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: false }));
app.use(cookieParser());
app.use(cors());
app.use(
	session({
		secret: process.env.SECRET,
		resave: false,
		saveUninitialized: true,
	})
);
app.use(passport.initialize());
app.use(passport.session());

app.use('/users', User);
app.use('/payment', Payment);
app.use('/admin', Admin);
// app.use('/bitcoin', Bitcoin);

app.all('*', (req, res, next) => {
	next(new ErrorHandler('No Api Route Hit -- Bad Request', 404));
});
app.use(errorMiddleware);

module.exports = app;
