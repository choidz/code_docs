// core/analysis.ts

import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

// --- 타입 정의 ---

export interface DependencyInfo {
  name: string;
  content: string;
}

export interface DependencyAnalysisResult {
  target: string | null;
  dependencies: DependencyInfo[];
}

// --- 헬퍼 함수 ---

/**
 * Babel AST 노드에서 다양한 형태의 함수 이름을 추출합니다.
 */
export const getFunctionName = (path: NodePath<t.Function>): string | null => {
  const node = path.node;
  // case 1: function myFunction() {}
  if (t.isFunctionDeclaration(node) && node.id) {
    return node.id.name;
  }
  // case 2: const myFunction = () => {}
  if (
    (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) &&
    t.isVariableDeclarator(path.parent) &&
    t.isIdentifier(path.parent.id)
  ) {
    return path.parent.id.name;
  }
  // case 3: class MyClass { myFunction() {} }
  if (t.isClassMethod(node) && t.isIdentifier(node.key)) {
    return node.key.name;
  }
  // case 4: myFunc: function() {} (ExtJS 스타일)
  if (
    t.isFunctionExpression(node) &&
    t.isObjectProperty(path.parent) &&
    t.isIdentifier(path.parent.key)
  ) {
    return path.parent.key.name;
  }
  return null;
};

/**
 * 코드의 복잡도를 간단하게 측정합니다. (Cyclomatic Complexity 유사)
 */
export const calculateComplexity = (code: string): number => {
  let complexity = 1;
  try {
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true,
    });
    traverse(ast, {
      IfStatement() {
        complexity++;
      },
      ForStatement() {
        complexity++;
      },
      WhileStatement() {
        complexity++;
      },
      DoWhileStatement() {
        complexity++;
      },
      SwitchCase() {
        complexity++;
      },
      ConditionalExpression() {
        complexity++;
      },
      LogicalExpression(path) {
        if (path.node.operator === "&&" || path.node.operator === "||") {
          complexity++;
        }
      },
    });
  } catch (e) {
    // 파싱 실패 시 라인 수 기반으로 대략적인 복잡도 추정
    return Math.max(1, Math.round(code.split("\n").length / 10));
  }
  return complexity;
};

/**
 * 특정 함수(`targetFuncName`)가 호출하는 다른 함수들의 목록을 분석합니다.
 */
export const runDependencyAnalysis = (
  code: string,
  targetFuncName: string
): DependencyAnalysisResult | null => {
  const findings: DependencyAnalysisResult = { target: null, dependencies: [] };
  try {
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true,
    });
    const calledFunctionNames = new Set<string>();

    traverse(ast, {
      Function(path: NodePath<t.Function>) {
        if (getFunctionName(path) === targetFuncName) {
          if (path.node.start != null && path.node.end != null) {
            findings.target = code.slice(path.node.start, path.node.end);
          }
          path.traverse({
            CallExpression(callPath: NodePath<t.CallExpression>) {
              const callee = callPath.node.callee;
              if (
                t.isMemberExpression(callee) &&
                t.isIdentifier(callee.property)
              ) {
                calledFunctionNames.add(callee.property.name);
              } else if (t.isIdentifier(callee)) {
                calledFunctionNames.add(callee.name);
              }
            },
          });
        }
      },
    });

    if (findings.target) {
      traverse(ast, {
        Function(path: NodePath<t.Function>) {
          const funcName = getFunctionName(path);
          if (funcName && calledFunctionNames.has(funcName)) {
            if (!findings.dependencies.some((dep) => dep.name === funcName)) {
              if (path.node.start != null && path.node.end != null) {
                findings.dependencies.push({
                  name: funcName,
                  content: code.slice(path.node.start, path.node.end),
                });
              }
            }
          }
        },
      });
    }
  } catch (e) {
    console.error("AST 의존성 분석 오류:", e);
    return null;
  }
  return findings;
};
