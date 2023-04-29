import { ComponentTestGenerator, GuardTestGenerator, PipeTestGenerator, ServiceTestGenerator } from "../test-generator.js";

class NgFile {
    constructor(extension, generator) {
        this.extension = extension;
        this.generator = generator;
    }
}

let NG_FILE_INFO = [
    new NgFile('.component.ts', ComponentTestGenerator),
    new NgFile('.service.ts', ServiceTestGenerator),
    new NgFile('.pipe.ts', PipeTestGenerator),
    new NgFile('.guard.ts', GuardTestGenerator)
]

export { NG_FILE_INFO };