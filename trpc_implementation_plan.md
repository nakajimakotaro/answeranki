# tRPC 段階的導入計画

**目標:** 現在の Express API を tRPC に移行し、クライアント・サーバー間の型安全性を向上させる。

**フェーズ 1: 準備**

1.  **依存関係のインストール:**
    *   サーバー側 (`server/`) に `@trpc/server`, `zod`, `@trpc/server/adapters/express` をインストール。
        ```bash
        cd server
        npm install @trpc/server zod @trpc/server/adapters/express
        cd ..
        ```
    *   クライアント側 (`./`) に `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, `zod` をインストール。
        ```bash
        npm install @trpc/client @trpc/react-query @tanstack/react-query zod
        ```

**フェーズ 2: サーバー側実装 (Universities API)**

1.  **tRPC 初期化:** `server/src/trpc.ts` を作成し、tRPC インスタンスとコンテキスト設定を定義。
2.  **University ルーター作成:** `server/src/routers/university.ts` を作成。
    *   `zod` を使用して `University` の入力スキーマ (作成・更新用) を定義。
    *   `getUniversities`, `createUniversity`, `updateUniversity`, `deleteUniversity` の各プロシージャを実装 (既存の `scheduleApi.ts` のロジックを移植)。
3.  **メインルーター作成:** `server/src/root.ts` (または `router.ts`) を作成し、`universityRouter` を含む `appRouter` を定義。
4.  **型エクスポート:** `appRouter` の型 (`AppRouter`) をエクスポート。
5.  **Express 統合:** `server/src/index.ts` を変更し、`/trpc` エンドポイントで tRPC ミドルウェアを使用するように設定。既存の `/api/schedule/universities` 関連のエンドポイントは削除またはコメントアウト。

**フェーズ 3: クライアント側実装 (Universities API)**

1.  **tRPC クライアント設定:** `src/renderer/lib/trpc.ts` (または `src/renderer/trpc.ts`) を作成。
    *   tRPC クライアントと React Query プロバイダーを設定。
    *   サーバーからエクスポートされた `AppRouter` 型をインポートして使用。
2.  **API 呼び出しの置換:**
    *   `src/renderer/routes/UniversitiesPage.tsx` や関連するコンポーネント/フックで、`scheduleService` を介した `fetch` 呼び出しを、tRPC クライアント (`trpc.university.getUniversities.useQuery` など) を使った呼び出しに置き換える。

**フェーズ 4: クリーンアップ (Universities API)**

1.  **不要コード削除:**
    *   `server/src/routes/scheduleApi.ts` 内の `University` interface と関連ルート定義を削除。
    *   `src/renderer/services/scheduleService.ts` 内の `University` interface と関連メソッド (`getUniversities`, `createUniversity` など) を削除。
    *   `src/renderer/types/schedule.ts` 内の `UniversityExamType` 以外の不要な型 (もしあれば) を削除。

**フェーズ 5 以降:**

*   他のエンティティ (Textbooks, Schedules, Logs, Exams など) についても、同様にフェーズ 2〜4 を繰り返します。
