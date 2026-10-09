import { AttachmentError, AttachmentKind, CHAT_ATTACHMENT_MAX_COUNT, attachmentVerdict, type ChatAttachment } from '$lib/chat-attachments';

export enum UploadStatus {
  Uploading = 'uploading',
  Ready = 'ready',
  Failed = 'failed'
}

export type Upload = {
  id: string;
  name: string;
  bytes: number;
  kind: AttachmentKind | null;
  preview: string | null;
  progress: number;
  status: UploadStatus;
  error?: AttachmentError | 'upload_failed';
  detail?: string;
  attachment?: ChatAttachment;
};

export type UploadPorts = {
  fetch: typeof fetch;
  put: (url: string, file: File, progress: (share: number) => void) => Promise<void>;
  preview: (file: File) => string | null;
};

const HTTP_OK_MAX = 299;

function xhrPut(url: string, file: File, progress: (share: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        progress(e.loaded / e.total);
      }
    };
    xhr.onload = () => (xhr.status <= HTTP_OK_MAX ? resolve() : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error('network'));
    xhr.send(file);
  });
}

export const BROWSER_PORTS: UploadPorts = {
  fetch: (...args) => fetch(...args),
  put: xhrPut,
  preview: (file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
};

class Refusal extends Error {
  constructor(readonly code: Upload['error'], message: string) {
    super(message);
  }
}

async function posted<T>(fetcher: typeof fetch, url: string, body: unknown): Promise<T> {
  const res = await fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: AttachmentError };
  if (!res.ok) {
    throw new Refusal(data.code ?? 'upload_failed', data.error ?? '');
  }
  return data;
}

export class ChatUploads {
  items = $state<Upload[]>([]);
  readonly #base: string;
  readonly #ports: UploadPorts;

  constructor(projectId: string, ports: UploadPorts = BROWSER_PORTS) {
    this.#base = `/api/v1/projects/${projectId}/attachments`;
    this.#ports = ports;
  }

  get busy(): boolean {
    return this.items.some((u) => u.status === UploadStatus.Uploading);
  }

  get ready(): ChatAttachment[] {
    return this.items.flatMap((u) => (u.status === UploadStatus.Ready && u.attachment ? [u.attachment] : []));
  }

  add(files: readonly File[]) {
    for (const file of files) {
      const verdict = attachmentVerdict(file.type, file.name, file.size);
      const counted = this.items.filter((u) => u.status !== UploadStatus.Failed).length;
      const error = !verdict.ok ? verdict.error : counted >= CHAT_ATTACHMENT_MAX_COUNT ? AttachmentError.TooMany : undefined;
      const upload: Upload = {
        id: crypto.randomUUID(),
        name: file.name,
        bytes: file.size,
        kind: verdict.ok ? verdict.kind : null,
        preview: error ? null : this.#ports.preview(file),
        progress: 0,
        status: error ? UploadStatus.Failed : UploadStatus.Uploading,
        ...(error ? { error } : {})
      };
      this.items = [...this.items, upload];
      if (!error) {
        void this.#upload(upload.id, file);
      }
    }
  }

  remove(id: string) {
    this.items = this.items.filter((u) => u.id !== id);
  }

  clear() {
    this.items = [];
  }

  #patch(id: string, patch: Partial<Upload>) {
    this.items = this.items.map((u) => (u.id === id ? { ...u, ...patch } : u));
  }

  async #upload(id: string, file: File) {
    try {
      const signed = await posted<{ path: string; uploadUrl: string }>(this.#ports.fetch, `${this.#base}/sign`, { name: file.name, mimeType: file.type, bytes: file.size });
      await this.#ports.put(signed.uploadUrl, file, (progress) => this.#patch(id, { progress }));
      const { attachment } = await posted<{ attachment: ChatAttachment }>(this.#ports.fetch, this.#base, { path: signed.path, mimeType: file.type });
      this.#patch(id, { status: UploadStatus.Ready, progress: 1, attachment });
    } catch (e) {
      const refusal = e instanceof Refusal ? e : new Refusal('upload_failed', '');
      this.#patch(id, { status: UploadStatus.Failed, error: refusal.code, detail: refusal.message || undefined });
    }
  }
}
