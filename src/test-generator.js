import typescript from 'typescript';
import VarDeclaration from './models/var-declaration.js';
import TypescriptNodeUtil from './typescript-node-util.js';
import CONFIG from '../config.js';

class TestGenerator {
    constructor(filePath, varName, decoratorId, usesTestBed = true) {
        this.logs = [];
        this.varName = varName;
        this.decoratorId = decoratorId;
        this.usesTestBed = usesTestBed;
        this.nodeUtil = new TypescriptNodeUtil(filePath);

        let classDeclaration = this.nodeUtil.getClassDeclaration();
        this.decorator = this.nodeUtil.getDecoratorWithIdentifier(classDeclaration, decoratorId);
        this.classId = this.nodeUtil.getClassId(classDeclaration);
        this.className = this.classId.getText(this.nodeUtil.sourceFile);
        this.methods = this.nodeUtil.getMethodDeclarations(classDeclaration);
        this.providers = this.nodeUtil.getConstructorProvidersInfo(classDeclaration);
        this.providers.forEach(provider => provider.mock = true);
    }

    generateSpyOnsAndExpectations(method, resultVal, paramValues) {
        let callExprs = this.nodeUtil.getCallExpressionsInMethod(method);
        let spyOns = [];
        let expectations = [];
        callExprs.forEach(callExpr => {
            let access = callExpr.propertyAccess.replace('this.', this.varName + '.');
            if (access == 'this') access = this.varName;

            let funCall = `${access}.${callExpr.fun}`;
            let spyOnText = `spyOn(${access}, '${callExpr.fun}')`;

            if (callExpr.isPropertyAccessSubscribe) {
                spyOnText = `${access} = of({})`;
            } else if (callExpr.isCallExpressionSubscribe) {
                spyOnText += `.and.returnValue(of({}))`;
            } else if (callExpr.usesMethodParam) {
                spyOnText += `.and.callThrough()`
            }

            spyOns.push(spyOnText + `;`);

            if (!callExpr.isPropertyAccessSubscribe) {
                expectations.push(`expect(${funCall}).toHaveBeenCalledWith();`);
            }
        });

        let localAssignments = this.nodeUtil.getAssignments(method, [...paramValues.map(p => p.name)]);

        if (resultVal != undefined) localAssignments.unshift({ propertyAccess: resultVal });

        if (localAssignments.length > 0 && expectations.length > 0) {
            expectations.push('');
        }
        localAssignments.forEach(assignment => {
            let access = assignment.propertyAccess.replace('this.', this.varName + '.');
            expectations.push(`expect(${access}).toBeUndefined();`);
        });

        return { spyOns, expectations };
    }

    getIndentStr(indentNum) {
        return CONFIG.format.indentWith.repeat(indentNum);
    }

    log(indentNum, text) {
        if (indentNum == undefined && text == undefined) {
            this.logs.push("");
        }
        else {
            if (indentNum != undefined && text == undefined) {
                text = indentNum;
                indentNum = 0;
            }
            this.logs.push(`${this.getIndentStr(indentNum)}${text}`);
        }
    }

    generateConstructorTest() {
        this.log(1, `it('should create', () => {`);
        this.varDeclarationList && this.varDeclarationList.forEach(vd => {
            this.log(2, `expect(${vd.name}).toBeTruthy();`);
        });
        this.log(1, `});`);
    }

    generateMethodCall(method, methodId, paramValues, resultVal, padding = 0) {
        if (method.kind == typescript.SyntaxKind.SetAccessor) {
            // component.setAccessorName = value;
            let p = paramValues[0].name;
            this.log(2 + padding, `${this.varName}.${methodId} = ${p};`)
        } else {
            let assignment = resultVal ? 'let ' + resultVal + ' = ' : ''; // let result =

            let paramsStr = method.kind == typescript.SyntaxKind.GetAccessor ? '' : `(${paramValues.map(pv => pv.name).join(', ')})`;
            this.log(2 + padding, `${assignment}${this.varName}.${methodId}${paramsStr};`)
        }
    }

    generateItTest(method, methodId, paramValues, spysAndExp, resultVal, padding = 0) {
        this.log(1 + padding, `it('should run #${methodId}()', () => {`);
        paramValues.forEach(pv => this.log(2 + padding, `let ${pv.name}: any = ${JSON.stringify(pv.value)};`))
        spysAndExp.spyOns.forEach(x => this.log(2 + padding, `${x}`));

        if ((paramValues && paramValues.length > 0) || (spysAndExp && spysAndExp.length > 0)) {
            this.log();
        }

        this.generateMethodCall(method, methodId, paramValues, resultVal, padding);

        if (spysAndExp.expectations && spysAndExp.expectations.length > 0) {
            this.log();
        }

        spysAndExp.expectations.forEach(x => this.log(2 + padding, `${x}`));
        this.log(1 + padding, `});`);
        this.log();
    }

    generateItTestWithDescribe(method, methodId, paramValues, spysAndExp, resultVal) {
        this.log(1, `describe('should run #${methodId}()', () => {`);
        this.generateItTest(method, methodId, paramValues, spysAndExp, resultVal, 1)
        this.log(1, `});`);
        this.log();
    }

    generateAllMethodTests() {
        this.methods.forEach(method => {
            let resultVal = this.nodeUtil.hasValidReturnStatement(method) ? 'result' : undefined;
            let methodId = this.nodeUtil.getMethodId(method);
            let paramValues = this.nodeUtil.getMethodParmInitValues(method);
            let spysAndExp = this.generateSpyOnsAndExpectations(method, resultVal, paramValues);

            if (CONFIG.encapsulateTestsInDescribe === true) {
                this.generateItTestWithDescribe(method, methodId, paramValues, spysAndExp, resultVal);
            } else {
                this.generateItTest(method, methodId, paramValues, spysAndExp, resultVal);
            }
        });
    }

    getProviderString(provider) {
        if (provider.decorator == undefined) {
            if (provider.mock) {
                return `{ provide: ${provider.provide}, useClass: Mock${provider.provide} }`;
            } else {
                return `${provider.provide}`;
            }
        } else {
            return `{ provide: ${provider.provide}, useValue: [] }`;
        }
    }

    generateTestBedBeforeEach(_imports, declarations, allProviders) {
        this.log(1, `beforeEach(waitForAsync(() => {`);
        this.log(2, `TestBed.configureTestingModule({`);
        this.log(3, `imports: [${_imports.join(', ')}],`);
        this.log(3, `declarations: [${declarations.join(', ')}],`);
        this.log(3, `schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],`);

        this.log(3, `providers: [`);
        let providersStr = allProviders.map(p => (this.getIndentStr(4) + this.getProviderString(p))).join(',\n');
        this.log(providersStr);
        this.log(3, `]`)

        if (this.decoratorId == 'Component') {
            this.log(2, `}).overrideComponent(${this.className}, {`);
            this.log();
            this.log(2, `}).compileComponents();`);
        } else {
            this.log(2, `});`);
        }
        this.log(1, `}));`);
    }

    generateVarAssignmentBeforeEach() {
        this.log(1, `beforeEach(() => {`);
        this.varDeclarationList && this.varDeclarationList.forEach(vd => {
            this.log(2, `${vd.name} = ${vd.value};`);
        });
        this.log(1, `});`);
    }

    generateProviderMocks(allProviders) {
        allProviders.filter(p => p.decorator == undefined && p.mock).forEach(provider => {
            this.log(`@Injectable()`);
            if (provider.methodIds && provider.methodIds.length > 0) {
                this.log(0, `class Mock${provider.provide} {`);
                provider.methodIds.forEach(m => this.log(1, `${m}() { }`));
                this.log(0, `}`);
            } else {
                this.log(0, `class Mock${provider.provide} { }`);
            }
            this.log();
        })
    }

    generateCompleteTest(_imports, declarations, extraProviders, generateMethodTests = true) {
        _imports = _imports || [];
        declarations = declarations || [];
        extraProviders = extraProviders || [];

        let allProviders = this.providers.concat(extraProviders);
        this.generateProviderMocks(allProviders);

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

        this.generateConstructorTest();
        this.log();

        if (generateMethodTests) {
            this.generateAllMethodTests();
        }

        this.log(`});`);

        return this.logs.join("\n");
    }
}

class ComponentTestGenerator extends TestGenerator {
    constructor(filePath) {
        super(filePath, 'component', 'Component');
        this.varDeclarationList = [
            new VarDeclaration('fixture', `ComponentFixture<${this.className}>`, `TestBed.createComponent(${this.className})`),
            new VarDeclaration('component', undefined, 'fixture.debugElement.componentInstance as any')
        ];
    }

    generate(generateMethodTests = true) {
        return this.generateCompleteTest(['FormsModule', 'ReactiveFormsModule'], [this.className], [], generateMethodTests);
    }
}

class GuardTestGenerator extends TestGenerator {
    constructor(filePath) {
        super(filePath, 'guard', 'Injectable');
        this.varDeclarationList = [
            new VarDeclaration('guard', undefined, `TestBed.inject(${this.className}) as any`)
        ];
    }

    generate(generateMethodTests = true) {
        return this.generateCompleteTest([], [], [], generateMethodTests);
    }
}

class ServiceTestGenerator extends TestGenerator {
    constructor(filePath) {
        super(filePath, 'service', 'Injectable');
        this.varDeclarationList = [
            new VarDeclaration('service', undefined, `TestBed.inject(${this.className}) as any`)
        ];
    }

    generate(generateMethodTests = true) {
        return this.generateCompleteTest([], [], [{ provide: this.className, mock: false }], generateMethodTests);
    }
}

class PipeTestGenerator extends TestGenerator {
    constructor(filePath) {
        super(filePath, 'pipe', 'Pipe', false);
        this.varDeclarationList = [
            new VarDeclaration('pipe', this.className, `new ${this.className}()`)
        ];
    }

    generate(generateMethodTests = true) {
        return this.generateCompleteTest([], [], [], generateMethodTests);
    }
}

class DirectiveTestGenerator extends TestGenerator {
    constructor(filePath) {
        super(filePath, 'directive', 'Directive', false);
        this.varDeclarationList = [
            new VarDeclaration('directive', this.className, `new ${this.className}()`)
        ];
    }

    generate(generateMethodTests = true) {
        return this.generateCompleteTest([], [], [], generateMethodTests);
    }
}

class ClassTestGenerator extends TestGenerator {
    constructor(filePath) {
        super(filePath, 'obj', undefined, false);
        this.varDeclarationList = [
            new VarDeclaration('obj', this.className, `new ${this.className}()`)
        ];
    }

    generate(generateMethodTests = true) {
        return this.generateCompleteTest([], [], [], generateMethodTests);
    }
}

export { ComponentTestGenerator, ServiceTestGenerator, PipeTestGenerator, GuardTestGenerator, ClassTestGenerator, DirectiveTestGenerator };