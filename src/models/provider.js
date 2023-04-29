class Provider {
    constructor(provide, decorator, identifier) {
        this.provide = provide;
        this.decorator = decorator;
        this.identifier = identifier;
        this.methodIds = [];
    }
}

export { Provider };