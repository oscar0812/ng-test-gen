import ComponentTestGenerator from "./src/test-generator.js";
import TypescriptNodeUtil from "./src/typescript-node-util.js";
const args = process.argv;

let file_path = args.length > 2 ? args[2] : '';

let nodeUtil = new TypescriptNodeUtil(file_path);
let testGenerator = new ComponentTestGenerator(nodeUtil);
testGenerator.getText();