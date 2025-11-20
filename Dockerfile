FROM node:24.11.1-alpine3.22 AS base
WORKDIR /app

# By copying only the package.json and package-lock.json here, we ensure that the following `-deps` steps are independent of the source code.
# Therefore, the `-deps` steps will be skipped if only the source code changes.
COPY package.json package-lock.json ./

FROM base AS prod-deps
RUN npm install --omit=dev

FROM base AS build-deps
RUN npm install

FROM build-deps AS build
COPY . .
RUN npm run build

FROM base AS runtime

# Install tini for signal handling
RUN apk add --no-cache tini

# Create non-root user for security
RUN addgroup -S appuser && adduser -S -G appuser -u 1001 appuser

# Copy dependencies and build artifacts with correct ownership
COPY --from=prod-deps --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/dist ./dist

# Switch to non-root user
USER appuser

ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "./dist/server/entry.mjs"]