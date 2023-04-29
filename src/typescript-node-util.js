import fs from 'fs';
import typescript from 'typescript';
import { Queue } from 'datastructures-js';
import CONFIG from '../config.js';
import VarDeclaration from './models/var-declaration.js';
import { Provider } from './models/provider.js';

export default class TypescriptNodeUtil {
    constructor(filePath) {
        this.nodeList = [];
        const source = fs.readFileSync(filePath, 'utf-8');
        this.sourceFile = typescript.createSourceFile(filePath, source, typescript.ScriptTarget.Latest);

        this.traverseAllNodes(this.sourceFile);
        this.nodeList.sort((a, b) => a.pos - b.pos);
        // this.printNode(this.sourceFile);

        this.nodeList.forEach(node => {
            node.getAllChildren = () => this.nodeList.filter(n => node.pos <= n.pos && node.end >= n.end && n.indentLevel > node.indentLevel);
            node.hasChild = (kind) => node.getAllChildren().filter(ch => kind == undefined || ch.kind == kind).length > 0;
            let possibleParent = this.nodeList.filter(n => n.pos <= node.pos && n.indentLevel == node.indentLevel - 1);
            node.getFirstParent = () => possibleParent[possibleParent.length - 1];
            let siblings = this.nodeList.filter(n => n.indentLevel == node.indentLevel && n.pos != node.pos);
            node.getPreviousSiblings = () => siblings.filter(n => n.pos < node.pos)
            node.getNextSiblings = () => siblings.filter(n => n.end > node.end)
        });
    }

    traverseAllNodes(node) {
        node.indentLevel = 0;

        let q = new Queue();
        q.enqueue(node);

        while (!q.isEmpty()) {
            node = q.dequeue();
            this.nodeList.push(node);
            node.forEachChild(child => {
                child.indentLevel = node.indentLevel + 1;
                q.enqueue(child);
            })
        }
    }

    printNode(node) {
        console.log(`${node.indentLevel}${"-".repeat(node.indentLevel)}(${node.kind})${typescript.SyntaxKind[node.kind]}: ${node.getText(this.sourceFile)}`)

        node.forEachChild(child => {
            child.getParent = () => node;
            this.printNode(child);
        })
    }

    uniqueByKeepFirst(data, key) {
        let seen = new Set();
        const uniqueCalls = data.filter(item => {
            const duplicate = seen.has(item[key]);
            seen.add(item[key]);
            return !duplicate;
        });

        return uniqueCalls;
    }

    getDecoratorWithIdentifier(node, identifier) {
        return node.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.Decorator).find(dec => {
            return dec.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.Identifier && ch.getText(this.sourceFile) == identifier) != undefined;
        });
    }

    getClassDeclaration() {
        return this.sourceFile.getAllChildren().find(n => n.kind == typescript.SyntaxKind.ClassDeclaration);
    }

    getClassId(classDeclaration) {
        return classDeclaration.getAllChildren().find(n => n.indentLevel == classDeclaration.indentLevel + 1 && n.kind == typescript.SyntaxKind.Identifier);
    }

    getMethodDeclarations(classDeclaration) {
        this.printNode(classDeclaration)
        return classDeclaration.getAllChildren().filter(n => n.indentLevel == classDeclaration.indentLevel + 1 && n.kind == typescript.SyntaxKind.MethodDeclaration);
    }

    // this.var = 'some value'
    getAssignments(parentNode, variableNames) {
        let assignments = parentNode.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.BinaryExpression)
            .filter(be => be.hasChild(typescript.SyntaxKind.FirstAssignment))
            .map(binExpr => {
                // this.printNode(binExpr)
                let children = binExpr.getAllChildren();
                let varId = children.find(ch => ch.kind == typescript.SyntaxKind.ThisKeyword);
                if (varId == undefined) {
                    let firstId = children.find(ch => ch.kind == typescript.SyntaxKind.Identifier);
                    let isVar = variableNames.some(v => firstId.getText(this.sourceFile).startsWith(v));
                    varId = isVar ? firstId : varId;
                }
                return varId;
            })
            .filter(varId => varId != undefined)
            .map(varId => {
                // bubble up from varId (might have array access and other weird things, so stop at the last propertyAccessExpression)
                let current = varId;
                let parent = current.getFirstParent();
                while (parent.kind == typescript.SyntaxKind.PropertyAccessExpression) {
                    current = parent;
                    parent = current.getFirstParent();
                }
                return { propertyAccess: current.getText(this.sourceFile), isThis: varId.kind == typescript.SyntaxKind.ThisKeyword };
            }).filter(expr => expr != undefined);

        return this.uniqueByKeepFirst(assignments, 'propertyAccess')
    }

    getConstructorProviders(firstIdentifier) {
        let constructor = firstIdentifier.getAllChildren().find(n => n.kind == typescript.SyntaxKind.Constructor);

        if (constructor == undefined) {
            return [];
        }

        let constructorParams = constructor.getAllChildren()
            .filter(ch => ch.indentLevel == constructor.indentLevel + 1 && ch.kind == typescript.SyntaxKind.Parameter);

        return constructorParams.map(param => {
            let injectDec = this.getDecoratorWithIdentifier(param, 'Inject');
            let varId = param.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.Identifier && ch.indentLevel == param.indentLevel + 1).getText(this.sourceFile);
            if (injectDec != undefined) {
                let idInsideDec = injectDec.getAllChildren().filter(ch => ch.indentLevel == injectDec.indentLevel + 2).findLast(_ => true).getText(this.sourceFile);
                return new Provider(idInsideDec, injectDec, varId);
            } else {
                let typeReference = param.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.TypeReference);
                let type = typeReference.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.Identifier).getText(this.sourceFile);
                return new Provider(type, undefined, varId);
            }
        });
    }

    getConstructorProvidersInfo(firstIdentifier) {
        let providerMethodCalls = this.sourceFile.getAllChildren()
            .filter(ch => ch && ch.kind == typescript.SyntaxKind.ThisKeyword)
            .map(tk => tk?.getFirstParent()?.getFirstParent()?.getFirstParent())
            .filter(parent => parent && parent.kind == typescript.SyntaxKind.CallExpression)
            .map(ce => {
                let propertyAccess = ce.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.PropertyAccessExpression && ch.indentLevel == ce.indentLevel + 2).getText(this.sourceFile);
                let methodId = ce.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.Identifier && ch.indentLevel == ce.indentLevel + 2).getText(this.sourceFile);
                return { propertyAccess, methodId };
            });

        let providers = this.getConstructorProviders(firstIdentifier).map(provider => {
            let methods = providerMethodCalls.filter(p => p.propertyAccess == `this.${provider.identifier}`);
            provider.methodIds = this.uniqueByKeepFirst(methods, 'methodId').map(m => m.methodId);
            return provider
        });

        return providers;
    }

    isValidCallExpression(callExpression, extraValidCalls) {
        // ['this.', 'param.', ...]
        let validCallStarts = ['this.', ...extraValidCalls.map(c => { c + '.' }), ...CONFIG.includeCalls.map(c => c + '.')];
        let callText = callExpression.getText(this.sourceFile);
        return validCallStarts.some(start => callText.startsWith(start));
    }

    parseCallExpression(callExpression, extraValidCalls) {
        let queue = new Queue();

        queue.enqueue(callExpression);
        let isSubscription = false;

        let lastCallExpr = undefined;
        let secondLevelChildren = undefined;
        let innerCallExpression = undefined;
        let innerCallCount = 0;
        let fun = undefined;
        while (!queue.isEmpty()) {
            lastCallExpr = queue.dequeue();
            secondLevelChildren = lastCallExpr.getAllChildren().filter(ch => ch.indentLevel == lastCallExpr.indentLevel + 2);

            if (secondLevelChildren.length < 2) {
                return { validCall: false };
            }

            innerCallExpression = lastCallExpr.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.CallExpression);
            fun = secondLevelChildren[1].getText(this.sourceFile);
            isSubscription = isSubscription || fun == 'subscribe';

            if (innerCallExpression != null) {
                queue.enqueue(innerCallExpression);
                innerCallCount++;
            }
        }

        if (!this.isValidCallExpression(lastCallExpr, extraValidCalls)) {
            return { validCall: false };
        }

        let propertyAccess = secondLevelChildren[0].getText(this.sourceFile);
        let isPropertyAccessSubscribe = isSubscription && fun == 'subscribe';
        let isCallExpressionSubscribe = isSubscription && fun != 'subscribe';
        return { propertyAccess, fun, funCall: propertyAccess + '.' + fun, isSubscription, isCallExpressionSubscribe, isPropertyAccessSubscribe, validCall: true };
    }

    hasValidReturnStatement(methodNode) {
        // invalid: return;
        // valid: return something;
        let returnStatementsWithChildren = methodNode.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.ReturnStatement)
            .filter(statement => statement.hasChild());

        return returnStatementsWithChildren.length > 0;
    }

    getMethodParmInitValues(node) {
        return node.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.Parameter && ch.indentLevel == node.indentLevel + 1).map(param => {
            let id = param.getAllChildren().find(ch2 => ch2.kind == typescript.SyntaxKind.Identifier);
            return new VarDeclaration(id.getText(this.sourceFile), undefined, {});
        });
    }

    getCallExpressionsInMethod(methodNode) {
        let paramIds = this.getMethodParmInitValues(methodNode).map(p => p.name);

        let callExpressions = methodNode.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.CallExpression);
        let parsedCalls = callExpressions.map(callExpression => this.parseCallExpression(callExpression, paramIds)).filter(call => call.validCall);

        if (CONFIG.spyOn.methodParams) {
            parsedCalls.filter(pc => paramIds.indexOf(pc.propertyAccess) >= 0).forEach(call => call.usesMethodParam = true);
        } else {
            // remove any calls (spys) on method params
            parsedCalls = parsedCalls.filter(pc => paramIds.indexOf(pc.propertyAccess) < 0);
        }

        return this.uniqueByKeepFirst(parsedCalls, 'funCall');
    }
}