import ts from "typescript";
import fs from "fs";
import { z } from "zod"; // Zod をインポート（型推論のため）

// --- 型ノードを Zod スキーマ文字列に変換するヘルパー関数 ---

/**
 * TypeScript の TypeNode を Zod スキーマを表す文字列に変換します。
 * @param typeNode 変換対象の TypeNode。
 * @param sourceFile TypeNode が属する SourceFile。
 * @returns Zod スキーマを表す文字列 (例: "z.string()", "z.object({...})")。
 */
function typeNodeToZodSchemaString(typeNode, sourceFile) {
    if (!typeNode) {
        return "z.unknown()"; // 型ノードがない場合
    }

    // --- プリミティブ型 ---
    if (ts.isToken(typeNode)) {
        switch (typeNode.kind) {
            case ts.SyntaxKind.NumberKeyword:
                return "z.number()";
            case ts.SyntaxKind.StringKeyword:
                return "z.string()";
            case ts.SyntaxKind.BooleanKeyword:
                return "z.boolean()";
            case ts.SyntaxKind.NullKeyword:
                return "z.null()";
            case ts.SyntaxKind.UndefinedKeyword:
                return "z.undefined()";
            case ts.SyntaxKind.VoidKeyword:
                return "z.undefined()"; // Promise<void> -> undefined
            case ts.SyntaxKind.AnyKeyword:
            case ts.SyntaxKind.UnknownKeyword:
                return "z.unknown()";
            default:
                return `z.unknown() /* Unhandled primitive kind: ${ts.SyntaxKind[typeNode.kind]} */`;
        }
    }
    // --- 配列型 ---
    else if (ts.isArrayTypeNode(typeNode)) {
        const elementType = typeNodeToZodSchemaString(typeNode.elementType, sourceFile);
        return `z.array(${elementType})`;
    }
    // --- タプル型 ---
    else if (ts.isTupleTypeNode(typeNode)) {
        // 要素が NamedTupleMember かどうかをチェックし、型 (el.type) を取得
        const elementTypes = typeNode.elements.map(el => {
            const typeToConvert = ts.isNamedTupleMember(el) ? el.type : el;
            return typeNodeToZodSchemaString(typeToConvert, sourceFile);
        });
        return `z.tuple([${elementTypes.join(", ")}])`;
    }
    // --- 型参照 ---
    else if (ts.isTypeReferenceNode(typeNode)) {
        const typeName = typeNode.typeName.getText(sourceFile);

        if (typeName === "Array" && typeNode.typeArguments && typeNode.typeArguments.length === 1) {
            const elementType = typeNodeToZodSchemaString(typeNode.typeArguments[0], sourceFile);
            return `z.array(${elementType})`;
        } else if (typeName === "Promise" && typeNode.typeArguments && typeNode.typeArguments.length === 1) {
            return typeNodeToZodSchemaString(typeNode.typeArguments[0], sourceFile);
        } else if (typeName === "Record" && typeNode.typeArguments && typeNode.typeArguments.length === 2) {
            const keyType = typeNodeToZodSchemaString(typeNode.typeArguments[0], sourceFile);
            const valueType = typeNodeToZodSchemaString(typeNode.typeArguments[1], sourceFile);
            if (keyType === "z.string()" || keyType === "z.number()" || keyType.startsWith("z.enum")) {
                return `z.record(${keyType}, ${valueType})`;
            } else {
                console.warn(`Unsupported key type for Record: ${keyType}. Falling back to z.record(z.string(), ...)`);
                return `z.record(z.string(), ${valueType}) /* Original key type: ${keyType} */`;
            }
        } else {
            const basicTypes = ["number", "string", "boolean", "null", "undefined", "void", "any", "unknown"];
            if (basicTypes.includes(typeName)) {
                return typeNodeToZodSchemaString(ts.createKeywordTypeNode(ts.SyntaxKind[`${typeName.charAt(0).toUpperCase() + typeName.slice(1)}Keyword`]), sourceFile);
            }
            // カスタム型 -> nameSchema (先頭小文字)
            return `${typeName.charAt(0).toLowerCase() + typeName.slice(1)}Schema`;
        }
    }
    // --- オブジェクトリテラル型 ---
    else if (ts.isTypeLiteralNode(typeNode)) {
        const properties = typeNode.members.map(member => {
            if (ts.isPropertySignature(member) && member.name && member.type) {
                const name = member.name.getText(sourceFile);
                const propertyName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : `"${name}"`;
                const typeString = typeNodeToZodSchemaString(member.type, sourceFile);
                const optional = member.questionToken ? ".optional()" : "";
                return `${propertyName}: ${typeString}${optional}`;
            }
            return null;
        }).filter(p => p !== null).join(",\n            ");
        return `z.object({\n            ${properties}\n        })`;
    }
    // --- ユニオン型 ---
    else if (ts.isUnionTypeNode(typeNode)) {
        const typeStrings = typeNode.types.map(t => typeNodeToZodSchemaString(t, sourceFile));
        const hasNull = typeStrings.includes("z.null()");
        const hasUndefined = typeStrings.includes("z.undefined()");
        const nonNullableOrUndefinedTypes = typeStrings.filter(t => t !== "z.null()" && t !== "z.undefined()");

        let schemaString = "";
        if (nonNullableOrUndefinedTypes.length === 1) {
            schemaString = nonNullableOrUndefinedTypes[0];
        } else if (nonNullableOrUndefinedTypes.length > 1) {
            schemaString = `z.union([${nonNullableOrUndefinedTypes.join(", ")}])`;
        } else {
            if (hasNull && hasUndefined) schemaString = "z.union([z.null(), z.undefined()])";
            else if (hasNull) schemaString = "z.null()";
            else if (hasUndefined) schemaString = "z.undefined()";
            else schemaString = "z.unknown()";
        }

        if (hasNull && hasUndefined) {
            if (schemaString !== "z.union([z.null(), z.undefined()])") {
                schemaString += ".nullable().optional()";
            }
        } else if (hasNull) {
            if (schemaString !== "z.null()") {
                schemaString += ".nullable()";
            }
        } else if (hasUndefined) {
            if (schemaString !== "z.undefined()") {
                schemaString += ".optional()";
            }
        }
        return schemaString;
    }
    // --- リテラル型 ---
    else if (ts.isLiteralTypeNode(typeNode)) {
        const literal = typeNode.literal;
        if (ts.isStringLiteral(literal)) {
            return `z.literal(${JSON.stringify(literal.text)})`;
        } else if (ts.isNumericLiteral(literal)) {
            return `z.literal(${literal.text})`;
        } else if (literal.kind === ts.SyntaxKind.TrueKeyword) {
            return `z.literal(true)`;
        } else if (literal.kind === ts.SyntaxKind.FalseKeyword) {
            return `z.literal(false)`;
        } else if (literal.kind === ts.SyntaxKind.NullKeyword) {
            return `z.null()`;
        } else {
            return `z.unknown() /* Unhandled literal kind: ${ts.SyntaxKind[literal.kind]} */`;
        }
    }
    // --- 交差型 (Intersection Type) ---
    else if (ts.isIntersectionTypeNode(typeNode)) {
        const typeStrings = typeNode.types.map(t => typeNodeToZodSchemaString(t, sourceFile));

        if (typeStrings.length === 0) {
            return "z.unknown()";
        }
        if (typeStrings.length === 1) {
            return typeStrings[0];
        }

        let baseSchema = `z.intersection(${typeStrings[0]}, ${typeStrings[1]})`;
        for (let i = 2; i < typeStrings.length; i++) {
            baseSchema += `.and(${typeStrings[i]})`;
        }
        return baseSchema;
    }
    // --- 括弧付きの型 ---
    else if (ts.isParenthesizedTypeNode(typeNode)) {
        return typeNodeToZodSchemaString(typeNode.type, sourceFile);
    }
    // --- 関数型 ---
    else if (ts.isFunctionTypeNode(typeNode)) {
        return `z.function()`; // tRPC では通常使わない
    }

    // --- 未対応の型 ---
    console.warn(`Unhandled type kind: ${ts.SyntaxKind[typeNode.kind]} Text: ${typeNode.getText(sourceFile)}`);
    return `z.unknown() /* Unhandled type kind: ${ts.SyntaxKind[typeNode.kind]} */`;
}

// --- tRPC ルーターコード生成関数 ---

function generateTrpcRouterCode(classDefinition, outputPath = './server/src/routers/generatedRouter.ts') {
    const sourceFile = ts.createSourceFile(
        "temp.d.ts", // ファイル名を .d.ts にして declare class を正しく解釈させる
        classDefinition,
        ts.ScriptTarget.Latest,
        true // setParentNodes
    );

    let allRoutersCode = "";
    const imports = new Set(); // インポートする Zod スキーマ名を保持 (ただし動的生成はしない)

    // --- ヘルパー関数: 型ノードからカスタム型名を抽出 ---
    function extractCustomTypeNames(typeNode, sourceFile, currentImports) {
        if (!typeNode) return;

        if (ts.isTypeReferenceNode(typeNode)) {
            const typeName = typeNode.typeName.getText(sourceFile);
            const basicTypes = ["Array", "Promise", "Record", "number", "string", "boolean", "null", "undefined", "void", "any", "unknown"];
            if (!basicTypes.includes(typeName)) {
                // カスタム型名を Set に追加 (先頭小文字 + Schema)
                currentImports.add(`${typeName.charAt(0).toLowerCase() + typeName.slice(1)}Schema`);
            }
            if (typeNode.typeArguments) {
                typeNode.typeArguments.forEach(arg => extractCustomTypeNames(arg, sourceFile, currentImports));
            }
        } else if (ts.isArrayTypeNode(typeNode)) {
            extractCustomTypeNames(typeNode.elementType, sourceFile, currentImports);
        } else if (ts.isTupleTypeNode(typeNode)) {
            // 要素が NamedTupleMember かどうかをチェックし、型 (el.type) を取得
            typeNode.elements.forEach(el => {
                const typeToExtract = ts.isNamedTupleMember(el) ? el.type : el;
                extractCustomTypeNames(typeToExtract, sourceFile, currentImports);
            });
        } else if (ts.isTypeLiteralNode(typeNode)) {
            typeNode.members.forEach(member => {
                if (ts.isPropertySignature(member) && member.type) {
                    extractCustomTypeNames(member.type, sourceFile, currentImports);
                }
            });
        } else if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
            typeNode.types.forEach(t => extractCustomTypeNames(t, sourceFile, currentImports));
        } else if (ts.isParenthesizedTypeNode(typeNode)) {
            extractCustomTypeNames(typeNode.type, sourceFile, currentImports);
        }
    }


    // --- ヘルパー関数: プロパティシグネチャを処理して tRPC プロシージャコードを生成 ---
     function processPropertySignature(memberName, memberTypeNode, sourceFile, ankiConnectObjectName) {
         if (!ts.isFunctionTypeNode(memberTypeNode)) {
             console.warn(`Member ${memberName} is not a function type, skipping.`);
             return "";
         }

         const skipMethodNames = ["loadProfile", "importPackage", "exportPackage", "requestPermission", "insertReviews", "multi"];
         // 特定のメソッドをスキップする
         if(skipMethodNames.includes(memberName)) {
            console.warn(`Member ${memberName} is not supported, skipping.`);
            return "";
         }

         console.log(`Processing method: ${ankiConnectObjectName}.${memberName}`);

         let inputSchemaString = "z.undefined()";
         let outputSchemaString = "z.unknown()";
         let procedureType = 'query';

         // --- 入力スキーマ (input) の解析 ---
         if (memberTypeNode.parameters.length === 1) {
             const param = memberTypeNode.parameters[0];
             if (param.type) {
                 extractCustomTypeNames(param.type, sourceFile, imports); // カスタム型名を抽出
                 inputSchemaString = typeNodeToZodSchemaString(param.type, sourceFile);
             } else {
                 inputSchemaString = "z.unknown() /* Parameter type not found */";
             }
         } else if (memberTypeNode.parameters.length === 0) {
             inputSchemaString = "z.undefined()";
         } else {
             console.warn(`Method ${ankiConnectObjectName}.${memberName} has multiple parameters. tRPC requires a single input object or void/undefined. Falling back to z.unknown().`);
             inputSchemaString = "z.unknown() /* Multiple parameters not directly supported */";
         }
         // --- 出力スキーマ (output) の解析 ---
         if(memberName ==="guiCurrentCard") {
            outputSchemaString = `guiCurrentCardSchema`;
         } else if (memberName === "cardsInfo") {
            outputSchemaString = `z.array(cardInfoSchema)`;
         } else if (memberTypeNode.type && ts.isTypeReferenceNode(memberTypeNode.type) && memberTypeNode.type.typeName.getText(sourceFile) === "Promise") {
             if (memberTypeNode.type.typeArguments && memberTypeNode.type.typeArguments.length === 1) {
                 const returnTypeNode = memberTypeNode.type.typeArguments[0];
                 extractCustomTypeNames(returnTypeNode, sourceFile, imports); // カスタム型名を抽出
                 outputSchemaString = typeNodeToZodSchemaString(returnTypeNode, sourceFile);
             } else {
                 outputSchemaString = "z.undefined()"; // Promise<void> -> undefined
             }
         } else {
             console.warn(`Method ${ankiConnectObjectName}.${memberName} does not return a Promise. Output schema might be incorrect.`);
             if (memberTypeNode.type) {
                 extractCustomTypeNames(memberTypeNode.type, sourceFile, imports); // カスタム型名を抽出
                 outputSchemaString = typeNodeToZodSchemaString(memberTypeNode.type, sourceFile);
             } else {
                 outputSchemaString = "z.unknown() /* Return type not found */";
             }
         }

         // --- プロシージャタイプ (query/mutation) の決定 ---
         const mutationPrefixes = ["add", "update", "delete", "remove", "set", "answer", "forget",
             "relearn", "create", "save", "store", "change", "clone", "reload", "sync"
            ];
         if (mutationPrefixes.some(prefix => memberName.toLowerCase().startsWith(prefix))) {
             procedureType = 'mutation';
         }
         if (memberName === "suspend" || memberName === "unsuspend") {
             procedureType = 'mutation';
         }
         if (memberName.startsWith("gui") && memberName !== "guiCurrentCard" && memberName !== "guiSelectedNotes") {
             procedureType = 'mutation';
         }

         // --- tRPC プロシージャコードの生成 ---
         return `
    ${memberName}: publicProcedure
        .input(${inputSchemaString})
        .output(${outputSchemaString})
        .${procedureType}(async ({ input }) => {
            const result = await ankiConnect.${ankiConnectObjectName}.${memberName}(${inputSchemaString === "z.undefined()" ? "" : "input"});
            return result;
        }),
`;
     }


    // --- YankiConnect クラス定義を走査 ---
    ts.forEachChild(sourceFile, node => {
        if (ts.isClassDeclaration(node) && node.name?.getText(sourceFile) === "YankiConnect") {
            node.members.forEach(member => {
                if (ts.isPropertyDeclaration(member) &&
                    member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ReadonlyKeyword) &&
                    ts.isIdentifier(member.name) &&
                    member.type &&
                    ts.isTypeLiteralNode(member.type)) {

                    const objectName = member.name.getText(sourceFile);
                    const typeLiteral = member.type;
                    let proceduresCode = "";

                    console.log(`\nProcessing object: ${objectName}`);
                    if(objectName === "model") {
                        console.log(`Object ${objectName} is not supported, skipping.`);
                        return;
                    }

                    typeLiteral.members.forEach(objectMember => {
                        if (ts.isPropertySignature(objectMember) && objectMember.name && ts.isIdentifier(objectMember.name) && objectMember.type) {
                            const methodName = objectMember.name.getText(sourceFile);
                            const methodTypeNode = objectMember.type;
                            proceduresCode += processPropertySignature(methodName, methodTypeNode, sourceFile, objectName);
                        } else {
                            // JSDocコメントなどは無視
                            if (!ts.isJSDoc(objectMember)) {
                                console.warn(`Skipping non-method member in ${objectName}: ${objectMember.getText(sourceFile)}`);
                            }
                        }
                    });


                    if (proceduresCode) {
                        const routerName = `${objectName}Router`;
                        allRoutersCode += `
// --- ${objectName.charAt(0).toUpperCase() + objectName.slice(1)} Router Definition ---
export const ${routerName} = router({${proceduresCode}
});\n`;
                    }
                }
            });
        }
    });

    const trpcRouterCode = `/* eslint-disable @typescript-eslint/no-unused-vars */
// This file is auto-generated by a script. Do not edit manually.
// Generated based on YankiConnect class definition.

import { z } from 'zod';
import { publicProcedure, router } from '../trpc.js';
import { YankiConnect } from 'yanki-connect';
import { cardInfoSchema, noteSchema, cardBrowserColumnsSchema } from '../generated/ankiConnectSchemas.js';

const ankiConnect = new YankiConnect();

const guiCurrentCardSchema = z.object({
  cardId: z.number().int(), // カードID (整数)
  fields: z.record(z.string(), z.object({
  value: z.string(), // フィールドの値（HTML文字列を含む）
  order: z.number().int(), // フィールドの順序を示す整数
})),
  fieldOrder: z.number().int(), // カードの順序 (整数)
  question: z.string(), // 質問面の内容 (HTML文字列を含む)
  answer: z.string(), // 回答面の内容 (HTML文字列を含む)
  buttons: z.array(z.number().int()), // 表示されるボタンの番号リスト (整数の配列)
  nextReviews: z.array(z.string()), // 各ボタンに対応する次回のレビュー間隔を示す文字列の配列
  modelName: z.string(), // カードモデル名
  deckName: z.string(), // デッキ名
  css: z.string(), // カードに適用されるCSS
  template: z.string(), // 使用されているテンプレート名
})

  const cardInfoSchema = z.object({
  cardId: z.number().describe("Unique identifier for the card"),
  fields: z.record(z.string(), z.any()).describe("An object containing the card's field data. Keys are field names, values can be of any type (represented as [Object] in the example)."),
  fieldOrder: z.number().int().describe("The order index of this card template within its model."),
  question: z.string().describe("The HTML content for the question side of the card."),
  answer: z.string().describe("The HTML content for the answer side of the card."),
  modelName: z.string().describe("The name of the note type (model) this card belongs to."),
  ord: z.number().int().describe("Alias for fieldOrder, representing the card template number (0-indexed)."),
  deckName: z.string().describe("The name of the deck this card belongs to."),
  css: z.string().describe("The CSS styling associated with the card's model."),
  factor: z.number().int().describe("The ease factor of the card, multiplied by 10 (e.g., 2500 represents 250%)."),
  interval: z.number().int().describe("The current interval between reviews in days."),
  note: z.number().describe("The identifier of the note this card belongs to."),
  type: z.number().int().describe("Card type: 0=new, 1=learning, 2=review, 3=relearning."),
  queue: z.number().int().describe("Queue state: -3=sched buried, -2=user buried, -1=suspended, 0=new, 1=learning, 2=review, 3=day learn, 4=preview."),
  due: z.number().int().describe("Due date: For review/relearning cards, it's days since deck creation. For new cards, it's the Order ID. For learning cards, it's a timestamp."),
  reps: z.number().int().describe("Number of times the card has been reviewed."),
  lapses: z.number().int().describe("Number of times the card went from review to learning (failed)."),
  left: z.number().int().describe("Reviews left today (for learning cards) or sequential display order."),
  mod: z.number().describe("Modification timestamp (seconds since epoch)."),
  nextReviews: z.array(z.string()).describe("An array of strings representing potential next review intervals (this might be specific to a client/add-on)."),
  flags: z.number().int().describe("Integer representing card flags (0-7).")
});

${allRoutersCode}

`;

    // ファイルへの書き込み
    try {
        const outputDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, trpcRouterCode.trim(), 'utf-8');
        console.log(`tRPC router code written to ${outputPath}`);
        // 抽出されたカスタムスキーマ名を表示
        if (imports.size > 0) {
             console.log("\nDetected custom schemas (ensure these are imported):");
             console.log(Array.from(imports).sort().join(', '));
        }
    } catch (error) {
        console.error(`Error writing file to ${outputPath}:`, error);
    }

    return trpcRouterCode.trim();
}

// --- 実行例 ---
const yankiConnectClassDefinitionPath = './node_modules/yanki-connect/dist/index.d.ts'; // 型定義ファイルのパス
const outputPath = './server/src/routers/anki.ts'; // 出力ファイルパス

const yankiConnectClassDefinition = fs.readFileSync(yankiConnectClassDefinitionPath, 'utf-8');
generateTrpcRouterCode(yankiConnectClassDefinition, outputPath);