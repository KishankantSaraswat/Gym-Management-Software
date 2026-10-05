class ErrorHandler extends Error{
    constructor(message,statusCode){
        super(message);
        this.statusCode=statusCode;
    }
}

export const errorMiddleware=(err,req,res,next)=>{
    err.message=err.message||"Internal Server Error";
    err.statusCode=err.statusCode|| 500;

    if (err.name === 'SequelizeValidationError') {
        const message = err.errors ? err.errors.map((item) => item.message).join(", ") : "Validation Error";
        err = new ErrorHandler(message, 400);
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
        const field = err.errors && err.errors[0] ? err.errors[0].path : 'field';
        const message = `Duplicate ${field} value entered`;
        err = new ErrorHandler(message, 409);
    }

    if (err.name === 'SequelizeForeignKeyConstraintError') {
        const message = "Referenced record not found";
        err = new ErrorHandler(message, 400);
    }

    if (err.name === 'SequelizeDatabaseError') {
        const message = "Database error";
        err = new ErrorHandler(message, 500);
    }

    if (err.name === 'SequelizeConnectionError') {
        const message = "Database connection failed";
        err = new ErrorHandler(message, 503);
    }

    if(err.name==="JsonWebTokenError"){
        const statusCode=400;
        const message="Json web Token is invalid. Try again.";
        err=new ErrorHandler(message,statusCode);
    }

    if(err.name==="TokenExpiredError"){
        const statusCode=400;
        const message="Json web Token is expired. Try again.";
        err=new ErrorHandler(message,statusCode);
    }

    const errorMessage = err.errors && Array.isArray(err.errors) ? err.errors.map((error) => error.message).join(" ") : err.message; 
    return res.status(err.statusCode).json({
        success:false,
        message: errorMessage,
    });
}

export default ErrorHandler;