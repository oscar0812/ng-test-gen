class NgFileType {
    constructor(fileExt, decoratorId, varName) {
        this.fileExt = fileExt;
        this.decoratorId = decoratorId;
        this.varName = varName;
    }
}

const FILE_TYPES = {
    COMPONENT: new NgFileType('component.ts', 'Component', 'component'),
    SERVICE: new NgFileType('service.ts', 'Injectable', 'service'),
    PIPE: new NgFileType('pipe.ts', 'Pipe', 'pipe')
}

export default FILE_TYPES;;