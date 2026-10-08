import { PublishRefusal } from '$lib/gallery/refusals';
import { PublishError } from './publish';
import { RemixError } from './remix';
import { INVALID_META } from './service';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE = 422;
const HTTP_BAD_GATEWAY = 502;

const PUBLISH_STATUS: Readonly<Record<string, number>> = {
  [INVALID_META]: HTTP_BAD_REQUEST,
  [PublishError.NotFound]: HTTP_NOT_FOUND,
  [PublishError.MissingAsset]: HTTP_CONFLICT,
  [PublishError.Moderated]: HTTP_UNPROCESSABLE,
  ...Object.fromEntries(Object.values(PublishRefusal).map((r) => [r, HTTP_UNPROCESSABLE]))
};

export const REMIX_STATUS: Readonly<Record<RemixError, number>> = {
  [RemixError.NotFound]: HTTP_NOT_FOUND,
  [RemixError.ProjectNotFound]: HTTP_NOT_FOUND,
  [RemixError.CanvasNotFound]: HTTP_NOT_FOUND,
  [RemixError.ForeignFile]: HTTP_BAD_GATEWAY,
  [RemixError.NotSaved]: HTTP_BAD_GATEWAY
};

export const publishStatus = (error: string) => PUBLISH_STATUS[error] ?? HTTP_UNPROCESSABLE;
