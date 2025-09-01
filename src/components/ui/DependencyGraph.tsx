import React from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
// ✨ Zustand 스토어를 import 합니다.
import { useAnalysisStore } from '../../store/analysisStore';

// ✨ 더 이상 부모로부터 props를 받지 않으므로 props 인터페이스를 제거하거나 비워둡니다.
const DependencyGraph: React.FC = () => {
    // ✨ 스토어에서 직접 graphData 상태를 가져옵니다.
    const graphData = useAnalysisStore((state) => state.graphData);

    // 노드가 하나라도 있을 때만 그래프를 렌더링합니다.
    if (graphData.nodes.length === 0) {
        return null;
    }

    return (
        <div style={{ height: '400px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '20px' }}>
            <ReactFlow
                nodes={graphData.nodes}
                edges={graphData.edges}
                fitView // 그래프를 뷰에 맞게 자동으로 조절합니다.
            >
                <Background />
                <Controls />
                <MiniMap />
            </ReactFlow>
        </div>
    );
};

export default DependencyGraph;