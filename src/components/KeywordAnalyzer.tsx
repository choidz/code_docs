import React, { useState } from 'react';
import { AnalysisConfig } from '../types';
import Section from './ui/Section';
import FormField from './ui/FormField';

/**
 * 키워드 기반 분석기능 전체를 담당하는 컴포넌트
 */
const KeywordAnalyzer = () => {
    const [jsonConfig, setJsonConfig] = useState<string>(
        JSON.stringify({
            targetFiles: ["AlarmListScreen.dart", "App.tsx"],
            searchKeywords: ["Provider.of", "useState", "MessageBox.Show", "fetch"]
        }, null, 2)
    );
    const [pastedCode, setPastedCode] = useState<string>('');
    const [analysisResult, setAnalysisResult] = useState<string>('');

    const runAnalysisOnContent = (content: string, config: AnalysisConfig): string => {
        // ... (이전 App.tsx의 runAnalysisOnContent 로직과 동일)
        const lines = content.split('\n');
        const findings: { keyword: string; lineNumber: number; lineContent: string }[] = [];
        lines.forEach((line, index) => {
            for (const keyword of config.searchKeywords) {
                if (line.includes(keyword)) {
                    findings.push({ keyword, lineNumber: index + 1, lineContent: line.trim() });
                    break;
                }
            }
        });
        if (findings.length === 0) return '';
        let reportPart = `총 **${findings.length}개**의 주요 코드 라인을 발견했습니다.\n\n`;
        config.searchKeywords.forEach(keyword => {
            const keywordFindings = findings.filter(f => f.keyword === keyword);
            if (keywordFindings.length > 0) {
                reportPart += `### 🔑 키워드: \`${keyword}\`\n\n`;
                keywordFindings.forEach(finding => {
                    reportPart += `- **Line ${finding.lineNumber}**: \`${finding.lineContent}\`\n`;
                });
                reportPart += `\n`;
            }
        });
        return reportPart;
    };

    const handlePastedCodeAnalysis = () => {
        // ... (이전 App.tsx의 handlePastedCodeAnalysis 로직과 동일)
        let config: AnalysisConfig;
        try {
            config = JSON.parse(jsonConfig);
        } catch (error) {
            setAnalysisResult('오류: JSON 설정의 형식이 올바르지 않습니다.');
            return;
        }
        const reportContent = runAnalysisOnContent(pastedCode, config);
        let finalReport = `# 📝 텍스트 분석 리포트\n\n`;
        finalReport += reportContent || '입력된 텍스트에서 지정된 키워드를 찾을 수 없었습니다.';
        setAnalysisResult(finalReport);
    };

    const handleFileUploadAnalysis = async (event: React.ChangeEvent<HTMLInputElement>) => {
        // ... (이전 App.tsx의 handleFileUploadAnalysis 로직과 동일)
        const files = event.target.files;
        let config: AnalysisConfig;
        try {
            config = JSON.parse(jsonConfig);
        } catch (error) {
            setAnalysisResult('오류: JSON 설정의 형식이 올바르지 않습니다.');
            return;
        }
        if (!files || files.length === 0) return;
        setAnalysisResult('파일 분석 중...');
        let fullMarkdownReport = `# 📚 파일 분석 리포트\n\n`;
        let foundSomething = false;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (config.targetFiles.includes(file.name) || config.targetFiles.length === 0) {
                const content: string = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsText(file);
                });
                const reportPart = runAnalysisOnContent(content, config);
                if (reportPart) {
                    foundSomething = true;
                    fullMarkdownReport += `## 📄 ${file.name}\n\n${reportPart}`;
                }
            }
        }
        if (!foundSomething) {
            fullMarkdownReport += '지정한 파일에서 키워드를 찾을 수 없었습니다.';
        }
        setAnalysisResult(fullMarkdownReport);
    };

    return (
        <Section title="⚙️ 키워드 기반 분석 (모든 언어)">
            <FormField
                label="추출 규칙 (JSON)"
                htmlFor="json-config"
                description="`targetFiles`는 파일 업로드 시에만 적용됩니다. (비워두면 모든 파일 분석)"
            >
                <textarea id="json-config" value={jsonConfig} onChange={(e) => setJsonConfig(e.target.value)} rows={8} />
            </FormField>
            <FormField label="옵션 A: 코드 직접 붙여넣기">
                <textarea value={pastedCode} onChange={(e) => setPastedCode(e.target.value)} rows={10} placeholder="여기에 분석할 코드를 붙여넣으세요." />
                <button onClick={handlePastedCodeAnalysis} className="add-button">붙여넣은 텍스트 분석 실행</button>
            </FormField>
            <div className="or-divider">또는</div>
            <FormField label="옵션 B: 파일 업로드 (자동 분석)">
                <input type="file" multiple onChange={handleFileUploadAnalysis} className="file-input" />
            </FormField>
            {analysisResult && (
                <FormField label="분석 리포트 (Markdown)">
                    <textarea value={analysisResult} readOnly rows={18} className="description-input" />
                </FormField>
            )}
        </Section>
    );
};

export default KeywordAnalyzer;
