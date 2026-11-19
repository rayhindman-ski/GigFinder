export type CvErrorContext = 'access' | 'files' | 'select' | 'session' | 'assess';

export interface CvErrorInfo { status: number | null; message: string; expired: boolean }

export function describeCvError(e: unknown, ctx: CvErrorContext): CvErrorInfo {
  const status = typeof (e as { status?: unknown })?.status === 'number' ? (e as { status: number }).status : null;
  const data = (e as { data?: unknown })?.data;
  const serverMsg = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string' ? (data as { error: string }).error : null;
  const expired = status === 404 && (ctx === 'session' || (ctx === 'assess' && /cv session/i.test(serverMsg ?? '')));
  let message: string;
  switch (status) {
    case 401: message = 'Your sign-in is no longer valid. Sign in again to continue.'; break;
    case 403: message = serverMsg ?? 'This account is not permitted to use the private CV workspace.'; break;
    case 404:
      message = expired
        ? 'This CV session has expired or the server restarted. Select your CV again to continue.'
        : serverMsg ?? (ctx === 'select' ? 'That file could not be found in a CV folder.' : ctx === 'assess' ? 'This role is no longer in the available feed. Run a new scan and pick it again.' : 'Not found.');
      break;
    case 429: message = serverMsg ? `${serverMsg} Wait a little, then retry.` : 'Rate limit reached. Wait a little, then retry.'; break;
    case 502:
      message = serverMsg ?? (ctx === 'select' ? 'The document could not be read or analysed. Scanned PDFs and images cannot be extracted.' : 'An upstream service (Drive or the AI model) failed. Retry in a moment.');
      break;
    default:
      message = serverMsg ?? (e instanceof Error && e.message ? e.message : 'The request failed.');
  }
  return { status, message, expired };
}
