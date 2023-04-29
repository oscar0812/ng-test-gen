import typescript from 'typescript';
import FILE_TYPES from './models/ng-file-type.js';

class TestGenerator {
    constructor(nodeUtil, type) {
        this.nodeUtil = nodeUtil;
        this.type = type;
        this.decorator = nodeUtil.getDecoratorWithIdentifier(nodeUtil.sourceFile, type.decoratorId);
        this.classId = this.decorator.getNextSiblings().find(n => n.kind == typescript.SyntaxKind.Identifier);
        this.className = this.classId.getText(this.nodeUtil.sourceFile);
        this.methods = nodeUtil.getMethodDeclarations(this.decorator);
        this.providers = nodeUtil.getConstructorProviders(this.decorator);
        this.providers.forEach(provider => provider.mock = true);
    }

    generateSpyOnsAndExpectations(method) {
        let callExprs = this.nodeUtil.getCallExpressions(method);
        let spyOns = [];
        let expectations = [];
        callExprs.forEach(callExpr => {
            let access = callExpr.propertyAccess.replace('this.', this.type.varName + '.');
            let funCall = `${access}.${callExpr.fun}`;
            let spyOnText = `\tspyOn(${access}, '${callExpr.fun}')`;
            if (callExpr.isSubscription && !callExpr.hasParentCallExpr) {
                spyOnText = `\t${funCall} = of({})`;
            } else if (callExpr.isSubscription && callExpr.hasParentCallExpr) {
                spyOnText += `.and.returnValue(of({}))`;
            }

            spyOns.push(spyOnText + `;`);
            expectations.push(`\texpect(${funCall}).toHaveBeenWithCalledWith();`);
        });

        let thisAssignments = this.nodeUtil.getThisAssignments(method);
        if (thisAssignments.length > 0 && expectations.length > 0) {
            expectations.push('');
        }
        thisAssignments.forEach(assignment => {
            let access = assignment.propertyAccess.replace('this.', this.type.varName + '.');
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
            this.log(2, `${this.type.varName}.${methodId}();\n`)
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

    generateCompleteTest(hasFixture = false, imports, declarations, extraProviders) {
        let allProviders = this.providers.concat(extraProviders);

        allProviders.filter(p => p.decorator == undefined && p.mock).forEach(provider => {
            this.log(`@Injectable()`);
            this.log(`class Mock${provider.provide} { }\n`);
        })

        this.log(`describe('${this.className}', () => {`)
        if (hasFixture) {
            this.log(1, `let fixture: ComponentFixture<${this.className}>;`);
        }
        this.log(1, `let ${this.type.varName};\n`);
        this.log(1, `beforeEach(async(() => {`);
        this.log(2, `TestBed.configureTestingModule({`);
        this.log(2, `imports: [${imports.join(', ')}],`);
        this.log(2, `declarations: [${declarations.join(', ')}],`);
        this.log(2, `schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],`);
        let providerStrings = allProviders.map(p => this.generateProvider(p));
        this.log(2, `providers:[${providerStrings.join(',\n\t\t\t')}]`);
        this.log(2, `}).overrideComponent(${this.className}, {`);
        this.log();
        this.log(2, `}).compileComponents();`);
        this.log(1, `});`);
        this.log();

        this.generateMethodTests();

        this.log(`});`);
    }
}

class ComponentTestGenerator extends TestGenerator {
    constructor(nodeUtil) {
        super(nodeUtil, FILE_TYPES.COMPONENT);
    }

    generate() {
        this.generateCompleteTest(true,
            ['FormsModule', 'ReactiveFormsModule'],
            [this.className],
            []);
    }
}

class ServiceTestGenerator extends TestGenerator {

}

export { ComponentTestGenerator, ServiceTestGenerator };