/**
 * 任务元数据
 */
export interface JobStartMetaDataPayload {
  // 若上传文件
  file?: {
    name: string;
    readUrl: string;
    mimeType: string;
  };
  // 若使用 url 解析
  url?: string;
  // 需求描述
  description?: string;
}
