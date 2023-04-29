import fs from 'fs';
import typescript from 'typescript';

export default class TypescriptNodeUtil {
    constructor(file_path) {
        this.nodeList = [];
        this.nodeMap = [];
        const source = fs.readFileSync(file_path, 'utf-8');
        this.sourceFile = typescript.createSourceFile(file_path, source, typescript.ScriptTarget.Latest);

        this.getNodesRecursively(this.sourceFile, 0, this.sourceFile, true, true);

        this.nodeList.forEach(node => {
            node.getAllChildren = () => this.nodeList.filter(n => node.pos <= n.pos && node.end > n.end);
        })
    }

    getNodesRecursively(node, indentLevel, sourceFile, appendNode = true, printNode = true) {
        node.indentLevel = indentLevel;
        
        const key = node.kind;
    
        if(appendNode) {
            this.nodeList.push(node);
            if(!(key in this.nodeMap)) {
                this.nodeMap[key] = [];
            }
            this.nodeMap[key].push(node);
        }

        if(printNode) {
            console.log(`${"-".repeat(node.indentLevel)}(${node.kind})${typescript.SyntaxKind[node.kind]}: ${node.getText(this.sourceFile)}`)
        }
        
        node.forEachChild(child => {
            child.getParent= () => node;
            this.getNodesRecursively(child, indentLevel + 1, sourceFile, appendNode, printNode)
        })
    }
}