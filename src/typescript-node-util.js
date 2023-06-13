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

        this.nodeList.forEach(node => {
            node.getAllChildren = () => this.nodeList.filter(n => node.pos <= n.pos && node.end >= n.end && n.indentLevel > node.indentLevel);
            node.hasChild = (kind) => node.getAllChildren().filter(ch => kind == undefined || ch.kind == kind).length > 0;
            let possibleParent = this.nodeList.filter(n => n.pos <= node.pos && n.indentLevel == node.indentLevel - 1);
            node.getFirstParent = () => possibleParent[possibleParent.length - 1];
            let siblings = this.nodeList.filter(n => n.indentLevel == node.indentLevel && n.pos != node.pos);
            node.getPreviousSiblings = () => siblings.filter(n => n.pos < node.pos)
            node.getNextSiblings = () => siblings.filter(n => n.end > node.end)
        });

        // this.printNode(this.nodeList[0]);
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

    getFirstAncestor(node, ancestorKind, minIndentLevel = 0) {
        let currentNode = node.getFirstParent();
        while(currentNode && currentNode.indentLevel >= minIndentLevel && currentNode.kind != ancestorKind) {
            currentNode = currentNode.getFirstParent();
        }
        
        return currentNode.kind == ancestorKind ? currentNode : undefined;
    }

    getIdentifiers(node) {
        let validIds = [typescript.SyntaxKind.ThisKeyword, typescript.SyntaxKind.Identifier];
        return node?.getAllChildren().filter(ch => validIds.indexOf(ch.kind) >= 0).map(ch => ch.getText(this.sourceFile));
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
        let firstChildren = classDeclaration.getAllChildren().filter(n => n.indentLevel == classDeclaration.indentLevel + 1);
        let normalMethods = firstChildren.filter(n => n.kind == typescript.SyntaxKind.MethodDeclaration);
        let arrowMethods = firstChildren.filter(n => n.kind == typescript.SyntaxKind.PropertyDeclaration).filter(prop => {
            return prop.getAllChildren().find(n => n.indentLevel == prop.indentLevel + 1 && n.kind == typescript.SyntaxKind.ArrowFunction) != undefined;
        });
        let accessors = firstChildren.filter(n => n.kind == typescript.SyntaxKind.GetAccessor || n.kind == typescript.SyntaxKind.SetAccessor);
        return [...normalMethods, ...arrowMethods, ...accessors].sort((a, b) => (a.pos > b.pos) ? 1 : -1);
    }

    getMethodId(method) {
        return method.getAllChildren().find(ch => ch.indentLevel == method.indentLevel + 1 && ch.kind == typescript.SyntaxKind.Identifier).getText(this.sourceFile);
    }

    // this.var = 'some value'
    getAssignments(parentNode, variableNames) {
        let assignments = parentNode.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.BinaryExpression)
            .filter(be => be.hasChild(typescript.SyntaxKind.FirstAssignment))
            .map(binExpr => {
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
                let ids = injectDec.getAllChildren().filter(ch => ch.indentLevel == injectDec.indentLevel + 2);
                let idInsideDec = ids[ids.length - 1].getText(this.sourceFile);
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
        let validCallStarts = ['this', ...extraValidCalls, ...CONFIG.includeCalls].map(c => c + '.');
        let callText = callExpression.getText(this.sourceFile);
        return validCallStarts.some(start => callText.startsWith(start));
    }

    parseCallExpression(callExpression, extraValidCalls) {
        let queue = new Queue();
        let callStack = [callExpression];

        let firstAccess = callExpression.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.PropertyAccessExpression);
        queue.enqueue(firstAccess);

        while (!queue.isEmpty()) {
            let innerCall = queue.dequeue()?.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.CallExpression);

            if (innerCall != null) {
                queue.enqueue(innerCall);
                callStack.push(innerCall);
            }
        }

        let lastNode = callStack[callStack.length - 1];
        let parentNode = callStack[callStack.length - 2];

        if (!this.isValidCallExpression(lastNode, extraValidCalls)) {
            return { validCall: false };
        }

        let propertyAccessExpr = lastNode.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.PropertyAccessExpression);

        let propertyAccessIds = this.getIdentifiers(propertyAccessExpr);
        let lastCallIds = this.getIdentifiers(lastNode);
        let parentCallIds = this.getIdentifiers(parentNode);

        let nextKeyword = parentNode && parentCallIds[lastCallIds.length];

        let fun = propertyAccessIds[propertyAccessIds.length - 1];

        let propertyAccess = propertyAccessIds.slice(0, -1).join('.');
        let isPropertyAccessSubscribe = fun == 'subscribe';
        let isCallExpressionSubscribe = nextKeyword == 'subscribe';
        let isSubscription = isPropertyAccessSubscribe || isCallExpressionSubscribe;
        return { propertyAccess, fun, funCall: propertyAccess + '.' + fun, isSubscription, isCallExpressionSubscribe, isPropertyAccessSubscribe, validCall: true };
    }

    hasValidReturnStatement(methodNode) {
        // invalid: return;
        // valid: return something;
        let returnStatementsWithChildren = methodNode.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.ReturnStatement)
            .filter(statement => statement.hasChild()).filter(ret => this.getFirstAncestor(ret, typescript.SyntaxKind.CallExpression, 2) == undefined);

        return returnStatementsWithChildren.length > 0;
    }

    getMethodParmInitValues(node) {
        let fun = node;
        if (node.kind == typescript.SyntaxKind.PropertyDeclaration) {
            // special case: arrow methods have params as part of the arrow function
            fun = node.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.ArrowFunction)
        }

        return fun.getAllChildren()
            .filter(ch => ch.kind == typescript.SyntaxKind.Parameter && ch.indentLevel == fun.indentLevel + 1)
            .map(param => {
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

        parsedCalls = parsedCalls.filter(pc => CONFIG.ignoreFunctions.indexOf(pc.fun) < 0);

        return this.uniqueByKeepFirst(parsedCalls, 'funCall');
    }
}