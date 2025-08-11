import React, { useState } from 'react';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { AstFunction } from '../types';
import Section from './ui/Section';
import FormField from './ui/FormField';

/**
 * AST 기반 분석기능 전체를 담당하는 컴포넌트
 */
const AstAnalyzer = () => {
    const [jsCode, setJsCode] = useState<string>('public void onShow() {\n  var me = this;\n  cboFactory.setValue(gFactoryCode);\n}');
    const [astFunctions, setAstFunctions] = useState<AstFunction[]>([]);

    const [isAiEnabled, setIsAiEnabled] = useState<boolean>(false);
    const [analysisLang, setAnalysisLang] = useState<'js' | 'csharp'>('js');

    const getExplanationFromGemini = async (codeSnippet: string): Promise<string> => {
        const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
        const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
        const prompt = `다음 코드의 기능을 한국어로 간결하게 설명해줘:\n\n\`\`\`${analysisLang === 'js' ? 'javascript' : 'csharp'}\n${codeSnippet}\n\`\`\``;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey!,
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                // 429 오류에 대한 사용자 친화적인 메시지 추가
                if (response.status === 429) {
                    return 'API 요청 빈도 제한에 도달했습니다. 잠시 후 다시 시도해주세요.';
                }
                return `API 오류: ${errorData.error?.message || '알 수 없는 오류'}`;
            }

            const data = await response.json();
            return data.candidates[0]?.content?.parts[0]?.text || '분석 결과를 가져올 수 없습니다.';
        } catch (error) {
            console.error('API 요청 실패:', error);
            return 'API 요청에 실패했습니다. 네트워크나 API 키를 확인해주세요.';
        }
    };

    const handleAnalysis = async () => {
        if (!jsCode.trim()) {
            setAstFunctions([]);
            return;
        }
        if (isAiEnabled && !process.env.REACT_APP_GEMINI_API_KEY) {
            alert('AI 분석을 활성화하려면 .env 파일에 REACT_APP_GEMINI_API_KEY를 설정해야 합니다.');
            return;
        }

        let extractedFuncs: Omit<AstFunction, 'explanation' | 'isLoading'>[] = [];

        if (analysisLang === 'js') {
            try {
                const codeToParse = `const tempObject = { ${jsCode} };`;
                const ast = parser.parse(codeToParse, { sourceType: "module", plugins: ["jsx", "typescript"], errorRecovery: true });

                const visitor = {
                    FunctionDeclaration(path: any) {
                        const start = path.node.start!; const end = path.node.end!;
                        extractedFuncs.push({ code: codeToParse.substring(start, end) });
                    },
                    VariableDeclarator(path: any) {
                        if (path.node.init?.type === 'ArrowFunctionExpression' || path.node.init?.type === 'FunctionExpression') {
                            const start = path.parentPath.node.start!; const end = path.parentPath.node.end!;
                            extractedFuncs.push({ code: codeToParse.substring(start, end) });
                        }
                    },
                    ObjectMethod(path: any) {
                        const start = path.node.start!; const end = path.node.end!;
                        extractedFuncs.push({ code: codeToParse.substring(start, end) });
                    },
                    ObjectProperty(path: any) {
                        if (path.node.value.type === 'FunctionExpression') {
                            const start = path.node.start!; const end = path.node.end!;
                            extractedFuncs.push({ code: codeToParse.substring(start, end) });
                        }
                    }
                };
                // @ts-ignore
                traverse(ast, visitor);
                // 래퍼(`const tempObject = { ... };`)를 제외한 순수 함수/메서드만 필터링합니다.
                // visitor에서 tempObject 자체도 VariableDeclarator로 잡히기 때문에 이를 제외합니다.
                if (extractedFuncs.length > 0 && extractedFuncs[0].code.startsWith('const tempObject')) {
                    extractedFuncs.shift();
                }

            } catch (error) {
                console.error("JS 코드 분석 중 오류:", error);
                alert("JavaScript/TypeScript 코드 분석 중 오류가 발생했습니다. 코드 형식을 확인해주세요.");
                setAstFunctions([]);
                return;
            }
        } else {
            // C#용 정규표현식 기반 분석
            const csharpRegex = /((public|private|protected|internal)\s+)?(static\s+)?\w+\s+\w+\s*\(.*?\)\s*\{[\s\S]*?\}/g;
            const matches = jsCode.match(csharpRegex);
            if (matches) {
                extractedFuncs = matches.map(match => ({ code: match }));
            }
        }

        if (extractedFuncs.length === 0) {
            setAstFunctions([]);
            alert('코드에서 함수나 메서드를 찾을 수 없습니다.');
            return;
        }

        if (!isAiEnabled) {
            setAstFunctions(extractedFuncs.map(f => ({ ...f, explanation: '', isLoading: false })));
            return;
        }

        // [수정] 모든 요청을 한 번에 보내는 대신, 순차적으로 처리합니다.
        const functionsWithLoading = extractedFuncs.map(f => ({ ...f, explanation: '', isLoading: true }));
        setAstFunctions(functionsWithLoading);

        const finalFunctions: AstFunction[] = [];
        for (let i = 0; i < extractedFuncs.length; i++) {
            const func = extractedFuncs[i];
            const explanation = await getExplanationFromGemini(func.code);

            // 현재까지 분석된 결과와 새로 분석된 결과를 합쳐서 state를 업데이트합니다.
            const updatedFunc = { ...func, explanation, isLoading: false };
            finalFunctions.push(updatedFunc);

            // UI에 점진적으로 결과를 표시하기 위해 매번 state를 업데이트합니다.
            setAstFunctions(prev => {
                const newFunctions = [...prev];
                newFunctions[i] = updatedFunc;
                return newFunctions;
            });

            // API 속도 제한을 준수하기 위해 요청 사이에 1.1초의 지연을 줍니다. (60 RPM / 60초 = 1초/요청)
            if (i < extractedFuncs.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1100));
            }
        }
    };

    return (
        <Section title="🔮 AI 구조적 분석">
            <FormField label="분석할 언어 선택">
                <select value={analysisLang} onChange={(e) => setAnalysisLang(e.target.value as 'js' | 'csharp')} className="language-select">
                    <option value="js">JS / TS / ExtJS (AST 분석)</option>
                    <option value="csharp">C# (패턴 기반 분석)</option>
                </select>
            </FormField>

            <FormField label="AI 분석 활성화">
                <div className="ai-toggle-container">
                    <div className="toggle-switch">
                        <input
                            id="ai-toggle"
                            type="checkbox"
                            checked={isAiEnabled}
                            onChange={(e) => setIsAiEnabled(e.target.checked)}
                        />
                        <label htmlFor="ai-toggle" className="slider"></label>
                    </div>
                    <label htmlFor="ai-toggle" className="toggle-label">추출된 모든 함수에 대해 AI 기능 분석 실행</label>
                </div>
            </FormField>

            <FormField label="소스 코드" htmlFor="ast-code-input">
                <textarea id="ast-code-input" value={jsCode} onChange={(e) => setJsCode(e.target.value)} rows={12} />
                <button onClick={handleAnalysis} className="add-button" style={{ backgroundColor: '#f0db4f', color: '#323330' }}>
                    {isAiEnabled ? '함수 분리 및 AI 분석 실행' : '함수/메서드 분리하기'}
                </button>
            </FormField>

            {astFunctions.length > 0 && (
                <div className="extracted-list" style={{ marginTop: '20px' }}>
                    <h2>분리된 항목 ({astFunctions.length}개)</h2>
                    {astFunctions.map((func, index) => (
                        <div key={index} className="extracted-item">
                            <pre className="code-preview">{func.code}</pre>
                            {func.isLoading ? (
                                <div className="ai-result loading">AI 분석 중...</div>
                            ) : (
                                func.explanation && <div className="ai-result">{func.explanation}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
};

export default AstAnalyzer;
