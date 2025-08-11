import React, { useState } from 'react';
import JSZip from 'jszip';
import Section from './ui/Section';
import FormField from './ui/FormField';

/**
 * 소스 코드에서 콤마로 구분된 키워드를 추출하는 도구
 */
const SourceExtractor = () => {
    const [keywords, setKeywords] = useState<string>('private void, public static void, EXEC, SELECT');
    const [pastedCode, setPastedCode] = useState<string>('');
    const [extractionResult, setExtractionResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // [새로운 부분] 함수 블록 추출 여부를 제어하는 state
    const [shouldExtractBlocks, setShouldExtractBlocks] = useState<boolean>(false);

    const parseKeywords = (keywordString: string): string[] => {
        return keywordString.split(',').map(k => k.trim()).filter(k => k.length > 0);
    };

    /**
     * (새로운 헬퍼) 특정 라인을 기준으로 감싸고 있는 코드 블록을 찾는 함수
     */
    const extractCodeBlock = (allLines: string[], keywordLineIndex: number): { block: string; start: number; end: number } | null => {
        let blockStartLine = -1;
        let blockEndLine = -1;

        // 1. 키워드 라인부터 위로 올라가며 블록의 시작점(보통 함수 선언부)을 찾습니다.
        for (let i = keywordLineIndex; i >= 0; i--) {
            const line = allLines[i];
            if (line.includes('{')) {
                // 여는 괄호를 찾으면, 그 이전 라인들도 포함하기 위해 더 탐색합니다.
                let signatureStart = i;
                while (signatureStart > 0) {
                    const prevLine = allLines[signatureStart - 1].trim();
                    if (prevLine === '' || prevLine.endsWith(';') || prevLine.endsWith('}') || prevLine.endsWith('{')) {
                        break;
                    }
                    signatureStart--;
                }
                blockStartLine = signatureStart;
                break;
            }
        }

        if (blockStartLine === -1) return null;

        // 2. 블록 시작점부터 아래로 내려가며 짝이 맞는 닫는 괄호를 찾습니다.
        let braceCount = 0;
        for (let i = blockStartLine; i < allLines.length; i++) {
            const line = allLines[i];
            for (const char of line) {
                if (char === '{') braceCount++;
                else if (char === '}') braceCount--;
            }
            if (braceCount === 0) {
                blockEndLine = i;
                break;
            }
        }

        if (blockEndLine === -1) return null;

        const blockLines = allLines.slice(blockStartLine, blockEndLine + 1);
        return { block: blockLines.join('\n'), start: blockStartLine + 1, end: blockEndLine + 1 };
    };

    const runKeywordAnalysis = (content: string, keywordArray: string[]): string => {
        const lines = content.split('\n');
        let findings = '';
        const processedBlockRanges: { start: number, end: number }[] = [];

        lines.forEach((line, index) => {
            // 이미 다른 블록에 포함되어 처리된 라인인지 확인
            const isProcessed = processedBlockRanges.some(range => index >= range.start && index <= range.end);
            if (isProcessed) return;

            for (const keyword of keywordArray) {
                if (line.includes(keyword)) {
                    if (shouldExtractBlocks) {
                        const blockResult = extractCodeBlock(lines, index);
                        if (blockResult) {
                            findings += `\n---\n**[블록] 키워드 \`${keyword}\` 발견 (Line ${index + 1} / Block ${blockResult.start}-${blockResult.end})**\n`;
                            findings += `\`\`\`\n${blockResult.block}\n\`\`\`\n`;
                            processedBlockRanges.push({ start: blockResult.start - 1, end: blockResult.end - 1 });
                            return; // 이 라인은 처리 완료, 다음 라인으로
                        }
                    }
                    // 블록 추출에 실패했거나 옵션이 꺼져있으면 기존 방식대로 한 줄만 추출
                    findings += `- **[라인] 키워드 \`${keyword}\` 발견 (Line ${index + 1})**: \`${line.trim()}\`\n`;
                    return; // 이 라인은 처리 완료, 다음 라인으로
                }
            }
        });
        return findings;
    };

    const handleExtraction = async (source: { type: 'text' } | { type: 'files', payload: FileList } | { type: 'zip', payload: File }) => {
        setIsLoading(true);
        setExtractionResult('');

        const keywordArray = parseKeywords(keywords);
        if (keywordArray.length === 0) {
            alert('오류: 추출할 키워드를 콤마(,)로 구분하여 입력하세요.');
            setIsLoading(false);
            return;
        }

        let fullReport = `# 🔍 소스 코드 추출 결과\n\n`;
        let foundSomething = false;

        const processContent = (content: string, sourceName: string) => {
            const findings = runKeywordAnalysis(content, keywordArray);
            if (findings) {
                foundSomething = true;
                fullReport += `## 📄 소스: ${sourceName}\n${findings}\n`;
            }
        };

        if (source.type === 'text') {
            processContent(pastedCode, '붙여넣은 텍스트');
        } else if (source.type === 'files') {
            for (let i = 0; i < source.payload.length; i++) {
                const file = source.payload[i];
                const content: string = await file.text();
                processContent(content, file.name);
            }
        } else if (source.type === 'zip') {
            const zip = await JSZip.loadAsync(source.payload);
            for (const filePath in zip.files) {
                const file = zip.files[filePath];
                if (!file.dir) {
                    const content = await file.async('string');
                    processContent(content, file.name);
                }
            }
        }

        if (!foundSomething) {
            fullReport += '지정한 소스에서 키워드를 찾을 수 없었습니다.';
        }
        setExtractionResult(fullReport);
        setIsLoading(false);
    };

    return (
        <Section title="1. 소스 코드 추출기">
            <FormField
                label="추출할 키워드"
                htmlFor="keywords-input"
                description="찾고 싶은 키워드를 콤마(,)로 구분하여 입력하세요."
            >
                <textarea id="keywords-input" value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={3} />
            </FormField>

            {/* [새로운 부분] 분석 옵션 UI */}
            <FormField label="분석 옵션">
                <div className="ai-toggle-container">
                    <div className="toggle-switch">
                        <input
                            id="block-toggle"
                            type="checkbox"
                            checked={shouldExtractBlocks}
                            onChange={(e) => setShouldExtractBlocks(e.target.checked)}
                        />
                        <label htmlFor="block-toggle" className="slider"></label>
                    </div>
                    <label htmlFor="block-toggle" className="toggle-label">발견된 키워드를 포함한 전체 함수/블록 추출 시도</label>
                </div>
            </FormField>

            <div className="or-divider">아래 옵션 중 하나로 소스를 제공하세요</div>
            <FormField label="옵션 A: 코드 직접 붙여넣기">
                <textarea value={pastedCode} onChange={(e) => setPastedCode(e.target.value)} rows={8} placeholder="여기에 분석할 코드를 붙여넣으세요." />
                <button onClick={() => handleExtraction({ type: 'text' })} className="add-button" disabled={isLoading}>
                    {isLoading ? '추출 중...' : '붙여넣은 텍스트에서 추출'}
                </button>
            </FormField>
            <FormField label="옵션 B: 개별 파일 업로드">
                <input type="file" multiple onChange={(e) => handleExtraction({ type: 'files', payload: e.target.files! })} className="file-input" />
            </FormField>
            <FormField label="옵션 C: 프로젝트 폴더(.zip) 업로드">
                <input type="file" accept=".zip" onChange={(e) => handleExtraction({ type: 'zip', payload: e.target.files![0] })} className="file-input" />
            </FormField>
            {extractionResult && (
                <FormField label="추출 결과 (Markdown)">
                    <textarea value={extractionResult} readOnly rows={15} className="description-input" />
                </FormField>
            )}
        </Section>
    );
};

export default SourceExtractor;
