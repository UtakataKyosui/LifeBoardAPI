import { NotionApiClient } from "./notion-api.client.ts";

export type NotionEnv = Record<string, string | undefined>;

export const NOTION_ENV = {
	token: "NOTION_TOKEN",
	routine: "NOTION_ROUTINE_DATA_SOURCE_ID",
	execution: "NOTION_EXECUTION_DATA_SOURCE_ID",
	adjustment: "NOTION_ADJUSTMENT_DATA_SOURCE_ID",
} as const;

/**
 * 環境変数から client と対象データソース ID を作る。トークンまたは ID が無ければ undefined を返し、
 * 呼び出し側は「未設定」の既定実装にフォールバックする。
 */
export function resolveNotion(
	source: "routine" | "execution" | "adjustment",
	env: NotionEnv = process.env,
): { api: NotionApiClient; dataSourceId: string } | undefined {
	const token = env[NOTION_ENV.token];
	const dataSourceId = env[NOTION_ENV[source]];
	if (!token || !dataSourceId) return undefined;
	return { api: new NotionApiClient({ token }), dataSourceId };
}
