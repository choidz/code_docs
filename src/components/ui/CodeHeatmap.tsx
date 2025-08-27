import React, { useEffect, useState } from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";

// 트리맵 데이터의 타입 정의
interface HeatmapData {
  name: string;
  loc: number;
  complexity: number;
  children?: HeatmapData[];
  // [추가] Recharts 타입 호환성을 위한 인덱스 시그니처
  [key: string]: any;
}

// 복잡도에 따라 색상을 결정하는 함수
const getColor = (complexity: number) => {
  if (complexity > 40) return "#d32f2f"; // Very High
  if (complexity > 20) return "#ef6c00"; // High
  if (complexity > 10) return "#f9a825"; // Moderate
  return "#4caf50"; // Good
};

// 트리맵의 각 셀을 커스텀 렌더링하기 위한 컴포넌트
// 트리맵의 각 셀을 커스텀 렌더링하기 위한 컴포넌트
const CustomizedContent = (props: any) => {
  const { depth, x, y, width, height, name } = props;

  // 동적 폰트 크기 계산 (너비에 더 민감하게 반응하도록 조정)
  const fontSize = Math.min(width / 7, height / 2, 14);

  return (
    <g>
      {/* 배경이 되는 사각형 */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth === 1 ? "#333" : getColor(props.complexity),
          stroke: "#fff",
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />

      {/* 텍스트가 렌더링되기에 너무 작지 않은 경우에만 표시 (최소 너비/높이 15px) */}
      {width > 15 && height > 15 && (
        <foreignObject
          x={x + 3}
          y={y + 3}
          width={width - 6}
          height={height - 6}>
          {/* foreignObject 안에서는 일반 HTML/CSS를 사용할 수 있습니다. */}
          <div
            style={{
              width: "100%",
              height: "100%",
              color: "white",
              fontSize: `${fontSize}px`,
              lineHeight: 1.2,
              // 이 속성이 자동 줄바꿈의 핵심입니다.
              wordBreak: "break-all",
              overflow: "hidden", // 영역을 벗어나는 텍스트는 숨김
            }}>
            {name}
          </div>
        </foreignObject>
      )}
    </g>
  );
};

// [추가] 툴팁 내용을 깔끔하게 보여주기 위한 커스텀 툴팁 컴포넌트
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: "#282c34",
          border: "1px solid #555",
          padding: "10px",
          borderRadius: "4px",
          color: "white",
        }}>
        <p style={{ margin: 0, fontWeight: "bold" }}>{data.name}</p>
        <p style={{ margin: "5px 0 0 0" }}>{`코드 라인 수: ${data.loc}`}</p>
        <p
          style={{
            margin: "5px 0 0 0",
          }}>{`코드 복잡도: ${data.complexity}`}</p>
      </div>
    );
  }
  return null;
};

interface CodeHeatmapProps {
  folderPath: string; // 분석할 폴더 경로를 props로 받음
}

const CodeHeatmap: React.FC<CodeHeatmapProps> = ({ folderPath }) => {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Electron API 리스너 설정
    const removeListener = window.electronAPI.onHeatmapDataResult((result) => {
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
      setIsLoading(false);
    });

    // --- [수정] 컴포넌트 언마운트 시 리스너 정리 ---
    // removeListener는 이제 항상 함수이므로 if문 없이 바로 반환합니다.
    return removeListener;
  }, []); // 이 useEffect는 한 번만 실행되도록 두는 것이 맞습니다.

  useEffect(() => {
    // folderPath가 유효할 때만 분석 실행
    if (folderPath) {
      handleAnalyze();
    } else {
      setData(null); // 폴더 경로가 없으면 데이터 초기화
    }
  }, [folderPath]);

  const handleAnalyze = () => {
    if (!folderPath) {
      setError("분석할 폴더 경로를 입력해주세요.");
      return;
    }
    setIsLoading(true);
    setError("");
    setData(null);
    window.electronAPI.generateHeatmapData(folderPath);
  };

  if (error) return <p style={{ color: "red" }}>오류: {error}</p>;
  if (isLoading) return <p>히트맵 데이터 분석 중...</p>;
  if (!data) return null; // 데이터가 없으면 아무것도 렌더링하지 않음

  return (
    <div style={{ width: "100%", height: 600, marginTop: "20px" }}>
      <ResponsiveContainer>
        <Treemap
          data={data.children}
          dataKey='loc' // 사각형 크기 기준
          aspectRatio={4 / 3}
          stroke='#fff'
          fill='#8884d8'
          content={<CustomizedContent />}>
          {/* [수정] Tooltip의 content prop에 커스텀 컴포넌트를 전달 */}
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
};

export default CodeHeatmap;
