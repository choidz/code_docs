import React from 'react';

interface FormFieldProps {
    label: string;
    description?: string;
    htmlFor?: string;
    children: React.ReactNode;
}

/**
 * 라벨, 설명, 입력 요소를 감싸는 재사용 가능한 폼 필드 컴포넌트
 */
const FormField: React.FC<FormFieldProps> = ({ label, description, htmlFor, children }) => {
    return (
        <div className="form-field">
            <label htmlFor={htmlFor}>{label}</label>
            {description && <p className="description-text">{description}</p>}
            {children}
        </div>
    );
};

export default FormField;
