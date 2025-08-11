import React from 'react';

interface SectionProps {
    title: string;
    children: React.ReactNode;
}

/**
 * 제목과 내용을 감싸는 재사용 가능한 섹션 컴포넌트
 */
const Section: React.FC<SectionProps> = ({ title, children }) => {
    return (
        <>
            <h2 className="section-title">{title}</h2>
            <div className="input-form">
                {children}
            </div>
        </>
    );
};

export default Section;
