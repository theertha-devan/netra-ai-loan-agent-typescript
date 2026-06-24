export interface UploadFile {
  filename: string;
  mime_type: string;
  data: string;
}

export interface ChatRequest {
  prompt: string;
  thread_id?: string | null;
  files?: UploadFile[] | null;
}
