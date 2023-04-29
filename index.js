import TypescriptNodeUtil from "./typescript-node-util.js";
const args = process.argv;

let file_path = args.length > 2 ? args[2] : '';

let nodeUtil = new TypescriptNodeUtil(file_path);
let methods = nodeUtil.getMethodDeclarations();
console.log(nodeUtil.getThisAssignments(methods[0]))