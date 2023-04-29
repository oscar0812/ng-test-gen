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
            node.getAllChildren = () => this.nodeList.filter(n => node.pos <= n.pos && node.end >= n.end);
            node.getFirstParent = () => this.nodeList.findLast(n => n.pos <= node.pos && n.indentLevel == node.indentLevel - 1);
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

    getDecoratorWithIdentifier(node, identifier) {
        return node.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.Decorator).find(dec => {
            return dec.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.Identifier && ch.getText(this.sourceFile) == identifier) != undefined;
        });
    }

    getMethodDeclarations(decorator) {
        return decorator.getNextSiblings().filter(n => n.kind == typescript.SyntaxKind.MethodDeclaration);
    }

    // this.var = 'some value'
    getThisAssignments(parentNode) {
        return parentNode.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.BinaryExpression).map(binExpr => {
            let immediateChildren = binExpr.getAllChildren().filter(ch => ch.indentLevel == binExpr.indentLevel + 1);
            let accessExpr = immediateChildren[0];
            let firstAssgn = immediateChildren[1];
            let val = immediateChildren[2];

            let thisKeyword = accessExpr.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.ThisKeyword);

            if (thisKeyword != undefined && firstAssgn.kind == typescript.SyntaxKind.FirstAssignment && val != undefined) {
                return { propertyAccess: accessExpr.getText(this.sourceFile), value: val.getText(this.sourceFile) };
            }
            return undefined;
        }).filter(expr => expr != undefined);
    }

    getConstructorProviders(firstIdentifier) {
        let constructor = firstIdentifier.getNextSiblings().find(n => n.kind == typescript.SyntaxKind.Constructor);

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
            .filter(ch => ch.kind == typescript.SyntaxKind.ThisKeyword)
            .map(tk => tk?.getFirstParent()?.getFirstParent()?.getFirstParent())
            .filter(parent => parent.kind == typescript.SyntaxKind.CallExpression)
            .map(ce => {
                let propertyAccess = ce.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.PropertyAccessExpression && ch.indentLevel == ce.indentLevel + 2).getText(this.sourceFile);
                let methodId = ce.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.Identifier && ch.indentLevel == ce.indentLevel + 2).getText(this.sourceFile);
                return { propertyAccess, methodId };
            });

        let providers = this.getConstructorProviders(firstIdentifier).map(provider => {
            let methodIds = providerMethodCalls.filter(p => p.propertyAccess == `this.${provider.identifier}`).map(p => p.methodId);

            // get only unique calls
            let seen = new Set();
            const uniqueCalls = methodIds.filter(item => {
                const duplicate = seen.has(item);
                seen.add(item);
                return !duplicate;
            });

            provider.methodIds = uniqueCalls;
            return provider
        });

        return providers;
    }

    validateCallExpression(callExpression, localVarDeclarationIds) {
        var queue = new Queue();
        queue.enqueue(callExpression);

        var lastExpr = undefined;
        var hasPropertyAccessExpr = false;

        while (!queue.isEmpty()) {
            lastExpr = queue.dequeue();
            let nextExpr = lastExpr.getAllChildren().find(ch => ch.indentLevel == lastExpr.indentLevel + 1 && ch.kind == typescript.SyntaxKind.PropertyAccessExpression);

            if (nextExpr == undefined) {
                break;
            }
            hasPropertyAccessExpr = true;
            queue.enqueue(nextExpr);
        }

        let id = lastExpr.getAllChildren()[1].getText(this.sourceFile);

        // exclude USER desired calls && local variable calls are out of scope
        return hasPropertyAccessExpr && CONFIG.excludeCalls.indexOf(id) < 0 && localVarDeclarationIds.indexOf(id) < 0;
    }

    parseCallExpression(callExpression, localVarDeclarationIds) {
        let queue = new Queue();

        queue.enqueue(callExpression);
        let isSubscription = false;

        let lastCallExpr = undefined;
        let secondLevelChildren = undefined;
        let innerCallExpression = undefined;
        let fun = undefined;
        while (!queue.isEmpty()) {
            lastCallExpr = queue.dequeue();
            secondLevelChildren = lastCallExpr.getAllChildren().filter(ch => ch.indentLevel == lastCallExpr.indentLevel + 2);

            if (secondLevelChildren.length < 2) {
                return { validCall: false };
            }

            innerCallExpression = lastCallExpr.getAllChildren().find(ch => ch.indentLevel > lastCallExpr.indentLevel && ch.kind == typescript.SyntaxKind.CallExpression);
            fun = secondLevelChildren[1].getText(this.sourceFile);
            isSubscription = isSubscription || fun == 'subscribe';

            if (innerCallExpression != null) {
                queue.enqueue(innerCallExpression);
            }
        }

        if (!this.validateCallExpression(lastCallExpr, localVarDeclarationIds)) {
            return { validCall: false };
        }

        let propertyAccess = secondLevelChildren[0].getText(this.sourceFile);
        let hasParentCallExpr = innerCallExpression != undefined;
        return { propertyAccess, fun, funCall: propertyAccess + '.' + fun, isSubscription, hasParentCallExpr, validCall: true };
    }

    getMethodParmInitValues(methodNode) {
        return methodNode.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.Parameter && ch.indentLevel == methodNode.indentLevel + 1).map(param => {
            let id = param.getAllChildren().find(ch2 => ch2.kind == typescript.SyntaxKind.Identifier);
            return new VarDeclaration(id.getText(this.sourceFile), undefined, {});
        });
    }

    getCallExpressionsInMethod(methodNode) {
        let paramIds = this.getMethodParmInitValues(methodNode).map(p => p.name);

        let localVarDeclarationIds = methodNode.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.VariableDeclaration).map(varDec => {
            // let varDecId = someValue;
            let id = varDec.getAllChildren().find(ch2 => ch2.kind == typescript.SyntaxKind.Identifier);
            return id.getText(this.sourceFile);
        });

        let callExpressions = methodNode.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.CallExpression);
        let parsedCalls = callExpressions.map(callExpression => this.parseCallExpression(callExpression, localVarDeclarationIds)).filter(call => call.validCall);

        if (CONFIG.spyOn.methodParams) {
            parsedCalls.filter(pc => paramIds.indexOf(pc.propertyAccess) >= 0).forEach(call => call.usesMethodParam = true);
        } else {
            // remove any calls (spys) on method params
            parsedCalls = parsedCalls.filter(pc => paramIds.indexOf(pc.propertyAccess) < 0);
        }

        // get only unique calls
        let seen = new Set();
        const uniqueCalls = parsedCalls.filter(item => {
            const duplicate = seen.has(item.funCall);
            seen.add(item.funCall);
            return !duplicate;
        });
        return uniqueCalls;
    }
}