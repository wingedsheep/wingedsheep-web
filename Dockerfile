# Build the static site, then serve it with nginx.
# The 3D models in public/models are committed, so the build doesn't need Blender.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# lets the deploy workflow check which commit is live
ARG GIT_SHA=dev
RUN echo "$GIT_SHA" > /usr/share/nginx/html/version.txt
