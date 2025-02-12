export interface Env {
  SLACK_BOT_API_KEY: string;
  BACKLOG_API_KEY: string;
  BACKLOG_SPACE_ID: string;
  BACKLOG_PROJECT_ID: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // 1. Backlogのチケット取得
      // クエリパラメータ構築
      const queryParams = buildQueryParams(env);
      const apiUrl = buildBacklogApiUrl(env.BACKLOG_SPACE_ID, queryParams);
      //URLのログ出力
      console.log(`Backlog API URL: ${apiUrl}`);
      return new Response(`Constructed Query URL: ${apiUrl}`);

    //   // 2. 送信メッセージの構築処理
    //   const message = formatSlackMessage(tickets);

    //   // 3. Slack Botによるメッセージ送信処理
    //   await sendSlackNotification(env, message);

    //   return new Response("Slack notification sent!", { status: 200 });
    } catch (error) {
      console.error("Error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};

// BacklogのAPIエンドポイントURLを構築
function buildBacklogApiUrl(spaceId: string, queryParams: string): string {
  return `https://${spaceId}.backlog.com/api/v2/issues?${queryParams}`;
}

// クエリパラメータの構築関数
function buildQueryParams(env: Env): string {
  const params = new URLSearchParams();
  
  // 認証キー
  params.append('apiKey', env.BACKLOG_API_KEY);
  
  // プロジェクトID（環境変数から取得）
  params.append('projectId[]', env.BACKLOG_PROJECT_ID);
  
  // ステータス（未対応のチケット）
  params.append('statusId[]', '1');
  
  // 取得件数
  params.append('count', '10');

  // ソート順（新しい順）
  params.append('sort', 'created');
  params.append('order', 'desc');

  return params.toString();
}

/**
 * チケット取得処理
 * Backlog APIはcurlでjson形式のチケット一覧を返す。
 * クエリパラメータの指定で条件に合致するチケットに絞って取得できる。
 */

/**
 * メッセージ構築処理
 * fetchBacklogTicketsで取得したチケットからメッセージを構築する。
 */

/**
 * メッセージ送信処理
 */
