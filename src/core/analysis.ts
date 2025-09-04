import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

// --- 타입 정의 ---

export interface DependencyInfo {
  name: string;
  content: string;
  file: string; // ✨ 소스 파일명을 저장하기 위한 속성 추가
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
  // case 4: myFunc: function() {}  또는  myFunc: () => {}
  if (
    (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) &&
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
    return Math.max(1, Math.round(code.split("\n").length / 10));
  }
  return complexity;
};

/**
 * 여러 파일에 걸쳐 특정 함수(`targetFuncName`)가 호출하는 다른 함수들의 목록을 분석합니다.
 */
export const runDependencyAnalysis = (
  files: { name: string; content: string }[],
  targetFuncName: string
): DependencyAnalysisResult | null => {
  const findings: DependencyAnalysisResult = { target: null, dependencies: [] };
  const calledFunctionNames = new Set<string>();

  const asts = files.map((file) => {
    try {
      return parser.parse(file.content, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
      });
    } catch (e) {
      console.error(`Error parsing ${file.name}:`, e);
      return null;
    }
  });

  // 1단계: 모든 AST를 순회하며 타겟 함수를 찾고, 내부에서 호출되는 함수 이름들을 수집합니다.
  asts.forEach((ast, index) => {
    if (!ast) return;
    const fileContent = files[index].content;

    traverse(ast, {
      Function(path: NodePath<t.Function>) {
        if (getFunctionName(path) === targetFuncName) {
          path.stop();

          if (path.node.start != null && path.node.end != null) {
            findings.target = fileContent.slice(
              path.node.start,
              path.node.end
            );
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
  });

  // 2단계: 타겟 함수를 찾았다면, 모든 AST를 다시 순회하여 호출된 함수들의 소스 코드를 찾습니다.
  if (findings.target) {
    asts.forEach((ast, index) => {
      if (!ast) return;
      const fileContent = files[index].content;

      traverse(ast, {
        Function(path: NodePath<t.Function>) {
          const funcName = getFunctionName(path);
          if (
            funcName &&
            funcName !== targetFuncName &&
            calledFunctionNames.has(funcName)
          ) {
            if (!findings.dependencies.some((dep) => dep.name === funcName)) {
              if (path.node.start != null && path.node.end != null) {
                findings.dependencies.push({
                  name: funcName,
                  content: fileContent.slice(path.node.start, path.node.end),
                  file: files[index].name, // ✨ 의존성이 발견된 파일의 이름을 추가합니다.
                });
              }
            }
          }
        },
      });
    });
  }

  if (!findings.target) {
    return null;
  }

  return findings;
};

