class CustomError {
    constructor (code, message) {
        this.code = code;
        this.message = message;
    }

    toString() {
        return `Internal Error [CODE: ${this.code}]: ${this.message}`;
    }
}
const ERROR_CODES = {
    INVALID_FILE: new CustomError(1000, 'Invalid file type. Only component.ts, service.ts, and pipe.ts files allowed.'), 
    NO_COMPONENT: new CustomError(2000,  'Component Class Identifier not found!'),
    TOO_MANY_COMPONENTS: new CustomError(2001, 'Only one component per file allowed!')
};

export default ERROR_CODES;
