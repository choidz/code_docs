import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { getFunctionName } from "./analysis"; // 테스트할 함수를 가져옵니다.

// 'describe'는 관련된 테스트들을 하나의 그룹으로 묶어줍니다.
describe("getFunctionName", () => {
    // 'it' (또는 'test')은 개별 테스트 케이스를 정의합니다.
    // 케이스 이름은 "어떤 상황에서 ~을 해야 한다" 처럼 서술적으로 작성하는 것이 좋습니다.
    it("일반적인 함수 선언(Function Declaration)의 이름을 올바르게 추출해야 한다", () => {
        // 1. 테스트용 코드 조각 준비
        const code = `function myFunction() { console.log('hello'); }`;
        const ast = parser.parse(code);

        let functionPath: NodePath<t.Function> | null = null;

        // 2. Babel Traverse를 이용해 테스트에 필요한 'path' 객체를 얻습니다.
        traverse(ast, {
            FunctionDeclaration(path) {
                functionPath = path;
            },
        });

        // 3. 실제 함수를 실행하고 결과를 확인합니다.
        if (functionPath) {
            const functionName = getFunctionName(functionPath);
            // 'expect(결과).toBe(기대값)' 구문으로 결과가 기대와 같은지 검증합니다.
            expect(functionName).toBe("myFunction");
        } else {
            // path를 찾지 못했다면 테스트를 강제로 실패시킵니다.
            fail("테스트할 함수 경로를 찾지 못했습니다.");
        }
    });

    // ✨ 다양한 케이스에 대한 테스트를 추가합니다.
    it("화살표 함수(Arrow Function) 변수 할당의 이름을 올바르게 추출해야 한다", () => {
        const code = `const myArrowFunction = () => {};`;
        const ast = parser.parse(code);
        let functionPath: NodePath<t.Function> | null = null;

        traverse(ast, {
            ArrowFunctionExpression(path) {
                functionPath = path;
            },
        });

        if (functionPath) {
            const functionName = getFunctionName(functionPath);
            expect(functionName).toBe("myArrowFunction");
        } else {
            fail("테스트할 함수 경로를 찾지 못했습니다.");
        }
    });

    it("클래스 메서드(Class Method)의 이름을 올바르게 추출해야 한다", () => {
        const code = `class MyClass { myMethod() {} }`;
        const ast = parser.parse(code, { plugins: ["typescript"] }); // 클래스 문법 지원
        let functionPath: NodePath<t.Function> | null = null;

        traverse(ast, {
            ClassMethod(path) {
                functionPath = path;
            },
        });

        if (functionPath) {
            const functionName = getFunctionName(functionPath);
            expect(functionName).toBe("myMethod");
        } else {
            fail("테스트할 함수 경로를 찾지 못했습니다.");
        }
    });

    it("객체 속성 함수(Object Property Function)의 이름을 올바르게 추출해야 한다", () => {
        const code = `const myObject = { myFunc: function() {} };`;
        const ast = parser.parse(code);
        let functionPath: NodePath<t.Function> | null = null;

        traverse(ast, {
            FunctionExpression(path) {
                // 객체 속성에 할당된 함수만 찾도록 필터링
                if (t.isObjectProperty(path.parent)) {
                    functionPath = path;
                }
            },
        });

        if (functionPath) {
            const functionName = getFunctionName(functionPath);
            expect(functionName).toBe("myFunc");
        } else {
            fail("테스트할 함수 경로를 찾지 못했습니다.");
        }
    });
});