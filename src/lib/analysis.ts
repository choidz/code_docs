import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

// --- 키워드 분석 로직 (기존과 동일) ---
export const parseKeywords = (keywordString: string): string[] => {
    return keywordString.split(',').map(k => k.trim()).filter(Boolean);
};

export const extractCodeBlock = (allLines: string[], keywordLineIndex: number): { block: string; start: number; end: number } | null => {
    let blockStartLine = -1, blockEndLine = -1;
    for (let i = keywordLineIndex; i >= 0; i--) { if (allLines[i].includes('{')) { let s = i; while (s > 0) { const p = allLines[s - 1].trim(); if (p === '' || p.endsWith(';') || p.endsWith('}') || p.endsWith('{')) break; s--; } blockStartLine = s; break; } }
    if (blockStartLine === -1) return null;
    let braceCount = 0;
    for (let i = blockStartLine; i < allLines.length; i++) { for (const char of allLines[i]) { if (char === '{') braceCount++; else if (char === '}') braceCount--; } if (braceCount === 0) { blockEndLine = i; break; } }
    if (blockEndLine === -1) return null;
    return { block: allLines.slice(blockStartLine, blockEndLine + 1).join('\n'), start: blockStartLine + 1, end: blockEndLine + 1 };
};

export const runKeywordAnalysis = (content: string, keywordArray: string[], shouldExtractBlocks: boolean): string => {
    const lines = content.split('\n'); let findings = ''; const processedBlockRanges: { start: number, end: number }[] = [];
    lines.forEach((line, index) => {
        if (processedBlockRanges.some(range => index >= range.start && index <= range.end)) return;

        // [수정] 검색을 위해 현재 라인을 소문자로 변환합니다.
        const lowerCaseLine = line.toLowerCase();

        for (const keyword of keywordArray) {
            // [수정] 키워드도 소문자로 변환하여 대소문자 구분 없이 비교합니다.
            if (lowerCaseLine.includes(keyword.toLowerCase())) {
                if (shouldExtractBlocks) {
                    const blockResult = extractCodeBlock(lines, index);
                    if (blockResult) {
                        findings += `\n---\n**[블록] 키워드 \`${keyword}\` 발견 (Line ${index + 1})**\n\`\`\`\n${blockResult.block}\n\`\`\`\n`;
                        processedBlockRanges.push({ start: blockResult.start - 1, end: blockResult.end - 1 });
                        return; // 다음 라인으로 넘어갑니다.
                    }
                }
                // 결과에는 원본 라인을 보여줍니다.
                findings += `- **[라인] 키워드 \`${keyword}\` 발견 (Line ${index + 1})**: \`${line.trim()}\`\n`;
                return; // 다음 라인으로 넘어갑니다.
            }
        }
    });
    return findings;
};


// --- 의존성 분석 로직 (수정됨) ---

/**
 * [수정됨] 다양한 형태의 함수 선언에서 이름을 추출하는 더 안정적인 함수입니다.
 */
export const getFunctionName = (path: NodePath<t.Function>): string | null => {
    const node = path.node;
    if (t.isFunctionDeclaration(node) && node.id) {
        return node.id.name;
    }
    if ((t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) && t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
        return path.parent.id.name;
    }
    if (t.isClassMethod(node) && t.isIdentifier(node.key)) {
        return node.key.name;
    }
    return null;
};

/**
 * [수정됨] 객체 메서드 호출(예: obj.method()) 등 더 복잡한 호출을 처리하도록 개선되었습니다.
 */
export const runDependencyAnalysis = (code: string, targetFuncName: string) => {
    const findings = { target: null as string | null, dependencies: [] as { name: string, content: string }[] };
    try {
        const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true });
        const calledFunctionNames = new Set<string>();

        // 1. 타겟 함수를 찾고, 그 안에서 호출되는 모든 함수의 이름을 수집합니다.
        traverse(ast, {
            Function(path) {
                if (getFunctionName(path) === targetFuncName) {
                    if (path.node.start != null && path.node.end != null) {
                        findings.target = code.slice(path.node.start, path.node.end);
                    }
                    // 타겟 함수 내부를 다시 순회하여 호출 표현식을 찾습니다.
                    path.traverse({
                        CallExpression(callPath) {
                            const callee = callPath.node.callee;
                            // case 1: myFunction()
                            if (t.isIdentifier(callee)) {
                                calledFunctionNames.add(callee.name);
                            }
                            // case 2: obj.myFunction()
                            else if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
                                calledFunctionNames.add(callee.property.name);
                            }
                        }
                    });
                }
            }
        });

        // 2. 타겟 함수를 찾은 경우에만, 수집된 함수 이름에 해당하는 실제 함수 코드를 찾습니다.
        if (findings.target) {
            traverse(ast, {
                Function(path) {
                    const funcName = getFunctionName(path);
                    if (funcName && calledFunctionNames.has(funcName) && path.node.start != null && path.node.end != null) {
                        // 중복 추가 방지
                        if (!findings.dependencies.some(dep => dep.name === funcName)) {
                            findings.dependencies.push({ name: funcName, content: code.slice(path.node.start, path.node.end) });
                        }
                    }
                }
            });
        }
    } catch (e) {
        console.error("AST 분석 오류:", e);
        return null; // 오류 발생 시 null 반환
    }
    return findings;
};
