var ErrorHandler = require('../utils/error');

const errorMiddleware = (err, req, res, next) => {
        const message = err.message || 'Internal Server Error';
        const statusCode = err.statusCode || 500;
        const error = new ErrorHandler(message, statusCode);

	res.status(error.statusCode).json({
		message: error.message,
		status: error.statusCode,
	});
};

module.exports = errorMiddleware;
