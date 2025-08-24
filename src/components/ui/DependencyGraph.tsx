import React from 'react';
// reactflow와 기본 스타일을 가져옵니다.
import ReactFlow, { Background, Controls, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';

// React Flow가 요구하는 데이터 타입입니다.
interface DependencyGraphProps {
    nodes: Node[];
    edges: Edge[];
}

const DependencyGraph: React.FC<DependencyGraphProps> = ({ nodes, edges }) => {
    if (!nodes || nodes.length === 0) {
        return null; // 데이터가 없으면 렌더링하지 않습니다.
    }

    return (
    <div style={{ height: '100%', width: '100%' }}>
        <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
        >
            <Background />
            <Controls />
        </ReactFlow>
    </div>
);
};

export default DependencyGraph;