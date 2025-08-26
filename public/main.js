const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { glob } = require("glob");
const JSZip = require("jszip");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const isDev = require("electron-is-dev");

/**
 * Electron 애플리케이션의 메인 윈도우를 생성하고 설정하는 함수입니다.
 */
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // preload 스크립트를 지정하여 main 프로세스와 renderer 프로세스 간의 안전한 통신을 설정합니다.
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // 개발 모드와 배포 모드를 구분하여 다른 URL/파일을 로드합니다.
  if (isDev) {
    // 개발 모드: React 개발 서버 URL을 로드합니다.
    mainWindow.loadURL("http://localhost:3000");
  } else {
    // 배포 모드: 빌드된 React 앱의 index.html 파일을 로드합니다.
    mainWindow.loadFile(path.join(__dirname, "index.html"));
  }
}

// Electron 앱이 준비되면 윈도우를 생성하고 IPC 리스너를 설정합니다.
app.whenReady().then(() => {
  createWindow();

  // macOS를 제외한 모든 플랫폼에서 창이 닫히면 앱을 종료합니다.
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  // macOS에서 독 아이콘을 클릭했을 때 창이 없으면 새로 생성합니다.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  /**
   * React(Renderer) 프로세스로부터 'run-analysis' 이벤트를 수신하는 메인 리스너입니다.
   * 모든 분석 요청의 시작점 역할을 합니다.
   * @param {IpcMainEvent} event - IPC 이벤트 객체
   * @param {object} options - React UI로부터 전달받은 분석 옵션 객체
   */
  ipcMain.on("run-analysis", async (event, options) => {
    // 분석 시작을 UI에 알립니다.
    event.reply("analysis-status-update", "분석 요청을 접수했습니다...");
    const {
      analysisType,
      sourceMethod,
      keywords,
      targetFunction,
      pastedCode,
      folderPath,
      filePath,
      shouldExtractBlocks,
    } = options;

    try {
      // 분석할 파일들의 내용을 담을 배열을 초기화합니다.
      let filesToAnalyze = [];

      // 1. 소스 위치에 따라 분석할 파일 목록을 준비합니다.
      if (sourceMethod === "folder") {
        if (!folderPath) throw new Error("폴더 경로를 입력해야 합니다.");
        event.reply("analysis-status-update", `폴더 검색 중: ${folderPath}`);
        const normalizedPath = folderPath.replace(/\\/g, "/");
        // glob 라이브러리를 사용하여 지정된 폴더 내의 모든 소스 파일을 재귀적으로 찾습니다.
        const files = glob.sync(
          `${normalizedPath}/**/*.{js,jsx,ts,tsx,cs,java}`
        );
        event.reply(
          "analysis-status-update",
          `${files.length}개의 파일을 찾았습니다. 분석을 시작합니다...`
        );

        files.forEach((file) => {
          filesToAnalyze.push({
            name: path.basename(file),
            content: fs.readFileSync(file, "utf-8"),
          });
        });
      } else if (sourceMethod === "upload") {
        if (!filePath) throw new Error("파일을 선택해야 합니다.");
        event.reply(
          "analysis-status-update",
          `파일 분석 준비 중: ${path.basename(filePath)}`
        );

        // 업로드된 파일이 ZIP 파일인 경우
        if (path.extname(filePath).toLowerCase() === ".zip") {
          const zipData = fs.readFileSync(filePath);
          const zip = await JSZip.loadAsync(zipData);

          // ZIP 파일 내의 모든 파일을 순회하며 압축을 해제하고 내용을 읽습니다.
          for (const fileName in zip.files) {
            const file = zip.files[fileName];
            if (!file.dir) {
              const content = await file.async("string");
              filesToAnalyze.push({ name: file.name, content });
            }
          }
        } else {
          // 단일 파일인 경우
          const content = fs.readFileSync(filePath, "utf-8");
          filesToAnalyze.push({
            name: path.basename(filePath),
            content: content,
          });
        }
      } else {
        // 'paste' (붙여넣기)
        if (!pastedCode) throw new Error("분석할 소스 코드를 입력해야 합니다.");
        filesToAnalyze.push({ name: "붙여넣은 코드", content: pastedCode });
      }

      // 2. 준비된 파일 목록을 가지고 실제 분석을 수행합니다.
      processFiles(filesToAnalyze);
    } catch (error) {
      handleError(error);
    }

    /**
     * 파일 목록을 받아 순회하며 선택된 분석 타입에 맞는 분석을 실행하고,
     * 최종 보고서를 생성하여 UI로 전송합니다.
     * @param {Array<{name: string, content: string}>} files - 분석할 파일 정보 배열
     */
    function processFiles(files) {
      let fullReport = `# 📝 분석 결과\n\n`;
      let foundSomething = false;

      files.forEach((file) => {
        let reportSegment = "";
        // 분석 타입에 따라 다른 분석 함수를 호출합니다.
        if (analysisType === "dependency") {
          const findings = runDependencyAnalysis(file.content, targetFunction);
          if (findings && findings.target) {
            foundSomething = true;
            reportSegment += `### 🎯 타겟 함수: \`${targetFunction}\`\n\`\`\`javascript\n${findings.target}\n\`\`\`\n`;
            if (findings.dependencies.length > 0) {
              reportSegment += `\n#### 📞 호출하는 함수 목록\n`;
              findings.dependencies.forEach((dep) => {
                reportSegment += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`;
              });
            }
          }
        } else {
          // 'keyword'
          const findings = runKeywordAnalysis(
            file.content,
            parseKeywords(keywords),
            shouldExtractBlocks
          );
          if (findings) {
            foundSomething = true;
            reportSegment = findings;
          }
        }
        if (reportSegment) {
          fullReport += `## 📄 소스: ${file.name}\n${reportSegment}\n`;
        }
      });

      if (!foundSomething) {
        fullReport += "분석 결과를 찾지 못했습니다.";
      }

      // 최종 분석 결과를 UI로 전송합니다.
      event.reply("analysis-status-update", "");
      event.reply("analysis-result", fullReport);
    }

    /**
     * 분석 과정에서 발생한 에러를 처리하고 UI에 오류 메시지를 전송합니다.
     * @param {Error} error - 발생한 에러 객체
     */
    function handleError(error) {
      console.error("[Main Process] 분석 중 심각한 오류 발생:", error);
      const errorMessage = `# ❗ 오류\n\n${error.message}`;
      event.reply("analysis-status-update", "");
      event.reply("analysis-result", errorMessage);
    }
  });

  /**
   * Babel AST 노드에서 다양한 형태의 함수 이름을 추출하는 헬퍼 함수입니다.
   * @param {NodePath} path - Babel Traverse의 현재 노드 경로
   * @returns {string|null} 추출된 함수 이름 또는 null
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
    if (
      path.node.type === "ClassMethod" &&
      path.node.key.type === "Identifier"
    ) {
      return path.node.key.name;
    }
    return null;
  };

  /**
   * 주어진 코드에서 특정 함수의 의존성을 분석하는 핵심 로직입니다.
   * @param {string} code - 분석할 소스 코드
   * @param {string} targetFuncName - 의존성을 찾을 대상 함수의 이름
   * @returns {{target: string|null, dependencies: Array<{name: string, content: string}>}} 분석 결과
   */
  const runDependencyAnalysis = (code, targetFuncName) => {
    const findings = { target: null, dependencies: [] };
    try {
      // 코드를 AST(추상 구문 트리)로 변환합니다.
      const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
        errorRecovery: true,
      });
      const calledFunctionNames = new Set();

      // 1. AST를 순회하여 타겟 함수를 찾고, 그 안에서 호출되는 함수들의 이름을 수집합니다.
      traverse(ast, {
        Function(path) {
          if (getFunctionName(path) === targetFuncName) {
            if (path.node.start != null && path.node.end != null) {
              findings.target = code.slice(path.node.start, path.node.end);
            }
            path.traverse({
              CallExpression(callPath) {
                if (callPath.node.callee.type === "Identifier") {
                  calledFunctionNames.add(callPath.node.callee.name);
                }
              },
            });
          }
        },
      });

      // 2. 타겟 함수를 찾았다면, AST를 다시 순회하여 호출된 함수들의 실제 소스 코드를 찾습니다.
      if (findings.target) {
        traverse(ast, {
          Function(path) {
            const funcName = getFunctionName(path);
            if (
              funcName &&
              calledFunctionNames.has(funcName) &&
              path.node.start != null &&
              path.node.end != null
            ) {
              findings.dependencies.push({
                name: funcName,
                content: code.slice(path.node.start, path.node.end),
              });
            }
          },
        });
      }
    } catch (e) {
      console.error("AST 분석 오류:", e);
      return { target: null, dependencies: [], error: e.message };
    }
    return findings;
  };

  /**
   * 콤마로 구분된 키워드 문자열을 배열로 변환합니다.
   * @param {string} keywordString - 사용자가 입력한 키워드 문자열
   * @returns {string[]} 공백이 제거된 키워드 배열
   */
  const parseKeywords = (keywordString) =>
    keywordString
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

  /**
   * 키워드가 발견된 라인을 기준으로 해당 코드가 포함된 전체 블록(함수 등)을 추출하는 함수입니다.
   * @param {string[]} allLines - 전체 코드 라인 배열
   * @param {number} keywordLineIndex - 키워드가 발견된 라인의 인덱스
   * @returns {{block: string}|null} 추출된 코드 블록 또는 null
   */
  const extractCodeBlock = (allLines, keywordLineIndex) => {
    let blockStartLine = -1,
      blockEndLine = -1;
    // 위로 올라가며 블록의 시작점을 찾습니다.
    for (let i = keywordLineIndex; i >= 0; i--) {
      if (allLines[i].includes("{")) {
        let s = i;
        while (s > 0) {
          const p = allLines[s - 1].trim();
          if (p === "" || p.endsWith(";") || p.endsWith("}") || p.endsWith("{"))
            break;
          s--;
        }
        blockStartLine = s;
        break;
      }
    }
    if (blockStartLine === -1) return null;

    // 아래로 내려가며 여는 괄호와 닫는 괄호의 개수를 맞춰 블록의 끝점을 찾습니다.
    let braceCount = 0;
    for (let i = blockStartLine; i < allLines.length; i++) {
      for (const char of allLines[i]) {
        if (char === "{") braceCount++;
        else if (char === "}") braceCount--;
      }
      if (braceCount === 0) {
        blockEndLine = i;
        break;
      }
    }
    if (blockEndLine === -1) return null;

    return {
      block: allLines.slice(blockStartLine, blockEndLine + 1).join("\n"),
    };
  };

  /**
   * 주어진 코드에서 키워드를 검색하는 핵심 로직입니다.
   * @param {string} content - 분석할 소스 코드
   * @param {string[]} keywordArray - 검색할 키워드 배열
   * @param {boolean} shouldExtractBlocks - 전체 블록을 추출할지 여부
   * @returns {string} 분석 결과를 담은 Markdown 문자열
   */
  const runKeywordAnalysis = (content, keywordArray, shouldExtractBlocks) => {
    const lines = content.split("\n");
    let findings = "";
    const processedBlockRanges = [];
    lines.forEach((line, index) => {
      // 이미 처리된 블록에 속한 라인은 건너뜁니다.
      if (
        processedBlockRanges.some(
          (range) => index >= range.start && index <= range.end
        )
      )
        return;
      for (const keyword of keywordArray) {
        if (line.includes(keyword)) {
          if (shouldExtractBlocks) {
            const blockResult = extractCodeBlock(lines, index);
            if (blockResult) {
              findings += `\n---\n**[블록] 키워드 \`${keyword}\` 발견 (Line ${
                index + 1
              })**\n\`\`\`\n${blockResult.block}\n\`\`\`\n`;
              processedBlockRanges.push({
                start: blockResult.start - 1,
                end: blockResult.end - 1,
              });
            } else {
              findings += `- **[라인] 키워드 \`${keyword}\` 발견 (Line ${
                index + 1
              })**: \`${line.trim()}\`\n`;
            }
          } else {
            findings += `- **[라인] 키워드 \`${keyword}\` 발견 (Line ${
              index + 1
            })**: \`${line.trim()}\`\n`;
          }
          return; // 한 라인에서 키워드를 찾으면 다음 라인으로 넘어갑니다.
        }
      }
    });
    return findings;
  };
});
