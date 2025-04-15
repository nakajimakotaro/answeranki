import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../../server/src/router';

// createTRPCReact を使用して trpc オブジェクトを作成し、エクスポート
export const trpc = createTRPCReact<AppRouter>();
