import React from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { useAnalysisStore } from '../../store/analysisStore';

const DependencyGraph: React.FC = () => {
    // ✨ 스토어에서 함수 의존성 그래프와 모듈 의존성 그래프 데이터를 모두 가져옵니다.
    const functionGraph = useAnalysisStore((state) => state.graphData);
    const moduleGraph = useAnalysisStore((state) => state.moduleGraphData);

    // ✨ [수정] 표시할 그래프 데이터를 결정합니다. 모듈 그래프 데이터가 있으면 우선적으로 사용합니다.
    let nodesToDisplay: Node[] = [];
    let edgesToDisplay: Edge[] = [];

    if (moduleGraph && moduleGraph.nodes.length > 0) {
        nodesToDisplay = moduleGraph.nodes;
        edgesToDisplay = moduleGraph.edges;
    } else if (functionGraph && functionGraph.nodes.length > 0) {
        nodesToDisplay = functionGraph.nodes;
        edgesToDisplay = functionGraph.edges;
    }

    // 표시할 노드가 없으면 컴포넌트를 렌더링하지 않습니다.
    if (nodesToDisplay.length === 0) {
        return null;
    }

    return (
        <div style={{ height: '400px', border: '1px solid #ddd', borderRadius: '8px', marginTop: '20px' }}>
            <ReactFlow
                nodes={nodesToDisplay}
                edges={edgesToDisplay}
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
