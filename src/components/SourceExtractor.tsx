import React, { useState, useEffect } from 'react';
import Section from './ui/Section';
import AnalysisForm from './ui/AnalysisForm';
import ResultDisplay from './ui/ResultDisplay';
import JSZip from 'jszip';

// 1. 분리해둔 분석 라이브러리에서 필요한 함수들을 가져옵니다.
import { runKeywordAnalysis, runDependencyAnalysis, parseKeywords } from '../lib/analysis';

const SourceExtractor = () => {
    // --- 상태 관리(State Management) ---

    // 1. 분석 옵션 관련 상태 (기존과 동일)
    const [analysisMode, setAnalysisMode] = useState<'keyword' | 'dependency'>('dependency');
    const [keywords, setKeywords] = useState<string>('private void, EXEC, SELECT');
    const [shouldExtractBlocks, setShouldExtractBlocks] = useState<boolean>(true);
    const [targetFunction, setTargetFunction] = useState<string>('');

    // 2. 소스 제공 방식 관련 상태 (기존과 동일)
    const [sourceMethod, setSourceMethod] = useState<'paste' | 'upload' | 'folder'>('paste');
    const [pastedCode, setPastedCode] = useState<string>('');
    const [folderPath, setFolderPath] = useState<string>('');
    const [selectedFilePath, setSelectedFilePath] = useState<string>(''); // Electron 전용
    const [selectedFileName, setSelectedFileName] = useState<string>('');

    // 3. 결과 및 UI 제어 관련 상태 (기존과 동일)
    const [extractionResult, setExtractionResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [isElectron, setIsElectron] = useState<boolean>(false);

    // 4. [수정] 웹 브라우저에서 파일 내용을 읽기 위해 File 객체를 저장할 상태 추가
    const [selectedFileObject, setSelectedFileObject] = useState<File | null>(null);

    // --- 초기 설정 및 Electron 리스너 ---
    useEffect(() => {
        const electronCheck = !!window.electronAPI;
        setIsElectron(electronCheck);

        if (electronCheck) {
            // Electron 환경일 때만 IPC 리스너를 설정합니다.
            window.electronAPI.onAnalysisResult((result) => {
                setExtractionResult(result);
                setIsLoading(false);
            });
            window.electronAPI.onStatusUpdate((message) => {
                setStatusMessage(message);
            });
        }
    }, []);

    // 웹/Electron 환경을 모두 처리하도록 파일 변경 핸들러 수정
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            setSelectedFilePath('');
            setSelectedFileName('');
            setSelectedFileObject(null);
            return;
        }

        // [핵심 1] 모든 환경(웹, Electron)에서 공통으로 실행됩니다.
        // - UI에 보여줄 파일 이름을 저장합니다.
        // - 웹 브라우저에서 파일 내용을 직접 읽기 위해 '파일 객체' 자체를 저장합니다.
        setSelectedFileName(file.name);
        setSelectedFileObject(file);

        // [핵심 2] Electron 환경에서만 특별히 실행됩니다.
        // - main.js의 파일 시스템(fs)이 접근할 수 있도록 파일의 '전체 경로'를 추가로 저장합니다.
        if (isElectron) {
            const filePath = (file as any).path;
            if (filePath) {
                setSelectedFilePath(filePath);
            } else {
                alert("파일 경로를 가져오는 데 실패했습니다. 앱을 재시작하거나 다른 파일을 시도해주세요.");
            }
        }
    };

    // 웹/Electron 환경에 따라 로직을 분기하도록 분석 실행 핸들러 수정
    // 3. [수정됨] 웹 환경의 ZIP 파일 처리를 포함하도록 분석 핸들러를 개선합니다.
    const handleRunAnalysis = async () => {
        setIsLoading(true);
        setExtractionResult('');
        setStatusMessage('');

        if (isElectron) {
            window.electronAPI.runAnalysis({
                analysisType: analysisMode, keywords, shouldExtractBlocks, targetFunction,
                sourceMethod, pastedCode, folderPath,
                filePath: selectedFilePath,
            });
        } else {
            // === 웹 브라우저 환경 ===
            try {
                if (sourceMethod === 'folder') {
                    alert("폴더 분석은 데스크톱 앱에서만 지원됩니다.");
                    setIsLoading(false);
                    return;
                }

                let result = '';
                if (sourceMethod === 'paste') {
                    result = performWebAnalysis(pastedCode);
                } else if (sourceMethod === 'upload' && selectedFileObject) {
                    // 파일 확장자를 확인하여 ZIP 파일인지 판별합니다.
                    if (selectedFileObject.name.toLowerCase().endsWith('.zip')) {
                        result = await performWebZipAnalysis(selectedFileObject);
                    } else {
                        // 일반 텍스트 파일 처리
                        const content = await selectedFileObject.text();
                        result = performWebAnalysis(content);
                    }
                }
                setExtractionResult(result || '분석 결과를 찾지 못했습니다.');
            } catch (error) {
                console.error("웹 분석 중 오류:", error);
                setExtractionResult("# ❗ 분석 중 오류가 발생했습니다.\n\n" + (error as Error).message);
            } finally {
                setIsLoading(false);
            }
        }
    };

    // 4. [추가] 웹 브라우저에서 ZIP 파일의 압축을 풀고 분석하는 헬퍼 함수
    const performWebZipAnalysis = async (file: File): Promise<string> => {
        setStatusMessage('웹 브라우저에서 ZIP 파일 압축을 해제하고 분석합니다...');
        const zip = await JSZip.loadAsync(file); // File 객체를 직접 넘겨줍니다.
        let fullReport = `# 📝 분석 결과 (ZIP: ${file.name})\n\n`;
        let foundSomething = false;

        // for...of 루프와 Object.values를 사용하여 각 파일을 순회합니다.
        for (const zipEntry of Object.values(zip.files)) {
            if (!zipEntry.dir) {
                const content = await zipEntry.async('string');
                const reportSegment = performWebAnalysis(content);

                if (reportSegment && reportSegment !== '분석 결과를 찾지 못했습니다.') {
                    fullReport += `## 📄 소스: ${zipEntry.name}\n${reportSegment}\n`;
                    foundSomething = true;
                }
            }
        }
        return foundSomething ? fullReport : 'ZIP 파일 내에서 분석 결과를 찾지 못했습니다.';
    };


    // 웹 환경 분석 헬퍼 함수 - 결과가 없을 때 더 구체적인 메시지를 반환하도록 개선
    const performWebAnalysis = (content: string): string => {
        setStatusMessage('웹 브라우저에서 분석을 수행합니다...');

        if (analysisMode === 'keyword') {
            const parsedKeywords = parseKeywords(keywords);
            // 키워드가 입력되었는지 먼저 확인합니다.
            if (parsedKeywords.length === 0) {
                return '검색할 키워드를 입력해주세요.';
            }
            console.log(parsedKeywords)
            const result = runKeywordAnalysis(content, parsedKeywords, shouldExtractBlocks);
            // 결과가 빈 문자열일 경우, 키워드를 찾지 못했다는 메시지를 반환합니다.
            return result || '입력하신 키워드를 소스 코드에서 찾을 수 없습니다.';
        }

        if (analysisMode === 'dependency') {
            // 대상 함수 이름이 입력되었는지 먼저 확인합니다.
            if (!targetFunction || targetFunction.trim() === '') {
                return '분석할 대상 함수의 이름을 입력해주세요.';
            }

            const findings = runDependencyAnalysis(content, targetFunction);

            // 분석 라이브러리에서 에러(null)를 반환했는지 확인합니다.
            if (!findings) {
                return 'AST 분석 중 오류가 발생했습니다. 개발자 콘솔을 확인해주세요.';
            }

            // 분석은 성공했지만, 타겟 함수를 찾았는지 확인합니다.
            if (findings.target) {
                let report = `### 🎯 타겟 함수: \`${targetFunction}\`\n\`\`\`javascript\n${findings.target}\n\`\`\`\n`;
                if (findings.dependencies.length > 0) {
                    report += `\n#### 📞 호출하는 함수 목록\n`;
                    findings.dependencies.forEach(dep => {
                        report += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`;
                    });
                }
                return report;
            } else {
                // 타겟 함수를 찾지 못했다는 구체적인 메시지를 반환합니다.
                return `대상 함수 \`${targetFunction}\`을(를) 소스 코드에서 찾을 수 없습니다. 함수 이름을 다시 확인해주세요.`;
            }
        }
        setStatusMessage('');
        // 위의 두 경우에 해당하지 않을 때 기본 메시지를 반환합니다.
        return '분석 결과를 찾지 못했습니다.';
    };

    // 파일 저장 핸들러 (기존과 동일, 웹/Electron 모두에서 작동)
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

    // --- JSX 렌더링 (기존과 동일) ---
    return (
        <Section title="1. 소스 코드 추출기">
            <AnalysisForm
                analysisMode={analysisMode} setAnalysisMode={setAnalysisMode}
                keywords={keywords} setKeywords={setKeywords}
                shouldExtractBlocks={shouldExtractBlocks} setShouldExtractBlocks={setShouldExtractBlocks}
                targetFunction={targetFunction} setTargetFunction={setTargetFunction}
                sourceMethod={sourceMethod} setSourceMethod={setSourceMethod}
                pastedCode={pastedCode} setPastedCode={setPastedCode}
                folderPath={folderPath} setFolderPath={setFolderPath}
                selectedFileName={selectedFileName}
                isLoading={isLoading}
                onRunAnalysis={handleRunAnalysis}
                onFileChange={handleFileChange}
                isElectron={isElectron}
            />
            <ResultDisplay
                isLoading={isLoading}
                statusMessage={statusMessage}
                extractionResult={extractionResult}
                onSaveToFile={handleSaveToFile}
            />
        </Section>
    );
};

export default SourceExtractor;
