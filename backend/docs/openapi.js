// OpenAPI 3.0 spec for the public read-only API, served as interactive docs
// at /api/public/docs (swagger-ui-express). Plain JS object — no YAML build
// step, no JSDoc scanning.

const publicPostExample = {
  id: "66a1f0c2e5b4a91234567890",
  caption: "Sunset over the ghats",
  image: "https://res.cloudinary.com/demo/image/upload/v1/sunset.jpg",
  altText: "An orange sunset reflecting on a river beside stone steps",
  likeCount: 42,
  commentCount: 5,
  createdAt: "2026-07-20T18:25:43.511Z",
  author: {
    username: "mohit",
    profilePicture: "https://res.cloudinary.com/demo/image/upload/v1/mohit.jpg",
  },
};

const errorResponse = (message) => ({
  description: message,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
      example: { success: false, message },
    },
  },
});

const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "SastaGram Public API",
    version: "1.0.0",
    description: [
      "Read-only, unauthenticated API for developers building on SastaGram data.",
      "",
      "**Rate limit:** 60 requests per minute per IP across all `/api/public/v1` endpoints.",
      "Standard `RateLimit-*` headers are returned; exceeding the limit yields **429 Too Many Requests**.",
      "",
      "No API key or cookie is required. Only public data is exposed — internal fields",
      "(like/voter user ids, embeddings, emails) are never included.",
    ].join("\n"),
  },
  servers: [{ url: "/api/public/v1", description: "This deployment" }],
  tags: [
    { name: "Posts", description: "Public post feed and lookups" },
    { name: "Users", description: "Public user profiles" },
    { name: "Search", description: "Post search" },
  ],
  paths: {
    "/posts": {
      get: {
        tags: ["Posts"],
        summary: "List posts (public feed)",
        description:
          "Newest-first feed with cursor pagination. Pass the returned `nextCursor` as `cursor` to fetch the next page; `nextCursor` is `null` on the last page.",
        operationId: "listPublicPosts",
        parameters: [
          {
            name: "cursor",
            in: "query",
            required: false,
            description: "Opaque cursor (the `id` of the last post from the previous page).",
            schema: { type: "string", example: "66a1f0c2e5b4a91234567890" },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            description: "Page size (default 10, maximum 20).",
            schema: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          },
        ],
        responses: {
          200: {
            description: "A page of posts",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PostList" },
                example: {
                  success: true,
                  posts: [publicPostExample],
                  nextCursor: "66a1e9a8d4c3b81234567889",
                },
              },
            },
          },
          400: errorResponse("Invalid cursor"),
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/posts/{id}": {
      get: {
        tags: ["Posts"],
        summary: "Get a single post",
        operationId: "getPublicPost",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Post id.",
            schema: { type: "string", example: "66a1f0c2e5b4a91234567890" },
          },
        ],
        responses: {
          200: {
            description: "The post",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    post: { $ref: "#/components/schemas/PublicPost" },
                  },
                },
                example: { success: true, post: publicPostExample },
              },
            },
          },
          404: errorResponse("Post not found"),
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/users/{username}": {
      get: {
        tags: ["Users"],
        summary: "Get a public user profile",
        operationId: "getPublicUser",
        parameters: [
          {
            name: "username",
            in: "path",
            required: true,
            description: "Exact username.",
            schema: { type: "string", example: "mohit" },
          },
        ],
        responses: {
          200: {
            description: "The public profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    user: { $ref: "#/components/schemas/PublicUser" },
                  },
                },
                example: {
                  success: true,
                  user: {
                    username: "mohit",
                    bio: "Building things on the internet",
                    profilePicture:
                      "https://res.cloudinary.com/demo/image/upload/v1/mohit.jpg",
                    counts: { posts: 12, followers: 340, following: 180 },
                  },
                },
              },
            },
          },
          404: errorResponse("User not found"),
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/search/posts": {
      get: {
        tags: ["Search"],
        summary: "Search posts",
        description:
          "Semantic search over post content when AI is enabled on the deployment, otherwise a case-insensitive caption substring search. The `mode` field reports which strategy produced the results.",
        operationId: "searchPublicPosts",
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            description: "Search query. An empty query returns an empty result set.",
            schema: { type: "string", example: "sunset" },
          },
        ],
        responses: {
          200: {
            description: "Matching posts (up to 20)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SearchResults" },
                example: {
                  success: true,
                  posts: [publicPostExample],
                  mode: "text",
                },
              },
            },
          },
          429: { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
  },
  components: {
    schemas: {
      PublicAuthor: {
        type: "object",
        properties: {
          username: { type: "string", example: "mohit" },
          profilePicture: {
            type: "string",
            description: "Avatar URL (empty string when unset).",
            example:
              "https://res.cloudinary.com/demo/image/upload/v1/mohit.jpg",
          },
        },
      },
      PublicPost: {
        type: "object",
        properties: {
          id: { type: "string", example: "66a1f0c2e5b4a91234567890" },
          caption: { type: "string", example: "Sunset over the ghats" },
          image: { type: "string", description: "Image URL" },
          altText: {
            type: "string",
            description:
              "AI-generated accessibility description (empty when unavailable).",
          },
          likeCount: { type: "integer", example: 42 },
          commentCount: { type: "integer", example: 5 },
          createdAt: { type: "string", format: "date-time" },
          author: {
            allOf: [{ $ref: "#/components/schemas/PublicAuthor" }],
            nullable: true,
          },
        },
      },
      PostList: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          posts: {
            type: "array",
            items: { $ref: "#/components/schemas/PublicPost" },
          },
          nextCursor: {
            type: "string",
            nullable: true,
            description: "Cursor for the next page, or null on the last page.",
          },
        },
      },
      SearchResults: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          posts: {
            type: "array",
            items: { $ref: "#/components/schemas/PublicPost" },
          },
          mode: {
            type: "string",
            enum: ["semantic", "text"],
            description: "Which search strategy produced the results.",
          },
        },
      },
      PublicUser: {
        type: "object",
        properties: {
          username: { type: "string", example: "mohit" },
          bio: { type: "string", example: "Building things on the internet" },
          profilePicture: { type: "string" },
          counts: {
            type: "object",
            properties: {
              posts: { type: "integer", example: 12 },
              followers: { type: "integer", example: 340 },
              following: { type: "integer", example: 180 },
            },
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          message: { type: "string" },
        },
      },
    },
    responses: {
      RateLimited: {
        description:
          "Rate limit exceeded (60 requests per minute per IP). Retry after the window resets — see the RateLimit-* response headers.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
            example: {
              success: false,
              message: "Too many requests, please try again later",
            },
          },
        },
      },
    },
  },
};

export default openapiSpec;
