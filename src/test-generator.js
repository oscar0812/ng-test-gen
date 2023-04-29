import typescript from 'typescript';
import FILE_TYPES from './models/ng-file-type.js';

class TestGenerator {
    constructor(nodeUtil, type) {
        this.nodeUtil = nodeUtil;
        this.type = type;
        this.decorator = nodeUtil.getDecoratorWithIdentifier(nodeUtil.sourceFile, type.decoratorId);
        this.methods = nodeUtil.getMethodDeclarations(this.decorator);
        this.providers = nodeUtil.getConstructorProviders(this.decorator);
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
        if(thisAssignments.length > 0 && expectations.length > 0) {
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
}

class ComponentTestGenerator extends TestGenerator {
    constructor(nodeUtil) {
        super(nodeUtil, FILE_TYPES.COMPONENT);
    }

    getText() {
        this.generateTests();
    }
}

export default ComponentTestGenerator;