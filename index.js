import path from 'path';
import { ComponentTestGenerator, ServiceTestGenerator } from "./src/test-generator.js";
import TypescriptNodeUtil from "./src/typescript-node-util.js";
import FILE_TYPES from './src/models/ng-file-type.js';
import ERROR_CODES from './src/models/errors.js';

const args = process.argv;

let filePath = args.length > 2 ? args[2] : '';

let basename = path.basename(filePath);
const fileType = Object.keys(FILE_TYPES).find(key => basename.endsWith(FILE_TYPES[key].fileExt));
if(fileType == undefined) {
    throw ERROR_CODES.INVALID_FILE.toString();
}

let nodeUtil = new TypescriptNodeUtil(filePath);

let testGenerator = undefined;
switch (fileType) {
    case 'COMPONENT':
        testGenerator = new ComponentTestGenerator(nodeUtil);
        break;
    case 'SERVICE':
        testGenerator = new ServiceTestGenerator(nodeUtil);
    default:
        throw ERROR_CODES.INVALID_FILE.toString();
        break;
}

testGenerator.getText();