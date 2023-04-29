import typescript from 'typescript';

const CONFIG = {
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