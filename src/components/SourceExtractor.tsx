import React, { useState } from 'react';
import JSZip from 'jszip';
import Section from './ui/Section';
import FormField from './ui/FormField';
// 1. AST 분석을 위한 라이브러리 import
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * 키워드 또는 의존성 기반으로 소스 코드를 분석하고 추출하는 도구
 */
const SourceExtractor = () => {
    // --- 상태 관리(State Management) ---
    const [keywords, setKeywords] = useState<string>('private void, EXEC, SELECT');
    const [pastedCode, setPastedCode] = useState<string>('');
    const [extractionResult, setExtractionResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // 분석 모드 및 옵션 상태
    const [analysisMode, setAnalysisMode] = useState<'keyword' | 'dependency'>('keyword');
    const [shouldExtractBlocks, setShouldExtractBlocks] = useState<boolean>(true);
    const [targetFunction, setTargetFunction] = useState<string>('');

    // --- 키워드 분석 로직 ---
    const parseKeywords = (keywordString: string): string[] => {
        return keywordString.split(',').map(k => k.trim()).filter(Boolean);
    };

    const extractCodeBlock = (allLines: string[], keywordLineIndex: number): { block: string; start: number; end: number } | null => {
        let blockStartLine = -1, blockEndLine = -1;
        for (let i = keywordLineIndex; i >= 0; i--) { if (allLines[i].includes('{')) { let s = i; while (s > 0) { const p = allLines[s - 1].trim(); if (p === '' || p.endsWith(';') || p.endsWith('}') || p.endsWith('{')) break; s--; } blockStartLine = s; break; } }
        if (blockStartLine === -1) return null;
        let braceCount = 0;
        for (let i = blockStartLine; i < allLines.length; i++) { for (const char of allLines[i]) { if (char === '{') braceCount++; else if (char === '}') braceCount--; } if (braceCount === 0) { blockEndLine = i; break; } }
        if (blockEndLine === -1) return null;
        return { block: allLines.slice(blockStartLine, blockEndLine + 1).join('\n'), start: blockStartLine + 1, end: blockEndLine + 1 };
    };

    const runKeywordAnalysis = (content: string, keywordArray: string[]): string => {
        const lines = content.split('\n'); let findings = ''; const processedBlockRanges: { start: number, end: number }[] = [];
        lines.forEach((line, index) => {
            if (processedBlockRanges.some(range => index >= range.start && index <= range.end)) return;
            for (const keyword of keywordArray) {
                if (line.includes(keyword)) {
                    if (shouldExtractBlocks) {
                        const blockResult = extractCodeBlock(lines, index); if (blockResult) {
                            findings += `\n---\n**[블록] 키워드 \`${keyword}\` 발견 (Line ${index + 1} / Block ${blockResult.start}-${blockResult.end})**\n`;
                            findings += `\`\`\`javascript\n${blockResult.block}\n\`\`\`\n`; // 언어 힌트 추가
                            processedBlockRanges.push({ start: blockResult.start - 1, end: blockResult.end - 1 }); return;
                        }
                    }
                    findings += `- **[라인] 키워드 \`${keyword}\` 발견 (Line ${index + 1})**: \`${line.trim()}\`\n`; return;
                }
            }
        }); return findings;
    };

    // --- 2. 의존성 분석 로직 (모든 함수 타입 지원으로 개선됨) ---
    const runDependencyAnalysis = (code: string, targetFuncName: string) => {
        const findings = { target: null as string | null, dependencies: [] as { name: string, content: string }[] };
        try {
            const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true });
            const calledFunctionNames = new Set<string>();

            // 헬퍼: 다양한 함수 노드에서 이름을 안전하게 추출하는 함수
            const getFunctionName = (path: any): string | null => {
                if (path.node.type === 'FunctionDeclaration' && path.node.id) {
                    return path.node.id.name;
                }
                if (path.node.type === 'FunctionExpression' || path.node.type === 'ArrowFunctionExpression') {
                    if (path.parent.type === 'VariableDeclarator' && 'name' in path.parent.id) {
                        return path.parent.id.name;
                    }
                }
                if (path.node.type === 'ClassMethod' && 'name' in path.node.key) {
                    return path.node.key.name;
                }
                return null;
            };

            // 1단계: 타겟 함수 찾기 (모든 함수 타입 대상)
            traverse(ast, {
                Function(path) { // 'FunctionDeclaration' 대신 'Function'을 사용
                    if (getFunctionName(path) === targetFuncName) {
                        if (path.node.start != null && path.node.end != null) {
                            findings.target = code.slice(path.node.start, path.node.end);
                        }
                        path.traverse({
                            CallExpression(callPath) {
                                if ('name' in callPath.node.callee) {
                                    calledFunctionNames.add(callPath.node.callee.name);
                                }
                            }
                        });
                    }
                }
            });

            // 2단계: 의존성 함수들 찾기
            if (findings.target) {
                traverse(ast, {
                    Function(path) { // 'FunctionDeclaration' 대신 'Function'을 사용
                        const funcName = getFunctionName(path);
                        if (funcName && calledFunctionNames.has(funcName) && path.node.start != null && path.node.end != null) {
                            findings.dependencies.push({
                                name: funcName,
                                content: code.slice(path.node.start, path.node.end)
                            });
                        }
                    }
                });
            }
        } catch (e) { console.error("AST 분석 오류:", e); return null; }
        return findings;
    };

    // --- 3. 통합 추출 핸들러 ---
    const handleExtraction = async (source: { type: 'text' } | { type: 'files', payload: FileList } | { type: 'zip', payload: File }) => {
        setIsLoading(true); setExtractionResult('');
        let fullReport = `# 🔍 소스 코드 분석 결과\n\n`; let foundSomething = false;

        const processContent = (content: string, sourceName: string) => {
            let reportSegment = '';
            if (analysisMode === 'keyword') {
                const keywordArray = parseKeywords(keywords);
                if (keywordArray.length === 0) { alert('키워드를 입력하세요.'); return; }
                reportSegment = runKeywordAnalysis(content, keywordArray);
            } else if (analysisMode === 'dependency') {
                if (!targetFunction.trim()) { alert('대상 함수 이름을 입력하세요.'); return; }
                const dependencyFindings = runDependencyAnalysis(content, targetFunction);
                if (dependencyFindings?.target) {
                    reportSegment += `\n---\n### 🎯 타겟 함수: \`${targetFunction}\`\n\`\`\`javascript\n${dependencyFindings.target}\n\`\`\`\n`;
                    if (dependencyFindings.dependencies.length > 0) {
                        reportSegment += `\n#### 📞 호출하는 함수 목록\n`;
                        dependencyFindings.dependencies.forEach(dep => {
                            reportSegment += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`;
                        });
                    } else {
                        reportSegment += `\n*호출하는 다른 함수를 찾지 못했습니다.*\n`;
                    }
                }
            }
            if (reportSegment) { foundSomething = true; fullReport += `## 📄 소스: ${sourceName}\n${reportSegment}\n`; }
        };

        if (source.type === 'text') { processContent(pastedCode, '붙여넣은 텍스트'); }
        else if (source.type === 'files') { for (const file of Array.from(source.payload)) { const content = await file.text(); processContent(content, file.name); } }
        else if (source.type === 'zip') { try { const zip = await JSZip.loadAsync(source.payload); for (const filePath in zip.files) { const file = zip.files[filePath]; if (!file.dir) { const content = await file.async('string'); processContent(content, file.name); } } } catch (e) { alert('ZIP 파일 처리 오류'); } }

        if (!foundSomething) { fullReport += '지정한 소스에서 분석 결과를 찾을 수 없었습니다.'; }
        setExtractionResult(fullReport); setIsLoading(false);
    };

    const handleSaveToFile = () => {
        if (!extractionResult) {
            alert('저장할 결과가 없습니다.');
            return;
        }
        const blob = new Blob([extractionResult], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `source-analysis-result_${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- 4. JSX 렌더링 ---
    return (
        <Section title="1. 소스 코드 추출기">
            <FormField label="분석 모드 선택">
                <select value={analysisMode} onChange={e => setAnalysisMode(e.target.value as any)} className="language-select">
                    <option value="keyword">🔑 키워드 검색</option>
                    <option value="dependency">🔗 의존성 분석 (JS/TS)</option>
                </select>
            </FormField>

            {analysisMode === 'keyword' && (
                <>
                    <FormField label="추출할 키워드" description="찾고 싶은 키워드를 콤마(,)로 구분하여 입력하세요.">
                        <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={3} />
                    </FormField>
                    <FormField label="분석 옵션">
                        <div className="ai-toggle-container">
                            <div className="toggle-switch">
                                <input id="block-toggle" type="checkbox" checked={shouldExtractBlocks} onChange={(e) => setShouldExtractBlocks(e.target.checked)} />
                                <label htmlFor="block-toggle" className="slider"></label>
                            </div>
                            <label htmlFor="block-toggle" className="toggle-label">발견된 키워드를 포함한 전체 함수/블록 추출 시도</label>
                        </div>
                    </FormField>
                </>
            )}

            {analysisMode === 'dependency' && (
                <FormField label="대상 함수 이름" description="이 함수가 호출하는 다른 함수들을 찾습니다.">
                    <input type="text" value={targetFunction} onChange={e => setTargetFunction(e.target.value)} placeholder="예: handlePayment" />
                </FormField>
            )}

            <div className="or-divider">아래 옵션 중 하나로 소스를 제공하세요</div>

            <FormField label="옵션 A: 코드 직접 붙여넣기">
                <textarea value={pastedCode} onChange={(e) => setPastedCode(e.target.value)} rows={8} placeholder="여기에 분석할 코드를 붙여넣으세요." />
                <button onClick={() => handleExtraction({ type: 'text' })} className="add-button" disabled={isLoading}>
                    {isLoading ? '분석 중...' : '분석 실행'}
                </button>
            </FormField>

            <FormField label="옵션 B: 개별 파일 업로드">
                <input type="file" multiple onChange={(e) => handleExtraction({ type: 'files', payload: e.target.files! })} className="file-input" />
            </FormField>

            <FormField label="옵션 C: 프로젝트 폴더(.zip) 업로드">
                <input type="file" accept=".zip" onChange={(e) => e.target.files && e.target.files[0] && handleExtraction({ type: 'zip', payload: e.target.files[0] })} className="file-input" />
            </FormField>

            {extractionResult && (
                <FormField label="추출 결과 (Markdown)">
                    <textarea value={extractionResult} readOnly rows={15} className="description-input" />

                    {/* --- [복구된 부분] --- */}
                    <button onClick={handleSaveToFile} className="add-button" style={{ marginTop: '10px' }}>
                        💾 결과 저장하기 (.md)
                    </button>
                    {/* --- [여기까지] --- */}

                </FormField>
            )}
        </Section>
    );
};

export default SourceExtractor;