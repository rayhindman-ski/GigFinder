import { ReplitConnectors } from "@replit/connectors-sdk";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import type { z } from "zod";
import { ListCvFilesResponse } from "@workspace/api-zod";
import { CvError } from "./cv-errors";

const connectors = new ReplitConnectors();
const MAX_BYTES = 5 * 1024 * 1024;
export const supportedCvTypes = new Set([
  "application/vnd.google-apps.document", "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/markdown",
]);
type CvFile = z.infer<typeof ListCvFilesResponse>["files"][number];
interface DriveFile {
  id: string; name: string; mimeType: string; modifiedTime?: string;
  parents?: string[]; trashed?: boolean; size?: string;
}
interface FilePage { files: DriveFile[]; nextPageToken?: string; incompleteSearch?: boolean }
const fileFields = "id,name,mimeType,modifiedTime";
const quote = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function drive(path: string): Promise<Response> {
  let response: Response;
  try {
    response = await connectors.proxy("google-drive", path, {
      method: "GET", signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new CvError(502, "Google Drive could not be reached. Please retry.");
  }
  if (!response.ok) {
    // Never forward provider error bodies; they may contain private metadata.
    if (response.status === 404) throw new CvError(404, "This Drive document is no longer available.");
    throw new CvError(502, response.status === 401 || response.status === 403
      ? "The connected Drive account could not be accessed. Check its connection in Integrations."
      : "Google Drive is unavailable or rate-limited. Please retry shortly.");
  }
  return response;
}

async function json<T>(path: string): Promise<T> {
  return (await drive(path)).json() as Promise<T>;
}

export async function connectedDriveEmail(): Promise<string> {
  const about = await json<{ user?: { emailAddress?: string } }>("/drive/v3/about?fields=user(emailAddress)");
  const email = about.user?.emailAddress?.trim().toLowerCase();
  if (!email) throw new CvError(502, "The connected Drive owner could not be verified.");
  return email;
}

export async function cvFolders(): Promise<DriveFile[]> {
  const folders: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({
      q: "trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = 'CV'",
      fields: "files(id,name,mimeType),nextPageToken,incompleteSearch",
      pageSize: "100", ...(pageToken ? { pageToken } : {}),
    });
    const page = await json<FilePage>("/drive/v3/files?" + query);
    folders.push(...page.files);
    pageToken = page.nextPageToken;
    if (folders.length > 100 || page.incompleteSearch) {
      throw new CvError(502, "Drive returned an incomplete folder search. Please retry.");
    }
  } while (pageToken);
  return folders;
}

function publicFile(file: DriveFile): CvFile {
  return {
    id: file.id, name: file.name, mimeType: file.mimeType,
    // Construct provider-only links rather than trusting arbitrary upstream URLs.
    webViewLink: `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
    modifiedTime: file.modifiedTime ?? "",
    supported: supportedCvTypes.has(file.mimeType),
  };
}

export async function listCvDocuments(search = "", pageToken?: string) {
  const folders = await cvFolders();
  if (!folders.length) return { files: [], folderCount: 0, nextPageToken: null,
    notice: "No folder named CV was found in the connected Google Drive." };
  const query = new URLSearchParams({
    q: `trashed = false and mimeType != 'application/vnd.google-apps.folder' and (${folders.map(f => `'${quote(f.id)}' in parents`).join(" or ")})${search.trim() ? ` and name contains '${quote(search.trim())}'` : ""}`,
    fields: `files(${fileFields}),nextPageToken,incompleteSearch`,
    orderBy: "modifiedTime desc", pageSize: "50", ...(pageToken ? { pageToken } : {}),
  });
  const page = await json<FilePage>("/drive/v3/files?" + query);
  return ListCvFilesResponse.parse({
    files: page.files.map(publicFile), folderCount: folders.length,
    nextPageToken: page.nextPageToken ?? null,
    notice: `${folders.length} folder${folders.length === 1 ? "" : "s"} named CV searched by filename. Direct children only; subfolders and shortcuts are not followed.${page.incompleteSearch ? " Google Drive reports some results may be missing." : ""}`,
  });
}

async function limitedBytes(response: Response): Promise<Buffer> {
  const size = Number(response.headers.get("content-length") ?? 0);
  if (size > MAX_BYTES) throw new CvError(422, "This CV is larger than the 5 MB analysis limit.");
  const reader = response.body?.getReader();
  if (!reader) throw new CvError(422, "Drive returned an empty document.");
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new CvError(422, "This CV is larger than the 5 MB analysis limit.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function readCvDocument(fileId: string): Promise<{ file: CvFile; text: string }> {
  const [folders, metadata] = await Promise.all([
    cvFolders(),
    json<DriveFile>(`/drive/v3/files/${encodeURIComponent(fileId)}?fields=${fileFields},parents,trashed,size`),
  ]);
  if (metadata.trashed || !metadata.parents?.some(id => folders.some(f => f.id === id))) {
    throw new CvError(403, "Choose a document directly inside your CV folder.");
  }
  if (!supportedCvTypes.has(metadata.mimeType)) {
    throw new CvError(422, "Use a Google Doc, text-based PDF, DOCX, plain text or Markdown CV. Images and legacy DOC files are not supported.");
  }
  if (Number(metadata.size ?? 0) > MAX_BYTES) {
    throw new CvError(422, "This CV is larger than the 5 MB analysis limit.");
  }
  const googleDoc = metadata.mimeType === "application/vnd.google-apps.document";
  const path = `/drive/v3/files/${encodeURIComponent(fileId)}` +
    (googleDoc ? "/export?mimeType=text%2Fplain" : "?alt=media");
  const buffer = await limitedBytes(await drive(path));
  let text: string;
  try {
    if (metadata.mimeType === "application/pdf") {
      const parser = new PDFParse({ data: buffer });
      try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
    } else if (metadata.mimeType.includes("wordprocessingml")) {
      text = (await mammoth.extractRawText({ buffer })).value;
    } else {
      text = buffer.toString("utf8");
    }
  } catch {
    throw new CvError(422, "This document could not be read. For scanned or password-protected PDFs, use a text-based PDF or Google Doc instead.");
  }
  text = text.replace(/\0/g, "").trim();
  if (text.replace(/\s/g, "").length < 80) {
    throw new CvError(422, "Not enough readable CV text was found. Scanned PDFs need a text layer; try Google Docs or DOCX.");
  }
  if (text.length > 120_000) {
    throw new CvError(422, "This document exceeds the 120,000 character analysis limit. Choose a shorter CV.");
  }
  return { file: publicFile(metadata), text };
}
