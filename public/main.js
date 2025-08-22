const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { glob } = require('glob'); // glob v9+는 ESM 전용이므로 CJS 호환 버전을 사용하거나 다른 방식을 써야 합니다. v7.x 버전을 사용하면 require로 바로 쓸 수 있습니다.
const JSZip = require('jszip');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default; // traverse는 default export를 가져와야 할 수 있습니다.
const isDev = require('electron-is-dev');


function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            // preload 경로는 build 폴더 기준으로 바뀌어야 합니다.
            // main.js와 preload.js가 같은 폴더에 있으므로 __dirname을 그대로 사용하면 됩니다.
            // 개발 모드에서는 'public/preload.js'를 사용하고, 배포 모드에서는 'preload.js'를 사용합니다.
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // 개발/배포 모드에 따라 URL 또는 파일 로드
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        console.log('개발 모드로 실행 중...');
    } else {
        mainWindow.loadFile(path.join(__dirname, 'index.html'));
        console.log('배포 모드로 실행 중...');
    }

    // 디버깅을 위해 개발자 도구를 강제로 엽니다.
    // 문제가 해결되면 이 줄은 지우거나 if(isDev) 안으로 옮기세요.
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
    try {

        createWindow();

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') app.quit();
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    } catch (error) {
        console.error('앱 초기화 중 오류 발생:', error);
    }


    // --- React UI로부터 요청을 받아 처리하는 메인 리스너 ---
    ipcMain.on('run-analysis', async (event, options) => {
        event.reply('analysis-status-update', '분석 요청을 접수했습니다...');
        const { analysisType, sourceMethod, keywords, targetFunction, pastedCode, folderPath, filePath, shouldExtractBlocks } = options;
        console.log('[Main Process] 분석 요청:', options);

        try {
            let filesToAnalyze = [];

            if (sourceMethod === 'folder') {
                if (!folderPath) throw new Error('폴더 경로를 입력해야 합니다.');
                event.reply('analysis-status-update', `폴더 검색 중: ${folderPath}`);
                const normalizedPath = folderPath.replace(/\\/g, '/');
                const files = glob.sync(`${normalizedPath}/**/*.{js,jsx,ts,tsx,cs,java}`);
                event.reply('analysis-status-update', `${files.length}개의 파일을 찾았습니다. 분석을 시작합니다...`);

                files.forEach(file => {
                    filesToAnalyze.push({
                        name: path.basename(file),
                        content: fs.readFileSync(file, 'utf-8')
                    });
                });

            } else if (sourceMethod === 'upload') {
                if (!filePath) throw new Error('파일을 선택해야 합니다.');
                event.reply('analysis-status-update', `파일 분석 준비 중: ${path.basename(filePath)}`);

                if (path.extname(filePath).toLowerCase() === '.zip') {
                    // [수정됨] await를 사용하여 ZIP 파일 처리가 끝날 때까지 기다립니다.
                    const zipData = fs.readFileSync(filePath);
                    const zip = await JSZip.loadAsync(zipData);

                    // for...of 루프를 사용하여 비동기 작업을 순차적으로 처리합니다.
                    for (const fileName in zip.files) {
                        const file = zip.files[fileName];
                        if (!file.dir) {
                            const content = await file.async('string');

                            // [디버깅 로그 추가] 파일 내용의 첫 200글자를 터미널에 출력합니다.
                            console.log(`--- Reading from ${file.name} ---\n`, content.substring(0, 200), '\n--- End of snippet ---');

                            filesToAnalyze.push({ name: file.name, content });
                        }
                    }
                } else {
                    // 단일 파일 처리
                    const content = fs.readFileSync(filePath, 'utf-8');
                    filesToAnalyze.push({
                        name: path.basename(filePath),
                        content: content
                    });
                }
            } else { // 'paste'
                if (!pastedCode) throw new Error('분석할 소스 코드를 입력해야 합니다.');
                filesToAnalyze.push({ name: '붙여넣은 코드', content: pastedCode });
            }
            console.log(`Electron: 총 ${filesToAnalyze.length}개의 파일을 분석합니다.`);
            processFiles(filesToAnalyze);

        } catch (error) {
            handleError(error);
        }

        function processFiles(files) {
            let fullReport = `# 📝 분석 결과\n\n`;
            let foundSomething = false;

            console.log('React: 파일이 선택되었습니다. 경로:', files);


            files.forEach(file => {
                let reportSegment = '';
                if (analysisType === 'dependency') {
                    const findings = runDependencyAnalysis(file.content, targetFunction);
                    if (findings && findings.target) {
                        foundSomething = true;
                        reportSegment += `### 🎯 타겟 함수: \`${targetFunction}\`\n\`\`\`javascript\n${findings.target}\n\`\`\`\n`;
                        if (findings.dependencies.length > 0) {
                            reportSegment += `\n#### 📞 호출하는 함수 목록\n`;
                            findings.dependencies.forEach(dep => { reportSegment += `\n* **\`${dep.name}\`**\n\`\`\`javascript\n${dep.content}\n\`\`\`\n`; });
                        }
                    }
                } else { // 'keyword'
                    const findings = runKeywordAnalysis(file.content, parseKeywords(keywords), shouldExtractBlocks);
                    if (findings) { foundSomething = true; reportSegment = findings; }
                }
                if (reportSegment) { fullReport += `## 📄 소스: ${file.name}\n${reportSegment}\n`; }
            });

            if (!foundSomething) { fullReport += '분석 결과를 찾지 못했습니다.'; }

            event.reply('analysis-status-update', '');
            event.reply('analysis-result', fullReport);
        }

        function handleError(error) {
            console.error('[Main Process] 분석 중 심각한 오류 발생:', error);
            const errorMessage = `# ❗ 오류\n\n${error.message}`;
            event.reply('analysis-status-update', '');
            event.reply('analysis-result', errorMessage);
        }
    });

    // --- 분석 로직들 ---
    const getFunctionName = (path) => {
        if (path.node.type === 'FunctionDeclaration' && path.node.id) {
            return path.node.id.name;
        }
        if ((path.node.type === 'FunctionExpression' || path.node.type === 'ArrowFunctionExpression') && path.parent.type === 'VariableDeclarator' && path.parent.id.type === 'Identifier') {
            return path.parent.id.name;
        }
        if (path.node.type === 'ClassMethod' && path.node.key.type === 'Identifier') {
            return path.node.key.name;
        }
        return null;
    };

    const runDependencyAnalysis = (code, targetFuncName) => {
        const findings = { target: null, dependencies: [] };
        try {
            const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true });
            const calledFunctionNames = new Set();
            traverse(ast, {
                Function(path) {
                    if (getFunctionName(path) === targetFuncName) {
                        if (path.node.start != null && path.node.end != null) {
                            findings.target = code.slice(path.node.start, path.node.end);
                        }
                        path.traverse({
                            CallExpression(callPath) {
                                if (callPath.node.callee.type === 'Identifier') {
                                    calledFunctionNames.add(callPath.node.callee.name);
                                }
                            }
                        });
                    }
                }
            });
            if (findings.target) {
                traverse(ast, {
                    Function(path) {
                        const funcName = getFunctionName(path);
                        if (funcName && calledFunctionNames.has(funcName) && path.node.start != null && path.node.end != null) {
                            findings.dependencies.push({ name: funcName, content: code.slice(path.node.start, path.node.end) });
                        }
                    }
                });
            }
        } catch (e) {
            console.error("AST 분석 오류:", e);
            return { target: null, dependencies: [], error: e.message };
        }
        return findings;
    };

    const parseKeywords = (keywordString) => keywordString.split(',').map(k => k.trim()).filter(Boolean);

    const extractCodeBlock = (allLines, keywordLineIndex) => {
        let blockStartLine = -1, blockEndLine = -1;
        for (let i = keywordLineIndex; i >= 0; i--) { if (allLines[i].includes('{')) { let s = i; while (s > 0) { const p = allLines[s - 1].trim(); if (p === '' || p.endsWith(';') || p.endsWith('}') || p.endsWith('{')) break; s--; } blockStartLine = s; break; } }
        if (blockStartLine === -1) return null;
        let braceCount = 0;
        for (let i = blockStartLine; i < allLines.length; i++) { for (const char of allLines[i]) { if (char === '{') braceCount++; else if (char === '}') braceCount--; } if (braceCount === 0) { blockEndLine = i; break; } }
        if (blockEndLine === -1) return null;
        return { block: allLines.slice(blockStartLine, blockEndLine + 1).join('\n') };
    };

    const runKeywordAnalysis = (content, keywordArray, shouldExtractBlocks) => {
        const lines = content.split('\n');
        let findings = '';
        const processedBlockRanges = [];
        lines.forEach((line, index) => {
            if (processedBlockRanges.some(range => index >= range.start && index <= range.end)) return;
            for (const keyword of keywordArray) {
                if (line.includes(keyword)) {
                    if (shouldExtractBlocks) {
                        const blockResult = extractCodeBlock(lines, index);
                        if (blockResult) {
                            findings += `\n---\n**[블록] 키워드 \`${keyword}\` 발견 (Line ${index + 1})**\n\`\`\`\n${blockResult.block}\n\`\`\`\n`;
                            processedBlockRanges.push({ start: blockResult.start - 1, end: blockResult.end - 1 });
                        } else {
                            findings += `- **[라인] 키워드 \`${keyword}\` 발견 (Line ${index + 1})**: \`${line.trim()}\`\n`;
                        }
                    } else {
                        findings += `- **[라인] 키워드 \`${keyword}\` 발견 (Line ${index + 1})**: \`${line.trim()}\`\n`;
                    }
                    return;
                }
            }
        });
        return findings;
    };
});