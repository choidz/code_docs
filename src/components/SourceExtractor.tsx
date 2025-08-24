import React, { useEffect, useState } from 'react';


import JSZip from 'jszip';
import type { Edge, Node } from 'reactflow';
import { parseKeywords, runAdvancedKeywordAnalysis, runDependencyAnalysis } from '../lib/analysis';
import AnalysisForm from './ui/AnalysisForm';
import DependencyGraph from './ui/DependencyGraph';
import ResultDisplay from './ui/ResultDisplay';
import Section from './ui/Section';

// ==========================================================
// ▼▼▼ [추가] 1단계에서 만든 헬퍼 파일들을 import 합니다. ▼▼▼
// ==========================================================
import { loadPresets, savePresets } from '../lib/presetManager';
import type { AnalysisPreset } from '../types';

const isElectron = !!window.electronAPI;

interface GraphData {
    nodes: Node[];
    edges: Edge[];
}

const SourceExtractor = () => {
    // --- 상태 관리 (기존과 동일) ---
    const [analysisMode, setAnalysisMode] = useState<'keyword' | 'dependency'>('dependency');
    const [keywords, setKeywords] = useState<string>('private, SELECT');
    const [shouldExtractBlocks, setShouldExtractBlocks] = useState<boolean>(true);
    const [targetFunction, setTargetFunction] = useState<string>('');
    const [sourceMethod, setSourceMethod] = useState<'paste' | 'upload' | 'folder'>('paste');
    const [pastedCode, setPastedCode] = useState<string>('');
    const [folderPath, setFolderPath] = useState<string>('');
    const [selectedFilePath, setSelectedFilePath] = useState<string>('');
    const [selectedFileName, setSelectedFileName] = useState<string>('');
    const [extractionResult, setExtractionResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [isElectron, setIsElectron] = useState<boolean>(false);
    const [selectedFileObject, setSelectedFileObject] = useState<File | null>(null);
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });

    // ==========================================================
    // ▼▼▼ [추가] 프리셋 관리를 위한 상태 변수 3개를 추가합니다. ▼▼▼
    // ==========================================================
    const [presets, setPresets] = useState<AnalysisPreset[]>([]);
    const [selectedPreset, setSelectedPreset] = useState<string>('');
    const [newPresetName, setNewPresetName] = useState<string>('');

    useEffect(() => {
        const electronCheck = !!window.electronAPI;
        setIsElectron(electronCheck);

         // ==========================================================
        // ▼▼▼ [추가] 컴포넌트가 처음 로드될 때 localStorage에서 프리셋을 불러옵니다. ▼▼▼
        // ==========================================================
        setPresets(loadPresets());
        if (electronCheck) {
            window.electronAPI.onAnalysisResult((result) => {
                setExtractionResult(result);
                setIsLoading(false);
            });
            window.electronAPI.onStatusUpdate((message) => {
                setStatusMessage(message);
            });
        }
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            setSelectedFilePath('');
            setSelectedFileName('');
            setSelectedFileObject(null);
            return;
        }
        setSelectedFileName(file.name);
        setSelectedFileObject(file);
        if (isElectron) {
            const filePath = (file as any).path;
            if (filePath) {
                setSelectedFilePath(filePath);
            } else {
                alert("파일 경로를 가져오는 데 실패했습니다. 앱을 재시작하거나 다른 파일을 시도해주세요.");
            }
        }
    };

    const handleRunAnalysis = async () => {
        setIsLoading(true);
        setExtractionResult('');
        setStatusMessage('');
        setGraphData({ nodes: [], edges: [] });

        if (isElectron) {
            window.electronAPI.runAnalysis({
                analysisType: analysisMode, keywords, shouldExtractBlocks, targetFunction,
                sourceMethod, pastedCode, folderPath,
                filePath: selectedFilePath,
            });
        } else {
            try {
                if (sourceMethod === 'folder') {
                    alert("폴더 분석은 데스크톱 앱에서만 지원됩니다.");
                    setIsLoading(false);
                    return;
                }
                let result = '';
                if (sourceMethod === 'paste') {
                    result = performWebAnalysis(pastedCode, 'Pasted Code');
                } else if (sourceMethod === 'upload' && selectedFileObject) {
                    if (selectedFileObject.name.toLowerCase().endsWith('.zip')) {
                        result = await performWebZipAnalysis(selectedFileObject);
                    } else {
                        const content = await selectedFileObject.text();
                        result = performWebAnalysis(content, selectedFileObject.name);
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

     // ==========================================================
    // ▼▼▼ [추가] 프리셋을 다루는 핸들러 함수 3개를 추가합니다. (기존 함수들 아래에) ▼▼▼
    // ==========================================================
    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const presetName = e.target.value;
        setSelectedPreset(presetName);

        const preset = presets.find(p => p.name === presetName);
        if (preset) {
            setAnalysisMode(preset.mode);
            setKeywords(preset.keywords);
            setTargetFunction(preset.targetFunction);
            setShouldExtractBlocks(preset.shouldExtractBlocks);
        }
    };

    const handleSavePreset = () => {
        if (!newPresetName.trim()) {
            alert('프리셋 이름을 입력해주세요.');
            return;
        }
        const trimmedName = newPresetName.trim();
        if (presets.some(p => p.name === trimmedName)) {
            alert('이미 사용 중인 이름입니다.');
            return;
        }

        const newPreset: AnalysisPreset = {
            name: trimmedName,
            mode: analysisMode,
            keywords: keywords,
            targetFunction: targetFunction,
            shouldExtractBlocks: shouldExtractBlocks,
        };

        const updatedPresets = [...presets, newPreset].sort((a, b) => a.name.localeCompare(b.name));
        setPresets(updatedPresets);
        savePresets(updatedPresets);

        setNewPresetName('');
        setSelectedPreset(trimmedName);
        alert(`'${trimmedName}' 프리셋이 저장되었습니다!`);
    };

    const handleDeletePreset = () => {
        if (!selectedPreset) {
            alert('삭제할 프리셋을 선택해주세요.');
            return;
        }

        if (window.confirm(`'${selectedPreset}' 프리셋을 정말 삭제하시겠습니까?`)) {
            const updatedPresets = presets.filter(p => p.name !== selectedPreset);
            setPresets(updatedPresets);
            savePresets(updatedPresets);
            setSelectedPreset('');
        }
    };

    const performWebZipAnalysis = async (file: File): Promise<string> => {
        setStatusMessage('웹 브라우저에서 ZIP 파일 압축을 해제하고 분석합니다...');
        const zip = await JSZip.loadAsync(file);
        let fullReport = `# 📝 분석 결과 (ZIP: ${file.name})\n\n`;
        let foundSomething = false;

        for (const zipEntry of Object.values(zip.files)) {
            if (!zipEntry.dir) {
                const content = await zipEntry.async('string');
                const reportSegment = performWebAnalysis(content, zipEntry.name);

                // ZIP 파일 분석 시에는 그래프를 표시하지 않고 초기화합니다.
                setGraphData({ nodes: [], edges: [] });

                if (reportSegment && reportSegment !== '분석 결과를 찾지 못했습니다.') {
                    fullReport += `## 📄 소스: ${zipEntry.name}\n${reportSegment}\n`;
                    foundSomething = true;
                }
            }
        }
        return foundSomething ? fullReport : 'ZIP 파일 내에서 분석 결과를 찾지 못했습니다.';
    };

    const performWebAnalysis = (content: string, sourceName: string): string => {
        setStatusMessage('웹 브라우저에서 분석을 수행합니다...');

        if (analysisMode === 'keyword') {
            const parsedKeywords = parseKeywords(keywords);
            if (parsedKeywords.length === 0) return '검색할 키워드를 입력해주세요.';

            const findings = runAdvancedKeywordAnalysis(content, parsedKeywords);

            if (findings.length > 0) {
                // [수정] 새로운 키워드 그래프 생성 함수를 호출합니다.
                const newGraphData = createKeywordGraphData(findings, parsedKeywords);
                setGraphData(newGraphData);

                let report = '';
                findings.forEach(finding => {
                    report += `\n---\n**[함수: ${finding.functionName}] 키워드 \`${finding.foundKeywords.join(', ')}\` 발견**\n\`\`\`javascript\n${finding.content}\n\`\`\`\n`;
                });
                return report;
            }
            return '입력하신 키워드를 소스 코드에서 찾을 수 없습니다.';
        }

        if (analysisMode === 'dependency') {
            if (!targetFunction || targetFunction.trim() === '') return '분석할 대상 함수의 이름을 입력해주세요.';
            const findings = runDependencyAnalysis(content, targetFunction);
            if (!findings) return 'AST 분석 중 오류가 발생했습니다.';

            if (findings.target) {
                const newGraphData = createDependencyGraphData(targetFunction, findings.dependencies);
                setGraphData(newGraphData);

                let report = `### 🎯 타겟 함수: \`${targetFunction}\`\n\`\`\`javascript\n${findings.target}\n\`\`\`\n`;
                if (findings.dependencies.length > 0) {
                    report += `\n#### 📞 호출하는 함수 목록\n`;
                    findings.dependencies.forEach(dep => {
                        report += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`;
                    });
                }
                return report;
            } else {
                return `대상 함수 \`${targetFunction}\`(을)를 찾을 수 없습니다.`;
            }
        }
        return '분석 결과를 찾지 못했습니다.';
    };

    // [수정] 키워드 그래프 생성 로직을 '키워드 중심'으로 변경
    const createKeywordGraphData = (findings: { functionName: string, foundKeywords: string[] }[], keywords: string[]): GraphData => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // 1. 검색한 키워드들을 그룹 노드처럼 추가합니다.
        keywords.forEach((keyword, index) => {
            nodes.push({
                id: `keyword-${keyword}`,
                data: { label: keyword },
                position: { x: index * 200, y: 0 }, // 최상단에 키워드 노드 배치
                type: 'input', // 키워드 노드를 시작점으로 표시
                style: { backgroundColor: '#FFFBE6', borderColor: '#FFC107', width: 'auto', minWidth: 120, textAlign: 'center' }
            });
        });

        // 2. 키워드가 발견된 함수들을 아래쪽에 추가합니다. (중복 없이)
        const functionNodes = new Map<string, Node>();
        findings.forEach((finding) => {
            if (!functionNodes.has(finding.functionName)) {
                functionNodes.set(finding.functionName, {
                    id: finding.functionName,
                    data: { label: finding.functionName },
                    position: { x: 0, y: 0 }, // 위치는 나중에 자동 배치됩니다.
                    style: { width: 'auto', minWidth: 150 }
                });
            }
        });

        // Map을 배열로 변환하여 노드 목록에 추가하고 위치를 지정합니다.
        let funcNodeIndex = 0;
        functionNodes.forEach(node => {
            node.position = { x: funcNodeIndex * 200, y: 150 };
            nodes.push(node);
            funcNodeIndex++;
        });

        // 3. '키워드' -> '함수'로 관계를 연결합니다.
        findings.forEach((finding) => {
            finding.foundKeywords.forEach(keyword => {
                edges.push({
                    id: `e-keyword-${keyword}-${finding.functionName}`,
                    source: `keyword-${keyword}`,
                    target: finding.functionName,
                });
            });
        });

        return { nodes, edges };
    };

    // [수정] 자동 레이아웃을 위해 수동 위치 지정을 제거
    const createDependencyGraphData = (target: string, dependencies: { name: string }[]): GraphData => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // React Flow가 자동으로 위치를 계산하도록 position 속성을 제거합니다.
        nodes.push({
            id: target,
            data: { label: target },
            position: { x: 0, y: 0 }, // 자동 레이아웃을 위해 초기 위치는 중요하지 않습니다.
            type: 'input',
            style: { backgroundColor: '#DFF4FF', borderColor: '#4A90E2', width: 'auto', minWidth: 150 }
        });

        dependencies.forEach((dep) => {
            if (!nodes.some(node => node.id === dep.name)) {
                nodes.push({
                    id: dep.name,
                    data: { label: dep.name },
                    position: { x: 0, y: 0 },
                    style: { width: 'auto', minWidth: 150 }
                });
            }
            edges.push({
                id: `e-${target}-${dep.name}`,
                source: target,
                target: dep.name,
                animated: true
            });
        });
        return { nodes, edges };
    };


    const handleSaveToFile = () => {
        if (!extractionResult) { alert('저장할 결과가 없습니다.'); return; }
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

    return (
                <div className="single-column-layout">

                                <Section title="소스추출기">
                    <AnalysisForm
                        analysisMode={analysisMode}
                        setAnalysisMode={setAnalysisMode}
                        keywords={keywords}
                        setKeywords={setKeywords}
                        targetFunction={targetFunction}
                        setTargetFunction={setTargetFunction}
                        sourceMethod={sourceMethod}
                        setSourceMethod={setSourceMethod}
                        pastedCode={pastedCode}
                        setPastedCode={setPastedCode}
                        folderPath={folderPath}
                        setFolderPath={setFolderPath}
                        selectedFileName={selectedFileName}
                        isLoading={isLoading}
                        onRunAnalysis={handleRunAnalysis}
                        onFileChange={handleFileChange}
                        isElectron={isElectron}
                        presets={presets}
                        selectedPreset={selectedPreset}
                        newPresetName={newPresetName}
                        onPresetChange={handlePresetChange}
                        onNewPresetNameChange={(e) => setNewPresetName(e.target.value)}
                        onSavePreset={handleSavePreset}
                        onDeletePreset={handleDeletePreset}
                    />
                </Section>

           {(isLoading || extractionResult) && (
             <Section title="분석 결과">
    {/* [추가] 그래프와 결과를 감싸는 전체 컨테이너 */}
    <div className="result-section-content">
        {/* 그래프를 표시하는 영역 */}
        {graphData.nodes.length > 0 && (
            <div className="graph-container">
                <DependencyGraph nodes={graphData.nodes} edges={graphData.edges} />
            </div>
        )}

        {/* 텍스트 결과를 표시하는 영역 */}
        <ResultDisplay
            isLoading={isLoading}
            statusMessage={statusMessage}
            extractionResult={extractionResult}
            onSaveToFile={handleSaveToFile}
        />
    </div>
</Section>
            )}
        </div>
    );
};

export default SourceExtractor;

