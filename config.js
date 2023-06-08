import typescript from 'typescript';

const CONFIG = {
    encapsulateTestsInDescribe: true,
    includeCalls: ['sessionStorage'],
    spyOn: {
        methodParams: true,
        methodCalls: true
    },
    format: {
        indentWith: '  '
    },
    ignoreKind: [typescript.SyntaxKind.QuestionDotToken],
    ignoreFunctions: ['filter', 'map', 'forEach']
};

export default CONFIG;