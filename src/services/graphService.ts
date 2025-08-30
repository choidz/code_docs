import { type Edge, type Node, MarkerType } from "reactflow";

/**
 * 호출 계층 분석 결과를 바탕으로 React Flow 그래프 데이터를 생성합니다.
 */
export const createCallHierarchyGraphData = (
  target: string,
  callers: { name: string }[]
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeSet = new Set<string>();

  nodes.push({
    id: target,
    data: { label: target },
    position: { x: 250, y: 100 + Math.floor(callers.length / 2) * 50 },
    type: "output",
    style: {
      backgroundColor: "#FFDDC1",
      borderColor: "#FF6B6B",
      width: "auto",
      minWidth: 150,
    },
  });
  nodeSet.add(target);

  callers.forEach((caller, index) => {
    if (!nodeSet.has(caller.name)) {
      nodes.push({
        id: caller.name,
        data: { label: caller.name },
        position: { x: 0, y: index * 100 },
        style: { width: "auto", minWidth: 150 },
      });
      nodeSet.add(caller.name);
    }
    edges.push({
      id: `e-${caller.name}-${target}`,
      source: caller.name,
      target: target,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
    });
  });
  return { nodes, edges };
};

/**
 * 키워드 분석 결과를 바탕으로 React Flow 그래프 데이터를 생성합니다.
 */
export const createKeywordGraphData = (
  findings: { functionName: string; foundKeywords: string[] }[],
  keywords: string[]
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  keywords.forEach((keyword, index) => {
    nodes.push({
      id: `keyword-${keyword}`,
      data: { label: keyword },
      position: { x: index * 200, y: 0 },
      type: "input",
      style: {
        backgroundColor: "#FFFBE6",
        borderColor: "#FFC107",
        width: "auto",
        minWidth: 120,
        textAlign: "center",
      },
    });
  });
  const functionNodes = new Map<string, Node>();
  findings.forEach((finding) => {
    if (!functionNodes.has(finding.functionName)) {
      functionNodes.set(finding.functionName, {
        id: finding.functionName,
        data: { label: finding.functionName },
        position: { x: 0, y: 0 },
        style: { width: "auto", minWidth: 150 },
      });
    }
  });
  let funcNodeIndex = 0;
  functionNodes.forEach((node) => {
    node.position = { x: funcNodeIndex * 200, y: 150 };
    nodes.push(node);
    funcNodeIndex++;
  });
  findings.forEach((finding) => {
    finding.foundKeywords.forEach((keyword) => {
      edges.push({
        id: `e-keyword-${keyword}-${finding.functionName}`,
        source: `keyword-${keyword}`,
        target: finding.functionName,
      });
    });
  });
  return { nodes, edges };
};

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
