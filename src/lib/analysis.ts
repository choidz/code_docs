import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

// --- 타입 정의 ---
// 키워드 분석 결과의 구조를 정의합니다.
export interface KeywordFinding {
    functionName: string;
    foundKeywords: string[];
    content: string;
}

// --- 키워드 분석 로직 (업그레이드됨) ---
export const parseKeywords = (keywordString: string): string[] => {
    return keywordString.split(',').map(k => k.trim()).filter(Boolean);
};

/**
 * [신규] AST 기반의 지능형 키워드 분석 함수입니다.
 * 어떤 함수 내에서 어떤 키워드가 발견되었는지 구조적인 데이터를 반환합니다.
 */
export const runAdvancedKeywordAnalysis = (code: string, keywordArray: string[]): KeywordFinding[] => {
    const findings: KeywordFinding[] = [];
    const lowerCaseKeywords = keywordArray.map(k => k.toLowerCase());

    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
            errorRecovery: true
        });

        traverse(ast, {
            Function(path) {
                const functionName = getFunctionName(path);
                if (!functionName) return; // 이름 없는 함수는 건너뜁니다.

                const functionContent = code.slice(path.node.start!, path.node.end!);
                const lowerCaseContent = functionContent.toLowerCase();
                const foundKeywords = new Set<string>();

                lowerCaseKeywords.forEach((keyword, index) => {
                    if (lowerCaseContent.includes(keyword)) {
                        // 사용자가 입력한 원본 키워드를 저장합니다.
                        foundKeywords.add(keywordArray[index]);
                    }
                });

                if (foundKeywords.size > 0) {
                    // 이미 분석된 함수인지 확인 (중복 방지)
                    if (!findings.some(f => f.functionName === functionName)) {
                        findings.push({
                            functionName: functionName,
                            foundKeywords: Array.from(foundKeywords),
                            content: functionContent
                        });
                    }
                }
            }
        });
    } catch (e) {
        console.error("AST 기반 키워드 분석 오류:", e);
    }
    return findings;
};


// --- 의존성 분석 로직 (수정됨) ---

/**
 * 다양한 형태의 함수 선언에서 이름을 추출하는 더 안정적인 함수입니다.
 */
export const getFunctionName = (path: NodePath<t.Function>): string | null => {
    const node = path.node;
    // case 1: function myFunction() {}
    if (t.isFunctionDeclaration(node) && node.id) {
        return node.id.name;
    }
    // case 2: const myFunction = () => {}
    if ((t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) && t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
        return path.parent.id.name;
    }
    // case 3: class MyClass { myFunction() {} }
    if (t.isClassMethod(node) && t.isIdentifier(node.key)) {
        return node.key.name;
    }
    // case 4 (추가): myFunc: function() {}  <-- ExtJS 스타일!
    if (t.isFunctionExpression(node) && t.isObjectProperty(path.parent) && t.isIdentifier(path.parent.key)) {
        return path.parent.key.name;
    }
    return null;
};

/**
 * 객체 메서드 호출(예: obj.method()) 등 더 복잡한 호출을 처리하도록 개선되었습니다.
 */
export const runDependencyAnalysis = (code: string, targetFuncName: string) => {
    const findings = { target: null as string | null, dependencies: [] as { name: string, content: string }[] };
    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
            errorRecovery: true
        });
        const calledFunctionNames = new Set<string>();

        traverse(ast, {
            Function(path) {
                if (getFunctionName(path) === targetFuncName) {
                    if (path.node.start != null && path.node.end != null) {
                        findings.target = code.slice(path.node.start, path.node.end);
                    }
                    path.traverse({
                        CallExpression(callPath) {
                            const callee = callPath.node.callee;
                            if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
                                calledFunctionNames.add(callee.property.name);
                            }
                            else if (t.isIdentifier(callee)) {
                                calledFunctionNames.add(callee.name);
                            }
                        }
                    });
                }
            }
        });

        if (findings.target) {
            traverse(ast, {
                Function(path) {
                    const funcName = getFunctionName(path);
                    if (funcName && calledFunctionNames.has(funcName) && path.node.start != null && path.node.end != null) {
                        if (!findings.dependencies.some(dep => dep.name === funcName)) {
                            findings.dependencies.push({ name: funcName, content: code.slice(path.node.start, path.node.end) });
                        }
                    }
                }
            });
        }
    } catch (e) {
        console.error("AST 분석 오류:", e);
        return null;
    }
    return findings;
};