var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var helmet = require('helmet');
var passport = require('passport');
var session = require('express-session');
require('dotenv').config();

var errorMiddleware = require('./middleware/errorMiddleware');
var ErrorHandler = require('./utils/error');
var connection = require('./utils/connection');
var { apiLimiter } = require('./middleware/rateLimiter');

var User = require('./routes/userRoutes');
var Payment = require('./routes/paymentRoutes');
var Admin = require('./routes/adminRoutes');
var paymentController = require('./controllers/paymentController');

app.listen(process.env.PORT, () => {
	console.log(`Running on port ${process.env.PORT}.`);
});
connection.connectDB();

// ── Stripe webhook must receive raw body before express.json ─────────────────
app.post(
	'/payment/webhook',
	express.raw({ type: 'application/json' }),
	paymentController.stripeWebhook
);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: false }));
app.use(cookieParser());
app.use(cors());
app.use(
	session({
		secret: process.env.SECRET,
		resave: false,
		saveUninitialized: false,
	})
);
app.use(passport.initialize());
app.use(passport.session());

// ── Global rate limit ─────────────────────────────────────────────────────────
app.use(apiLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
	res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/users', User);
app.use('/payment', Payment);
app.use('/admin', Admin);

app.all('*', (req, res, next) => {
	next(new ErrorHandler('No API route found — bad request', 404));
});
app.use(errorMiddleware);

module.exports = app;
