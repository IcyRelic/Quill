import { getSite } from "@/lib/content";
import { publicOrigin } from "@/lib/api";

export const dynamic = "force-dynamic";

const page = {
  type: "object",
  properties: {
    slug: { type: "string", example: "guides/export-a-pdf" },
    title: { type: "string" },
    description: { type: "string" },
    draft: { type: "boolean" },
    updated: { type: "string", format: "date-time" },
    updatedBy: { type: ["string", "null"], description: "Who saved it last: a key's or connected app's name, or the admin's name" },
    url: { type: "string", description: "The page's address on the site" },
    previewUrl: { type: "string", description: "Drafts only, for callers with a key: a link anyone can open to read the draft without signing in" },
    body: { type: "string", description: "Markdown. See /components/overview for callouts, steps, tabs and accordions." },
  },
};
const pageInput = {
  type: "object",
  required: ["title"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    body: { type: "string", description: "Markdown" },
    draft: { type: "boolean" },
    group: { type: "string", description: "Sidebar group to place the page in (created if missing)." },
    folder: { type: "string", description: "Dropdown inside the group to place the page in (created if missing). Needs group." },
    position: { type: "integer", description: "Position inside the group, from 0. Default: last." },
  },
};
const keyObject = {
  type: "object",
  properties: { id: { type: "string" }, name: { type: "string" }, last4: { type: "string" }, createdAt: { type: ["string", "null"] }, lastUsedAt: { type: ["string", "null"] }, legacy: { type: "boolean" }, appId: { type: ["string", "null"] } },
};
const slugParam = { name: "slug", in: "path", required: true, schema: { type: "string" }, description: "Page slug; may contain slashes, e.g. guides/export-a-pdf" };
const err = { description: "Error", content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" } } } } } };
const ok = (schema: object, description = "OK") => ({ description, content: { "application/json": { schema } } });
const jsonBody = (schema: object) => ({ required: true, content: { "application/json": { schema } } });

export async function GET(req: Request) {
  const site = await getSite();
  const spec = {
    openapi: "3.1.0",
    info: {
      title: `${site.name} docs API`,
      version: "1.0.0",
      description:
        "Read and edit the documentation site. Reads are public (drafts excepted). Writes need `Authorization: Bearer <key>`, with keys made in the admin portal under API keys, or the token of an app connected through /api/connect (keys in the QUILL_API_KEYS environment variable also work). Changes are live as soon as the call returns.",
    },
    servers: [{ url: await publicOrigin(req) }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
    paths: {
      "/api/v1/pages": {
        get: { summary: "List pages (no bodies)", responses: { 200: ok({ type: "object", properties: { pages: { type: "array", items: page } } }) } },
        post: {
          summary: "Create a page (409 if the slug exists)",
          security: [{ bearer: [] }],
          requestBody: jsonBody({ ...pageInput, required: ["slug", "title"], properties: { slug: { type: "string" }, ...pageInput.properties } }),
          responses: { 201: ok({ type: "object", properties: { page } }, "Created"), 400: err, 401: err, 409: err },
        },
      },
      "/api/v1/pages/{slug}": {
        parameters: [slugParam],
        get: {
          summary: "Read a page",
          parameters: [{ name: "html", in: "query", schema: { type: "string" }, description: "Set to 1 to include rendered html and toc" }],
          responses: { 200: ok({ type: "object", properties: { page } }), 404: err },
        },
        put: { summary: "Create or replace a page", security: [{ bearer: [] }], requestBody: jsonBody(pageInput), responses: { 200: ok({ type: "object", properties: { page } }), 201: ok({ type: "object", properties: { page } }, "Created"), 400: err, 401: err } },
        patch: {
          summary: "Update some fields, append to the body, or move the page",
          security: [{ bearer: [] }],
          requestBody: jsonBody({ type: "object", properties: { ...pageInput.properties, appendBody: { type: "string", description: "Markdown added to the end of the body" }, newSlug: { type: "string" }, resetPreview: { type: "boolean", description: "Make a new preview link; the old one stops working" } } }),
          responses: { 200: ok({ type: "object", properties: { page } }), 400: err, 401: err, 404: err, 409: err },
        },
        delete: { summary: "Delete a page and remove it from the sidebar", security: [{ bearer: [] }], responses: { 200: ok({ type: "object", properties: { deleted: { type: "string" } } }), 401: err, 404: err } },
      },
      "/api/v1/navigation": {
        get: { summary: "The sidebar groups and their pages, in order", responses: { 200: ok({ type: "object" }) } },
        put: {
          summary: "Replace the sidebar",
          security: [{ bearer: [] }],
          requestBody: jsonBody({
            type: "object",
            properties: {
              navigation: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    pages: {
                      type: "array",
                      description: "Page slugs in order. An object makes a dropdown in the sidebar.",
                      items: { oneOf: [{ type: "string" }, { type: "object", properties: { title: { type: "string" }, pages: { type: "array", items: { type: "string" } } } }] },
                    },
                  },
                },
              },
            },
          }),
          responses: { 200: ok({ type: "object" }), 400: err, 401: err },
        },
      },
      "/api/v1/site": {
        get: { summary: "Site settings (name, top bar links, home page, footer, logo, favicon, theme colours)", responses: { 200: ok({ type: "object" }) } },
        patch: {
          summary: "Merge some settings (objects one level deep). theme.colors holds hex colours changed from the defaults; {} resets them.",
          security: [{ bearer: [] }],
          requestBody: jsonBody({ type: "object" }),
          responses: { 200: ok({ type: "object" }), 400: err, 401: err },
        },
        put: { summary: "Replace all settings", security: [{ bearer: [] }], requestBody: jsonBody({ type: "object" }), responses: { 200: ok({ type: "object" }), 400: err, 401: err } },
      },
      "/api/v1/search": {
        get: { summary: "Search published pages", parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }], responses: { 200: ok({ type: "object" }) } },
      },
      "/api/v1/preview": {
        post: { summary: "Render Markdown without saving", security: [{ bearer: [] }], requestBody: jsonBody({ type: "object", properties: { body: { type: "string" } } }), responses: { 200: ok({ type: "object", properties: { html: { type: "string" }, toc: { type: "array" } } }), 401: err } },
      },
      "/api/v1/uploads": {
        get: { summary: "List uploaded files", security: [{ bearer: [] }], responses: { 200: ok({ type: "object" }), 401: err } },
        post: {
          summary: "Upload an image, video or PDF (up to 15 MB)",
          security: [{ bearer: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } },
              "application/json": { schema: { type: "object", properties: { name: { type: "string" }, data: { type: "string", description: "base64" } } } },
            },
          },
          responses: { 201: ok({ type: "object", properties: { upload: { type: "object", properties: { url: { type: "string" } } } } }, "Created"), 400: err, 401: err },
        },
      },
      "/api/v1/uploads/{name}": {
        delete: { summary: "Delete an uploaded file", security: [{ bearer: [] }], parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" } }], responses: { 200: ok({ type: "object" }), 401: err, 404: err } },
      },
      "/api/connect/start": {
        post: {
          summary: "Start connecting an app. No key needed; an admin approves the returned code at verify_url.",
          requestBody: jsonBody({ type: "object", properties: { client_name: { type: "string", example: "InkBot on DESKTOP-X" } } }),
          responses: {
            200: ok({ type: "object", properties: { code: { type: "string", example: "ABCD-2345" }, secret: { type: "string" }, verify_url: { type: "string" }, expires_in: { type: "integer", example: 900 }, interval: { type: "integer", example: 3 } } }),
            429: err,
          },
        },
      },
      "/api/connect/poll": {
        post: {
          summary: "Poll a connection request. 202 pending, 200 approved (token returned once), 403 denied, 410 expired, unknown or already collected.",
          requestBody: jsonBody({ type: "object", required: ["code", "secret"], properties: { code: { type: "string" }, secret: { type: "string" } } }),
          responses: {
            200: ok({ type: "object", properties: { token: { type: "string" }, site: { type: "object", properties: { name: { type: "string" } } }, user: { type: "object", properties: { name: { type: "string" } } } } }),
            202: ok({ type: "object", properties: { status: { type: "string", example: "pending" } } }, "Waiting for an admin"),
            403: err,
            410: err,
          },
        },
      },
      "/api/connect": {
        delete: { summary: "Disconnect this app (its own token) and revoke every key it issued", security: [{ bearer: [] }], responses: { 200: ok({ type: "object", properties: { disconnected: { type: "boolean" } } }), 401: err, 403: err } },
      },
      "/api/v1/connection/keys": {
        get: { summary: "Keys this connected app issued (app token only)", security: [{ bearer: [] }], responses: { 200: ok({ type: "object", properties: { keys: { type: "array", items: keyObject } } }), 401: err, 403: err } },
        post: {
          summary: "Issue a key for one of the app's bots (app token only). secret is shown once.",
          security: [{ bearer: [] }],
          requestBody: jsonBody({ type: "object", required: ["name"], properties: { name: { type: "string", example: "InkBot: Juniper" } } }),
          responses: { 201: ok({ type: "object", properties: { key: keyObject, secret: { type: "string" } } }, "Created"), 400: err, 401: err, 403: err },
        },
      },
      "/api/v1/connection/keys/{id}": {
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        patch: { summary: "Rename one of this app's keys", security: [{ bearer: [] }], requestBody: jsonBody({ type: "object", properties: { name: { type: "string" } } }), responses: { 200: ok({ type: "object", properties: { key: keyObject } }), 401: err, 403: err, 404: err } },
        delete: { summary: "Revoke one of this app's keys", security: [{ bearer: [] }], responses: { 200: ok({ type: "object", properties: { revoked: { type: "string" } } }), 401: err, 403: err, 404: err } },
      },
    },
  };
  return Response.json(spec);
}
