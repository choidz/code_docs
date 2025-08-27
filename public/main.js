const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { glob } = require("glob");
const JSZip = require("jszip");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const isDev = require("electron-is-dev");

// =================================================================
// ✨ 1. 모든 헬퍼 함수를 파일 최상단으로 이동 (구조 정리)
// =================================================================

/**
 * Babel AST 노드에서 다양한 형태의 함수 이름을 추출하는 헬퍼 함수입니다.
 */
const getFunctionName = (path) => {
  if (path.node.type === "FunctionDeclaration" && path.node.id) {
    return path.node.id.name;
  }
  if (
    (path.node.type === "FunctionExpression" ||
      path.node.type === "ArrowFunctionExpression") &&
    path.parent.type === "VariableDeclarator" &&
    path.parent.id.type === "Identifier"
  ) {
    return path.parent.id.name;
  }
  if (path.node.type === "ClassMethod" && path.node.key.type === "Identifier") {
    return path.node.key.name;
  }
  // ExtJS 스타일의 객체 속성 함수 선언을 위한 지원 추가
  if (
    path.node.type === "FunctionExpression" &&
    path.parent.type === "ObjectProperty" &&
    path.parent.key.type === "Identifier"
  ) {
    return path.parent.key.name;
  }
  return null;
};

/**
 * 코드의 복잡도를 간단하게 측정하는 함수입니다.
 */
const calculateComplexity = (code) => {
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
 * 콤마로 구분된 키워드 문자열을 배열로 변환합니다.
 */
const parseKeywords = (keywordString) =>
  keywordString
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

/**
 * [최신 버전] 의존성 분석 함수 (obj.method() 호출 지원)
 */
const runDependencyAnalysis = (code, targetFuncName) => {
  const findings = { target: null, dependencies: [] };
  try {
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true,
    });
    const calledFunctionNames = new Set();
    const processedDeps = new Set();
    traverse(ast, {
      Function(path) {
        if (getFunctionName(path) === targetFuncName) {
          findings.target = code.slice(path.node.start, path.node.end);
          path.traverse({
            CallExpression(callPath) {
              const callee = callPath.node.callee;
              if (callee.type === "Identifier") {
                calledFunctionNames.add(callee.name);
              } else if (
                callee.type === "MemberExpression" &&
                callee.property.type === "Identifier"
              ) {
                calledFunctionNames.add(callee.property.name);
              }
            },
          });
        }
      },
    });
    if (findings.target) {
      traverse(ast, {
        Function(path) {
          const funcName = getFunctionName(path);
          if (
            funcName &&
            calledFunctionNames.has(funcName) &&
            !processedDeps.has(funcName)
          ) {
            findings.dependencies.push({
              name: funcName,
              content: code.slice(path.node.start, path.node.end),
            });
            processedDeps.add(funcName);
          }
        },
      });
    }
  } catch (e) {
    console.error("AST 의존성 분석 오류:", e);
  }
  return findings;
};

/**
 * [최신 버전] 호출 계층 분석 함수 (path.findParent 사용)
 */
const runCallHierarchyAnalysis = (code, targetFuncName) => {
  const callers = [];
  const processedFuncs = new Set();
  try {
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true,
    });
    traverse(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        let calleeName = null;
        if (callee.type === "Identifier") calleeName = callee.name;
        else if (
          callee.type === "MemberExpression" &&
          callee.property.type === "Identifier"
        )
          calleeName = callee.property.name;

        if (calleeName === targetFuncName) {
          const parentFunctionPath = path.findParent((p) => p.isFunction());
          if (parentFunctionPath && parentFunctionPath.isFunction()) {
            const callerName = getFunctionName(parentFunctionPath);
            if (callerName && !processedFuncs.has(callerName)) {
              callers.push({
                name: callerName,
                content: code.slice(
                  parentFunctionPath.node.start,
                  parentFunctionPath.node.end
                ),
              });
              processedFuncs.add(callerName);
            }
          }
        }
      },
    });
  } catch (e) {
    console.error("호출 계층 분석 오류:", e);
  }
  return { target: targetFuncName, callers };
};

/**
 * [최신 버전] AST 기반 키워드 분석 함수
 */
const runAdvancedKeywordAnalysis = (code, keywordArray) => {
  const findings = [];
  const lowerCaseKeywords = keywordArray.map((k) => k.toLowerCase());
  try {
    const ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true,
    });
    traverse(ast, {
      Function(path) {
        const functionName = getFunctionName(path);
        if (!functionName) return;
        const functionContent = code.slice(path.node.start, path.node.end);
        const lowerCaseContent = functionContent.toLowerCase();
        const foundKeywords = new Set();
        lowerCaseKeywords.forEach((keyword, index) => {
          if (lowerCaseContent.includes(keyword)) {
            foundKeywords.add(keywordArray[index]);
          }
        });
        if (
          foundKeywords.size > 0 &&
          !findings.some((f) => f.functionName === functionName)
        ) {
          findings.push({
            functionName,
            foundKeywords: Array.from(foundKeywords),
            content: functionContent,
          });
        }
      },
    });
  } catch (e) {
    console.error("AST 기반 키워드 분석 오류:", e);
  }
  return findings;
};

// =================================================================
// ✨ 2. Electron 앱 생명주기 및 IPC 핸들러
// =================================================================

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(__dirname, "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // --- 분석 실행 메인 리스너 ---
  ipcMain.on("run-analysis", async (event, options) => {
    event.reply("analysis-status-update", "분석 요청을 접수했습니다...");
    const {
      analysisType,
      sourceMethod,
      keywords,
      targetFunction,
      pastedCode,
      folderPath,
      filePath,
    } = options;
    try {
      let filesToAnalyze = [];
      if (sourceMethod === "folder") {
        if (!folderPath) throw new Error("폴더 경로를 입력해야 합니다.");
        const normalizedPath = folderPath.replace(/\\/g, "/");
        const files = glob.sync(
          `${normalizedPath}/**/*.{js,jsx,ts,tsx,cs,java}`
        );
        files.forEach((file) => {
          filesToAnalyze.push({
            name: path.basename(file),
            content: fs.readFileSync(file, "utf-8"),
          });
        });
      } else if (sourceMethod === "upload") {
        if (!filePath) throw new Error("파일을 선택해야 합니다.");
        if (path.extname(filePath).toLowerCase() === ".zip") {
          const zipData = fs.readFileSync(filePath);
          const zip = await JSZip.loadAsync(zipData);
          for (const fileName in zip.files) {
            const file = zip.files[fileName];
            if (!file.dir) {
              const content = await file.async("string");
              filesToAnalyze.push({ name: file.name, content });
            }
          }
        } else {
          filesToAnalyze.push({
            name: path.basename(filePath),
            content: fs.readFileSync(filePath, "utf-8"),
          });
        }
      } else {
        if (!pastedCode) throw new Error("분석할 소스 코드를 입력해야 합니다.");
        filesToAnalyze.push({ name: "붙여넣은 코드", content: pastedCode });
      }

      processFiles(filesToAnalyze);
    } catch (error) {
      handleError(error);
    }

    function processFiles(files) {
      const finalResult = {
        analysisType,
        target: targetFunction,
        findings: [],
        sourceFiles: files.map((f) => f.name),
      };
      files.forEach((file) => {
        if (analysisType === "dependency") {
          const findings = runDependencyAnalysis(file.content, targetFunction);
          if (findings && findings.target) {
            finalResult.findings.push({ file: file.name, ...findings });
          }
        } else if (analysisType === "callHierarchy") {
          const findings = runCallHierarchyAnalysis(
            file.content,
            targetFunction
          );
          if (findings && findings.callers.length > 0) {
            finalResult.findings.push({ file: file.name, ...findings });
          }
        } else {
          const findings = runAdvancedKeywordAnalysis(
            file.content,
            parseKeywords(keywords)
          );
          if (findings && findings.length > 0) {
            finalResult.findings.push({ file: file.name, results: findings });
          }
        }
      });
      event.reply("analysis-result", finalResult);
    }

    function handleError(error) {
      console.error("[Main Process] 분석 중 오류 발생:", error);
      event.reply("analysis-result", { error: error.message });
    }
  });

  // --- 히트맵 생성 리스너 ---
  ipcMain.on("generate-heatmap-data", async (event, folderPath) => {
    // ... 기존 히트맵 로직은 안정적이므로 그대로 유지 ...
    if (!folderPath) {
      event.reply("heatmap-data-result", { error: "폴더 경로가 필요합니다." });
      return;
    }
    try {
      const normalizedPath = folderPath.replace(/\\/g, "/");
      const files = glob.sync(`${normalizedPath}/**/*.{js,jsx,ts,tsx,cs,java}`);
      const root = { name: path.basename(normalizedPath), children: [] };
      for (const file of files) {
        const relativePath = path
          .relative(normalizedPath, file)
          .replace(/\\/g, "/");
        const parts = relativePath.split("/");
        let currentNode = root;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          let childNode = currentNode.children.find(
            (child) => child.name === part && child.children
          );
          if (!childNode) {
            childNode = { name: part, children: [] };
            currentNode.children.push(childNode);
          }
          currentNode = childNode;
        }
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n").length;
        const complexity = calculateComplexity(content);
        currentNode.children.push({
          name: parts[parts.length - 1],
          loc: lines,
          complexity: complexity,
        });
      }
      event.reply("heatmap-data-result", root);
    } catch (error) {
      console.error("히트맵 데이터 생성 오류:", error);
      event.reply("heatmap-data-result", { error: error.message });
    }
  });
});
