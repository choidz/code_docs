import { useState } from 'react';
import FormField from './ui/FormField';
import Section from './ui/Section';

/**
 * 사용자가 제공한 컨텍스트와 질문을 기반으로 AI와 대화하는 도구
 */
const AiAssistant = () => {
    const [context, setContext] = useState<string>(''); // 사용자가 붙여넣는 컨텍스트 (예: 추출 결과)
    const [prompt, setPrompt] = useState<string>(''); // AI에게 보낼 프롬프트
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const handleAiRequest = async () => {
        if (!prompt.trim()) {
            alert('AI에게 보낼 질문이나 명령을 입력하세요.');
            return;
        }
        if (!process.env.REACT_APP_GEMINI_API_KEY) {
            alert('.env 파일에 REACT_APP_GEMINI_API_KEY를 설정해야 합니다.');
            return;
        }

        setIsLoading(true);
        const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
        const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

        // 컨텍스트가 있으면 함께 보내고, 없으면 프롬프트만 보냅니다.
        const fullPrompt = context.trim()
            ? `주어진 컨텍스트:\n\n---\n${context}\n---\n\n위 컨텍스트를 바탕으로 다음 요청을 수행해 주세요:\n\n"${prompt}"`
            : prompt;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
            });

            if (!response.ok) throw new Error(`API 오류: ${response.statusText}`);

            const data = await response.json();
            const aiResponse = data.candidates[0]?.content?.parts[0]?.text || 'AI로부터 응답을 받지 못했습니다.';

            // AI의 답변으로 컨텍스트 영역을 업데이트합니다.
            setContext(aiResponse);
            setPrompt(''); // 프롬프트 입력창 비우기

        } catch (error) { 
            console.error('AI 요청 실패:', error);
            alert(`AI 요청 중 오류가 발생했습니다: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
                <div className="single-column-layout">

        <Section title="AI 어시스턴트">
            <div className="form-content">
                <FormField
                    label="컨텍스트 / 편집 공간 (Context / Workspace)"
                    description="소스 추출기의 결과를 여기에 붙여넣거나, AI에게 물어보고 싶은 내용을 자유롭게 작성하세요."
                >
                    <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={20} />
                </FormField>
                <FormField label="AI에게 요청하기">
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="예: 위의 내용을 기능별로 요약하고 마크다운 테이블로 만들어줘." />
                </FormField>
            </div>
            <div className="form-footer">
                {/* [변경] 버튼 클래스명을 'btn-primary-solid'로 수정합니다. */}
                <button onClick={handleAiRequest} className="btn-primary-solid" disabled={isLoading}>
                    {isLoading ? 'AI 생각 중...' : '🤖 AI에게 작업 요청'}
                </button>
            </div>
        </Section>
        </div>
    );
};

export default AiAssistant;
