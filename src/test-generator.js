import typescript from 'typescript';
import VarDeclaration from './models/var-declaration.js';
import TypescriptNodeUtil from './typescript-node-util.js';

class TestGenerator {
    constructor(filePath, varName, decoratorId, usesTestBed = true) {
        this.varName = varName;
        this.decoratorId = decoratorId;
        this.usesTestBed = usesTestBed;
        this.nodeUtil = new TypescriptNodeUtil(filePath);

        this.decorator = this.nodeUtil.getDecoratorWithIdentifier(this.nodeUtil.sourceFile, decoratorId);
        this.classId = this.decorator.getNextSiblings().find(n => n.kind == typescript.SyntaxKind.Identifier);
        this.className = this.classId.getText(this.nodeUtil.sourceFile);
        this.methods = this.nodeUtil.getMethodDeclarations(this.decorator);
        this.providers = this.nodeUtil.getConstructorProviders(this.decorator);
        this.providers.forEach(provider => provider.mock = true);
    }

    generateSpyOnsAndExpectations(method) {
        let callExprs = this.nodeUtil.getCallExpressions(method);
        let spyOns = [];
        let expectations = [];
        callExprs.forEach(callExpr => {
            let access = callExpr.propertyAccess.replace('this.', this.varName + '.');
            if (access == 'this') access = this.varName;
            let funCall = `${access}.${callExpr.fun}`;
            let spyOnText = `\tspyOn(${access}, '${callExpr.fun}')`;
            if (callExpr.isSubscription && !callExpr.hasParentCallExpr) {
                spyOnText = `\t${funCall} = of({})`;
            } else if (callExpr.isSubscription && callExpr.hasParentCallExpr) {
                spyOnText += `.and.returnValue(of({}))`;
            }

            spyOns.push(spyOnText + `;`);
            expectations.push(`\texpect(${funCall}).toHaveBeenCalledWith();`);
        });

        let thisAssignments = this.nodeUtil.getThisAssignments(method);
        if (thisAssignments.length > 0 && expectations.length > 0) {
            expectations.push('');
        }
        thisAssignments.forEach(assignment => {
            let access = assignment.propertyAccess.replace('this.', this.varName + '.');
            expectations.push(`\texpect(${access}).toBeUndefined();`);
        });

        return { spyOns, expectations };
    }

    log(tabNum, text) {
        if (tabNum == undefined && text == undefined) {
            console.log();
        }
        else {
            if (tabNum != undefined && text == undefined) {
                text = tabNum;
                tabNum = 0;
            }
            console.log(`${'\t'.repeat(tabNum)}${text}`);
        }
    }

    generateMethodTests() {
        this.methods.forEach(method => {
            let methodId = method.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.Identifier).getText(this.nodeUtil.sourceFile);
            let data = this.generateSpyOnsAndExpectations(method);

            this.log(1, `it('should run #${methodId}()', () => {`);
            data.spyOns.forEach(x => this.log(1, `${x}`));
            this.log();
            this.log(2, `${this.varName}.${methodId}();\n`)
            data.expectations.forEach(x => this.log(1, `${x}`));
            this.log(1, `});`);
            this.log();
        });
    }

    generateProvider(provider) {
        if (provider.decorator == undefined) {
            if (provider.mock) {
                return `{ provide: ${provider.provide}, useClass: Mock${provider.provide}}`;
            } else {
                return `${provider.provide}`;
            }
        } else {
            return `{ provide: ${provider.provide}, useValue: [] }`;
        }
    }

    generateTestBedBeforeEach(_imports, declarations, allProviders) {
        this.log(1, `beforeEach(async(() => {`);
        this.log(2, `TestBed.configureTestingModule({`);
        this.log(2, `imports: [${_imports.join(', ')}],`);
        this.log(2, `declarations: [${declarations.join(', ')}],`);
        this.log(2, `schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],`);
        let providerStrings = allProviders.map(p => this.generateProvider(p));
        this.log(2, `providers:[${providerStrings.join(',\n\t\t\t')}]`);
        this.log(2, `}).overrideComponent(${this.className}, {`);
        this.log();
        this.log(2, `}).compileComponents();`);
        this.log(1, `}));`);
    }

    generateVarAssignmentBeforeEach() {
        this.log(1, `beforeEach(() => {`);
        this.varDeclarationList && this.varDeclarationList.forEach(vd => {
            this.log(2, `${vd.name} = ${vd.value};`);
        });
        this.log(1, `});`);
    }

    generateCompleteTest(_imports, declarations, extraProviders) {
        let allProviders = this.providers.concat(extraProviders || []);

        allProviders.filter(p => p.decorator == undefined && p.mock).forEach(provider => {
            this.log(`@Injectable()`);
            this.log(`class Mock${provider.provide} { }\n`);
        })

        this.log(`describe('${this.className}', () => {`)
        this.varDeclarationList && this.varDeclarationList.forEach(vd => {
            let str = `let ${vd.name}`;
            if (vd.type) {
                str += `: ${vd.type}`
            }
            str += ';'
            this.log(1, str);
        });
        this.log();

        if (this.usesTestBed) {
            this.generateTestBedBeforeEach(_imports, declarations, allProviders);
            this.log();
        }

        this.generateVarAssignmentBeforeEach();
        this.log();

        this.generateMethodTests();

        this.log(`});`);
    }
}

class ComponentTestGenerator extends TestGenerator {
    constructor(filePath) {
        super(filePath, 'component', 'Component');
        this.varDeclarationList = [
            new VarDeclaration('fixture', `ComponentFixture<${this.className}>`, `TestBed.createComponent(${this.className})`),
            new VarDeclaration('component', undefined, 'fixture.debugElement.componentInstance')
        ];
    }

    generate() {
        this.generateCompleteTest(['FormsModule', 'ReactiveFormsModule'], [this.className], []);
    }
}

class ServiceTestGenerator extends TestGenerator {
    constructor(filePath) {
        super(filePath, 'service', 'Injectable');
        this.varDeclarationList = [
            new VarDeclaration('service', undefined, `TestBed.get(${this.className})`)
        ];
    }

    generate() {
        this.generateCompleteTest([], [], [
            { provide: this.className, mock: false }
        ]);
    }
}

class PipeTestGenerator extends TestGenerator {
    constructor(filePath) {
        super(filePath, 'pipe', 'Pipe', false);
        this.varDeclarationList = [
            new VarDeclaration('pipe', this.className, `new ${this.className}()`)
        ];
    }

    generate() {
        this.generateCompleteTest();
    }
}

class GuardTestGenerator extends TestGenerator {
    constructor(filePath) {
        super(filePath, 'guard', 'Injectable');
        this.varDeclarationList = [
            new VarDeclaration('guard', undefined, `TestBed.get(${this.className})`)
        ];
    }

    generate() {
        this.generateCompleteTest([], [], [
            { provide: this.className, mock: false }
        ]);
    }
}

export { ComponentTestGenerator, ServiceTestGenerator, PipeTestGenerator, GuardTestGenerator };