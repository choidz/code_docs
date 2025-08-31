import { type Edge, type Node } from "reactflow";
/**
 * 의존성 분석 결과를 바탕으로 React Flow 그래프 데이터를 생성합니다.
 */
export const createDependencyGraphData = (
  target: string,
  dependencies: { name: string }[]
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeSet = new Set<string>();

  nodes.push({
    id: target,
    data: { label: target },
    position: { x: 250, y: 0 },
    type: "input",
    style: {
      backgroundColor: "#DFF4FF",
      borderColor: "#4A90E2",
      width: "auto",
      minWidth: 150,
    },
  });
  nodeSet.add(target);

  dependencies.forEach((dep, index) => {
    if (!nodeSet.has(dep.name)) {
      nodes.push({
        id: dep.name,
        data: { label: dep.name },
        position: {
          x: (index % 2) * 500,
          y: 100 + Math.floor(index / 2) * 100,
        },
        style: { width: "auto", minWidth: 150 },
      });
      nodeSet.add(dep.name);
    }
    edges.push({
      id: `e-${target}-${dep.name}`,
      source: target,
      target: dep.name,
      animated: true,
    });
  });
  return { nodes, edges };
};
