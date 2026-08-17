FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:24-slim
WORKDIR /app

# Optional system dependencies for convert_pdf_to_text / convert_docx_to_text /
# convert_xlsx_to_text and `search-files --content`. Remove this layer if you
# don't need those tools available remotely — the MCP server itself works
# without them.
RUN apt-get update && apt-get install -y --no-install-recommends \
      poppler-utils \
      docx2txt \
      gnumeric \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/cli.js", "mcp", "--http"]
