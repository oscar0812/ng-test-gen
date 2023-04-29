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
    NO_COMPONENT: new CustomError(1000,  'Component Class Identifier not found!'),
    TOO_MANY_COMPONENTS: new CustomError(1001, 'Only one component per file allowed!')
};

export default ERROR_CODES;
