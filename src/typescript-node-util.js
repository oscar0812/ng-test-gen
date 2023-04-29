import fs from 'fs';
import typescript from 'typescript';
import { Queue } from 'datastructures-js';
import ERROR_CODES from './models/errors.js';
import CONFIG from '../config.js';

export default class TypescriptNodeUtil {
    constructor(filePath) {
        this.nodeList = [];
        const source = fs.readFileSync(filePath, 'utf-8');
        this.sourceFile = typescript.createSourceFile(filePath, source, typescript.ScriptTarget.Latest);

        this.traverseAllNodes(this.sourceFile);
        // this.printNode(this.sourceFile);

        this.nodeList.forEach(node => {
            node.getAllChildren = () => this.nodeList.filter(n => node.pos <= n.pos && node.end >= n.end);
            let siblings = this.nodeList.filter(n => n.indentLevel == node.indentLevel && n.pos != node.pos);
            node.getPreviousSiblings = () => siblings.filter(n => n.pos < node.pos)
            node.getNextSiblings = () => siblings.filter(n => n.end > node.end)
        })
    }

    traverseAllNodes(node) {
        node.indentLevel = 0;

        let q = new Queue();
        q.enqueue(node);

        while (!q.isEmpty()) {
            node = q.dequeue();
            this.nodeList.push(node);
            node.forEachChild(child => {
                child.getParent = () => node;
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

    getComponentClassIdentifier() {
        let decorator = this.getDecoratorWithIdentifier(this.sourceFile, 'Component');
        let identifiers = decorator.getNextSiblings().filter(n => n.kind == typescript.SyntaxKind.Identifier);
        if (identifiers.length == 0) {
            throw ERROR_CODES.NO_COMPONENT.toString();
        }
        if (identifiers.length > 1) {
            throw ERROR_CODES.TOO_MANY_COMPONENTS.toString();
        }
        return identifiers[0];
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

        if(constructor == undefined) {
            return [];
        }
        
        let constructorParams = constructor.getAllChildren()
            .filter(ch => ch.indentLevel == constructor.indentLevel + 1 && ch.kind == typescript.SyntaxKind.Parameter);

        return constructorParams.map(param => {
            let injectDec = this.getDecoratorWithIdentifier(param, 'Inject');
            if (injectDec != undefined) {
                let id = injectDec.getAllChildren().filter(ch => ch.indentLevel == injectDec.indentLevel + 2).findLast(_ => true);
                return { provide: id.getText(this.sourceFile), decorator: injectDec }
            } else {
                let typeReference = param.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.TypeReference);
                let id = typeReference.getAllChildren().find(ch => ch.kind == typescript.SyntaxKind.Identifier);
                return { provide: id.getText(this.sourceFile) };
            }
        });
    }

    validateCallExpression(callExpression) {
        var queue = new Queue();
        queue.enqueue(callExpression);

        var lastExpr = undefined;

        while(!queue.isEmpty()) {
            lastExpr = queue.dequeue();
            let nextExpr = lastExpr.getAllChildren().find(ch => ch.indentLevel > lastExpr.indentLevel && ch.kind == typescript.SyntaxKind.PropertyAccessExpression);

            if(nextExpr == undefined) {
                break;
            }
            queue.enqueue(nextExpr);
        }

        let id = lastExpr.getAllChildren()[1].getText(this.sourceFile);
        return CONFIG.excludeCalls.indexOf(id) < 0;
    }

    parseCallExpression(callExpression, previousWasSubscription = false, hasParentCallExpr = false) {
        let secondLevelChildren = callExpression.getAllChildren().filter(ch => ch.indentLevel == callExpression.indentLevel + 2);
        if(secondLevelChildren.length < 2) {
            return { validCall: false };
        }

        let innerCallExpression = callExpression.getAllChildren().find(ch => ch.indentLevel > callExpression.indentLevel && ch.kind == typescript.SyntaxKind.CallExpression);
        let propertyAccess = secondLevelChildren[0].getText(this.sourceFile);
        let fun = secondLevelChildren[1].getText(this.sourceFile);
        let isSubscription = previousWasSubscription || fun == 'subscribe';

        if (innerCallExpression != null) {
            // has inner fun call which returns an observable
            return this.parseCallExpression(innerCallExpression, isSubscription, true);
        }

        if(!this.validateCallExpression(callExpression)) {
            return { validCall: false };
        }

        return { propertyAccess, fun, funCall: propertyAccess + '.' + fun, isSubscription, hasParentCallExpr, validCall: true };
    }

    getCallExpressions(parentNode) {
        let callExpressions = parentNode.getAllChildren().filter(ch => ch.kind == typescript.SyntaxKind.CallExpression);
        let parsedCalls = callExpressions.map(callExpression => this.parseCallExpression(callExpression)).filter(call => call.validCall);

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