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

    generateTests() {
        this.methods.forEach(method => {
            let methodId = method.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.Identifier).getText(this.nodeUtil.sourceFile);
            let data = this.generateSpyOnsAndExpectations(method);

            console.log(`it('should run #${methodId}()', async () => {`);
            data.spyOns.forEach(x => console.log(x));
            console.log(`\n\t${this.type.varName}.${methodId}();\n`)
            data.expectations.forEach(x => console.log(x));
            console.log(`});\n`);
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

    generateInitTemplate(hasFixture = false, imports, declarations, extraProviders) {
        let allProviders = this.providers.concat(extraProviders);

        allProviders.filter(p => p.decorator == undefined && p.mock).forEach(provider => {
            console.log(`@Injectable()`);
            console.log(`class Mock${provider.provide} { }\n`);
        })

        console.log(`describe('${this.className}', () => {`)
        if (hasFixture) {
            console.log(`\tlet fixture: ComponentFixture<${this.className}>;`);
        }
        console.log(`\tlet ${this.type.varName};\n`)
        console.log('\tTestBed.configureTestingModule({');
        console.log(`\t\timports: [${imports.join(', ')}],`);
        console.log(`\t\tdeclarations: [${declarations.join(', ')}],`);
        console.log(`\t\tschemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],`);
        let providerStrings = allProviders.map(p => this.generateProvider(p));
        console.log(`\t\tproviders:[\n${providerStrings.join(',\n')}\n]`);
        console.log(`\t}).overrideComponent(${this.className}, {}).compileComponents();`)
    }
}

class ComponentTestGenerator extends TestGenerator {
    constructor(nodeUtil) {
        super(nodeUtil, FILE_TYPES.COMPONENT);
    }

    getText() {
        this.generateInitTemplate(true,
            ['FormsModule', 'ReactiveFormsModule'],
            [this.className],
            []);
        this.generateTests();
        console.log(`});`)
    }
}

class ServiceTestGenerator extends TestGenerator {

}

export { ComponentTestGenerator, ServiceTestGenerator };